import {
  db,
  signalTradesTable,
  signalTradeDistributionsTable,
  walletsTable,
  usersTable,
  transactionsTable,
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
  pipsTarget: number;
  pipSize?: number;
  expectedProfitPercent: number;
  notes?: string;
  idempotencyKey?: string;
  createdBy?: number;
};

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
  const exitPrice = calcExitPrice(input.entryPrice, input.direction, input.pipsTarget, pipSize);
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
      pipsTarget: input.pipsTarget.toString(),
      pipSize: pipSize.toString(),
      exitPrice: exitPrice.toString(),
      expectedProfitPercent: input.expectedProfitPercent.toString(),
      status: "running",
      notes: input.notes,
      idempotencyKey,
      createdBy: input.createdBy,
    })
    .returning();

  logger.info({ tradeId: created!.id, pair: input.pair }, "[signal-trade] created");
  return created!;
}

export async function closeSignalTrade(input: CloseTradeInput) {
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

  // Determine realized profit %
  const expectedPct = parseFloat(t.expectedProfitPercent as string);
  const realizedPct = input.realizedProfitPercent ?? expectedPct;
  const realizedExit = input.realizedExitPrice ?? parseFloat(t.exitPrice as string);
  const closeReason = input.closeReason ?? "target_hit";

  // Slippage clamp safety: realized must be within +/- 50% of expected unless manual override
  if (closeReason !== "manual") {
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

      // Update wallet (profit goes to profit_balance)
      const newProfitBal = sql`${walletsTable.profitBalance}::numeric + ${profit.toString()}::numeric`;
      await tx
        .update(walletsTable)
        .set({ profitBalance: newProfitBal as any, updatedAt: new Date() })
        .where(eq(walletsTable.userId, w.userId));

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

      // Double-entry: profit_expense ↑ debit, user:profit ↑ credit (loss handled with sign reversal)
      if (profit > 0) {
        await postJournalEntry(
          journalForSystem(`signal-${t.id}-u${w.userId}`),
          [
            { accountCode: "platform:profit_expense", entryType: "debit",  amount: profit, description: `Signal #${t.id} payout` },
            { accountCode: `user:${w.userId}:profit`, entryType: "credit", amount: profit, description: `Signal #${t.id} payout` },
          ],
          txRow!.id,
          tx,
        );
      } else {
        const loss = Math.abs(profit);
        await postJournalEntry(
          journalForSystem(`signal-${t.id}-u${w.userId}-loss`),
          [
            { accountCode: `user:${w.userId}:profit`, entryType: "debit",  amount: loss, description: `Signal #${t.id} loss` },
            { accountCode: "platform:profit_expense", entryType: "credit", amount: loss, description: `Signal #${t.id} loss reversal` },
          ],
          txRow!.id,
          tx,
        );
      }

      totalDistributed += profit;
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
