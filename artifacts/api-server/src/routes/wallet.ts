import { Router } from "express";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { DepositBody, WithdrawBody, TransferToTradingBody } from "@workspace/api-zod";

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
  const [updated] = await db.update(walletsTable)
    .set({ mainBalance: newMain.toString(), updatedAt: new Date() })
    .where(eq(walletsTable.userId, req.userId!))
    .returning();

  await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: "deposit",
    amount: amount.toString(),
    status: "completed",
    description: `USDT deposit of $${amount.toFixed(2)}`,
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

  await db.update(walletsTable)
    .set({ profitBalance: (profitBalance - amount).toString(), updatedAt: new Date() })
    .where(eq(walletsTable.userId, req.userId!));

  const [tx] = await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: "withdrawal",
    amount: amount.toString(),
    status: "pending",
    description: `Withdrawal to ${walletAddress}`,
    walletAddress,
  }).returning();

  res.json({
    id: tx!.id,
    userId: tx!.userId,
    type: tx!.type,
    amount: parseFloat(tx!.amount as string),
    status: tx!.status,
    description: tx!.description,
    createdAt: tx!.createdAt.toISOString(),
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
  const [updated] = await db.update(walletsTable)
    .set({
      mainBalance: (mainBalance - amount).toString(),
      tradingBalance: (tradingBalance + amount).toString(),
      updatedAt: new Date(),
    })
    .where(eq(walletsTable.userId, req.userId!))
    .returning();

  await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: "transfer",
    amount: amount.toString(),
    status: "completed",
    description: `Transfer $${amount.toFixed(2)} to trading balance`,
  });

  res.json(formatWallet(updated!));
});

export default router;
