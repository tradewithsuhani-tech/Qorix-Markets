import { Router } from "express";
import {
  db,
  walletsTable,
  usersTable,
  inrWithdrawalsTable,
  systemSettingsTable,
  merchantsTable,
  transactionsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, gte, like } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";
import { createNotification } from "../lib/notifications";
import { transactionLogger, errorLogger } from "../lib/logger";
import { sendTxnEmailToUser, verifyOtp } from "../lib/email-service";
import { ensureUserAccounts, postJournalEntry, journalForTransaction } from "../lib/ledger-service";
import { isSmokeTestUser } from "../lib/smoke-test-account";
import { getWithdrawalCaps } from "../lib/withdrawal-caps";
import { notifyAllActiveMerchantsOfNewWithdrawal } from "../lib/escalation-cron";
import { WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE } from "./auth";
import { NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS } from "./wallet";
import { checkWithdrawDeviceCooldown } from "../lib/withdraw-device-cooldown";

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

  // --- New-account 24h withdrawal lock (parity with routes/wallet.ts:244-252) ---
  // A brand-new account that just deposited via INR (UPI/Bank) used to be
  // able to immediately withdraw via INR while USDT enforced this 24h gate.
  // That gap turned the INR channel into the preferred path for any "drop
  // a deposit, immediately withdraw to a different beneficiary" laundering
  // attempt, and into the lower-friction path for a freshly-phished login.
  // Same constant, same wording, same status code — only the channel differs.
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  if (accountAgeMs < NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil(NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS - accountAgeMs / 3_600_000);
    res.status(403).json({
      error: "withdrawal_locked_new_account",
      message: `New accounts must wait ${NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS}h before first withdrawal (${hoursLeft}h remaining)`,
    });
    return;
  }

  // --- 24h post-password-change lock (parity with routes/wallet.ts:260-276) ---
  // Pairs with /auth/change-password and /auth/reset-password. If the
  // password was rotated in the last 24h, withdrawals are frozen on EVERY
  // channel so a stolen-password attacker who immediately rotates can't
  // drain the account before the real owner reads the "your password was
  // changed" email. /auth/security-status surfaces the same window to the
  // UI for honest users so they understand why the flow is paused.
  // Without this on INR, the USDT lock was a paper tiger — a hijacker
  // simply switched channels.
  if (user.passwordChangedAt) {
    const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
    const sinceChangeMs = Date.now() - new Date(user.passwordChangedAt).getTime();
    if (sinceChangeMs < lockMs) {
      const hoursLeft = Math.ceil((lockMs - sinceChangeMs) / 3_600_000);
      res.status(403).json({
        error: "withdrawal_locked_password_change",
        message:
          `Withdrawals are paused for ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE}h after a password change ` +
          `for your security (${hoursLeft}h remaining). Deposits and trading continue as normal.`,
        hoursLeft,
        lockedUntil: new Date(new Date(user.passwordChangedAt).getTime() + lockMs).toISOString(),
      });
      return;
    }
  }

  // --- 24h NEW-DEVICE withdrawal cooldown (B7, parity with USDT path) ---
  // Mirrors `routes/wallet.ts` (USDT/TRC20 path) — see the comment block
  // there for the full rationale. Short version: the write side is owned
  // by `lib/device-tracking.ts` → `trackLoginDevice`, which stamps
  // `user_devices.first_seen_at` on first successful login from a
  // (user, device-fingerprint) pair. Until 24h has elapsed we refuse
  // withdrawals from that device, even with a valid session and OTP.
  // Without this on INR the USDT lock would be a paper tiger — the same
  // channel-bypass argument that put the new-account 24h lock and the
  // post-password-change 24h lock on this endpoint.
  //
  // Placement: BEFORE body parsing / OTP verification so a blocked user
  // never burns a single-use email OTP. AFTER user/kyc/account-age/
  // password-change so the user sees the most informative early reject.
  {
    const cooldown = await checkWithdrawDeviceCooldown(req, req.userId!);
    if (!cooldown.ok) {
      res.status(cooldown.status).json(cooldown.body);
      return;
    }
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

  // --- Withdrawal OTP verification (mirror of routes/wallet.ts USDT path) ---
  // Server-side enforcement of the same email-OTP step-up the USDT/TRC20
  // path requires. Without this, an attacker who has an active session can
  // drain the INR channel with no second factor — even if the user has
  // 2FA enabled (2FA only gates session issuance, not individual
  // withdrawals). The client (`inr-withdraw-tab.tsx`) requests an OTP via
  // `POST /auth/withdrawal-otp` (purpose `withdrawal_confirm`) and submits
  // the 6-digit code in `body.otp` as part of this request.
  //
  // Placement note: this comes AFTER all client-validatable input checks
  // (amount, payout method, UPI/IFSC shape) so a client-side typo doesn't
  // silently consume the user's OTP. It comes BEFORE the rate fetch / cap
  // check / atomic debit so a stolen session POSTing directly with no OTP
  // is rejected before any DB work happens. Race semantics: OTP is one-shot
  // (consumed on success); the same OTP cannot be reused for a second
  // withdrawal. Purpose `withdrawal_confirm` is shared with the USDT path,
  // so a single email OTP request can satisfy whichever channel the user
  // chooses to submit first — but only one of them.
  const submittedOtp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!submittedOtp) {
    res.status(400).json({
      error: "withdrawal_otp_required",
      message: "Please request a withdrawal OTP first",
    });
    return;
  }
  const otpResult = await verifyOtp(req.userId!, submittedOtp, "withdrawal_confirm");
  if (!otpResult.valid) {
    res.status(400).json({
      error: "invalid_otp",
      message: otpResult.error ?? "Invalid or expired OTP",
    });
    return;
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
      // --- TOCTOU re-check: 24h post-password-change lock INSIDE the txn
      //     (parity with routes/wallet.ts:341-350 USDT path) ---
      // Closes the tiny race where a concurrent /auth/change-password or
      // /auth/reset-password could land between the outer pre-check above
      // and the moment we touch the wallet here. Reads the freshly-committed
      // users row; if the lock has just become active, we abort and roll
      // back instead of letting an attacker who races a password rotation
      // slip a withdrawal through. The new-account lock doesn't need a
      // re-check (createdAt is immutable).
      const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
      const recheck = await tx
        .select({ passwordChangedAt: usersTable.passwordChangedAt })
        .from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .limit(1);
      const pwdChangedAt = recheck[0]?.passwordChangedAt;
      if (pwdChangedAt && Date.now() - new Date(pwdChangedAt).getTime() < lockMs) {
        throw new Error("WITHDRAWAL_LOCKED_PASSWORD_CHANGE");
      }

      // Ensure user GL accounts exist BEFORE the wallet debit so the
      // subsequent journal entry can find them. This also triggers the
      // opening-balance reconciliation (B20) for any orphan wallet whose
      // ledger trail starts from zero.
      await ensureUserAccounts(req.userId!, tx);

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

      // Insert a pending `transactions` row so the user sees their pending
      // withdrawal in their history immediately. The deterministic
      // `[INR-WD:${id}]` prefix lets the approve/reject handlers find this
      // row again without needing a FK column on inr_withdrawals.
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

      // Lock the funds in the ledger: move user:UID:main → platform:pending_withdrawals.
      // This keeps wallet sum == ledger sum for the user's main account.
      // Approve will release the funds to platform:usdt_pool. Reject will
      // restore them to user:UID:main.
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
      res.status(400).json({ error: "insufficient_main_balance", message: "Insufficient main balance" });
      return;
    }
    if (err?.message === "WITHDRAWAL_LOCKED_PASSWORD_CHANGE") {
      // Same shape as the outer pre-check rejection so the client can
      // surface a single error path regardless of which guard fired.
      res.status(403).json({
        error: "withdrawal_locked_password_change",
        message:
          `Withdrawals are paused for ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE}h after a password change ` +
          `for your security. Deposits and trading continue as normal.`,
      });
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

      // Find the pending `transactions` row created at submit time via the
      // deterministic `[INR-WD:${id}]` description prefix. If the withdrawal
      // was created by older code (pre-B21) without a txn row, fall through
      // gracefully: insert a completed txn now and post a direct journal that
      // bypasses the locked stage (pre-B21 submits never posted the lock
      // journal either, so going main → usdt_pool keeps things consistent).
      const wdTag = `[INR-WD:${id}]`;
      const [pendingTxn] = await tx
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, claimed.userId),
            eq(transactionsTable.type, "withdrawal"),
            eq(transactionsTable.status, "pending"),
            like(transactionsTable.description, `${wdTag}%`),
          ),
        )
        .limit(1);
      const amountUsdt = parseFloat(claimed.amountUsdt as string);

      if (pendingTxn) {
        // B21+ path: pending txn + lock journal exist. Finalize both.
        await tx
          .update(transactionsTable)
          .set({
            status: "completed",
            description:
              `${wdTag} INR withdrawal paid — ₹${parseFloat(claimed.amountInr as string).toFixed(2)} ` +
              `(≈$${amountUsdt.toFixed(2)} USDT) via ${claimed.payoutMethod.toUpperCase()}` +
              (payoutReference ? ` — ref ${payoutReference}` : ""),
          })
          .where(eq(transactionsTable.id, pendingTxn.id));

        // Release the held funds to the platform usdt pool (asset out).
        // Contra: platform:pending_withdrawals (liability cleared).
        await postJournalEntry(
          `inr_wd:${id}:approve`,
          [
            {
              accountCode: "platform:pending_withdrawals",
              entryType: "debit",
              amount: amountUsdt,
              description: `Release held funds for INR withdrawal #${id}`,
            },
            {
              accountCode: "platform:usdt_pool",
              entryType: "credit",
              amount: amountUsdt,
              description: `INR withdrawal #${id} paid out (user ${claimed.userId})`,
            },
          ],
          pendingTxn.id,
          tx,
        );
      } else {
        // Pre-B21 path / orphan withdrawal: no pending txn, no lock journal.
        // Wallet was already debited at submit; we just need to write the
        // ledger half so wallet sum == ledger sum going forward.
        await ensureUserAccounts(claimed.userId, tx);
        const [newTxn] = await tx
          .insert(transactionsTable)
          .values({
            userId: claimed.userId,
            type: "withdrawal",
            amount: amountUsdt.toFixed(6),
            status: "completed",
            description:
              `${wdTag} INR withdrawal paid — ₹${parseFloat(claimed.amountInr as string).toFixed(2)} ` +
              `(≈$${amountUsdt.toFixed(2)} USDT) via ${claimed.payoutMethod.toUpperCase()}` +
              (payoutReference ? ` — ref ${payoutReference}` : "") +
              ` (legacy submit — direct settlement)`,
          })
          .returning();
        await postJournalEntry(
          `inr_wd:${id}:approve`,
          [
            {
              accountCode: `user:${claimed.userId}:main`,
              entryType: "debit",
              amount: amountUsdt,
              description: `INR withdrawal #${id} settled (legacy direct settlement)`,
            },
            {
              accountCode: "platform:usdt_pool",
              entryType: "credit",
              amount: amountUsdt,
              description: `INR withdrawal #${id} paid out (user ${claimed.userId})`,
            },
          ],
          newTxn!.id,
          tx,
        );
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

      // Mirror the wallet refund in the ledger: release the held funds back
      // to user:UID:main and mark the pending txn as rejected. Pre-B21
      // withdrawals never posted the lock journal, so the refund-side
      // journal is skipped for them (no pending txn → fall-through path).
      const wdTag = `[INR-WD:${id}]`;
      const [pendingTxn] = await tx
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, row.userId),
            eq(transactionsTable.type, "withdrawal"),
            eq(transactionsTable.status, "pending"),
            like(transactionsTable.description, `${wdTag}%`),
          ),
        )
        .limit(1);
      const amountUsdt = parseFloat(row.amountUsdt as string);

      if (pendingTxn) {
        await tx
          .update(transactionsTable)
          .set({
            status: "rejected",
            description:
              `${wdTag} INR withdrawal rejected — ₹${parseFloat(row.amountInr as string).toFixed(2)} refunded` +
              (note ? ` (reason: ${note})` : ""),
          })
          .where(eq(transactionsTable.id, pendingTxn.id));

        await postJournalEntry(
          `inr_wd:${id}:reject`,
          [
            {
              accountCode: "platform:pending_withdrawals",
              entryType: "debit",
              amount: amountUsdt,
              description: `Release held funds — INR withdrawal #${id} rejected`,
            },
            {
              accountCode: `user:${row.userId}:main`,
              entryType: "credit",
              amount: amountUsdt,
              description: `Refund for rejected INR withdrawal #${id}`,
            },
          ],
          pendingTxn.id,
          tx,
        );
      }
      // else: pre-B21 withdrawal — no lock journal exists, wallet refund
      // alone is sufficient. The mismatch reconciliation script handles
      // backfill for any pre-B21 approved withdrawals; rejected ones
      // never had a journal so they remain consistent.

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
