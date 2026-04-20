import {
  db,
  signalTradesTable,
  signalTradeDistributionsTable,
  signalTradeAuditTable,
  walletsTable,
  usersTable,
  transactionsTable,
  investmentsTable,
  tradesTable,
  equityHistoryTable,
  monthlyPerformanceTable,
} from "@workspace/db";
import { eq, and, sql, gt, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForSystem,
} from "./ledger-service";
import { createNotification } from "./notifications";

export type CreateTradeInput = {
  pair: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  tpPrice?: number;
  slPrice?: number;
  pipsTarget?: number;
  pipSize?: number;
  expectedProfitPercent: number;
  scheduledAt?: Date;
  notes?: string;
  idempotencyKey?: string;
  createdBy?: number;
};

async function writeAudit(
  tradeId: number,
  action: string,
  details: Record<string, unknown> | string | null = null,
  actorUserId?: number,
  tx?: any,
) {
  const runner = tx ?? db;
  await runner.insert(signalTradeAuditTable).values({
    tradeId,
    action,
    actorUserId: actorUserId ?? null,
    details: details === null ? null : typeof details === "string" ? details : JSON.stringify(details),
  });
}

export type CloseTradeInput = {
  tradeId: number;
  realizedExitPrice?: number;
  realizedProfitPercent?: number;
  closeReason?: "target_hit" | "manual" | "stop_loss" | "slippage";
  notes?: string;
};

function calcExitPrice(entry: number, direction: "BUY" | "SELL", pipsTarget: number, pipSize: number): number {
  const move = pipsTarget * pipSize;
  return direction === "BUY" ? entry + move : entry - move;
}

export async function createSignalTrade(input: CreateTradeInput) {
  const pipSize = input.pipSize ?? 0.0001;

  // TP is the canonical source of truth when provided.
  // If both tpPrice and pipsTarget given, derive pipsTarget from tpPrice (ignoring user-supplied pipsTarget) for consistency.
  let pipsTarget: number;
  if (input.tpPrice !== undefined) {
    pipsTarget = Math.abs(input.tpPrice - input.entryPrice) / pipSize;
  } else if (input.pipsTarget && input.pipsTarget > 0) {
    pipsTarget = input.pipsTarget;
  } else {
    throw new Error("Either pipsTarget or tpPrice required");
  }
  if (pipsTarget <= 0) throw new Error("Computed pipsTarget must be positive");

  // Validate TP/SL direction sanity
  if (input.tpPrice !== undefined) {
    if (input.direction === "BUY" && input.tpPrice <= input.entryPrice)
      throw new Error("BUY: TP must be above entry");
    if (input.direction === "SELL" && input.tpPrice >= input.entryPrice)
      throw new Error("SELL: TP must be below entry");
  }
  if (input.slPrice !== undefined) {
    if (input.direction === "BUY" && input.slPrice >= input.entryPrice)
      throw new Error("BUY: SL must be below entry");
    if (input.direction === "SELL" && input.slPrice <= input.entryPrice)
      throw new Error("SELL: SL must be above entry");
  }

  const exitPrice = input.tpPrice ?? calcExitPrice(input.entryPrice, input.direction, pipsTarget, pipSize);
  const idempotencyKey = input.idempotencyKey ?? `trade:${randomUUID()}`;

  // Duplicate prevention: same pair + direction + entry price within last 60 seconds
  const dupWindow = new Date(Date.now() - 60_000);
  const dup = await db
    .select({ id: signalTradesTable.id })
    .from(signalTradesTable)
    .where(
      and(
        eq(signalTradesTable.pair, input.pair),
        eq(signalTradesTable.direction, input.direction),
        eq(signalTradesTable.entryPrice, input.entryPrice.toString()),
        gt(signalTradesTable.createdAt, dupWindow),
      ),
    )
    .limit(1);
  if (dup.length > 0) {
    throw new Error(`Duplicate trade detected for ${input.pair} ${input.direction} @ ${input.entryPrice} within 60s`);
  }

  const [created] = await db
    .insert(signalTradesTable)
    .values({
      pair: input.pair.toUpperCase(),
      direction: input.direction,
      entryPrice: input.entryPrice.toString(),
      pipsTarget: pipsTarget.toString(),
      pipSize: pipSize.toString(),
      exitPrice: exitPrice.toString(),
      tpPrice: input.tpPrice?.toString() ?? null,
      slPrice: input.slPrice?.toString() ?? null,
      scheduledAt: input.scheduledAt ?? null,
      expectedProfitPercent: input.expectedProfitPercent.toString(),
      status: "running",
      notes: input.notes,
      idempotencyKey,
      createdBy: input.createdBy,
    })
    .returning();

  await writeAudit(created!.id, "created", {
    pair: created!.pair, direction: created!.direction,
    entry: input.entryPrice, tp: input.tpPrice, sl: input.slPrice,
    expectedProfitPercent: input.expectedProfitPercent,
    scheduledAt: input.scheduledAt,
  }, input.createdBy);

  logger.info({ tradeId: created!.id, pair: input.pair }, "[signal-trade] created");
  return created!;
}

// Hit TP — uses TP price as exit, full expected profit %
export async function hitTakeProfit(tradeId: number, actorUserId?: number) {
  const t = await db.select().from(signalTradesTable).where(eq(signalTradesTable.id, tradeId)).limit(1);
  if (t.length === 0) throw new Error(`Trade #${tradeId} not found`);
  const trade = t[0]!;
  if (!trade.tpPrice) throw new Error("Trade has no TP price configured");
  // Note: click audit is written inside closeSignalTrade only after successful claim,
  // to avoid noisy duplicate click logs on rejected (already-closed) clicks.
  return closeSignalTrade({
    tradeId,
    realizedExitPrice: parseFloat(trade.tpPrice as string),
    realizedProfitPercent: parseFloat(trade.expectedProfitPercent as string),
    closeReason: "target_hit",
  }, actorUserId, "tp_clicked");
}

// Hit SL — exit at SL price, loss = expected% × (slPips/tpPips)
export async function hitStopLoss(tradeId: number, actorUserId?: number) {
  const t = await db.select().from(signalTradesTable).where(eq(signalTradesTable.id, tradeId)).limit(1);
  if (t.length === 0) throw new Error(`Trade #${tradeId} not found`);
  const trade = t[0]!;
  if (!trade.slPrice) throw new Error("Trade has no SL price configured");

  const entry = parseFloat(trade.entryPrice as string);
  const sl = parseFloat(trade.slPrice as string);
  const pipSize = parseFloat(trade.pipSize as string);
  const tpPips = parseFloat(trade.pipsTarget as string);
  const slPips = Math.abs(entry - sl) / pipSize;
  const expectedPct = parseFloat(trade.expectedProfitPercent as string);
  const lossPct = -1 * expectedPct * (slPips / tpPips);

  return closeSignalTrade({
    tradeId,
    realizedExitPrice: sl,
    realizedProfitPercent: lossPct,
    closeReason: "stop_loss",
  }, actorUserId, "sl_clicked");
}

export async function getTradeAuditLog(tradeId: number) {
  return await db.select().from(signalTradeAuditTable)
    .where(eq(signalTradeAuditTable.tradeId, tradeId))
    .orderBy(desc(signalTradeAuditTable.createdAt));
}

export async function closeSignalTrade(input: CloseTradeInput, actorUserId?: number, clickAction?: string) {
  // Atomic claim: only one concurrent close request can flip status running -> closing
  const claimed = await db
    .update(signalTradesTable)
    .set({ status: "closing" })
    .where(and(eq(signalTradesTable.id, input.tradeId), eq(signalTradesTable.status, "running")))
    .returning();

  if (claimed.length === 0) {
    // Either not found or already closed/closing
    const existing = await db.select({ id: signalTradesTable.id, status: signalTradesTable.status })
      .from(signalTradesTable).where(eq(signalTradesTable.id, input.tradeId)).limit(1);
    if (existing.length === 0) throw new Error(`Trade #${input.tradeId} not found`);
    throw new Error(`Trade #${input.tradeId} already ${existing[0]!.status}`);
  }
  const t = claimed[0]!;

  // Click audit (only after successful claim — avoids noisy duplicate clicks)
  if (clickAction) {
    await writeAudit(t.id, clickAction, {
      realizedExitPrice: input.realizedExitPrice,
      realizedProfitPercent: input.realizedProfitPercent,
    }, actorUserId);
  }

  // Determine realized profit %
  const expectedPct = parseFloat(t.expectedProfitPercent as string);
  const realizedPct = input.realizedProfitPercent ?? expectedPct;
  const realizedExit = input.realizedExitPrice ?? parseFloat(t.exitPrice as string);
  const closeReason = input.closeReason ?? "target_hit";

  // Slippage clamp safety: realized must be within +/- 50% of expected.
  // Skip for explicit TP/SL/manual paths (caller knows the realized %).
  if (closeReason === "slippage") {
    const drift = Math.abs(realizedPct - expectedPct);
    const limit = Math.max(0.5, Math.abs(expectedPct) * 0.5);
    if (drift > limit) {
      throw new Error(
        `Slippage too large (expected ${expectedPct}%, realized ${realizedPct}%). Use manual override to confirm.`,
      );
    }
  }

  // Find all users with positive trading balance — they participate in the distribution
  const eligible = await db
    .select({ userId: walletsTable.userId, tradingBalance: walletsTable.tradingBalance })
    .from(walletsTable)
    .where(gt(walletsTable.tradingBalance, "0"));

  if (eligible.length === 0) {
    // Nothing to distribute — just close the trade
    await db
      .update(signalTradesTable)
      .set({
        status: "closed",
        closeReason,
        realizedProfitPercent: realizedPct.toString(),
        realizedExitPrice: realizedExit.toString(),
        closedAt: new Date(),
        totalDistributed: "0",
        affectedUsers: 0,
        notes: input.notes ?? t.notes,
      })
      .where(eq(signalTradesTable.id, t.id));
    await writeAudit(t.id, "closed", {
      realizedProfitPercent: realizedPct, realizedExitPrice: realizedExit,
      closeReason, users: 0, totalDistributed: 0,
    }, actorUserId);
    return { tradeId: t.id, distributed: 0, users: 0 };
  }

  let totalDistributed = 0;

  try {
  await db.transaction(async (tx) => {
    for (const w of eligible) {
      const basis = parseFloat(w.tradingBalance as string);
      // Round to 8 decimals
      const rawProfit = basis * (realizedPct / 100);
      const profit = Math.round(rawProfit * 1e8) / 1e8;
      if (profit === 0) continue;

      await ensureUserAccounts(w.userId, tx);

      // Signal trade P/L flows into trading balance. At month-end (25th), accumulated
      // gains are swept from trading → profit wallet. Profit wallet is user-withdrawable.
      // Cap negative P/L to available trading balance so the user's trading account
      // never goes below zero (platform absorbs anything beyond).
      const currentTrading = parseFloat(w.tradingBalance as string);
      const appliedDelta = profit >= 0 ? profit : -Math.min(Math.abs(profit), currentTrading);
      if (appliedDelta === 0 && profit < 0) {
        // Nothing to debit — skip entirely for this user on this trade
        continue;
      }
      const newTradingBal = sql`${walletsTable.tradingBalance}::numeric + ${appliedDelta.toString()}::numeric`;
      await tx
        .update(walletsTable)
        .set({ tradingBalance: newTradingBal as any, updatedAt: new Date() })
        .where(eq(walletsTable.userId, w.userId));

      // Mirror profit into investments aggregate for dashboard widgets (Total Profit / Daily P&L / Active Investment)
      const invRows = await tx.select().from(investmentsTable).where(eq(investmentsTable.userId, w.userId)).limit(1);
      if (invRows.length > 0) {
        await tx
          .update(investmentsTable)
          .set({
            totalProfit: sql`${investmentsTable.totalProfit}::numeric + ${profit.toString()}::numeric` as any,
            dailyProfit: sql`${investmentsTable.dailyProfit}::numeric + ${profit.toString()}::numeric` as any,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(investmentsTable.userId, w.userId));
      } else {
        await tx.insert(investmentsTable).values({
          userId: w.userId,
          amount: basis.toString(),
          totalProfit: profit.toString(),
          dailyProfit: profit.toString(),
          isActive: true,
          riskLevel: "low",
        });
      }

      // Trade row for win/loss & performance widgets
      await tx.insert(tradesTable).values({
        userId: w.userId,
        symbol: t.pair,
        direction: t.direction === "BUY" ? "LONG" : "SHORT",
        entryPrice: t.entryPrice as any,
        exitPrice: realizedExit.toString(),
        amount: basis.toString(),
        profit: profit.toString(),
        profitPercent: realizedPct.toString(),
        executedAt: new Date(),
      });

      // Equity snapshot (Equity Curve, Drawdown, Rolling Returns)
      const wRows = await tx.select().from(walletsTable).where(eq(walletsTable.userId, w.userId)).limit(1);
      const wAfter = wRows[0]!;
      const equityNow = parseFloat(wAfter.mainBalance as string) + parseFloat(wAfter.tradingBalance as string) + parseFloat(wAfter.profitBalance as string);
      const today = new Date().toISOString().split("T")[0]!;
      const eqExisting = await tx.select().from(equityHistoryTable)
        .where(and(eq(equityHistoryTable.userId, w.userId), eq(equityHistoryTable.date, today))).limit(1);
      if (eqExisting.length > 0) {
        await tx.update(equityHistoryTable)
          .set({
            equity: equityNow.toString(),
            profit: sql`${equityHistoryTable.profit}::numeric + ${profit.toString()}::numeric` as any,
          })
          .where(and(eq(equityHistoryTable.userId, w.userId), eq(equityHistoryTable.date, today)));
      } else {
        await tx.insert(equityHistoryTable).values({
          userId: w.userId, date: today, equity: equityNow.toString(), profit: profit.toString(),
        });
      }

      // Monthly performance upsert (Performance Dashboard, Monthly comparison)
      const ym = today.slice(0, 7);
      const startEquityToday = equityNow - profit;
      const mpRows = await tx.select().from(monthlyPerformanceTable)
        .where(and(eq(monthlyPerformanceTable.userId, w.userId), eq(monthlyPerformanceTable.yearMonth, ym))).limit(1);
      if (mpRows.length > 0) {
        const m = mpRows[0]!;
        const newTotal = parseFloat(m.totalProfit as string) + profit;
        const newPeak = Math.max(parseFloat(m.peakEquity as string), equityNow);
        const startEq = parseFloat(m.startEquity as string) || startEquityToday;
        const monthlyReturn = startEq > 0 ? ((equityNow - startEq) / startEq) * 100 : 0;
        const dd = newPeak > 0 ? Math.max(0, (newPeak - equityNow) / newPeak * 100) : 0;
        const winningDays = profit > 0 ? m.winningDays + 1 : m.winningDays;
        const tradingDays = m.tradingDays + 1;
        const winRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0;
        await tx.update(monthlyPerformanceTable).set({
          totalProfit: newTotal.toString(),
          peakEquity: newPeak.toString(),
          monthlyReturn: monthlyReturn.toFixed(4),
          maxDrawdown: Math.max(parseFloat(m.maxDrawdown as string), dd).toFixed(4),
          tradingDays, winningDays,
          winRate: winRate.toFixed(4),
          updatedAt: new Date(),
        }).where(and(eq(monthlyPerformanceTable.userId, w.userId), eq(monthlyPerformanceTable.yearMonth, ym)));
      } else {
        await tx.insert(monthlyPerformanceTable).values({
          userId: w.userId, yearMonth: ym,
          monthlyReturn: startEquityToday > 0 ? ((profit / startEquityToday) * 100).toFixed(4) : "0",
          maxDrawdown: "0",
          winRate: profit > 0 ? "100" : "0",
          totalProfit: profit.toString(),
          tradingDays: 1,
          winningDays: profit > 0 ? 1 : 0,
          startEquity: startEquityToday.toString(),
          peakEquity: equityNow.toString(),
        });
      }

      // Insert transaction record
      const [txRow] = await tx
        .insert(transactionsTable)
        .values({
          userId: w.userId,
          type: "profit",
          amount: profit.toString(),
          status: "completed",
          description: `Signal trade #${t.id} ${t.pair} ${t.direction} (${realizedPct.toFixed(2)}%)`,
        })
        .returning({ id: transactionsTable.id });

      // Distribution audit row
      await tx.insert(signalTradeDistributionsTable).values({
        tradeId: t.id,
        userId: w.userId,
        shareBasisAmount: basis.toString(),
        profitAmount: profit.toString(),
      });

      // Double-entry: signal P/L lands in user's TRADING ledger account.
      // Gains: profit_expense → user:trading. Losses: user:trading → profit_expense.
      // Loss amount already capped to currentTrading above (appliedDelta).
      if (appliedDelta > 0) {
        await postJournalEntry(
          journalForSystem(`signal-${t.id}-u${w.userId}`),
          [
            { accountCode: "platform:profit_expense",   entryType: "debit",  amount: appliedDelta, description: `Signal #${t.id} payout` },
            { accountCode: `user:${w.userId}:trading`,  entryType: "credit", amount: appliedDelta, description: `Signal #${t.id} payout` },
          ],
          txRow!.id,
          tx,
        );
      } else if (appliedDelta < 0) {
        const loss = Math.abs(appliedDelta);
        await postJournalEntry(
          journalForSystem(`signal-${t.id}-u${w.userId}-loss`),
          [
            { accountCode: `user:${w.userId}:trading`,  entryType: "debit",  amount: loss, description: `Signal #${t.id} loss` },
            { accountCode: "platform:profit_expense",   entryType: "credit", amount: loss, description: `Signal #${t.id} loss reversal` },
          ],
          txRow!.id,
          tx,
        );
      }

      totalDistributed += appliedDelta;
    }

    await tx
      .update(signalTradesTable)
      .set({
        status: "closed",
        closeReason,
        realizedProfitPercent: realizedPct.toString(),
        realizedExitPrice: realizedExit.toString(),
        closedAt: new Date(),
        totalDistributed: totalDistributed.toString(),
        affectedUsers: eligible.length,
        notes: input.notes ?? t.notes,
      })
      .where(eq(signalTradesTable.id, t.id));
  });
  } catch (err) {
    // Distribution failed — revert claim so it can be retried
    await db
      .update(signalTradesTable)
      .set({ status: "running" })
      .where(and(eq(signalTradesTable.id, t.id), eq(signalTradesTable.status, "closing")));
    throw err;
  }

  await writeAudit(t.id, "closed", {
    realizedProfitPercent: realizedPct,
    realizedExitPrice: realizedExit,
    closeReason,
    users: eligible.length,
    totalDistributed,
  }, actorUserId);

  logger.info(
    { tradeId: t.id, users: eligible.length, distributed: totalDistributed },
    "[signal-trade] closed and distributed",
  );

  // Fire notifications (non-blocking)
  for (const w of eligible) {
    createNotification({
      userId: w.userId,
      type: "daily_profit",
      title: `Trade closed: ${t.pair}`,
      message: `Signal #${t.id} ${t.direction} returned ${realizedPct.toFixed(2)}%`,
    }).catch(() => {});
  }

  return { tradeId: t.id, distributed: totalDistributed, users: eligible.length };
}

export async function listTrades(opts: { status?: "running" | "closed"; limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  const where = opts.status ? eq(signalTradesTable.status, opts.status) : undefined;
  const rows = await db
    .select()
    .from(signalTradesTable)
    .where(where as any)
    .orderBy(desc(signalTradesTable.createdAt))
    .limit(limit);
  return rows;
}

export async function getUserTradeHistory(userId: number, limit = 50) {
  const rows = await db
    .select({
      id: signalTradeDistributionsTable.id,
      tradeId: signalTradeDistributionsTable.tradeId,
      profitAmount: signalTradeDistributionsTable.profitAmount,
      shareBasis: signalTradeDistributionsTable.shareBasisAmount,
      createdAt: signalTradeDistributionsTable.createdAt,
      pair: signalTradesTable.pair,
      direction: signalTradesTable.direction,
      realizedProfitPercent: signalTradesTable.realizedProfitPercent,
      entryPrice: signalTradesTable.entryPrice,
      realizedExitPrice: signalTradesTable.realizedExitPrice,
    })
    .from(signalTradeDistributionsTable)
    .innerJoin(signalTradesTable, eq(signalTradeDistributionsTable.tradeId, signalTradesTable.id))
    .where(eq(signalTradeDistributionsTable.userId, userId))
    .orderBy(desc(signalTradeDistributionsTable.createdAt))
    .limit(limit);
  return rows;
}
