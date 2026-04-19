import {
  db,
  walletsTable,
  investmentsTable,
  transactionsTable,
  tradesTable,
  equityHistoryTable,
  systemSettingsTable,
  dailyProfitRunsTable,
  usersTable,
  monthlyPerformanceTable,
} from "@workspace/db";
import { eq, gt, and } from "drizzle-orm";
import { logger } from "./logger";
import { createNotification } from "./notifications";
import { getVipInfo } from "./vip";

export const DRAWDOWN_LIMITS: Record<string, number> = {
  low: 0.03,
  medium: 0.05,
  high: 0.10,
};

export const RISK_MULTIPLIERS: Record<string, number> = {
  low: 0.6,
  medium: 1.0,
  high: 1.5,
};

export const RISK_PROFILES = {
  LOW: {
    name: "Conservative",
    multiplier: 0.6,
    drawdownLimit: 0.03,
    minDailyPct: 0.3,
    maxDailyPct: 0.6,
    description: "Capital-first strategy. Minimal volatility with steady, predictable gains.",
    volatility: "Low",
    score: 2,
  },
  MEDIUM: {
    name: "Balanced",
    multiplier: 1.0,
    drawdownLimit: 0.05,
    minDailyPct: 0.5,
    maxDailyPct: 1.0,
    description: "Optimized risk/reward ratio. Consistent returns with moderate exposure.",
    volatility: "Medium",
    score: 5,
  },
  HIGH: {
    name: "Aggressive",
    multiplier: 1.5,
    drawdownLimit: 0.10,
    minDailyPct: 0.75,
    maxDailyPct: 1.5,
    description: "Maximum yield strategy. Higher returns with elevated market exposure.",
    volatility: "High",
    score: 8,
  },
} as const;

const REFERRAL_MONTHLY_RATE = 0.005;
const DAYS_PER_MONTH = 30;
const REFERRAL_DAILY_RATE = REFERRAL_MONTHLY_RATE / DAYS_PER_MONTH;

export async function getLastDailyProfitPercent(): Promise<number> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "daily_profit_percent"))
    .limit(1);
  return rows.length > 0 ? parseFloat(rows[0]!.value) : 0;
}

export interface DistributeProfitResult {
  investorsAffected: number;
  totalProfitDistributed: number;
  totalAUM: number;
  referralBonusPaid: number;
}

export async function distributeDailyProfit(
  profitPercent: number,
): Promise<DistributeProfitResult> {
  if (profitPercent < -100 || profitPercent > 100) {
    throw new Error("Profit percent must be between -100 and 100");
  }

  let investorsAffected = 0;
  let totalProfitDistributed = 0;
  let totalReferralBonusPaid = 0;

  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettingsTable)
      .values({ key: "daily_profit_percent", value: profitPercent.toString() })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value: profitPercent.toString(), updatedAt: new Date() },
      });

    const activeInvestments = await tx
      .select()
      .from(investmentsTable)
      .where(eq(investmentsTable.isActive, true));

    const todayStr = new Date().toISOString().split("T")[0]!;

    const totalAUM = activeInvestments.reduce(
      (acc, inv) => acc + parseFloat(inv.amount as string),
      0,
    );

    for (const inv of activeInvestments) {
      const amount = parseFloat(inv.amount as string);
      const totalProfit = parseFloat(inv.totalProfit as string);
      const currentDrawdown = parseFloat(inv.drawdown as string);
      const currentPeakBalance = parseFloat(inv.peakBalance as string) || amount;
      const drawdownLimitPct = parseFloat(inv.drawdownLimit as string) || (DRAWDOWN_LIMITS[inv.riskLevel] ?? 0.05) * 100;
      const drawdownLimitAmt = (drawdownLimitPct / 100) * amount;

      if (currentDrawdown >= drawdownLimitAmt) {
        await tx
          .update(investmentsTable)
          .set({ isActive: false, isPaused: true, stoppedAt: new Date(), pausedAt: new Date() })
          .where(eq(investmentsTable.userId, inv.userId));

        await tx.insert(transactionsTable).values({
          userId: inv.userId,
          type: "system",
          amount: "0",
          status: "completed",
          description: `Capital Protection triggered: drawdown limit of ${drawdownLimitPct}% reached. Trading paused automatically.`,
        });

        await createNotification(
          inv.userId,
          "drawdown_alert",
          "⚠️ Capital Protection Triggered",
          `Your drawdown reached the ${drawdownLimitPct}% limit. Trading has been automatically paused. $${Math.max(0, amount - currentDrawdown).toFixed(2)} USDT is secured in your wallet.`,
        );

        logger.info({ userId: inv.userId, drawdownLimitPct }, "Investment paused: capital protection triggered");
        continue;
      }

      const riskKey = (inv.riskLevel ?? "medium").toLowerCase();
      const riskMultiplier = RISK_MULTIPLIERS[riskKey] ?? 1.0;
      const adjustedProfitPercent = profitPercent * riskMultiplier;
      const baseDailyProfit = amount * (adjustedProfitPercent / 100);
      const vipInfo = getVipInfo(amount);
      const vipBonus = baseDailyProfit > 0 ? baseDailyProfit * vipInfo.profitBonus : 0;
      const dailyProfitAmount = baseDailyProfit + vipBonus;
      const newTotalProfit = totalProfit + dailyProfitAmount;

      let newDrawdown = currentDrawdown;
      if (profitPercent < 0) {
        newDrawdown = currentDrawdown + Math.abs(dailyProfitAmount);
      }

      const equityAfterToday = inv.autoCompound
        ? amount + dailyProfitAmount
        : amount + (totalProfit + dailyProfitAmount);
      const newPeakBalance = Math.max(currentPeakBalance, equityAfterToday);

      const walletRows = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, inv.userId))
        .limit(1);

      if (walletRows.length === 0) continue;
      const wallet = walletRows[0]!;
      const profitBalance = parseFloat(wallet.profitBalance as string);
      const tradingBalance = parseFloat(wallet.tradingBalance as string);

      if (inv.autoCompound) {
        await tx
          .update(walletsTable)
          .set({
            tradingBalance: (tradingBalance + dailyProfitAmount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, inv.userId));

        await tx
          .update(investmentsTable)
          .set({
            amount: (amount + dailyProfitAmount).toString(),
            totalProfit: newTotalProfit.toString(),
            dailyProfit: dailyProfitAmount.toString(),
            drawdown: newDrawdown.toString(),
            peakBalance: newPeakBalance.toString(),
          })
          .where(eq(investmentsTable.userId, inv.userId));
      } else {
        await tx
          .update(walletsTable)
          .set({
            profitBalance: (profitBalance + dailyProfitAmount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, inv.userId));

        await tx
          .update(investmentsTable)
          .set({
            totalProfit: newTotalProfit.toString(),
            dailyProfit: dailyProfitAmount.toString(),
            drawdown: newDrawdown.toString(),
            peakBalance: newPeakBalance.toString(),
          })
          .where(eq(investmentsTable.userId, inv.userId));
      }

      const vipDesc = vipInfo.tier !== "none" ? ` · ${vipInfo.label} VIP +${(vipInfo.profitBonus * 100).toFixed(0)}% bonus` : "";
      await tx.insert(transactionsTable).values({
        userId: inv.userId,
        type: "profit",
        amount: dailyProfitAmount.toString(),
        status: "completed",
        description: `Daily profit (${inv.riskLevel} risk, ${adjustedProfitPercent.toFixed(2)}% effective rate${vipDesc})`,
      });

      await createNotification(
        inv.userId,
        "daily_profit",
        dailyProfitAmount >= 0 ? "Daily Profit Credited" : "Daily Loss Recorded",
        dailyProfitAmount >= 0
          ? `+$${dailyProfitAmount.toFixed(2)} USDT earned today (${adjustedProfitPercent.toFixed(2)}% · ${inv.riskLevel} risk${vipInfo.tier !== "none" ? ` · ${vipInfo.label} VIP` : ""}).`
          : `$${Math.abs(dailyProfitAmount).toFixed(2)} USDT drawdown recorded today (${adjustedProfitPercent.toFixed(2)}%).`,
      );

      const currentEquity = inv.autoCompound ? amount + dailyProfitAmount : amount;
      await tx
        .insert(equityHistoryTable)
        .values({
          userId: inv.userId,
          date: todayStr,
          equity: currentEquity.toString(),
          profit: dailyProfitAmount.toString(),
        })
        .onConflictDoNothing();

      // Update monthly performance
      const yearMonth = todayStr.slice(0, 7)!;
      const isWinningDay = dailyProfitAmount > 0;
      const existing = await tx
        .select()
        .from(monthlyPerformanceTable)
        .where(
          and(
            eq(monthlyPerformanceTable.userId, inv.userId),
            eq(monthlyPerformanceTable.yearMonth, yearMonth),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        const startEquity = currentEquity - dailyProfitAmount;
        const peakEq = Math.max(startEquity, currentEquity);
        const drawdownPct = peakEq > 0 ? ((peakEq - currentEquity) / peakEq) * 100 : 0;
        const monthlyReturnPct = startEquity > 0 ? ((currentEquity - startEquity) / startEquity) * 100 : 0;
        const wr = isWinningDay ? 100 : 0;
        await tx.insert(monthlyPerformanceTable).values({
          userId: inv.userId,
          yearMonth,
          monthlyReturn: monthlyReturnPct.toString(),
          maxDrawdown: drawdownPct.toString(),
          winRate: wr.toString(),
          totalProfit: dailyProfitAmount.toString(),
          tradingDays: 1,
          winningDays: isWinningDay ? 1 : 0,
          startEquity: startEquity.toString(),
          peakEquity: peakEq.toString(),
        });
      } else {
        const rec = existing[0]!;
        const prevStartEquity = parseFloat(rec.startEquity as string);
        const prevPeakEquity = parseFloat(rec.peakEquity as string);
        const prevTotalProfit = parseFloat(rec.totalProfit as string);
        const prevTradingDays = rec.tradingDays;
        const prevWinningDays = rec.winningDays;

        const newPeakEquity = Math.max(prevPeakEquity, currentEquity);
        const newTotalProfit = prevTotalProfit + dailyProfitAmount;
        const newTradingDays = prevTradingDays + 1;
        const newWinningDays = prevWinningDays + (isWinningDay ? 1 : 0);

        const drawdownPct = newPeakEquity > 0 ? ((newPeakEquity - currentEquity) / newPeakEquity) * 100 : 0;
        const prevMaxDrawdown = parseFloat(rec.maxDrawdown as string);
        const newMaxDrawdown = Math.max(prevMaxDrawdown, drawdownPct);

        const monthlyReturnPct = prevStartEquity > 0 ? ((currentEquity - prevStartEquity) / prevStartEquity) * 100 : 0;
        const newWinRate = newTradingDays > 0 ? (newWinningDays / newTradingDays) * 100 : 0;

        await tx
          .update(monthlyPerformanceTable)
          .set({
            monthlyReturn: monthlyReturnPct.toString(),
            maxDrawdown: newMaxDrawdown.toString(),
            winRate: newWinRate.toString(),
            totalProfit: newTotalProfit.toString(),
            tradingDays: newTradingDays,
            winningDays: newWinningDays,
            peakEquity: newPeakEquity.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(monthlyPerformanceTable.userId, inv.userId),
              eq(monthlyPerformanceTable.yearMonth, yearMonth),
            ),
          );
      }

      const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]!;
      const direction = adjustedProfitPercent >= 0 ? "buy" : "sell";
      const basePrice = symbol.startsWith("BTC")
        ? 67000
        : symbol.startsWith("ETH")
          ? 3200
          : symbol.startsWith("SOL")
            ? 145
            : 420;
      const entryPrice = basePrice * (1 - 0.005);
      const exitPrice = basePrice * (1 + adjustedProfitPercent / 100);

      await tx.insert(tradesTable).values({
        userId: inv.userId,
        symbol,
        direction,
        entryPrice: entryPrice.toString(),
        exitPrice: exitPrice.toString(),
        profit: dailyProfitAmount.toString(),
        profitPercent: adjustedProfitPercent.toString(),
      });

      totalProfitDistributed += dailyProfitAmount;
      investorsAffected++;

      const userRows = await tx
        .select({ sponsorId: usersTable.sponsorId })
        .from(usersTable)
        .where(eq(usersTable.id, inv.userId))
        .limit(1);

      const sponsorId = userRows[0]?.sponsorId;
      if (sponsorId && sponsorId !== inv.userId && sponsorId !== 0) {
        const sponsorInvRows = await tx
          .select({ isActive: investmentsTable.isActive })
          .from(investmentsTable)
          .where(eq(investmentsTable.userId, sponsorId))
          .limit(1);

        if (sponsorInvRows[0]?.isActive) {
          const referralBonus = amount * REFERRAL_DAILY_RATE;
          const sponsorWalletRows = await tx
            .select()
            .from(walletsTable)
            .where(eq(walletsTable.userId, sponsorId))
            .limit(1);

          if (sponsorWalletRows.length > 0) {
            const sponsorWallet = sponsorWalletRows[0]!;
            const sponsorProfitBalance = parseFloat(sponsorWallet.profitBalance as string);

            await tx
              .update(walletsTable)
              .set({
                profitBalance: (sponsorProfitBalance + referralBonus).toString(),
                updatedAt: new Date(),
              })
              .where(eq(walletsTable.userId, sponsorId));

            await tx.insert(transactionsTable).values({
              userId: sponsorId,
              type: "referral_bonus",
              amount: referralBonus.toString(),
              status: "completed",
              description: `Referral bonus from active investor (daily ${(REFERRAL_DAILY_RATE * 100).toFixed(4)}%)`,
            });

            totalReferralBonusPaid += referralBonus;
          }
        }
      }
    }

    await tx.insert(dailyProfitRunsTable).values({
      runDate: todayStr,
      profitPercent: profitPercent.toString(),
      totalAUM: totalAUM.toString(),
      totalProfitDistributed: totalProfitDistributed.toString(),
      investorsAffected,
      referralBonusPaid: totalReferralBonusPaid.toString(),
    });
  });

  return {
    investorsAffected,
    totalProfitDistributed,
    totalAUM: 0,
    referralBonusPaid: totalReferralBonusPaid,
  };
}

export async function transferProfitToMain(): Promise<{
  usersProcessed: number;
  totalTransferred: number;
}> {
  const walletsWithProfit = await db
    .select()
    .from(walletsTable)
    .where(gt(walletsTable.profitBalance, "0"));

  let usersProcessed = 0;
  let totalTransferred = 0;

  await db.transaction(async (tx) => {
    for (const wallet of walletsWithProfit) {
      const profitBalance = parseFloat(wallet.profitBalance as string);
      if (profitBalance <= 0) continue;

      const mainBalance = parseFloat(wallet.mainBalance as string);

      await tx
        .update(walletsTable)
        .set({
          mainBalance: (mainBalance + profitBalance).toString(),
          profitBalance: "0",
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, wallet.userId));

      await tx.insert(transactionsTable).values({
        userId: wallet.userId,
        type: "transfer",
        amount: profitBalance.toString(),
        status: "completed",
        description: `Monthly profit payout: $${profitBalance.toFixed(2)} moved to main wallet`,
      });

      await createNotification(
        wallet.userId,
        "monthly_payout",
        "Monthly Payout Processed",
        `$${profitBalance.toFixed(2)} USDT has been transferred from your profit balance to your main wallet.`,
      );

      usersProcessed++;
      totalTransferred += profitBalance;
    }
  });

  return { usersProcessed, totalTransferred };
}
