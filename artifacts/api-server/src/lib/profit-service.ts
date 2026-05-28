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
  signalTradeDistributionsTable,
} from "@workspace/db";
import { eq, gt, and, isNull, sql, inArray, gte, lt, lte } from "drizzle-orm";
import { getRateForDate, generateAllRiskSchedules, ensureCurrentMonthSchedules } from "./monthly-schedule-service";
import { logger, profitLogger, errorLogger } from "./logger";
import { createNotification } from "./notifications";
import { getVipInfo } from "./vip";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForTransaction,
  journalForSystem,
} from "./ledger-service";

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

const REFERRAL_COMMISSION_RATE = 0.10;

// Auto daily profit accrual: each risk tier earns a fixed monthly target,
// spread evenly across 22 forex trading days (Mon–Fri). No admin input
// required — cron credits this every weekday.
export const FOREX_DAYS_PER_MONTH = 22;
export const MONTHLY_PROFIT_TARGET_PCT: Record<string, number> = {
  low: 4,      // Conservative
  medium: 6,   // Balanced
  high: 8,     // Aggressive
};
export function autoDailyPctForRisk(riskKey: string | null | undefined): number {
  const k = (riskKey ?? "medium").toLowerCase();
  const monthly = MONTHLY_PROFIT_TARGET_PCT[k] ?? MONTHLY_PROFIT_TARGET_PCT.medium!;
  return monthly / FOREX_DAYS_PER_MONTH;
}

// Returns the current month's total forex trading days (Mon–Fri) and the
// 1-based index of `d` within them. Used to spread the fixed monthly
// target evenly while clamping cumulative profit to exactly the target.
export function forexWorkingDayInfo(d: Date): { totalN: number; idxToday: number } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const today = d.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let totalN = 0;
  let idxToday = 0;
  for (let day = 1; day <= lastDay; day++) {
    const dow = new Date(Date.UTC(y, m, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) {
      totalN++;
      if (day <= today) idxToday = totalN;
    }
  }
  return { totalN, idxToday };
}

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
      await ensureUserAccounts(inv.userId, tx);
      const amount = parseFloat(inv.amount as string);
      const totalProfit = parseFloat(inv.totalProfit as string);
      const currentDrawdown = parseFloat(inv.drawdown as string);
      const currentPeakBalance = parseFloat(inv.peakBalance as string) || amount;
      const drawdownLimitPct = parseFloat(inv.drawdownLimit as string) || (DRAWDOWN_LIMITS[inv.riskLevel] ?? 0.05) * 100;
      const drawdownLimitAmt = (drawdownLimitPct / 100) * amount;

      if (currentDrawdown >= drawdownLimitAmt) {
        // System compliance force-stop: clear any pending risk-level change so it
        // cannot be unexpectedly promoted on the next profit run after the user
        // restarts. No orphaned pending states survive a compliance stop.
        await tx
          .update(investmentsTable)
          .set({
            isActive: false,
            isPaused: true,
            stoppedAt: new Date(),
            pausedAt: new Date(),
            pendingRiskLevel: null,
            pendingRiskLevelDate: null,
          })
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
      const [profitTxn] = await tx.insert(transactionsTable).values({
        userId: inv.userId,
        type: "profit",
        amount: dailyProfitAmount.toString(),
        status: "completed",
        description: `Daily profit (${inv.riskLevel} risk, ${adjustedProfitPercent.toFixed(2)}% effective rate${vipDesc})`,
      }).returning({ id: transactionsTable.id });

      const profitAmt = Math.abs(dailyProfitAmount);
      const profitAccount = inv.autoCompound ? `user:${inv.userId}:trading` : `user:${inv.userId}:profit`;
      const profitLines = dailyProfitAmount >= 0
        ? [
            { accountCode: "platform:profit_expense", entryType: "debit" as const, amount: profitAmt, description: "Daily profit expense" },
            { accountCode: profitAccount, entryType: "credit" as const, amount: profitAmt, description: `Daily profit credited to user ${inv.userId}` },
          ]
        : [
            { accountCode: profitAccount, entryType: "debit" as const, amount: profitAmt, description: `Daily loss debited from user ${inv.userId}` },
            { accountCode: "platform:profit_expense", entryType: "credit" as const, amount: profitAmt, description: "Daily loss reversal" },
          ];
      await postJournalEntry(journalForTransaction(profitTxn!.id), profitLines, profitTxn!.id, tx);

      await createNotification(
        inv.userId,
        "daily_profit",
        dailyProfitAmount >= 0 ? "Daily Profit Credited" : "Daily Loss Recorded",
        dailyProfitAmount >= 0
          ? `+$${dailyProfitAmount.toFixed(2)} USDT earned today (${adjustedProfitPercent.toFixed(2)}% · ${inv.riskLevel} risk${vipInfo.tier !== "none" ? ` · ${vipInfo.label} VIP` : ""}).`
          : `$${Math.abs(dailyProfitAmount).toFixed(2)} USDT drawdown recorded today (${adjustedProfitPercent.toFixed(2)}%).`,
      );

      const currentEquity = inv.autoCompound ? amount + dailyProfitAmount : amount;
      // equity_history has no UNIQUE(user_id,date) → read-first then UPDATE-or-INSERT
      const eqExisting291 = await tx
        .select({ id: equityHistoryTable.id })
        .from(equityHistoryTable)
        .where(and(eq(equityHistoryTable.userId, inv.userId), eq(equityHistoryTable.date, todayStr)))
        .limit(1);
      if (eqExisting291.length > 0) {
        await tx
          .update(equityHistoryTable)
          .set({ equity: currentEquity.toString(), profit: dailyProfitAmount.toString() })
          .where(and(eq(equityHistoryTable.userId, inv.userId), eq(equityHistoryTable.date, todayStr)));
      } else {
        await tx.insert(equityHistoryTable).values({
          userId: inv.userId,
          date: todayStr,
          equity: currentEquity.toString(),
          profit: dailyProfitAmount.toString(),
        });
      }

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
      if (
        sponsorId &&
        sponsorId !== inv.userId &&
        sponsorId !== 0 &&
        dailyProfitAmount > 0
      ) {
        const sponsorInvRows = await tx
          .select({ isActive: investmentsTable.isActive })
          .from(investmentsTable)
          .where(eq(investmentsTable.userId, sponsorId))
          .limit(1);

        if (sponsorInvRows[0]?.isActive) {
          const referralBonus = dailyProfitAmount * REFERRAL_COMMISSION_RATE;
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

            const [refTxn] = await tx.insert(transactionsTable).values({
              userId: sponsorId,
              type: "referral_bonus",
              amount: referralBonus.toString(),
              status: "completed",
              description: `Referral commission: ${(REFERRAL_COMMISSION_RATE * 100).toFixed(0)}% of partner's daily profit ($${dailyProfitAmount.toFixed(2)})`,
            }).returning({ id: transactionsTable.id });

            await ensureUserAccounts(sponsorId, tx);
            await postJournalEntry(
              journalForTransaction(refTxn!.id),
              [
                { accountCode: "platform:referral_expense", entryType: "debit", amount: referralBonus, description: `Referral bonus to sponsor ${sponsorId}` },
                { accountCode: `user:${sponsorId}:profit`, entryType: "credit", amount: referralBonus, description: `Referral bonus credited to sponsor ${sponsorId}` },
              ],
              refTxn!.id,
              tx,
            );

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
    }).onConflictDoNothing();
  });

  return {
    investorsAffected,
    totalProfitDistributed,
    totalAUM: 0,
    referralBonusPaid: totalReferralBonusPaid,
  };
}

/**
 * NAV-based auto daily profit engine.
 *
 * Each weekday this function:
 *   1. Ensures the monthly rate schedule exists (generates if missing).
 *   2. Fetches today's pre-generated rate per risk bucket.
 *   3. Settles any top-up capital that was "pending" from a previous day
 *      (adds it to investments.amount so it earns from today onward).
 *   4. Takes a start-of-day snapshot of each active investment's amount
 *      (stored on the investments row itself as navSnapshotBalance).
 *   5. Computes profit = snapshotBalance × rate — never on live `amount`
 *      so intra-day deposits have zero effect on today's run.
 *   6. Applies compounding, drawdown protection, VIP bonus, and referral
 *      commission exactly as before.
 *   7. Writes ledger entry + equity snapshot + daily_profit_runs row.
 *
 * Idempotency: guarded at two levels —
 *   • daily_profit_runs: fast outer check (whole-run dedup by date).
 *   • per-user profit transaction: inner check so partial runs can resume.
 */
export async function distributeAutoDailyProfit(): Promise<DistributeProfitResult> {
  const todayStr = new Date().toISOString().split("T")[0]!;

  // ── Outer idempotency guard (fast path) ─────────────────────────────────
  const runCheck = await db
    .select({ id: dailyProfitRunsTable.id })
    .from(dailyProfitRunsTable)
    .where(eq(dailyProfitRunsTable.runDate, todayStr))
    .limit(1);
  if (runCheck.length > 0) {
    profitLogger.info({ runDate: todayStr }, "distributeAutoDailyProfit: already ran today — skipping");
    return { investorsAffected: 0, totalProfitDistributed: 0, totalAUM: 0, referralBonusPaid: 0 };
  }

  // ── 1. Ensure monthly rate schedule exists ───────────────────────────────
  try {
    await ensureCurrentMonthSchedules();
  } catch (err) {
    profitLogger.warn({ err }, "distributeAutoDailyProfit: failed to ensure monthly schedules (using fallback rates)");
  }

  // ── 2. Look up today's rate per risk bucket ──────────────────────────────
  const rates: Record<string, number> = {};
  for (const risk of ["low", "medium", "high"]) {
    let rate = await getRateForDate(todayStr, risk).catch(() => null);
    if (rate === null) {
      // Fallback: mean daily rate from hardcoded constants
      const { totalN } = forexWorkingDayInfo(new Date());
      const monthly = MONTHLY_PROFIT_TARGET_PCT[risk] ?? 6;
      rate = totalN > 0 ? monthly / totalN : 0;
      profitLogger.warn({ risk, todayStr }, "distributeAutoDailyProfit: no schedule rate found, using fallback");
    }
    rates[risk] = rate;
  }

  let investorsAffected = 0;
  let totalProfitDistributed = 0;
  let totalReferralBonusPaid = 0;
  let totalAUM = 0;

  await db.transaction(async (tx) => {
    // ── 3. Settle pending top-ups from PRIOR days (strictly < today) ─────
    // Top-ups recorded with navPendingDate < today are now old enough to join
    // today's snapshot. Top-ups recorded TODAY are NOT settled — they earn
    // from tomorrow's run only.
    const pendingInvs = await tx
      .select({
        userId: investmentsTable.userId,
        amount: investmentsTable.amount,
        navPendingAdd: investmentsTable.navPendingAdd,
      })
      .from(investmentsTable)
      .where(
        and(
          eq(investmentsTable.isActive, true),
          lt(investmentsTable.navPendingDate, todayStr),   // strictly < today
          gt(investmentsTable.navPendingAdd, "0"),
        ),
      );

    for (const pi of pendingInvs) {
      const base    = parseFloat(pi.amount as string);
      const pending = parseFloat(pi.navPendingAdd as string);
      if (pending > 0) {
        await tx
          .update(investmentsTable)
          .set({
            amount: (base + pending).toString(),
            navPendingAdd: "0",
            navPendingDate: null,
          })
          .where(eq(investmentsTable.userId, pi.userId));
      }
    }

    // ── 3b. Promote pending risk-level changes from PRIOR days ───────────
    // A risk-level change requested on day D is stored as pendingRiskLevel /
    // pendingRiskLevelDate. On day D+1 (first run after the change), this step
    // promotes the pending value to the live riskLevel so that:
    //   - day D still earns at the OLD rate (snapshot was taken before this step)
    //   - day D+1 onward earns at the NEW rate
    // Strictly < today so same-day changes are never promoted in the same run.
    const pendingRiskInvs = await tx
      .select({
        userId: investmentsTable.userId,
        pendingRiskLevel: investmentsTable.pendingRiskLevel,
      })
      .from(investmentsTable)
      .where(
        and(
          eq(investmentsTable.isActive, true),
          lt(investmentsTable.pendingRiskLevelDate, todayStr), // strictly < today
        ),
      );

    for (const pri of pendingRiskInvs) {
      if (!pri.pendingRiskLevel) continue;
      await tx
        .update(investmentsTable)
        .set({
          riskLevel: pri.pendingRiskLevel,
          pendingRiskLevel: null,
          pendingRiskLevelDate: null,
        })
        .where(eq(investmentsTable.userId, pri.userId));
      profitLogger.info(
        { userId: pri.userId, newRiskLevel: pri.pendingRiskLevel, promotedOn: todayStr },
        "NAV: pending risk-level change promoted",
      );

      // Notify the user so they have an in-app record that their scheduled
      // risk-level change actually took effect (they may have queued it the
      // prior day and forgotten about it by the time the profit run fires).
      const levelLabel =
        pri.pendingRiskLevel.charAt(0).toUpperCase() + pri.pendingRiskLevel.slice(1).toLowerCase();
      await createNotification(
        pri.userId,
        "risk_level_changed",
        "✅ Risk Level Updated",
        `Your risk level has been updated to ${levelLabel} as scheduled.`,
      );
    }

    // ── 4. Load all active investments (post-settlement) ─────────────────
    const activeInvestments = await tx
      .select()
      .from(investmentsTable)
      .where(eq(investmentsTable.isActive, true));

    totalAUM = activeInvestments.reduce(
      (acc, inv) => acc + parseFloat(inv.amount as string),
      0,
    );

    // ── 4a. Build the snapshot map BEFORE writing to DB ──────────────────
    // For investments already snapshotted today (crash-recovery re-run),
    // use the persisted navSnapshotBalance so results are reproducible.
    // For all others, use the post-settlement `amount` as today's basis.
    const snapshotMap = new Map<number, number>();
    for (const inv of activeInvestments) {
      const alreadySnapshotted = inv.navSnapshotDate === todayStr && inv.navSnapshotBalance != null;
      const snap = alreadySnapshotted
        ? parseFloat(inv.navSnapshotBalance as string)
        : parseFloat(inv.amount as string);
      snapshotMap.set(inv.userId, snap);
    }

    // ── 4b. Persist snapshots for investments not yet done today ─────────
    for (const inv of activeInvestments) {
      if (inv.navSnapshotDate === todayStr) continue;
      await tx
        .update(investmentsTable)
        .set({
          navSnapshotBalance: snapshotMap.get(inv.userId)!.toString(),
          navSnapshotDate: todayStr,
        })
        .where(eq(investmentsTable.userId, inv.userId));
    }

    for (const inv of activeInvestments) {
      // Skip if investment started today — profit begins NEXT working day.
      const startedDateStr = inv.startedAt
        ? new Date(inv.startedAt).toISOString().split("T")[0]!
        : todayStr;
      if (startedDateStr >= todayStr) continue;

      // Per-user idempotency: skip if profit already credited today.
      const todayStart = new Date(todayStr + "T00:00:00.000Z");
      const todayEnd   = new Date(todayStr + "T23:59:59.999Z");
      const alreadyPaid = await tx
        .select({ id: transactionsTable.id })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, inv.userId),
            eq(transactionsTable.type, "profit"),
            gte(transactionsTable.createdAt, todayStart),
            lt(transactionsTable.createdAt, todayEnd),
          ),
        )
        .limit(1);
      if (alreadyPaid.length > 0) continue;

      await ensureUserAccounts(inv.userId, tx);

      // ── 5. Drawdown protection — check before computing profit ─────────
      const amount = parseFloat(inv.amount as string);
      const currentDrawdown = parseFloat(inv.drawdown as string);
      const drawdownLimitPct = parseFloat(inv.drawdownLimit as string) || (DRAWDOWN_LIMITS[inv.riskLevel] ?? 0.05) * 100;
      const drawdownLimitAmt = (drawdownLimitPct / 100) * amount;

      if (currentDrawdown >= drawdownLimitAmt) {
        // System compliance force-stop: clear any pending risk-level change so it
        // cannot be unexpectedly promoted on the next profit run after the user
        // restarts. No orphaned pending states survive a compliance stop.
        await tx
          .update(investmentsTable)
          .set({
            isActive: false,
            isPaused: true,
            stoppedAt: new Date(),
            pausedAt: new Date(),
            pendingRiskLevel: null,
            pendingRiskLevelDate: null,
          })
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

        logger.info({ userId: inv.userId, drawdownLimitPct }, "NAV: investment paused — capital protection triggered");
        continue;
      }

      // ── 6. Compute profit from snapshot balance × today's rate ────────
      const snapshotBalance = snapshotMap.get(inv.userId) ?? amount;
      if (snapshotBalance <= 0) continue;

      const riskKey = (inv.riskLevel ?? "medium").toLowerCase();
      const dailyRatePct = rates[riskKey] ?? 0;
      const dailyProfitAmount = snapshotBalance * (dailyRatePct / 100);

      // Skip if rate is zero (e.g., holiday/weekend fallback) — nothing to credit.
      if (dailyRatePct === 0) continue;

      const totalProfit = parseFloat(inv.totalProfit as string);
      const currentPeakBalance = parseFloat(inv.peakBalance as string) || snapshotBalance;
      const dailyPct = dailyRatePct;
      const vipInfo = getVipInfo(snapshotBalance);
      const newTotalProfit = totalProfit + dailyProfitAmount;

      // Update drawdown accumulator for loss days (reset never happens mid-run)
      let newDrawdown = currentDrawdown;
      if (dailyProfitAmount < 0) {
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
      const profitBalance  = parseFloat(wallet.profitBalance as string);
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

      const vipDesc = vipInfo.tier !== "none"
        ? ` · ${vipInfo.label} VIP +${(vipInfo.profitBonus * 100).toFixed(0)}% bonus`
        : "";
      const profitSign = dailyProfitAmount >= 0 ? "+" : "";
      const [profitTxn] = await tx
        .insert(transactionsTable)
        .values({
          userId: inv.userId,
          type: "profit",
          amount: dailyProfitAmount.toString(),
          status: "completed",
          description: `Daily profit (${inv.riskLevel} risk, ${profitSign}${dailyPct.toFixed(4)}% NAV rate${vipDesc})`,
        })
        .returning({ id: transactionsTable.id });

      const profitAmt = Math.abs(dailyProfitAmount);
      const profitAccount = inv.autoCompound
        ? `user:${inv.userId}:trading`
        : `user:${inv.userId}:profit`;

      // Double-entry: direction depends on profit vs loss.
      // Profit day:  platform bears cost  → debit platform:profit_expense, credit user
      // Loss day:    user bears the loss  → debit user account,            credit platform:profit_expense (reversal)
      if (profitAmt > 0) {
        const profitLines = dailyProfitAmount >= 0
          ? [
              { accountCode: "platform:profit_expense", entryType: "debit"  as const, amount: profitAmt, description: "Daily NAV profit expense" },
              { accountCode: profitAccount,              entryType: "credit" as const, amount: profitAmt, description: `Daily NAV profit credited to user ${inv.userId}` },
            ]
          : [
              { accountCode: profitAccount,              entryType: "debit"  as const, amount: profitAmt, description: `Daily NAV loss debited from user ${inv.userId}` },
              { accountCode: "platform:profit_expense", entryType: "credit" as const, amount: profitAmt, description: "Daily NAV loss reversal" },
            ];
        await postJournalEntry(journalForTransaction(profitTxn!.id), profitLines, profitTxn!.id, tx);
      }

      await createNotification(
        inv.userId,
        "daily_profit",
        dailyProfitAmount >= 0 ? "Daily Profit Credited" : "Daily Loss Recorded",
        dailyProfitAmount >= 0
          ? `${profitSign}$${Math.abs(dailyProfitAmount).toFixed(2)} USDT earned today (${profitSign}${dailyPct.toFixed(4)}% · ${inv.riskLevel} risk${vipInfo.tier !== "none" ? ` · ${vipInfo.label} VIP` : ""}).`
          : `$${Math.abs(dailyProfitAmount).toFixed(2)} USDT drawdown recorded today (${dailyPct.toFixed(4)}% · ${inv.riskLevel} risk).`,
      );

      const currentEquity = inv.autoCompound ? amount + dailyProfitAmount : amount;
      // equity_history has no UNIQUE(user_id,date) → read-first then UPDATE-or-INSERT
      const eqExisting = await tx
        .select({ id: equityHistoryTable.id })
        .from(equityHistoryTable)
        .where(and(eq(equityHistoryTable.userId, inv.userId), eq(equityHistoryTable.date, todayStr)))
        .limit(1);
      if (eqExisting.length > 0) {
        await tx
          .update(equityHistoryTable)
          .set({ equity: currentEquity.toString(), profit: dailyProfitAmount.toString() })
          .where(and(eq(equityHistoryTable.userId, inv.userId), eq(equityHistoryTable.date, todayStr)));
      } else {
        await tx.insert(equityHistoryTable).values({
          userId: inv.userId,
          date: todayStr,
          equity: currentEquity.toString(),
          profit: dailyProfitAmount.toString(),
        });
      }

      // Monthly performance roll-up.
      const mpYearMonth = todayStr.slice(0, 7)!;
      const existing = await tx
        .select()
        .from(monthlyPerformanceTable)
        .where(
          and(
            eq(monthlyPerformanceTable.userId, inv.userId),
            eq(monthlyPerformanceTable.yearMonth, mpYearMonth),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        const startEquity = currentEquity - dailyProfitAmount;
        const peakEq = Math.max(startEquity, currentEquity);
        const monthlyReturnPct = startEquity > 0
          ? ((currentEquity - startEquity) / startEquity) * 100
          : 0;
        await tx.insert(monthlyPerformanceTable).values({
          userId: inv.userId,
          yearMonth: mpYearMonth,
          monthlyReturn: monthlyReturnPct.toString(),
          maxDrawdown: "0",
          winRate: "100",
          totalProfit: dailyProfitAmount.toString(),
          tradingDays: 1,
          winningDays: dailyProfitAmount >= 0 ? 1 : 0,
          startEquity: startEquity.toString(),
          peakEquity: peakEq.toString(),
        });
      } else {
        const rec = existing[0]!;
        const prevStartEquity = parseFloat(rec.startEquity as string);
        const prevPeakEquity  = parseFloat(rec.peakEquity as string);
        const prevTotalProfit = parseFloat(rec.totalProfit as string);
        const newPeakEquity   = Math.max(prevPeakEquity, currentEquity);
        const newTotal        = prevTotalProfit + dailyProfitAmount;
        const newDays         = rec.tradingDays + 1;
        const newWins         = rec.winningDays + (dailyProfitAmount >= 0 ? 1 : 0);
        const monthlyReturnPct = prevStartEquity > 0
          ? ((currentEquity - prevStartEquity) / prevStartEquity) * 100
          : 0;
        const wrPct = newDays > 0 ? (newWins / newDays) * 100 : 100;
        await tx
          .update(monthlyPerformanceTable)
          .set({
            monthlyReturn: monthlyReturnPct.toString(),
            winRate: wrPct.toString(),
            totalProfit: newTotal.toString(),
            tradingDays: newDays,
            winningDays: newWins,
            peakEquity: newPeakEquity.toString(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(monthlyPerformanceTable.userId, inv.userId),
              eq(monthlyPerformanceTable.yearMonth, mpYearMonth),
            ),
          );
      }

      // Sponsor referral bonus (10%) — only on positive days.
      if (dailyProfitAmount > 0) {
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
            const referralBonus = dailyProfitAmount * REFERRAL_COMMISSION_RATE;
            const sponsorWalletRows = await tx
              .select()
              .from(walletsTable)
              .where(eq(walletsTable.userId, sponsorId))
              .limit(1);
            if (sponsorWalletRows.length > 0) {
              const sw = sponsorWalletRows[0]!;
              const spProfit = parseFloat(sw.profitBalance as string);
              await tx
                .update(walletsTable)
                .set({ profitBalance: (spProfit + referralBonus).toString(), updatedAt: new Date() })
                .where(eq(walletsTable.userId, sponsorId));
              const [refTxn] = await tx
                .insert(transactionsTable)
                .values({
                  userId: sponsorId,
                  type: "referral_bonus",
                  amount: referralBonus.toString(),
                  status: "completed",
                  description: `Referral commission: ${(REFERRAL_COMMISSION_RATE * 100).toFixed(0)}% of partner's daily profit ($${dailyProfitAmount.toFixed(2)})`,
                })
                .returning({ id: transactionsTable.id });
              await ensureUserAccounts(sponsorId, tx);
              await postJournalEntry(
                journalForTransaction(refTxn!.id),
                [
                  { accountCode: "platform:referral_expense", entryType: "debit",  amount: referralBonus, description: `Referral bonus to sponsor ${sponsorId}` },
                  { accountCode: `user:${sponsorId}:profit`,  entryType: "credit", amount: referralBonus, description: `Referral bonus credited to sponsor ${sponsorId}` },
                ],
                refTxn!.id,
                tx,
              );
              totalReferralBonusPaid += referralBonus;
            }
          }
        }
      }

      totalProfitDistributed += dailyProfitAmount;
      investorsAffected++;
    }

    if (investorsAffected > 0) {
      await tx.insert(dailyProfitRunsTable).values({
        runDate: todayStr,
        profitPercent: "0",
        totalAUM: totalAUM.toString(),
        totalProfitDistributed: totalProfitDistributed.toString(),
        investorsAffected,
        referralBonusPaid: totalReferralBonusPaid.toString(),
      }).onConflictDoNothing();
    }
  });

  return { investorsAffected, totalProfitDistributed, totalAUM, referralBonusPaid: totalReferralBonusPaid };
}

/**
 * Adjusts navSnapshotBalance when capital is withdrawn mid-day, BEFORE the daily profit
 * run has completed for today.
 *
 * Scenario this guards against:
 *   1. Profit cron starts → writes navSnapshotBalance = investment.amount (e.g. 1000) and
 *      navSnapshotDate = today for the user.
 *   2. A crash or parallel-run situation means daily_profit_runs is NOT yet committed.
 *   3. User withdraws / stops their investment → effective deployed capital drops to newBasis.
 *   4. On the crash-recovery re-run the snapshot (step 4a) would read the stale 1000 and
 *      overpay profit on capital that no longer exists.
 *
 * Fix: if navSnapshotDate == today AND no daily_profit_runs row exists yet, overwrite
 * navSnapshotBalance with newBasis so the re-run uses the corrected capital figure.
 *
 * Callers supply newBasis = 0 when the investment is fully stopped (no capital deployed).
 * For a partial capital reduction, pass the remaining deployed amount.
 *
 * @param userId   - the user whose snapshot to adjust
 * @param newBasis - the corrected snapshot balance (0 for a full stop)
 * @param tx       - optional Drizzle transaction (uses db directly when omitted)
 */
export async function adjustNavSnapshotIfNeeded(
  userId: number,
  newBasis: number,
  // Accept db or an in-flight Drizzle transaction (PgTransaction lacks $client).
  tx?: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const dbOrTx = tx ?? db;

  // Fast-path: profit already distributed today — the committed snapshot is no longer
  // the basis for any future re-run, so there is nothing to fix.
  const profitRanRows = await dbOrTx
    .select({ id: dailyProfitRunsTable.id })
    .from(dailyProfitRunsTable)
    .where(eq(dailyProfitRunsTable.runDate, todayStr))
    .limit(1);
  if (profitRanRows.length > 0) return;

  // Check whether today's snapshot has already been captured for this investment.
  // If navSnapshotDate != today the profit run hasn't started yet and there is no
  // stale snapshot to correct.
  const invRows = await dbOrTx
    .select({ navSnapshotDate: investmentsTable.navSnapshotDate })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, userId))
    .limit(1);
  if (!invRows[0] || invRows[0].navSnapshotDate !== todayStr) return;

  // Overwrite the stale snapshot so any crash-recovery re-run uses the correct basis.
  await dbOrTx
    .update(investmentsTable)
    .set({ navSnapshotBalance: newBasis.toString() })
    .where(eq(investmentsTable.userId, userId));

  profitLogger.info(
    { userId, newBasis, todayStr },
    "NAV: mid-day capital change — navSnapshotBalance adjusted before today's profit run",
  );
}

/**
 * Monthly 25th sweep: moves each user's unswept signal-trade net P/L
 * from TRADING balance → PROFIT balance. Profit balance remains user-withdrawable
 * at any time (main/trading are untouched by this sweep).
 */
export async function sweepSignalProfitsToProfitWallet(): Promise<{
  usersProcessed: number;
  totalTransferred: number;
}> {
  const now = new Date();

  // Aggregate net unswept signal P/L per user
  const aggregates = await db
    .select({
      userId: signalTradeDistributionsTable.userId,
      netAmount: sql<string>`sum(${signalTradeDistributionsTable.profitAmount})`,
    })
    .from(signalTradeDistributionsTable)
    .where(isNull(signalTradeDistributionsTable.sweptAt))
    .groupBy(signalTradeDistributionsTable.userId);

  let usersProcessed = 0;
  let totalTransferred = 0;

  for (const agg of aggregates) {
    const netAmount = parseFloat(agg.netAmount ?? "0");
    if (netAmount <= 0) {
      // Net loss or zero — mark as swept so they don't accumulate, no transfer
      await db
        .update(signalTradeDistributionsTable)
        .set({ sweptAt: now })
        .where(
          and(
            eq(signalTradeDistributionsTable.userId, agg.userId),
            isNull(signalTradeDistributionsTable.sweptAt),
          ),
        );
      continue;
    }

    await db.transaction(async (tx) => {
      // Re-check available trading balance — cap transfer to what's actually there.
      const wRows = await tx.select().from(walletsTable).where(eq(walletsTable.userId, agg.userId)).limit(1);
      const w = wRows[0];
      if (!w) return;
      const tradingNow = parseFloat(w.tradingBalance as string);
      const moveAmount = Math.min(netAmount, tradingNow);
      if (moveAmount <= 0) {
        await tx
          .update(signalTradeDistributionsTable)
          .set({ sweptAt: now })
          .where(
            and(
              eq(signalTradeDistributionsTable.userId, agg.userId),
              isNull(signalTradeDistributionsTable.sweptAt),
            ),
          );
        return;
      }

      // Denormalized wallet update: trading -= moveAmount, profit += moveAmount
      await tx
        .update(walletsTable)
        .set({
          tradingBalance: (tradingNow - moveAmount).toString(),
          profitBalance: (parseFloat(w.profitBalance as string) + moveAmount).toString(),
          updatedAt: now,
        })
        .where(eq(walletsTable.userId, agg.userId));

      // Transaction record
      const [payoutTxn] = await tx
        .insert(transactionsTable)
        .values({
          userId: agg.userId,
          type: "transfer",
          amount: moveAmount.toString(),
          status: "completed",
          description: `Monthly signal-profit sweep: $${moveAmount.toFixed(2)} moved from trading to profit wallet`,
        })
        .returning({ id: transactionsTable.id });

      // Double-entry ledger
      await ensureUserAccounts(agg.userId, tx);
      await postJournalEntry(
        journalForTransaction(payoutTxn!.id),
        [
          { accountCode: `user:${agg.userId}:trading`, entryType: "debit",  amount: moveAmount, description: "Monthly sweep — trading cleared to profit" },
          { accountCode: `user:${agg.userId}:profit`,  entryType: "credit", amount: moveAmount, description: "Monthly sweep — credited to profit wallet" },
        ],
        payoutTxn!.id,
        tx,
      );

      // Mark all unswept distributions as swept
      await tx
        .update(signalTradeDistributionsTable)
        .set({ sweptAt: now })
        .where(
          and(
            eq(signalTradeDistributionsTable.userId, agg.userId),
            isNull(signalTradeDistributionsTable.sweptAt),
          ),
        );

      await createNotification(
        agg.userId,
        "monthly_payout",
        "Monthly Profit Sweep",
        `$${moveAmount.toFixed(2)} USDT has been moved from your trading balance to your profit wallet and is now available for withdrawal.`,
      );

      usersProcessed++;
      totalTransferred += moveAmount;
    });
  }

  return { usersProcessed, totalTransferred };
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

      const [payoutTxn] = await tx.insert(transactionsTable).values({
        userId: wallet.userId,
        type: "transfer",
        amount: profitBalance.toString(),
        status: "completed",
        description: `Monthly profit payout: $${profitBalance.toFixed(2)} moved to main wallet`,
      }).returning({ id: transactionsTable.id });

      await ensureUserAccounts(wallet.userId, tx);
      await postJournalEntry(
        journalForTransaction(payoutTxn!.id),
        [
          { accountCode: `user:${wallet.userId}:profit`, entryType: "debit", amount: profitBalance, description: "Monthly payout — profit cleared" },
          { accountCode: `user:${wallet.userId}:main`, entryType: "credit", amount: profitBalance, description: "Monthly payout — credited to main" },
        ],
        payoutTxn!.id,
        tx,
      );

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
