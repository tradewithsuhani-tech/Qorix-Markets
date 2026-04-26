import { Router } from "express";
import { db, walletsTable, transactionsTable, investmentsTable, usersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { DepositBody, WithdrawBody, TransferToTradingBody } from "@workspace/api-zod";
import { createNotification } from "../lib/notifications";
import { transactionLogger, errorLogger } from "../lib/logger";
import { emitDepositEvent } from "../lib/event-bus";
import { getVipInfo } from "../lib/vip";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForTransaction,
} from "../lib/ledger-service";
import { verifyOtp, sendTxnEmailToUser } from "../lib/email-service";
import { isSmokeTestUser } from "../lib/smoke-test-account";

const router = Router();
router.use(authMiddleware);

// Block real-money flows for the dedicated post-deploy smoke-test account so a
// stray funded balance can never trigger a real journal entry, on-chain
// withdrawal, or transfer between balances. The smoke check only ever exercises
// read endpoints (GET /auth/me); these guards make sure that even if the check
// is later extended (or someone hits these routes manually with the smoke
// token) nothing real moves.
async function blockSmokeTestRealMoney(
  userId: number,
  res: import("express").Response,
  flow: "deposit" | "withdraw" | "transfer",
): Promise<boolean> {
  if (await isSmokeTestUser(userId)) {
    res.status(403).json({
      error: "smoke_test_account_blocked",
      message: `The deploy smoke-test account is read-only — ${flow} is disabled.`,
    });
    return true;
  }
  return false;
}

function formatWallet(w: typeof walletsTable.$inferSelect, points = 0) {
  return {
    id: w.id,
    userId: w.userId,
    mainBalance: parseFloat(w.mainBalance as string),
    tradingBalance: parseFloat(w.tradingBalance as string),
    profitBalance: parseFloat(w.profitBalance as string),
    points,
    updatedAt: w.updatedAt.toISOString(),
  };
}

async function getUserPoints(userId: number): Promise<number> {
  const rows = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return rows[0]?.points ?? 0;
}

router.get("/wallet", async (req: AuthRequest, res) => {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const points = await getUserPoints(req.userId!);
  if (wallets.length === 0) {
    const [newWallet] = await db.insert(walletsTable).values({ userId: req.userId! }).returning();
    res.json(formatWallet(newWallet!, points));
    return;
  }
  res.json(formatWallet(wallets[0]!, points));
});

router.post("/wallet/deposit", async (req: AuthRequest, res) => {
  const result = DepositBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { amount } = result.data;
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  if (await blockSmokeTestRealMoney(req.userId!, res, "deposit")) return;

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const newMain = parseFloat(wallet.mainBalance as string) + amount;

  const [updated, txnRecord] = await db.transaction(async (tx) => {
    await ensureUserAccounts(req.userId!, tx);

    const [w] = await tx
      .update(walletsTable)
      .set({ mainBalance: newMain.toString(), updatedAt: new Date() })
      .where(eq(walletsTable.userId, req.userId!))
      .returning();

    const [txn] = await tx
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "deposit",
        amount: amount.toString(),
        status: "completed",
        description: `USDT deposit of $${amount.toFixed(2)}`,
      })
      .returning();

    await postJournalEntry(
      journalForTransaction(txn!.id),
      [
        { accountCode: "platform:usdt_pool", entryType: "debit", amount, description: `Deposit received from user ${req.userId!}` },
        { accountCode: `user:${req.userId!}:main`, entryType: "credit", amount, description: `Deposit credited to main wallet` },
      ],
      txn!.id,
      tx,
    );

    return [w, txn] as const;
  });

  transactionLogger.info(
    { event: "deposit", userId: req.userId!, amount, newMainBalance: newMain },
    "Deposit completed",
  );

  await createNotification(
    req.userId!,
    "deposit",
    "Deposit Confirmed",
    `$${amount.toFixed(2)} USDT has been credited to your main balance.`,
  );

  sendTxnEmailToUser(
    req.userId!,
    "Deposit Confirmed",
    `Great news — your USDT deposit has been confirmed and credited to your account.\n\n` +
      `Amount: $${amount.toFixed(2)} USDT\n` +
      `Credited to: Main Balance\n` +
      `New Main Balance: $${newMain.toFixed(2)} USDT\n\n` +
      `You can now transfer funds to your Trading Balance and start earning with our AI strategies.\n\n` +
      `If you did not initiate this deposit, please contact support immediately.`,
  );

  emitDepositEvent({ userId: req.userId!, amount, newMainBalance: newMain }).catch((err) => {
    errorLogger.error({ err, userId: req.userId!, amount }, "Failed to emit deposit event");
  });

  res.json(formatWallet(updated!));
});

// Withdrawal lock window for brand-new accounts (anti-fraud cool-off)
const NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS = 24;
// 1 point = $0.01 fee discount; max 50% of fee can be redeemed
const POINTS_TO_FEE_RATE = 0.01;
const MAX_FEE_DISCOUNT_RATIO = 0.5;

router.post("/wallet/withdraw", async (req: AuthRequest, res) => {
  const result = WithdrawBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (await blockSmokeTestRealMoney(req.userId!, res, "withdraw")) return;

  const { amount, walletAddress } = result.data;

  // --- User status / KYC / cool-off checks ---
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
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  if (accountAgeMs < NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil(NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS - accountAgeMs / 3_600_000);
    res.status(403).json({
      error: "withdrawal_locked_new_account",
      message: `New accounts must wait ${NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS}h before first withdrawal (${hoursLeft}h remaining)`,
    });
    return;
  }

  // --- Withdrawal OTP verification ---
  const { otp } = req.body;
  if (!otp || typeof otp !== "string") {
    res.status(400).json({ error: "withdrawal_otp_required", message: "Please request a withdrawal OTP first" });
    return;
  }

  const otpResult = await verifyOtp(req.userId!, otp, "withdrawal_confirm");
  if (!otpResult.valid) {
    res.status(400).json({ error: "invalid_otp", message: otpResult.error ?? "Invalid or expired OTP" });
    return;
  }
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const rawSource = (req.body?.source as string | undefined) ?? "profit";
  const source: "main" | "profit" = rawSource === "main" ? "main" : "profit";

  const profitBalance = parseFloat(wallet.profitBalance as string);
  const mainBalance = parseFloat(wallet.mainBalance as string);
  const sourceBalance = source === "main" ? mainBalance : profitBalance;
  if (amount > sourceBalance) {
    res.status(400).json({ error: `Insufficient ${source} balance` });
    return;
  }

  const invRows = await db
    .select({ amount: investmentsTable.amount, isActive: investmentsTable.isActive })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, req.userId!))
    .limit(1);
  // VIP tier for withdrawal fee is based on ACTIVE investment only.
  const investmentAmount =
    invRows[0] && invRows[0].isActive ? parseFloat(invRows[0].amount as string) : 0;
  const vipInfo = getVipInfo(investmentAmount);
  const grossFee = parseFloat((amount * vipInfo.withdrawalFee).toFixed(8));

  // --- Optional points-based fee discount ---
  const requestedPoints = Math.max(0, parseInt(req.body?.usePoints, 10) || 0);
  const maxFeeDiscount = parseFloat((grossFee * MAX_FEE_DISCOUNT_RATIO).toFixed(8));
  const maxPointsByValue = Math.floor(maxFeeDiscount / POINTS_TO_FEE_RATE);
  const pointsToSpend = Math.min(requestedPoints, user.points, maxPointsByValue);
  const feeDiscount = parseFloat((pointsToSpend * POINTS_TO_FEE_RATE).toFixed(8));
  const feeAmount = parseFloat((grossFee - feeDiscount).toFixed(8));
  const netAmount = parseFloat((amount - feeAmount).toFixed(8));

  const { sql } = await import("drizzle-orm");
  const { pointsTransactionsTable } = await import("@workspace/db");

  let txnRecord: typeof transactionsTable.$inferSelect | undefined;
  try {
    txnRecord = await db.transaction(async (tx) => {
      await ensureUserAccounts(req.userId!, tx);

      // --- Atomic guarded balance debit (prevents over-withdrawal under concurrency) ---
      const balanceCol = source === "main" ? walletsTable.mainBalance : walletsTable.profitBalance;
      const balanceColName = source === "main" ? "mainBalance" : "profitBalance";
      const balanceUpdate: Record<string, any> = {
        updatedAt: new Date(),
        [balanceColName]: sql`${balanceCol} - ${amount}`,
      };
      const debitResult = await tx
        .update(walletsTable)
        .set(balanceUpdate)
        .where(and(eq(walletsTable.userId, req.userId!), gte(balanceCol, amount.toString())))
        .returning({ id: walletsTable.id });
      if (debitResult.length === 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const userAccountCode = `user:${req.userId!}:${source}`;

      // --- Atomic guarded points debit (prevents double-spend under concurrency) ---
      if (pointsToSpend > 0) {
        const pointsResult = await tx
          .update(usersTable)
          .set({ points: sql`${usersTable.points} - ${pointsToSpend}` })
          .where(and(eq(usersTable.id, req.userId!), gte(usersTable.points, pointsToSpend)))
          .returning({ id: usersTable.id });
        if (pointsResult.length === 0) {
          throw new Error("INSUFFICIENT_POINTS");
        }
        await tx.insert(pointsTransactionsTable).values({
          userId: req.userId!,
          amount: -pointsToSpend,
          type: "withdrawal_discount",
          description: `Spent ${pointsToSpend} points for $${feeDiscount.toFixed(2)} fee discount`,
        });
      }

    if (feeAmount > 0) {
      const feeDescParts = [`${(vipInfo.withdrawalFee * 100).toFixed(1)}% · ${vipInfo.label} tier`];
      if (feeDiscount > 0) feeDescParts.push(`-$${feeDiscount.toFixed(2)} points discount`);
      const [feeTxn] = await tx
        .insert(transactionsTable)
        .values({
          userId: req.userId!,
          type: "fee",
          amount: feeAmount.toString(),
          status: "completed",
          description: `Withdrawal fee (${feeDescParts.join(" · ")})`,
        })
        .returning();

      await postJournalEntry(
        journalForTransaction(feeTxn!.id),
        [
          { accountCode: userAccountCode, entryType: "debit", amount: feeAmount, description: `Withdrawal fee charged` },
          { accountCode: "platform:fee_revenue", entryType: "credit", amount: feeAmount, description: `Fee revenue — ${vipInfo.label} tier` },
        ],
        feeTxn!.id,
        tx,
      );
    }

    const [withdrawalTxn] = await tx
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "withdrawal",
        amount: netAmount.toString(),
        status: "pending",
        description: `Withdrawal from ${source} to ${walletAddress}${feeAmount > 0 ? ` (fee: $${feeAmount.toFixed(2)})` : ""}`,
        walletAddress,
      })
      .returning();

    await postJournalEntry(
      journalForTransaction(withdrawalTxn!.id),
      [
        { accountCode: userAccountCode, entryType: "debit", amount: netAmount, description: `Withdrawal requested to ${walletAddress}` },
        { accountCode: "platform:usdt_pool", entryType: "credit", amount: netAmount, description: `Withdrawal outflow` },
      ],
      withdrawalTxn!.id,
      tx,
    );

      return withdrawalTxn!;
    });
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: `Insufficient ${source} balance` });
      return;
    }
    if (err?.message === "INSUFFICIENT_POINTS") {
      res.status(400).json({ error: "Insufficient points balance" });
      return;
    }
    throw err;
  }

  transactionLogger.info(
    {
      event: "withdrawal_requested",
      userId: req.userId!,
      amount,
      netAmount,
      feeAmount,
      vipTier: vipInfo.tier,
      walletAddress: `${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}`,
      transactionId: txnRecord!.id,
    },
    "Withdrawal request created",
  );

  await createNotification(
    req.userId!,
    "withdrawal",
    "Withdrawal Requested",
    `Your withdrawal of $${netAmount.toFixed(2)} USDT (after $${feeAmount.toFixed(2)} fee) to ${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)} is pending review.`,
  );

  sendTxnEmailToUser(
    req.userId!,
    "Withdrawal Requested",
    `We have received your withdrawal request and it is now pending review by our team.\n\n` +
      `Net Amount: $${netAmount.toFixed(2)} USDT\n` +
      `Network Fee: $${feeAmount.toFixed(2)} USDT (${(vipInfo.withdrawalFee * 100).toFixed(1)}% — ${vipInfo.label} tier)\n` +
      `Destination Wallet (TRC20): ${walletAddress}\n` +
      `Request ID: #${txnRecord!.id}\n\n` +
      `Withdrawals are typically processed within a few hours during business hours. ` +
      `You will receive another email confirmation as soon as the on-chain transaction has been broadcast.\n\n` +
      `If you did not request this withdrawal, please contact support immediately.`,
  );

  res.json({
    id: txnRecord!.id,
    userId: txnRecord!.userId,
    type: txnRecord!.type,
    amount: parseFloat(txnRecord!.amount as string),
    status: txnRecord!.status,
    description: txnRecord!.description,
    createdAt: txnRecord!.createdAt.toISOString(),
  });
});

router.post("/wallet/transfer", async (req: AuthRequest, res) => {
  const result = TransferToTradingBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (await blockSmokeTestRealMoney(req.userId!, res, "transfer")) return;

  const { amount } = result.data;
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const mainBalance = parseFloat(wallet.mainBalance as string);
  if (amount > mainBalance) {
    res.status(400).json({ error: "Insufficient main balance" });
    return;
  }

  const tradingBalance = parseFloat(wallet.tradingBalance as string);

  const [updated] = await db.transaction(async (tx) => {
    await ensureUserAccounts(req.userId!, tx);

    const [w] = await tx
      .update(walletsTable)
      .set({
        mainBalance: (mainBalance - amount).toString(),
        tradingBalance: (tradingBalance + amount).toString(),
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, req.userId!))
      .returning();

    const [txn] = await tx
      .insert(transactionsTable)
      .values({
        userId: req.userId!,
        type: "transfer",
        amount: amount.toString(),
        status: "completed",
        description: `Transfer $${amount.toFixed(2)} to trading balance`,
      })
      .returning();

    await postJournalEntry(
      journalForTransaction(txn!.id),
      [
        { accountCode: `user:${req.userId!}:main`, entryType: "debit", amount, description: `Transfer out of main wallet` },
        { accountCode: `user:${req.userId!}:trading`, entryType: "credit", amount, description: `Transfer into trading wallet` },
      ],
      txn!.id,
      tx,
    );

    return [w] as const;
  });

  transactionLogger.info(
    {
      event: "transfer_to_trading",
      userId: req.userId!,
      amount,
      newMainBalance: mainBalance - amount,
      newTradingBalance: tradingBalance + amount,
    },
    "Transfer to trading balance completed",
  );

  res.json(formatWallet(updated!));
});

export default router;
