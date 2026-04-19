import { Router } from "express";
import { db, investmentsTable, walletsTable, transactionsTable, tradesTable, equityHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { StartInvestmentBody, ToggleCompoundingBody } from "@workspace/api-zod";

const router = Router();
router.use(authMiddleware);

function formatInvestment(inv: typeof investmentsTable.$inferSelect) {
  return {
    id: inv.id,
    userId: inv.userId,
    amount: parseFloat(inv.amount as string),
    riskLevel: inv.riskLevel,
    isActive: inv.isActive,
    autoCompound: inv.autoCompound,
    totalProfit: parseFloat(inv.totalProfit as string),
    dailyProfit: parseFloat(inv.dailyProfit as string),
    drawdown: parseFloat(inv.drawdown as string),
    startedAt: inv.startedAt?.toISOString() ?? null,
    stoppedAt: inv.stoppedAt?.toISOString() ?? null,
  };
}

router.get("/investment", async (req: AuthRequest, res) => {
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);
  if (invs.length === 0) {
    const [newInv] = await db.insert(investmentsTable).values({ userId: req.userId! }).returning();
    res.json(formatInvestment(newInv!));
    return;
  }
  res.json(formatInvestment(invs[0]!));
});

router.post("/investment/start", async (req: AuthRequest, res) => {
  const result = StartInvestmentBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { amount, riskLevel } = result.data;
  if (!["low", "medium", "high"].includes(riskLevel)) {
    res.status(400).json({ error: "Invalid risk level. Use low, medium, or high" });
    return;
  }
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

  const tradingBalance = parseFloat(wallet.tradingBalance as string);
  if (amount > tradingBalance) {
    res.status(400).json({ error: "Insufficient trading balance" });
    return;
  }

  const [updated] = await db.update(investmentsTable)
    .set({
      amount: amount.toString(),
      riskLevel,
      isActive: true,
      dailyProfit: "0",
      drawdown: "0",
      startedAt: new Date(),
      stoppedAt: null,
    })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: "investment",
    amount: amount.toString(),
    status: "completed",
    description: `Started auto trading with $${amount.toFixed(2)} at ${riskLevel} risk`,
  });

  res.json(formatInvestment(updated!));
});

router.post("/investment/stop", async (req: AuthRequest, res) => {
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);
  const inv = invs[0];
  if (!inv) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  const [updated] = await db.update(investmentsTable)
    .set({ isActive: false, stoppedAt: new Date() })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  res.json(formatInvestment(updated!));
});

router.patch("/investment/compounding", async (req: AuthRequest, res) => {
  const result = ToggleCompoundingBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [updated] = await db.update(investmentsTable)
    .set({ autoCompound: result.data.autoCompound })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  res.json(formatInvestment(updated!));
});

router.get("/trades", async (req: AuthRequest, res) => {
  const limit = parseInt(req.query["limit"] as string) || 10;

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, req.userId!))
    .orderBy(desc(tradesTable.executedAt))
    .limit(limit);

  res.json(trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    entryPrice: parseFloat(t.entryPrice as string),
    exitPrice: parseFloat(t.exitPrice as string),
    profit: parseFloat(t.profit as string),
    profitPercent: parseFloat(t.profitPercent as string),
    executedAt: t.executedAt.toISOString(),
  })));
});

export default router;
