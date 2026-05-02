/**
 * BOT TERMINAL — state composer (Batch S)
 *
 * Builds the JSON payload for `GET /api/bot-trading/state`. Pure
 * read-only: it joins live quotes (quote-feed) with the existing
 * signal_trades / signal_trade_distributions tables to give the
 * dashboard widget everything it needs in one round-trip:
 *
 *   - market gating (forex window vs crypto 24/7)
 *   - bot plan progress (slots executed / pending / next ETA),
 *     pulled directly from auto-signal-engine.getAutoEngineState
 *   - platform-level open positions (status='running' rows in
 *     signal_trades, with a live signed PnL% computed against the
 *     current quote.mid)
 *   - platform-level closed trades since UTC midnight
 *   - the calling user's distributed share for today (count + sum
 *     of profit_amount from signal_trade_distributions)
 *
 * Important architectural note: signal_trades is PLATFORM-level —
 * the bot places one trade and all eligible users get a pro-rata
 * distribution row. So the open/closed lists in this payload are
 * the same for every user; only the `userToday` block is keyed
 * to req.user.id.
 *
 * ZERO new schema, ZERO migrations. Reuses existing tables and
 * helpers. Uses Promise.all to issue the 5 reads concurrently so
 * the dashboard widget's poll latency stays well under 1s.
 */

import { db, signalTradesTable, signalTradeDistributionsTable } from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { getAllQuotes, isForexMarketOpen, type Quote } from "./quote-feed";
import { getAutoEngineState } from "./auto-signal-engine";

export type BotStateOpenPosition = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: number;
  tpPrice: number | null;
  slPrice: number | null;
  expectedProfitPercent: number;
  openedAt: string;
  livePnlPct: number | null;
};

export type BotStateClosedTrade = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: number;
  realizedExitPrice: number | null;
  realizedProfitPercent: number | null;
  closeReason: string | null;
  closedAt: string;
};

export type BotStateResponse = {
  asOf: string;
  market: { forexOpen: boolean; cryptoOpen: boolean };
  bot: {
    enabled: boolean;
    plan: Awaited<ReturnType<typeof getAutoEngineState>> | null;
  };
  openPositions: BotStateOpenPosition[];
  closedToday: BotStateClosedTrade[];
  userToday: { distributionsCount: number; totalProfit: number };
  summary: {
    openCount: number;
    closedTodayCount: number;
    closedTodayPctSum: number;
  };
};

function utcStartOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function quoteByPair(quotes: Quote[]): Map<string, Quote> {
  const m = new Map<string, Quote>();
  for (const q of quotes) m.set(q.code, q);
  return m;
}

/**
 * Live signed PnL% for an open position vs current mid.
 *   BUY  : (mid - entry) / entry * 100
 *   SELL : (entry - mid) / entry * 100
 *
 * Returns null if the quote is unavailable or entry is non-positive
 * (defensive — a zero/negative entry would never be a real trade,
 * but we don't want a divide-by-zero to surface as Infinity in the
 * response and break frontend formatters).
 */
function computeLivePnlPct(
  direction: string,
  entryPrice: number,
  mid: number | null,
): number | null {
  if (mid == null) return null;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  const sign = direction.toUpperCase() === "SELL" ? -1 : 1;
  return +((((mid - entryPrice) / entryPrice) * 100) * sign).toFixed(4);
}

export async function buildBotState(userId: number): Promise<BotStateResponse> {
  const todayUtc = utcStartOfToday();

  const [quotes, engineState, openRows, closedRows, userDistRows] =
    await Promise.all([
      getAllQuotes(),
      // Engine state lookup hits Redis-backed plan storage. If Redis
      // is briefly unreachable we'd rather degrade to a null plan
      // than 500 the entire dashboard widget — the rest of the
      // payload (quotes, positions, user share) is still useful.
      getAutoEngineState().catch(() => null),
      db
        .select()
        .from(signalTradesTable)
        .where(eq(signalTradesTable.status, "running"))
        .orderBy(desc(signalTradesTable.createdAt))
        .limit(50),
      db
        .select()
        .from(signalTradesTable)
        .where(
          and(
            eq(signalTradesTable.status, "closed"),
            gte(signalTradesTable.closedAt, todayUtc),
          ),
        )
        .orderBy(desc(signalTradesTable.closedAt))
        .limit(100),
      db
        .select({
          count: sql<number>`count(*)::int`,
          sum: sql<string>`coalesce(sum(${signalTradeDistributionsTable.profitAmount}),'0')`,
        })
        .from(signalTradeDistributionsTable)
        .where(
          and(
            eq(signalTradeDistributionsTable.userId, userId),
            gte(signalTradeDistributionsTable.createdAt, todayUtc),
          ),
        ),
    ]);

  const qMap = quoteByPair(quotes);

  const openPositions: BotStateOpenPosition[] = openRows.map((r) => {
    const mid = qMap.get(r.pair)?.mid ?? null;
    const entry = Number(r.entryPrice);
    return {
      id: r.id,
      pair: r.pair,
      direction: r.direction,
      entryPrice: entry,
      tpPrice: r.tpPrice == null ? null : Number(r.tpPrice),
      slPrice: r.slPrice == null ? null : Number(r.slPrice),
      expectedProfitPercent: Number(r.expectedProfitPercent),
      openedAt: r.createdAt.toISOString(),
      livePnlPct: computeLivePnlPct(r.direction, entry, mid),
    };
  });

  const closedToday: BotStateClosedTrade[] = closedRows.map((r) => ({
    id: r.id,
    pair: r.pair,
    direction: r.direction,
    entryPrice: Number(r.entryPrice),
    realizedExitPrice:
      r.realizedExitPrice == null ? null : Number(r.realizedExitPrice),
    realizedProfitPercent:
      r.realizedProfitPercent == null ? null : Number(r.realizedProfitPercent),
    closeReason: r.closeReason ?? null,
    closedAt: (r.closedAt ?? r.createdAt).toISOString(),
  }));

  const distRow = userDistRows[0] ?? { count: 0, sum: "0" };
  const userToday = {
    distributionsCount: Number(distRow.count ?? 0),
    totalProfit: +Number(distRow.sum ?? "0").toFixed(8),
  };

  const closedTodayPctSum = closedRows.reduce(
    (acc, r) =>
      acc +
      (r.realizedProfitPercent == null ? 0 : Number(r.realizedProfitPercent)),
    0,
  );

  return {
    asOf: new Date().toISOString(),
    market: { forexOpen: isForexMarketOpen(), cryptoOpen: true },
    bot: { enabled: true, plan: engineState },
    openPositions,
    closedToday,
    userToday,
    summary: {
      openCount: openPositions.length,
      closedTodayCount: closedToday.length,
      closedTodayPctSum: +closedTodayPctSum.toFixed(4),
    },
  };
}
