import { Router } from "express";
import {
  db,
  walletsTable,
  usersTable,
  inrWithdrawalsTable,
  systemSettingsTable,
  merchantsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";
import { createNotification } from "../lib/notifications";
import { transactionLogger, errorLogger } from "../lib/logger";
import { sendTxnEmailToUser } from "../lib/email-service";
import { isSmokeTestUser } from "../lib/smoke-test-account";
import { getWithdrawalCaps } from "../lib/withdrawal-caps";
import { notifyAllActiveMerchantsOfNewWithdrawal } from "../lib/escalation-cron";

const router = Router();

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = "85.0";

async function getInrRate(): Promise<number> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, INR_RATE_KEY))
    .limit(1);
  const raw = rows[0]?.value ?? DEFAULT_INR_RATE;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Number(DEFAULT_INR_RATE);
}

function formatWithdrawal(w: typeof inrWithdrawalsTable.$inferSelect) {
  return {
    id: w.id,
    userId: w.userId,
    amountInr: parseFloat(w.amountInr as string),
    amountUsdt: parseFloat(w.amountUsdt as string),
    rateUsed: parseFloat(w.rateUsed as string),
    payoutMethod: w.payoutMethod,
    upiId: w.upiId,
    accountHolder: w.accountHolder,
    accountNumber: w.accountNumber,
    ifsc: w.ifsc,
    bankName: w.bankName,
    status: w.status,
    adminNote: w.adminNote,
    payoutReference: w.payoutReference,
    reviewedBy: w.reviewedBy,
    reviewedAt: w.reviewedAt ? w.reviewedAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PUBLIC (auth) — withdrawal caps + history + create
// ---------------------------------------------------------------------------
router.get("/withdrawal-limits", authMiddleware, async (req: AuthRequest, res) => {
  const caps = await getWithdrawalCaps(req.userId!);
  const rate = await getInrRate();
  res.json({
    rate,
    ...caps,
    inrChannelOwedInr: +(caps.inrChannelOwed * rate).toFixed(2),
    inrChannelMaxInr: +(caps.inrChannelMax * rate).toFixed(2),
  });
});

router.get("/inr-withdrawals/mine", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(inrWithdrawalsTable)
    .where(eq(inrWithdrawalsTable.userId, req.userId!))
    .orderBy(desc(inrWithdrawalsTable.createdAt))
    .limit(50);
  res.json({ withdrawals: rows.map(formatWithdrawal) });
});

router.post("/inr-withdrawals", authMiddleware, async (req: AuthRequest, res) => {
  if (await isSmokeTestUser(req.userId!)) {
    res
      .status(403)
      .json({ error: "smoke_test_account_blocked", message: "INR withdrawals are disabled for the smoke-test account." });
    return;
  }

  // --- User status / KYC checks (mirror USDT withdraw) ---
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const user = userRows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.isDisabled || user.isFrozen) {
    res.status(403).json({ error: "account_restricted", message: "Withdrawals are blocked for restricted accounts" });
    return;
  }
  if (user.kycStatus !== "approved") {
    res.status(403).json({ error: "kyc_required", message: "Complete KYC verification before withdrawing" });
    return;
  }

  const body = req.body ?? {};
  const amountInr = Number(body.amountInr);
  const payoutMethod = String(body.payoutMethod ?? "").toLowerCase();

  if (!Number.isFinite(amountInr) || amountInr < 100) {
    res.status(400).json({ error: "amountInr must be at least ₹100" });
    return;
  }
  if (payoutMethod !== "upi" && payoutMethod !== "bank") {
    res.status(400).json({ error: "payoutMethod must be 'upi' or 'bank'" });
    return;
  }

  const upiId = payoutMethod === "upi" ? String(body.upiId ?? "").trim() : null;
  const accountHolder = payoutMethod === "bank" ? String(body.accountHolder ?? "").trim() : null;
  const accountNumber = payoutMethod === "bank" ? String(body.accountNumber ?? "").trim() : null;
  const ifsc = payoutMethod === "bank" ? String(body.ifsc ?? "").trim().toUpperCase() : null;
  const bankName = payoutMethod === "bank" ? String(body.bankName ?? "").trim() || null : null;

  if (payoutMethod === "upi" && (!upiId || !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId))) {
    res.status(400).json({ error: "Invalid UPI ID" });
    return;
  }
  if (payoutMethod === "bank") {
    if (!accountHolder || accountHolder.length < 2) {
      res.status(400).json({ error: "Account holder name required" });
      return;
    }
    if (!accountNumber || !/^\d{6,20}$/.test(accountNumber)) {
      res.status(400).json({ error: "Account number must be 6–20 digits" });
      return;
    }
    if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      res.status(400).json({ error: "Invalid IFSC code" });
      return;
    }
  }

  const rate = await getInrRate();
  const amountUsdt = +(amountInr / rate).toFixed(6);

  // --- Pre-flight cap check (cheap reject; authoritative re-check happens inside the txn) ---
  {
    const preCaps = await getWithdrawalCaps(req.userId!);
    if (amountUsdt > preCaps.inrChannelMax) {
      const allowedInr = +(preCaps.inrChannelMax * rate).toFixed(2);
      res.status(400).json({
        error: "channel_cap_exceeded",
        message:
          `INR withdrawal limit exceeded. You can withdraw at most ₹${allowedInr.toFixed(2)} via INR right now ` +
          `($${preCaps.usdtChannelOwed.toFixed(2)} of your balance is reserved to be withdrawn back via USDT/TRC20).`,
        allowedInr,
        caps: preCaps,
      });
      return;
    }
    if (amountUsdt > preCaps.mainBalance) {
      res.status(400).json({
        error: "insufficient_main_balance",
        message: `INR withdrawals are paid from Main Balance. You have $${preCaps.mainBalance.toFixed(2)} available, this request needs $${amountUsdt.toFixed(2)}.`,
      });
      return;
    }
  }

  // --- Atomic: re-check caps inside txn, guarded debit, insert ---
  let created: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    created = await db.transaction(async (tx) => {
      const debit = await tx
        .update(walletsTable)
        .set({
          mainBalance: sql`${walletsTable.mainBalance} - ${amountUsdt.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(walletsTable.userId, req.userId!), gte(walletsTable.mainBalance, amountUsdt.toFixed(6))),
        )
        .returning({ id: walletsTable.id });
      if (debit.length === 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Authoritative cap re-check (after debit, before insert) — defeats concurrent-request race.
      //
      // BUGFIX (2026-04-28): the previous form `amountUsdt > txCaps.inrChannelMax`
      // was incorrect because the wallet debit above has *already* subtracted
      // `amountUsdt` from main_balance, so the snapshot read by getWithdrawalCaps
      // inside this tx returns a totalBalance that is post-debit. That makes
      // `inrChannelMax = post_total - usdtChannelOwed`, and the comparison
      // `amountUsdt > post_total - usdtChannelOwed` rejects practically every
      // INR withdrawal that was at or near the cap (it falsely rejected the user
      // who deposited ₹9,000 via INR + $5 via USDT and tried to withdraw
      // ₹9,000 INR — the pre-flight passed, the debit succeeded, and then this
      // re-check fired with `91.84 > 0`, triggering rollback and the misleading
      // "max ₹9000.00 right now" error).
      //
      // The correct post-debit guard is the same shape used in wallet.ts for
      // the USDT path: after the debit, the remaining wallet must still cover
      // whatever is owed to the *other* channel — here, the USDT/TRC20
      // reservation (`usdtChannelOwed`). Race semantics are preserved: if a
      // concurrent USDT deposit landed between pre-flight and this snapshot,
      // usdtChannelOwed grows and we still reject correctly.
      const txCaps = await getWithdrawalCaps(req.userId!, tx);
      if (txCaps.totalBalance < txCaps.usdtChannelOwed) {
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
      return row!;
    });
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "insufficient_main_balance", message: "Insufficient main balance" });
      return;
    }
    if (err?.message === "INR_CHANNEL_CAP_EXCEEDED") {
      const caps = await getWithdrawalCaps(req.userId!);
      const allowedInr = +(caps.inrChannelMax * rate).toFixed(2);
      res.status(400).json({
        error: "channel_cap_exceeded",
        message:
          `INR withdrawal limit exceeded. You can withdraw at most ₹${allowedInr.toFixed(2)} via INR right now ` +
          `($${caps.usdtChannelOwed.toFixed(2)} of your balance is reserved to be withdrawn back via USDT/TRC20).`,
        allowedInr,
        caps,
      });
      return;
    }
    errorLogger.error({ err, userId: req.userId }, "[inr-withdrawal] create failed");
    res.status(500).json({ error: "Failed to submit withdrawal" });
    return;
  }

  await createNotification(
    req.userId!,
    "withdrawal",
    "INR withdrawal submitted",
    `Your INR withdrawal of ₹${amountInr.toFixed(2)} (≈$${amountUsdt.toFixed(2)} USDT) is awaiting admin payout.`,
  );
  // Notify every active merchant — first to claim it from the panel becomes
  // the owner. The 10/15-min cron escalates further if no one acts.
  void notifyAllActiveMerchantsOfNewWithdrawal(created!.id);
  transactionLogger.info(
    { event: "inr_withdrawal_requested", id: created!.id, userId: req.userId, amountInr, amountUsdt },
    "INR withdrawal requested",
  );
  res.json({ withdrawal: formatWithdrawal(created!) });
});

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
router.use("/admin/inr-withdrawals", authMiddleware, adminMiddleware, requireAdminPermission, auditAdminRequest);

router.get("/admin/inr-withdrawals", async (req, res) => {
  const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const where = status
    ? and(eq(inrWithdrawalsTable.status, status))
    : undefined;
  const rows = await db
    .select()
    .from(inrWithdrawalsTable)
    .where(where ?? sql`true`)
    .orderBy(desc(inrWithdrawalsTable.createdAt))
    .limit(200);
  res.json({ withdrawals: rows.map(formatWithdrawal) });
});

router.post("/admin/inr-withdrawals/:id/approve", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  const payoutReference = String(req.body?.payoutReference ?? "").trim() || null;
  const adminNote = String(req.body?.adminNote ?? "").trim() || null;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Admin can also pass `merchantId` to credit a specific merchant (e.g. when
  // approving without the withdrawal being claimed via the merchant flow).
  // If the row already has assignedMerchantId, that wins.
  const adminPickedMerchantId =
    req.body?.merchantId != null && Number.isFinite(Number(req.body.merchantId))
      ? Number(req.body.merchantId)
      : null;

  let row: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    row = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(inrWithdrawalsTable)
        .set({
          status: "approved",
          reviewedBy: req.userId!,
          reviewedAt: new Date(),
          payoutReference,
          adminNote,
          ...(adminPickedMerchantId != null ? { assignedMerchantId: adminPickedMerchantId } : {}),
        })
        .where(and(eq(inrWithdrawalsTable.id, id), eq(inrWithdrawalsTable.status, "pending")))
        .returning();
      if (!claimed) throw new Error("NOT_PENDING");
      const creditTo = claimed.assignedMerchantId ?? adminPickedMerchantId;
      if (creditTo != null) {
        const amountInrStr = parseFloat(claimed.amountInr as string).toFixed(2);
        const credited = await tx
          .update(merchantsTable)
          .set({
            inrBalance: sql`${merchantsTable.inrBalance} + ${amountInrStr}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(merchantsTable.id, creditTo))
          .returning({ id: merchantsTable.id });
        // Guard against silent miss: if the supplied merchantId doesn't exist
        // (no FK on assignedMerchantId), we must NOT finalize the withdrawal
        // with no balance restored — roll the whole tx back instead.
        if (credited.length === 0) {
          throw new Error("INVALID_MERCHANT_ID");
        }
      }
      return claimed;
    });
  } catch (err: any) {
    if (err?.message === "NOT_PENDING") {
      const [existing] = await db.select().from(inrWithdrawalsTable).where(eq(inrWithdrawalsTable.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Withdrawal not found" });
        return;
      }
      res.status(409).json({ error: `Withdrawal already ${existing.status}` });
      return;
    }
    if (err?.message === "INVALID_MERCHANT_ID") {
      res.status(400).json({ error: "Invalid merchantId — no such merchant" });
      return;
    }
    errorLogger.error({ err, id }, "[inr-withdrawal] approve failed");
    res.status(500).json({ error: "Failed to approve withdrawal" });
    return;
  }
  if (!row) {
    res.status(500).json({ error: "Approve handler reached an inconsistent state" });
    return;
  }
  await createNotification(
    row.userId,
    "withdrawal",
    "INR withdrawal paid",
    `Your INR withdrawal of ₹${parseFloat(row.amountInr as string).toFixed(2)} has been processed.${
      payoutReference ? ` Reference: ${payoutReference}` : ""
    }`,
  );
  sendTxnEmailToUser(
    row.userId,
    "INR Withdrawal Processed",
    `Your INR withdrawal has been paid out.\n\n` +
      `Amount: ₹${parseFloat(row.amountInr as string).toFixed(2)}\n` +
      `Method: ${row.payoutMethod.toUpperCase()}\n` +
      (payoutReference ? `Bank/UPI Reference: ${payoutReference}\n` : "") +
      `\nIf you do not see the funds in 30 minutes, contact support.`,
  );
  res.json({ ok: true });
});

router.post("/admin/inr-withdrawals/:id/reject", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  const note = String(req.body?.adminNote ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  let refunded: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    refunded = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(inrWithdrawalsTable)
        .set({ status: "rejected", reviewedBy: req.userId!, reviewedAt: new Date(), adminNote: note || null })
        .where(and(eq(inrWithdrawalsTable.id, id), eq(inrWithdrawalsTable.status, "pending")))
        .returning();
      if (!row) {
        throw new Error("NOT_PENDING");
      }
      // Refund the held main balance
      await tx
        .update(walletsTable)
        .set({
          mainBalance: sql`${walletsTable.mainBalance} + ${row.amountUsdt}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, row.userId));
      return row;
    });
  } catch (err: any) {
    if (err?.message === "NOT_PENDING") {
      const [existing] = await db.select().from(inrWithdrawalsTable).where(eq(inrWithdrawalsTable.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Withdrawal not found" });
        return;
      }
      res.status(409).json({ error: `Withdrawal already ${existing.status}` });
      return;
    }
    errorLogger.error({ err, id }, "[inr-withdrawal] reject failed");
    res.status(500).json({ error: "Failed to reject withdrawal" });
    return;
  }
  await createNotification(
    refunded!.userId,
    "withdrawal",
    "INR withdrawal rejected",
    `Your INR withdrawal of ₹${parseFloat(refunded!.amountInr as string).toFixed(2)} was rejected and the amount refunded to your Main Balance.${
      note ? ` Reason: ${note}` : ""
    }`,
  );
  res.json({ ok: true });
});

export default router;
