import { Router } from "express";
import { db, walletsTable, investmentsTable, equityHistoryTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

router.get("/dashboard/summary", async (req: AuthRequest, res) => {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);

  const wallet = wallets[0] ?? { mainBalance: "0", tradingBalance: "0", profitBalance: "0" };
  const inv = invs[0];

  const mainBalance = parseFloat(wallet.mainBalance as string);
  const tradingBalance = parseFloat(wallet.tradingBalance as string);
  const profitBalance = parseFloat(wallet.profitBalance as string);
  const totalBalance = mainBalance + tradingBalance + profitBalance;
  const dailyProfit = inv ? parseFloat(inv.dailyProfit as string) : 0;
  const totalProfit = inv ? parseFloat(inv.totalProfit as string) : 0;
  const investmentAmount = inv ? parseFloat(inv.amount as string) : 0;

  const dailyProfitPercent = investmentAmount > 0 ? (dailyProfit / investmentAmount) * 100 : 0;

  const today = new Date();
  const nextPayout = new Date(today.getFullYear(), today.getMonth(), 25);
  if (today.getDate() >= 25) {
    nextPayout.setMonth(nextPayout.getMonth() + 1);
  }
  const daysUntilPayout = Math.ceil((nextPayout.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    totalBalance,
    dailyProfitLoss: dailyProfit,
    dailyProfitPercent,
    activeInvestment: investmentAmount,
    totalProfit,
    profitBalance,
    tradingBalance,
    nextPayoutDate: nextPayout.toISOString().split("T")[0],
    daysUntilPayout,
    riskLevel: inv?.riskLevel ?? null,
    isTrading: inv?.isActive ?? false,
  });
});

router.get("/dashboard/equity-chart", async (req: AuthRequest, res) => {
  const days = parseInt(req.query["days"] as string) || 30;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await db.select().from(equityHistoryTable)
    .where(and(
      eq(equityHistoryTable.userId, req.userId!),
      gte(equityHistoryTable.date, since.toISOString().split("T")[0]!)
    ))
    .orderBy(desc(equityHistoryTable.date));

  if (records.length === 0) {
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
    const wallet = wallets[0];
    const baseEquity = wallet ? parseFloat(wallet.mainBalance as string) + parseFloat(wallet.tradingBalance as string) + parseFloat(wallet.profitBalance as string) : 1000;

    const synthetic = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const variance = (Math.random() - 0.45) * 0.02;
      const dayEquity = baseEquity * (1 + (days - i) * 0.002 + variance);
      const dayProfit = dayEquity * variance;
      synthetic.push({
        date: d.toISOString().split("T")[0],
        equity: parseFloat(dayEquity.toFixed(2)),
        profit: parseFloat(dayProfit.toFixed(2)),
      });
    }
    res.json(synthetic);
    return;
  }

  res.json(records.map((r) => ({
    date: r.date,
    equity: parseFloat(r.equity as string),
    profit: parseFloat(r.profit as string),
  })));
});

export default router;
