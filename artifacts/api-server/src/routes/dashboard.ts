import { Router } from "express";
import { db, walletsTable, investmentsTable, equityHistoryTable, tradesTable, monthlyPerformanceTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, desc, sum, count } from "drizzle-orm";
import { getSlotData } from "./admin";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { getVipInfo } from "../lib/vip";

const router = Router();
router.use(authMiddleware);

// Per-user "Total Equity" display boost: random $100–$500 every 10 min,
// persisted in wallets.demo_equity_boost. Display-only — never affects real
// balances, withdrawals, profit distribution or any accounting.
const USER_EQUITY_WINDOW_MS = 10 * 60 * 1000;
const USER_EQUITY_BUMP_MIN = 100;
const USER_EQUITY_BUMP_MAX = 500;

// Per-user "Active Trading Fund" display boost: random $100–$1000 every 30 min.
const TRADING_FUND_WINDOW_MS = 30 * 60 * 1000;
const TRADING_FUND_BUMP_MIN = 100;
const TRADING_FUND_BUMP_MAX = 1000;

// Per-user synthetic "Daily P&L" display values (display-only, never real).
//   - One target % per UTC weekday, picked in [DAILY_PNL_MIN_PCT, MAX].
//   - Released as 4 chunks every 4 hours so the card grows during the day.
//   - Sat/Sun (UTC) = market closed: state freezes, frontend shows countdown.
const DAILY_PNL_WINDOW_MS = 4 * 60 * 60 * 1000;
const DAILY_PNL_INCREMENTS = 4;
const DAILY_PNL_MIN_PCT = 0.4;
const DAILY_PNL_MAX_PCT = 0.6;

function isWeekendUtc(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function nextMondayMidnightUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysUntilMon = day === 0 ? 1 : day === 6 ? 2 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMon);
  return d;
}

function generateDailyChunks(targetPct: number): number[] {
  // 4 random positive weights, scaled so they sum to targetPct (≈0.4–0.6%).
  const weights = Array.from({ length: DAILY_PNL_INCREMENTS }, () => 0.5 + Math.random());
  const sumW = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => +((w / sumW) * targetPct).toFixed(4));
}

router.get("/dashboard/summary", async (req: AuthRequest, res) => {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);

  const wallet = wallets[0];
  const inv = invs[0];

  const mainBalance = parseFloat((wallet?.mainBalance as string) ?? "0");
  const tradingBalance = parseFloat((wallet?.tradingBalance as string) ?? "0");
  const profitBalance = parseFloat((wallet?.profitBalance as string) ?? "0");

  // Catch-up the per-user demo equity boost on every summary fetch.
  let demoEquityBoost = parseFloat((wallet?.demoEquityBoost as string) ?? "0");
  let demoEquityLastAt = Number(wallet?.demoEquityLastAt ?? 0);
  if (wallet) {
    const now = Date.now();
    if (!demoEquityLastAt) demoEquityLastAt = now;
    const windows = Math.floor((now - demoEquityLastAt) / USER_EQUITY_WINDOW_MS);
    if (windows > 0) {
      let added = 0;
      for (let i = 0; i < windows; i++) {
        added += USER_EQUITY_BUMP_MIN + Math.floor(Math.random() * (USER_EQUITY_BUMP_MAX - USER_EQUITY_BUMP_MIN + 1));
      }
      demoEquityBoost += added;
      demoEquityLastAt = demoEquityLastAt + windows * USER_EQUITY_WINDOW_MS;
      await db
        .update(walletsTable)
        .set({
          demoEquityBoost: demoEquityBoost.toFixed(2),
          demoEquityLastAt,
        })
        .where(eq(walletsTable.userId, req.userId!));
    } else if (!wallet.demoEquityLastAt) {
      await db
        .update(walletsTable)
        .set({ demoEquityLastAt })
        .where(eq(walletsTable.userId, req.userId!));
    }
  }

  const totalBalance = mainBalance + tradingBalance + profitBalance + demoEquityBoost;

  // Synthetic Daily P&L state (per UTC weekday). Frozen on Sat/Sun.
  const nowDate = new Date();
  const todayUtc = nowDate.toISOString().slice(0, 10);
  const weekend = isWeekendUtc(nowDate);

  let dailyPnlAmount = parseFloat((wallet?.dailyPnlAmount as string) ?? "0");
  let dailyPnlPct = parseFloat((wallet?.dailyPnlPct as string) ?? "0");
  let dailyPnlDay = (wallet?.dailyPnlDay as string) ?? "";
  let dailyPnlTargetPct = parseFloat((wallet?.dailyPnlTargetPct as string) ?? "0");
  let dailyPnlChunks: number[] = (() => {
    try { return JSON.parse((wallet?.dailyPnlChunks as string) ?? "[]"); } catch { return []; }
  })();
  let dailyPnlIncrementsDone = wallet?.dailyPnlIncrementsDone ?? 0;
  let totalProfitBoost = parseFloat((wallet?.totalProfitBoost as string) ?? "0");

  let nextChunkAt: number | null = null;
  let marketOpensAt: number | null = null;

  if (wallet) {
    if (weekend) {
      // Market closed — freeze, expose countdown to next Monday 00:00 UTC.
      marketOpensAt = nextMondayMidnightUtc(nowDate).getTime();
      // Reset visible P&L to 0 for weekend display.
      dailyPnlAmount = 0;
      dailyPnlPct = 0;
    } else {
      // New UTC weekday → roll fresh target + chunk plan.
      if (dailyPnlDay !== todayUtc || dailyPnlChunks.length !== DAILY_PNL_INCREMENTS) {
        dailyPnlTargetPct = +(DAILY_PNL_MIN_PCT + Math.random() * (DAILY_PNL_MAX_PCT - DAILY_PNL_MIN_PCT)).toFixed(4);
        dailyPnlChunks = generateDailyChunks(dailyPnlTargetPct);
        dailyPnlDay = todayUtc;
        dailyPnlIncrementsDone = 0;
        dailyPnlAmount = 0;
        dailyPnlPct = 0;
      }
      // How many 4hr windows have elapsed since UTC midnight (1..4).
      const utcMidnight = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
      const msSinceMidnight = nowDate.getTime() - utcMidnight;
      const expected = Math.min(DAILY_PNL_INCREMENTS, Math.floor(msSinceMidnight / DAILY_PNL_WINDOW_MS) + 1);
      if (dailyPnlIncrementsDone < expected) {
        // Sum only the freshly-dispensed chunks → exact $ delta to add to
        // both Daily P&L and Total Profit so they stay perfectly in sync.
        let newChunksPct = 0;
        for (let i = dailyPnlIncrementsDone; i < expected; i++) {
          newChunksPct += dailyPnlChunks[i] ?? 0;
        }
        const deltaAmount = +(totalBalance * newChunksPct / 100).toFixed(2);
        dailyPnlPct = +(dailyPnlPct + newChunksPct).toFixed(4);
        dailyPnlAmount = +(dailyPnlAmount + deltaAmount).toFixed(2);
        totalProfitBoost = +(totalProfitBoost + deltaAmount).toFixed(2);
        dailyPnlIncrementsDone = expected;
      }
      // Daily P&L amount is monotonic and tied to the actual deltas added —
      // do NOT recompute from totalBalance between bumps (would desync from
      // Total Profit and oscillate as balance fluctuates).
      // Countdown to the next 4hr bump (null once all 4 are done for the day).
      if (dailyPnlIncrementsDone < DAILY_PNL_INCREMENTS) {
        nextChunkAt = utcMidnight + dailyPnlIncrementsDone * DAILY_PNL_WINDOW_MS;
      }

      await db
        .update(walletsTable)
        .set({
          dailyPnlAmount: dailyPnlAmount.toFixed(2),
          dailyPnlPct: dailyPnlPct.toFixed(4),
          dailyPnlDay,
          dailyPnlTargetPct: dailyPnlTargetPct.toFixed(4),
          dailyPnlChunks: JSON.stringify(dailyPnlChunks),
          dailyPnlIncrementsDone,
          totalProfitBoost: totalProfitBoost.toFixed(2),
        })
        .where(eq(walletsTable.userId, req.userId!));
    }
  }

  const dailyProfit = dailyPnlAmount;
  const realTotalProfit = inv ? parseFloat(inv.totalProfit as string) : 0;
  const totalProfit = realTotalProfit + totalProfitBoost;
  const realInvestment = inv ? parseFloat(inv.amount as string) : 0;

  // Catch-up the per-user Active Trading Fund display boost (+$100–$1000 / 30min).
  // First-touch seed: random $500–$2000 so the card never shows $0.
  let tradingFundBoost = parseFloat((wallet?.tradingFundBoost as string) ?? "0");
  let tradingFundLastAt = Number(wallet?.tradingFundLastAt ?? 0);
  if (wallet) {
    const now = Date.now();
    let dirty = false;
    if (tradingFundBoost <= 0) {
      tradingFundBoost = 500 + Math.floor(Math.random() * 1501); // 500–2000
      dirty = true;
    }
    if (!tradingFundLastAt) {
      tradingFundLastAt = now;
      dirty = true;
    }
    const tfWindows = Math.floor((now - tradingFundLastAt) / TRADING_FUND_WINDOW_MS);
    if (tfWindows > 0) {
      let added = 0;
      for (let i = 0; i < tfWindows; i++) {
        added += TRADING_FUND_BUMP_MIN + Math.floor(Math.random() * (TRADING_FUND_BUMP_MAX - TRADING_FUND_BUMP_MIN + 1));
      }
      tradingFundBoost += added;
      tradingFundLastAt = tradingFundLastAt + tfWindows * TRADING_FUND_WINDOW_MS;
      dirty = true;
    }
    if (dirty) {
      await db
        .update(walletsTable)
        .set({
          tradingFundBoost: tradingFundBoost.toFixed(2),
          tradingFundLastAt,
        })
        .where(eq(walletsTable.userId, req.userId!));
    }
  }
  const investmentAmount = realInvestment + tradingFundBoost;

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
    dailyProfitPercent: dailyPnlPct,
    dailyPnl: {
      amount: dailyPnlAmount,
      percent: dailyPnlPct,
      targetPercent: dailyPnlTargetPct,
      incrementsDone: dailyPnlIncrementsDone,
      incrementsTotal: DAILY_PNL_INCREMENTS,
      nextChunkAt,
      marketClosed: weekend,
      marketOpensAt,
    },
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
  const userId = req.userId!;

  // Always derive the chart's right-edge value from the live displayed equity
  // (real wallet + demoEquityBoost). This way, as Total Equity grows, the
  // curve grows with it. Deterministic per-user noise so refetches don't
  // reshuffle the historical shape.
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  const wallet = wallets[0];
  const realBalance = wallet
    ? parseFloat(wallet.mainBalance as string) + parseFloat(wallet.tradingBalance as string) + parseFloat(wallet.profitBalance as string)
    : 0;
  const equityBoost = wallet ? parseFloat(wallet.demoEquityBoost as string) : 0;
  const currentEquity = Math.max(realBalance + equityBoost, 1);

  // Cheap deterministic noise: hash(userId, i) → [-0.5, 0.5).
  const noise = (i: number) => {
    let h = (userId * 2654435761 + i * 1013904223) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return (h / 0xffffffff) - 0.5;
  };

  const points: Array<{ date: string; equity: number; profit: number }> = [];

  if (days <= 1) {
    // Intraday view: hourly points from start of UTC day to now, ending exactly
    // at currentEquity. Earlier hours are slightly below current.
    const now = new Date();
    const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const nowMs = now.getTime();
    const stepMs = 60 * 60 * 1000;
    const numPoints = Math.max(2, Math.floor((nowMs - startMs) / stepMs) + 2);
    const startEquity = currentEquity * 0.9985; // ~0.15% lower at day open
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const ts = startMs + Math.round(t * (nowMs - startMs));
      const wobble = 1 + noise(i) * 0.0006;
      const equity = (startEquity + (currentEquity - startEquity) * t) * wobble;
      points.push({
        date: new Date(ts).toISOString(),
        equity: parseFloat(equity.toFixed(2)),
        profit: parseFloat((equity - startEquity).toFixed(2)),
      });
    }
    // Force the last point to exactly match the live equity.
    points[points.length - 1] = {
      date: new Date(nowMs).toISOString(),
      equity: parseFloat(currentEquity.toFixed(2)),
      profit: parseFloat((currentEquity - startEquity).toFixed(2)),
    };
  } else {
    // Multi-day view: daily points ending today at currentEquity, trending up
    // ~0.4% per trading day on average. Saturday/Sunday flat (market closed).
    const dayMs = 86400000;
    const dailyAvgPct = 0.004;
    // Build forward then reverse so the final point is exactly currentEquity.
    const reversed: Array<{ date: string; equity: number; profit: number }> = [];
    let eq = currentEquity;
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * dayMs);
      const dow = d.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const dayPct = isWeekend ? 0 : dailyAvgPct + noise(i) * 0.003;
      reversed.push({
        date: d.toISOString().split("T")[0]!,
        equity: parseFloat(eq.toFixed(2)),
        profit: parseFloat((eq - currentEquity).toFixed(2)),
      });
      // Step back one day → equity was lower by dayPct (skip on weekend).
      eq = eq / (1 + dayPct);
    }
    points.push(...reversed.reverse());
  }

  // Persist today's equity snapshot to equity_history so a real series builds
  // up over time (charts will eventually use real records once enough exist).
  if (wallet) {
    const todayStr = new Date().toISOString().split("T")[0]!;
    await db
      .insert(equityHistoryTable)
      .values({
        userId,
        date: todayStr,
        equity: currentEquity.toFixed(2),
        profit: (currentEquity - realBalance).toFixed(2),
      })
      .onConflictDoNothing();
  }

  res.json(points);
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

  // Layer the persisted, monotonic Total Equity boost (+$100–$500 every 10 min)
  // on top of real AUM + admin baseline so the displayed equity always trends up.
  const { advanceLiveCounters } = await import("./public");
  const live = await advanceLiveCounters(realActiveInvestors + baselineInvestors, baselineAUM);

  const totalAUM = realAUM + baselineAUM + live.totalEquityBoost;
  const activeCapital = realAUM + baselineActiveCapital + live.totalEquityBoost;
  const reserveFund = realReserve + baselineReserve;
  const activeInvestors = Math.max(realActiveInvestors + baselineInvestors, live.activeInvestors);
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
