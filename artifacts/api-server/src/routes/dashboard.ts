import { Router } from "express";
import { db, walletsTable, investmentsTable, equityHistoryTable, tradesTable, monthlyPerformanceTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, desc, sum, count } from "drizzle-orm";
import { getSlotData } from "./admin";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { getVipInfo } from "../lib/vip";

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

  const vipInfo = getVipInfo(investmentAmount);

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
    vip: {
      tier: vipInfo.tier,
      label: vipInfo.label,
      profitBonus: vipInfo.profitBonus,
      withdrawalFee: vipInfo.withdrawalFee,
      minAmount: vipInfo.minAmount,
      nextTier: vipInfo.nextTier ?? null,
    },
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

router.get("/dashboard/performance", async (req: AuthRequest, res) => {
  const allTrades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, req.userId!))
    .orderBy(desc(tradesTable.executedAt));

  const totalTrades = allTrades.length;
  const winningTrades = allTrades.filter(t => parseFloat(t.profit as string) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const avgReturn = totalTrades > 0
    ? allTrades.reduce((acc, t) => acc + parseFloat(t.profitPercent as string), 0) / totalTrades
    : 0;

  const inv = await db.select().from(investmentsTable)
    .where(eq(investmentsTable.userId, req.userId!)).limit(1);
  const investment = inv[0];

  const drawdown = investment ? parseFloat(investment.drawdown as string) : 0;
  const riskLevel = investment?.riskLevel ?? "low";
  const riskScore = riskLevel === "high" ? "High" : riskLevel === "medium" ? "Medium" : "Low";

  const equityRecords = await db.select().from(equityHistoryTable)
    .where(eq(equityHistoryTable.userId, req.userId!))
    .orderBy(desc(equityHistoryTable.date))
    .limit(30);

  let maxDrawdownPct = 0;
  if (equityRecords.length > 1) {
    const equities = equityRecords.map(r => parseFloat(r.equity as string)).reverse();
    let peak = equities[0]!;
    for (const e of equities) {
      if (e > peak) peak = e;
      const dd = peak > 0 ? ((peak - e) / peak) * 100 : 0;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  const rollingReturns: { period: string; return: number }[] = [];
  const periods = [{ label: "7D", days: 7 }, { label: "30D", days: 30 }, { label: "90D", days: 90 }];
  for (const { label, days } of periods) {
    const slice = equityRecords.slice(0, days);
    if (slice.length >= 2) {
      const first = parseFloat(slice[slice.length - 1]!.equity as string);
      const last = parseFloat(slice[0]!.equity as string);
      rollingReturns.push({ period: label, return: first > 0 ? ((last - first) / first) * 100 : 0 });
    } else {
      rollingReturns.push({ period: label, return: 0 });
    }
  }

  res.json({
    winRate: parseFloat(winRate.toFixed(1)),
    totalTrades,
    avgReturn: parseFloat(avgReturn.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdownPct.toFixed(2)),
    drawdown: parseFloat(drawdown.toFixed(2)),
    riskScore,
    rollingReturns,
  });
});

router.get("/dashboard/fund-stats", async (req: AuthRequest, res) => {
  const [aumResult] = await db
    .select({ total: sum(investmentsTable.amount) })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));

  const [allMainResult] = await db
    .select({ total: sum(walletsTable.mainBalance) })
    .from(walletsTable);

  const [allProfitResult] = await db
    .select({ total: sum(walletsTable.profitBalance) })
    .from(walletsTable);

  const [activeCountResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));

  const realAUM = parseFloat(String(aumResult?.total ?? "0")) || 0;
  const realReserve = (parseFloat(String(allMainResult?.total ?? "0")) || 0) +
    (parseFloat(String(allProfitResult?.total ?? "0")) || 0);
  const realActiveInvestors = Number(activeCountResult?.count ?? 0);

  // Public-facing baselines so the platform doesn't show $0 to brand-new
  // visitors. These are admin-controlled (admin/settings) and added on top of
  // real on-platform numbers. They never affect any user balance, P&L,
  // accounting journal or withdrawal logic — display only.
  const settingRows = await db.select().from(systemSettingsTable);
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  const baselineAUM = Number(settings["baseline_total_aum"] ?? "0") || 0;
  const baselineActiveCapital = Number(settings["baseline_active_capital"] ?? "0") || 0;
  const baselineReserve = Number(settings["baseline_reserve_fund"] ?? "0") || 0;
  const baselineInvestors = Number(settings["baseline_active_investors"] ?? "0") || 0;

  const totalAUM = realAUM + baselineAUM;
  const activeCapital = realAUM + baselineActiveCapital;
  const reserveFund = realReserve + baselineReserve;
  const activeInvestors = realActiveInvestors + baselineInvestors;
  const slotData = await getSlotData();

  res.json({
    totalAUM,
    activeCapital,
    reserveFund,
    activeInvestors,
    utilizationRate: (activeCapital + reserveFund) > 0
      ? parseFloat(((activeCapital / (activeCapital + reserveFund)) * 100).toFixed(1))
      : 0,
    maxSlots: slotData.maxSlots,
    availableSlots: slotData.availableSlots,
    isFull: slotData.isFull,
  });
});

router.get("/dashboard/monthly-performance", async (req: AuthRequest, res) => {
  const filter = (req.query["filter"] as string) || "6m";

  let since: string | null = null;
  if (filter === "3m") {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    since = d.toISOString().slice(0, 7)!;
  } else if (filter === "6m") {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    since = d.toISOString().slice(0, 7)!;
  }

  const conditions = [eq(monthlyPerformanceTable.userId, req.userId!)];
  if (since) {
    conditions.push(gte(monthlyPerformanceTable.yearMonth, since));
  }

  const records = await db
    .select()
    .from(monthlyPerformanceTable)
    .where(and(...conditions))
    .orderBy(monthlyPerformanceTable.yearMonth);

  res.json(
    records.map((r) => ({
      yearMonth: r.yearMonth,
      monthlyReturn: parseFloat(r.monthlyReturn as string),
      maxDrawdown: parseFloat(r.maxDrawdown as string),
      winRate: parseFloat(r.winRate as string),
      totalProfit: parseFloat(r.totalProfit as string),
      tradingDays: r.tradingDays,
      winningDays: r.winningDays,
      startEquity: parseFloat(r.startEquity as string),
      peakEquity: parseFloat(r.peakEquity as string),
    })),
  );
});

export default router;
