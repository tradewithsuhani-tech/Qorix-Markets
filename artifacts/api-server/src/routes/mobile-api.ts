/**
 * Mobile API adapters — Flutter-friendly path aliases and field-name bridges.
 *
 * Existing /api/* routes keep their current shape (web compatibility).
 * This file exposes the same underlying operations at the paths and with the
 * request/response shapes the Flutter developer's spec requires.
 *
 * Paths added here:
 *   GET  /deposit/inr/merchants        — alias for GET /payment-methods
 *   POST /deposit/inr/submit           — alias for POST /inr-deposits (remapped fields)
 *   POST /wallet/withdraw/inr          — alias for POST /inr-withdrawals (remapped fields)
 *                                        + supports payoutMethod "qorix_user"
 */

import { Router } from "express";
import {
  db,
  walletsTable,
  usersTable,
  paymentMethodsTable,
  inrDepositsTable,
  inrWithdrawalsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { isSmokeTestUser } from "../lib/smoke-test-account";
import { verifyOtp, sendTxnEmailToUser } from "../lib/email-service";
import { getWithdrawalCaps } from "../lib/withdrawal-caps";
import { checkWithdrawDeviceCooldown } from "../lib/withdraw-device-cooldown";
import { NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS } from "./wallet";
import { WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE } from "./auth";
import { createNotification } from "../lib/notifications";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForTransaction,
} from "../lib/ledger-service";
import { transactionLogger, errorLogger } from "../lib/logger";
import {
  notifyAllActiveMerchantsOfNewWithdrawal,
  notifyOwnerMerchantOfNewDeposit,
} from "../lib/escalation-cron";

const router = Router();

async function getInrRate(): Promise<number> {
  const rows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "inr_to_usdt_rate"))
    .limit(1);
  const n = Number(rows[0]?.value ?? "99");
  return Number.isFinite(n) && n > 0 ? n : 99;
}

// ── GET /deposit/inr/merchants ───────────────────────────────────────────────
// Flutter alias for GET /payment-methods.
// ?method=upi|net_banking|imps_neft  filters by payment type
// ?amount=<INR>                      optional capacity / bracket filter
router.get("/deposit/inr/merchants", authMiddleware, async (req: AuthRequest, res) => {
  const methodFilter = String(req.query["method"] ?? "").toLowerCase();
  const internalType =
    methodFilter === "upi"
      ? "upi"
      : methodFilter === "net_banking" ||
          methodFilter === "imps_neft" ||
          methodFilter === "bank"
        ? "bank"
        : null;

  const amountRaw = req.query["amount"];
  const amount =
    amountRaw != null && Number.isFinite(Number(amountRaw)) && Number(amountRaw) > 0
      ? Number(amountRaw)
      : null;

  const rate = await getInrRate();

  const conditions: any[] = [eq(paymentMethodsTable.isActive, true)];
  if (internalType) conditions.push(eq(paymentMethodsTable.type, internalType));
  if (amount) {
    conditions.push(sql`${paymentMethodsTable.minAmount}::numeric <= ${amount}`);
    conditions.push(sql`${paymentMethodsTable.maxAmount}::numeric >= ${amount}`);
  }

  const methods = await db
    .select()
    .from(paymentMethodsTable)
    .where(and(...conditions))
    .orderBy(paymentMethodsTable.sortOrder, paymentMethodsTable.id);

  res.json({
    merchants: methods.map((m) => ({
      id: m.id,
      type: m.type,
      displayName: m.displayName,
      upiId: m.upiId,
      accountHolder: m.accountHolder,
      accountNumber: m.accountNumber,
      ifsc: m.ifsc,
      bankName: m.bankName,
      qrImageBase64: m.qrImageBase64,
      minAmount: parseFloat(m.minAmount as string),
      maxAmount: parseFloat(m.maxAmount as string),
      instructions: m.instructions,
    })),
    rate,
  });
});

// ── POST /deposit/inr/submit ─────────────────────────────────────────────────
// Flutter alias for POST /inr-deposits.
// Flutter body : { amount, method, merchantId, utr, referenceCode }
// Internal map : amount → amountInr
//                merchantId → paymentMethodId
//                referenceCode → utr (accepted as alias; if both present, utr wins)
router.post("/deposit/inr/submit", authMiddleware, async (req: AuthRequest, res) => {
  if (await isSmokeTestUser(req.userId!)) {
    res.status(403).json({
      error: "smoke_test_account_blocked",
      message: "INR deposits are disabled for the smoke-test account.",
    });
    return;
  }

  const body = req.body ?? {};

  const paymentMethodId = Number(body.merchantId ?? body.paymentMethodId);
  const amountInr = Number(body.amount ?? body.amountInr);
  const utr = String(body.utr ?? body.referenceCode ?? "").trim();
  const proofImageBase64 =
    typeof body.proofImageBase64 === "string" ? body.proofImageBase64 : null;

  if (!Number.isFinite(paymentMethodId) || paymentMethodId <= 0) {
    res.status(400).json({ error: "invalid_merchant_id", message: "Valid merchantId is required." });
    return;
  }
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    res.status(400).json({ error: "invalid_amount", message: "amount must be a positive number." });
    return;
  }
  if (utr.length < 6 || utr.length > 100) {
    res.status(400).json({
      error: "invalid_utr",
      message: "UTR / referenceCode must be 6–100 characters.",
    });
    return;
  }
  if (proofImageBase64 && proofImageBase64.length > 2_000_000) {
    res.status(400).json({ error: "proof_too_large", message: "Proof image too large (max ~1.5 MB)." });
    return;
  }

  const [method] = await db
    .select()
    .from(paymentMethodsTable)
    .where(
      and(eq(paymentMethodsTable.id, paymentMethodId), eq(paymentMethodsTable.isActive, true)),
    )
    .limit(1);
  if (!method) {
    res.status(404).json({ error: "merchant_not_found", message: "Merchant not found or inactive." });
    return;
  }

  const min = parseFloat(method.minAmount as string);
  const max = parseFloat(method.maxAmount as string);
  if (amountInr < min || amountInr > max) {
    res.status(400).json({
      error: "amount_out_of_range",
      message: `Amount must be between ₹${min} and ₹${max}.`,
    });
    return;
  }

  // Duplicate UTR check
  const [existingUtr] = await db
    .select({ id: inrDepositsTable.id })
    .from(inrDepositsTable)
    .where(eq(inrDepositsTable.utr, utr))
    .limit(1);
  if (existingUtr) {
    res.status(409).json({ error: "duplicate_utr", message: "This UTR/reference has already been submitted." });
    return;
  }

  const rate = await getInrRate();
  const amountUsdt = +(amountInr / rate).toFixed(6);

  try {
    const [row] = await db
      .insert(inrDepositsTable)
      .values({
        userId: req.userId!,
        paymentMethodId,
        amountInr: amountInr.toFixed(2),
        amountUsdt: amountUsdt.toFixed(6),
        rateUsed: rate.toFixed(4),
        utr,
        proofImageBase64,
      })
      .returning();

    await createNotification(
      req.userId!,
      "deposit",
      "INR deposit submitted",
      `Your INR deposit of ₹${amountInr.toFixed(2)} (≈$${amountUsdt.toFixed(2)} USDT) is awaiting admin review.`,
    );
    void notifyOwnerMerchantOfNewDeposit(row!.id);

    res.json({
      success: true,
      deposit: {
        id: row!.id,
        amountInr,
        amountUsdt,
        status: "pending",
        message: "Deposit submitted and awaiting admin review.",
      },
    });
  } catch (err: any) {
    if (String(err?.message ?? "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "duplicate_utr", message: "This UTR/reference has already been submitted." });
      return;
    }
    errorLogger.error({ err, userId: req.userId }, "[mobile] inr-deposit submit failed");
    res.status(500).json({ error: "server_error", message: "Failed to submit deposit." });
  }
});

// ── POST /wallet/withdraw/inr ────────────────────────────────────────────────
// Flutter alias for POST /inr-withdrawals.
// Flutter body:
//   { amount, payoutMethod: "upi"|"bank"|"qorix_user", destination, otp }
//
// payoutMethod "upi"         : destination = "id@upihandle"
// payoutMethod "bank"        : destination = "accountHolder|accountNumber|IFSC[|bankName]"
//                               OR body includes accountHolder / accountNumber / ifsc fields
// payoutMethod "qorix_user"  : destination = referral code / username
//                               (admin-reviewed P2P; pending manual credit by admin)
//
// OTP: caller must first POST /auth/withdrawal-otp (purpose: withdrawal_confirm).
// All security locks mirror the main /inr-withdrawals route.
router.post("/wallet/withdraw/inr", authMiddleware, async (req: AuthRequest, res) => {
  if (await isSmokeTestUser(req.userId!)) {
    res.status(403).json({
      error: "smoke_test_account_blocked",
      message: "INR withdrawals are disabled for the smoke-test account.",
    });
    return;
  }

  // ── User / KYC / account-age / password-change checks ──────────────────
  const [userRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!userRow) {
    res.status(404).json({ error: "user_not_found", message: "User not found." });
    return;
  }
  if (userRow.isDisabled || userRow.isFrozen) {
    res.status(403).json({
      error: "account_restricted",
      message: "Withdrawals are blocked for restricted accounts.",
    });
    return;
  }
  if (userRow.kycStatus !== "approved") {
    res.status(403).json({
      error: "kyc_required",
      message: "Complete KYC verification before withdrawing.",
    });
    return;
  }

  const accountAgeMs = Date.now() - new Date(userRow.createdAt).getTime();
  if (accountAgeMs < NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil(NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS - accountAgeMs / 3_600_000);
    res.status(403).json({
      error: "withdrawal_locked_new_account",
      message: `New accounts must wait ${NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS}h before first withdrawal (${hoursLeft}h remaining).`,
    });
    return;
  }

  if (userRow.passwordChangedAt) {
    const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
    const sinceMs = Date.now() - new Date(userRow.passwordChangedAt).getTime();
    if (sinceMs < lockMs) {
      const hoursLeft = Math.ceil((lockMs - sinceMs) / 3_600_000);
      res.status(403).json({
        error: "withdrawal_locked_password_change",
        message: `Withdrawals are paused for ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE}h after a password change (${hoursLeft}h remaining).`,
        hoursLeft,
        lockedUntil: new Date(new Date(userRow.passwordChangedAt).getTime() + lockMs).toISOString(),
      });
      return;
    }
  }

  // ── 24h new-device cooldown ────────────────────────────────────────────
  const cooldown = await checkWithdrawDeviceCooldown(req, req.userId!);
  if (!cooldown.ok) {
    res.status(cooldown.status).json(cooldown.body);
    return;
  }

  // ── Parse and validate body ────────────────────────────────────────────
  const body = req.body ?? {};
  const amountInr = Number(body.amount ?? body.amountInr);
  const payoutMethod = String(body.payoutMethod ?? "").toLowerCase();
  const destination = body.destination ?? null;

  if (!Number.isFinite(amountInr) || amountInr < 100) {
    res.status(400).json({ error: "invalid_amount", message: "amount must be at least ₹100." });
    return;
  }
  if (!["upi", "bank", "qorix_user"].includes(payoutMethod)) {
    res.status(400).json({
      error: "invalid_payout_method",
      message: "payoutMethod must be 'upi', 'bank', or 'qorix_user'.",
    });
    return;
  }

  // Resolve payout fields based on method
  let upiId: string | null = null;
  let accountHolder: string | null = null;
  let accountNumber: string | null = null;
  let ifsc: string | null = null;
  let bankName: string | null = null;

  if (payoutMethod === "upi") {
    upiId = typeof destination === "string" ? destination.trim() : String(body.upiId ?? "").trim();
    if (!upiId || !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId)) {
      res.status(400).json({ error: "invalid_upi_id", message: "Invalid UPI ID format (e.g. name@bank)." });
      return;
    }
  } else if (payoutMethod === "bank") {
    // Accept destination as "accountHolder|accountNumber|IFSC|bankName"
    // OR individual fields in body
    if (typeof destination === "string" && destination.includes("|")) {
      const parts = destination.split("|");
      accountHolder = parts[0]?.trim() ?? null;
      accountNumber = parts[1]?.trim() ?? null;
      ifsc = parts[2]?.trim().toUpperCase() ?? null;
      bankName = parts[3]?.trim() || null;
    } else if (destination && typeof destination === "object") {
      accountHolder = String(destination.accountHolder ?? "").trim() || null;
      accountNumber = String(destination.accountNumber ?? "").trim() || null;
      ifsc = String(destination.ifsc ?? "").trim().toUpperCase() || null;
      bankName = String(destination.bankName ?? "").trim() || null;
    } else {
      accountHolder = String(body.accountHolder ?? "").trim() || null;
      accountNumber = String(body.accountNumber ?? "").trim() || null;
      ifsc = String(body.ifsc ?? "").trim().toUpperCase() || null;
      bankName = String(body.bankName ?? "").trim() || null;
    }
    if (!accountHolder || accountHolder.length < 2) {
      res.status(400).json({ error: "invalid_account_holder", message: "Account holder name required." });
      return;
    }
    if (!accountNumber || !/^\d{6,20}$/.test(accountNumber)) {
      res.status(400).json({ error: "invalid_account_number", message: "Account number must be 6–20 digits." });
      return;
    }
    if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      res.status(400).json({ error: "invalid_ifsc", message: "Invalid IFSC code format (e.g. HDFC0001234)." });
      return;
    }
  } else {
    // qorix_user — store destination as upiId field for admin visibility
    const recipientRef = typeof destination === "string" ? destination.trim() : String(body.recipientCode ?? "").trim();
    if (!recipientRef) {
      res.status(400).json({ error: "invalid_destination", message: "destination (referral code or email) required for qorix_user." });
      return;
    }
    upiId = recipientRef;
  }

  // ── OTP verification ───────────────────────────────────────────────────
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!otp) {
    res.status(400).json({
      error: "withdrawal_otp_required",
      message: "Please request a withdrawal OTP via POST /auth/withdrawal-otp first.",
    });
    return;
  }
  const otpResult = await verifyOtp(req.userId!, otp, "withdrawal_confirm");
  if (!otpResult.valid) {
    res.status(400).json({
      error: "invalid_otp",
      message: otpResult.error ?? "Invalid or expired OTP.",
    });
    return;
  }

  // ── Cap + balance checks ───────────────────────────────────────────────
  const rate = await getInrRate();
  const amountUsdt = +(amountInr / rate).toFixed(6);

  const preCaps = await getWithdrawalCaps(req.userId!);
  if (payoutMethod !== "qorix_user" && amountUsdt > preCaps.inrChannelMax) {
    const allowedInr = +(preCaps.inrChannelMax * rate).toFixed(2);
    res.status(400).json({
      error: "channel_cap_exceeded",
      message: `INR withdrawal limit exceeded. You can withdraw at most ₹${allowedInr.toFixed(2)} right now.`,
      allowedInr,
    });
    return;
  }
  if (amountUsdt > preCaps.mainBalance) {
    res.status(400).json({
      error: "insufficient_main_balance",
      message: `Insufficient main balance. Available: $${preCaps.mainBalance.toFixed(2)}.`,
    });
    return;
  }

  // ── Atomic DB transaction ──────────────────────────────────────────────
  let created: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    created = await db.transaction(async (tx) => {
      // TOCTOU: re-check password-change lock inside txn
      const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
      const [recheck] = await tx
        .select({ passwordChangedAt: usersTable.passwordChangedAt })
        .from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .limit(1);
      if (
        recheck?.passwordChangedAt &&
        Date.now() - new Date(recheck.passwordChangedAt).getTime() < lockMs
      ) {
        throw new Error("WITHDRAWAL_LOCKED_PASSWORD_CHANGE");
      }

      await ensureUserAccounts(req.userId!, tx);

      const debit = await tx
        .update(walletsTable)
        .set({
          mainBalance: sql`${walletsTable.mainBalance} - ${amountUsdt.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletsTable.userId, req.userId!),
            sql`${walletsTable.mainBalance} >= ${amountUsdt.toFixed(6)}::numeric`,
          ),
        )
        .returning({ id: walletsTable.id });
      if (debit.length === 0) throw new Error("INSUFFICIENT_BALANCE");

      // Post-debit cap re-check (authoritative — closes concurrent-request race)
      const txCaps = await getWithdrawalCaps(req.userId!, tx);
      if (payoutMethod !== "qorix_user" && txCaps.totalBalance < txCaps.usdtChannelOwed) {
        throw new Error("INR_CHANNEL_CAP_EXCEEDED");
      }

      const [row] = await tx
        .insert(inrWithdrawalsTable)
        .values({
          userId: req.userId!,
          amountInr: amountInr.toFixed(2),
          amountUsdt: amountUsdt.toFixed(6),
          rateUsed: rate.toFixed(4),
          payoutMethod,
          upiId,
          accountHolder,
          accountNumber,
          ifsc,
          bankName,
        })
        .returning();

      const [txnRow] = await tx
        .insert(transactionsTable)
        .values({
          userId: req.userId!,
          type: "withdrawal",
          amount: amountUsdt.toFixed(6),
          status: "pending",
          description: `[INR-WD:${row!.id}] INR withdrawal pending — ₹${amountInr.toFixed(2)} (≈$${amountUsdt.toFixed(2)} USDT) via ${payoutMethod.toUpperCase()}`,
        })
        .returning();

      await postJournalEntry(
        journalForTransaction(txnRow!.id),
        [
          {
            accountCode: `user:${req.userId!}:main`,
            entryType: "debit",
            amount: amountUsdt,
            description: `INR withdrawal pending — funds locked (WD#${row!.id})`,
          },
          {
            accountCode: "platform:pending_withdrawals",
            entryType: "credit",
            amount: amountUsdt,
            description: `Held for INR withdrawal #${row!.id} (user ${req.userId!})`,
          },
        ],
        txnRow!.id,
        tx,
      );

      return row!;
    });
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "insufficient_main_balance", message: "Insufficient main balance." });
      return;
    }
    if (err?.message === "WITHDRAWAL_LOCKED_PASSWORD_CHANGE") {
      res.status(403).json({
        error: "withdrawal_locked_password_change",
        message: `Withdrawals are paused for ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE}h after a password change.`,
      });
      return;
    }
    if (err?.message === "INR_CHANNEL_CAP_EXCEEDED") {
      const caps = await getWithdrawalCaps(req.userId!);
      const allowedInr = +(caps.inrChannelMax * rate).toFixed(2);
      res.status(400).json({
        error: "channel_cap_exceeded",
        message: `INR withdrawal limit exceeded. You can withdraw at most ₹${allowedInr.toFixed(2)} right now.`,
        allowedInr,
      });
      return;
    }
    errorLogger.error({ err, userId: req.userId }, "[mobile] inr-withdrawal create failed");
    res.status(500).json({ error: "server_error", message: "Failed to submit withdrawal." });
    return;
  }

  await createNotification(
    req.userId!,
    "withdrawal",
    "INR withdrawal submitted",
    `Your INR withdrawal of ₹${amountInr.toFixed(2)} (≈$${amountUsdt.toFixed(2)} USDT) is awaiting admin payout.`,
  );
  void notifyAllActiveMerchantsOfNewWithdrawal(created!.id);
  transactionLogger.info(
    { event: "inr_withdrawal_requested_mobile", id: created!.id, userId: req.userId, amountInr, amountUsdt, payoutMethod },
    "INR withdrawal requested via mobile API",
  );

  res.json({
    success: true,
    withdrawal: {
      id: created!.id,
      amountInr,
      amountUsdt,
      status: "pending",
      payoutMethod,
      message: "Withdrawal submitted and awaiting admin payout.",
    },
  });
});

export default router;
