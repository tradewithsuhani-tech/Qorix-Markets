import { Router } from "express";
import { db, walletsTable, transactionsTable, investmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

const router = Router();
router.use(authMiddleware);

function formatWallet(w: typeof walletsTable.$inferSelect) {
  return {
    id: w.id,
    userId: w.userId,
    mainBalance: parseFloat(w.mainBalance as string),
    tradingBalance: parseFloat(w.tradingBalance as string),
    profitBalance: parseFloat(w.profitBalance as string),
    updatedAt: w.updatedAt.toISOString(),
  };
}

router.get("/wallet", async (req: AuthRequest, res) => {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  if (wallets.length === 0) {
    const [newWallet] = await db.insert(walletsTable).values({ userId: req.userId! }).returning();
    res.json(formatWallet(newWallet!));
    return;
  }
  res.json(formatWallet(wallets[0]!));
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

  emitDepositEvent({ userId: req.userId!, amount, newMainBalance: newMain }).catch((err) => {
    errorLogger.error({ err, userId: req.userId!, amount }, "Failed to emit deposit event");
  });

  res.json(formatWallet(updated!));
});

router.post("/wallet/withdraw", async (req: AuthRequest, res) => {
  const result = WithdrawBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { amount, walletAddress } = result.data;
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const profitBalance = parseFloat(wallet.profitBalance as string);
  if (amount > profitBalance) {
    res.status(400).json({ error: "Insufficient profit balance" });
    return;
  }

  const invRows = await db
    .select({ amount: investmentsTable.amount })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, req.userId!))
    .limit(1);
  const investmentAmount = invRows[0] ? parseFloat(invRows[0].amount as string) : 0;
  const vipInfo = getVipInfo(investmentAmount);
  const feeAmount = parseFloat((amount * vipInfo.withdrawalFee).toFixed(8));
  const netAmount = parseFloat((amount - feeAmount).toFixed(8));

  const [txnRecord] = await db.transaction(async (tx) => {
    await ensureUserAccounts(req.userId!, tx);

    await tx
      .update(walletsTable)
      .set({ profitBalance: (profitBalance - amount).toString(), updatedAt: new Date() })
      .where(eq(walletsTable.userId, req.userId!));

    if (feeAmount > 0) {
      const [feeTxn] = await tx
        .insert(transactionsTable)
        .values({
          userId: req.userId!,
          type: "fee",
          amount: feeAmount.toString(),
          status: "completed",
          description: `Withdrawal fee (${(vipInfo.withdrawalFee * 100).toFixed(1)}% · ${vipInfo.label} tier)`,
        })
        .returning();

      await postJournalEntry(
        journalForTransaction(feeTxn!.id),
        [
          { accountCode: `user:${req.userId!}:profit`, entryType: "debit", amount: feeAmount, description: `Withdrawal fee charged` },
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
        description: `Withdrawal to ${walletAddress}${feeAmount > 0 ? ` (fee: $${feeAmount.toFixed(2)})` : ""}`,
        walletAddress,
      })
      .returning();

    await postJournalEntry(
      journalForTransaction(withdrawalTxn!.id),
      [
        { accountCode: `user:${req.userId!}:profit`, entryType: "debit", amount: netAmount, description: `Withdrawal requested to ${walletAddress}` },
        { accountCode: "platform:usdt_pool", entryType: "credit", amount: netAmount, description: `Withdrawal outflow` },
      ],
      withdrawalTxn!.id,
      tx,
    );

    return [withdrawalTxn] as const;
  });

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
