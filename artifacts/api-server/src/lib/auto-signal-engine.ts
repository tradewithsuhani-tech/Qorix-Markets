import { db, signalTradesTable } from "@workspace/db";
import { and, eq, gte, isNull, like, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { createSignalTrade, closeSignalTrade } from "./signal-trade-service";

/**
 * CONTROLLED AUTO SIGNAL ENGINE
 *
 * Generates signal trades automatically on a 5-minute candle cadence with:
 *  - Max 15 trades / UTC day
 *  - 1-hour pause after every 2 trades
 *  - Daily profit target = 0.4% of demo balance (track cumulative %)
 *  - TP per trade ≈ 0.2–0.4%
 *  - Multi-pair rotation: BTCUSD / XAUUSD / EURUSD / USOIL
 *  - Auto-close on candle close (5 min after open) — TP always hit (demo realism)
 *
 * Engine trades are tagged in `notes` with the AUTO_TAG so the closer can
 * find them without affecting manually-created admin trades.
 */

// Tag includes a non-typeable marker so admin-typed notes can never collide.
// Combined with `createdBy IS NULL` filter on the closer, this is double-safe.
const AUTO_TAG = "[AUTO-ENGINE-v1#a7c2]";
const AUTO_NOTES_PREFIX = `${AUTO_TAG} 5m candle signal`;
const MAX_TRADES_PER_DAY = 15;
const TRADES_BEFORE_BREAK = 2;
const BREAK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const DAILY_TARGET_PERCENT = 0.4; // 0.4% of balance
const TP_MIN_PERCENT = 0.2;
const TP_MAX_PERCENT = 0.4;
const CANDLE_MS = 5 * 60 * 1000;
const MIN_BODY_PERCENT = 0.02; // skip dojis below this %

type PairCfg = {
  code: string;
  base: number;        // anchor price
  pipSize: number;     // matches frontend pair-meta
  precision: number;   // decimals for entry price string
  volPercent: number;  // typical 5-min body volatility (%)
};

const PAIRS: PairCfg[] = [
  { code: "BTCUSD", base: 67000, pipSize: 1,      precision: 2, volPercent: 0.20 },
  { code: "XAUUSD", base: 2380,  pipSize: 0.01,   precision: 2, volPercent: 0.15 },
  { code: "EURUSD", base: 1.085, pipSize: 0.0001, precision: 5, volPercent: 0.08 },
  { code: "USOIL",  base: 78.50, pipSize: 0.01,   precision: 2, volPercent: 0.18 },
];
const PAIR_BY_CODE: Record<string, PairCfg> = PAIRS.reduce((acc, p) => {
  acc[p.code] = p; return acc;
}, {} as Record<string, PairCfg>);

// ─────────────────────────────────────────────────────────────────────────────
// In-memory engine state (single-process; resets on server restart by design)
// ─────────────────────────────────────────────────────────────────────────────
type EngineState = {
  dayKey: string;
  tradesToday: number;
  tradesSinceLastBreak: number;
  profitPercentToday: number;
  lastTradeAt: number | null;
  breakUntil: number | null;
};

const STATE: EngineState = {
  dayKey: "",
  tradesToday: 0,
  tradesSinceLastBreak: 0,
  profitPercentToday: 0,
  lastTradeAt: null,
  breakUntil: null,
};

// Per-pair drifting "last close" so synthetic candles chain naturally
const lastCloseByPair: Record<string, number> = {};

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function resetIfNewDay() {
  const today = utcDayKey();
  if (STATE.dayKey !== today) {
    STATE.dayKey = today;
    STATE.tradesToday = 0;
    STATE.tradesSinceLastBreak = 0;
    STATE.profitPercentToday = 0;
    STATE.lastTradeAt = null;
    STATE.breakUntil = null;
    logger.info({ day: today }, "[auto-engine] day reset");
  }
}

/**
 * Rehydrate today's counters from the DB so server restarts don't reset
 * the daily caps and let the engine exceed 15 trades / 0.4% target.
 * Looks at all auto-engine trades created today and replays the running totals.
 */
export async function rehydrateAutoEngineState(): Promise<void> {
  const today = utcDayKey();
  const dayStartUtc = new Date(`${today}T00:00:00.000Z`);
  STATE.dayKey = today;

  try {
    const rows = await db
      .select({
        count: sql<number>`count(*)::int`,
        profitSum: sql<number>`coalesce(sum(${signalTradesTable.expectedProfitPercent}::numeric), 0)::float`,
        lastAt: sql<Date | null>`max(${signalTradesTable.createdAt})`,
      })
      .from(signalTradesTable)
      .where(
        and(
          like(signalTradesTable.notes, `${AUTO_TAG}%`),
          isNull(signalTradesTable.createdBy),
          gte(signalTradesTable.createdAt, dayStartUtc),
        ),
      );

    const r = rows[0];
    if (r && r.count > 0) {
      STATE.tradesToday = r.count;
      STATE.profitPercentToday = +Number(r.profitSum ?? 0).toFixed(4);
      STATE.lastTradeAt = r.lastAt ? new Date(r.lastAt as any).getTime() : null;
      // Re-derive cooldown: if last trade was within BREAK_DURATION_MS AND a multiple
      // of TRADES_BEFORE_BREAK has been hit, restore the pause.
      const inBreakBlock = STATE.tradesToday % TRADES_BEFORE_BREAK === 0 && STATE.tradesToday > 0;
      if (inBreakBlock && STATE.lastTradeAt) {
        const breakEnds = STATE.lastTradeAt + BREAK_DURATION_MS;
        if (breakEnds > Date.now()) {
          STATE.breakUntil = breakEnds;
          STATE.tradesSinceLastBreak = 0;
        } else {
          STATE.tradesSinceLastBreak = 0;
        }
      } else {
        STATE.tradesSinceLastBreak = STATE.tradesToday % TRADES_BEFORE_BREAK;
      }
      logger.info(
        {
          tradesToday: STATE.tradesToday,
          profitPercentToday: STATE.profitPercentToday,
          breakUntil: STATE.breakUntil ? new Date(STATE.breakUntil).toISOString() : null,
        },
        "[auto-engine] state rehydrated from DB",
      );
    } else {
      logger.info({ day: today }, "[auto-engine] no prior trades today — fresh state");
    }
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err }, "[auto-engine] rehydrate failed (continuing with empty state)");
  }
}

function pickPair(): PairCfg {
  return PAIRS[Math.floor(Math.random() * PAIRS.length)]!;
}

/**
 * Simulate the last CLOSED 5-minute candle for the given pair.
 * Aligned to UTC clock (00:00, 00:05, 00:10, …). The candle's openTime is
 * 10 min ago and closeTime is 5 min ago — i.e. fully settled.
 */
function simulateLastClosedCandle(pair: PairCfg) {
  const now = Date.now();
  const slot = Math.floor(now / CANDLE_MS) * CANDLE_MS;
  const closeTime = slot - CANDLE_MS;       // last fully closed
  const openTime = closeTime - CANDLE_MS;

  const prev = lastCloseByPair[pair.code] ?? pair.base;
  // body: random walk in [-vol, +vol]
  const bodyPct = (Math.random() * 2 - 1) * pair.volPercent;
  const open = prev;
  const close = +(open * (1 + bodyPct / 100)).toFixed(pair.precision);
  const wickPct = pair.volPercent * 0.4;
  const high = +(Math.max(open, close) * (1 + Math.random() * wickPct / 100)).toFixed(pair.precision);
  const low = +(Math.min(open, close) * (1 - Math.random() * wickPct / 100)).toFixed(pair.precision);

  lastCloseByPair[pair.code] = close;
  return { openTime, closeTime, open, close, high, low, bodyPct };
}

function clampDecimals(n: number, decimals: number): number {
  return +n.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: tick — called every 5 minutes by cron
// ─────────────────────────────────────────────────────────────────────────────
export async function tickAutoSignalEngine(): Promise<{ ok: boolean; reason?: string; tradeId?: number; pair?: string }> {
  resetIfNewDay();
  const now = Date.now();

  if (STATE.breakUntil && now < STATE.breakUntil) {
    const minsLeft = Math.ceil((STATE.breakUntil - now) / 60000);
    logger.info({ minsLeft }, "[auto-engine] paused — cooldown break in progress");
    return { ok: false, reason: `break:${minsLeft}m` };
  }
  if (STATE.tradesToday >= MAX_TRADES_PER_DAY) {
    return { ok: false, reason: "max_trades_reached" };
  }
  if (STATE.profitPercentToday >= DAILY_TARGET_PERCENT) {
    return { ok: false, reason: "daily_target_hit" };
  }

  // AI-scanning realism log
  logger.info("[auto-engine] AI scanning market...");

  const pair = pickPair();
  const candle = simulateLastClosedCandle(pair);

  // Doji guard
  if (Math.abs(candle.bodyPct) < MIN_BODY_PERCENT) {
    logger.info({ pair: pair.code, bodyPct: candle.bodyPct }, "[auto-engine] no signal — body too small");
    return { ok: false, reason: "no_signal" };
  }

  // Direction comes from the SIGNAL candle (last closed). Entry is the CURRENT
  // market price (≈ that candle's close, since price is continuous), and the
  // trade auto-closes at the end of the next 5-min candle window.
  const direction: "BUY" | "SELL" = candle.close > candle.open ? "BUY" : "SELL";
  const entryPrice = candle.close;

  // TP percent — clamp so cumulative doesn't overshoot daily target by too much
  const remainingHeadroom = Math.max(0, DAILY_TARGET_PERCENT - STATE.profitPercentToday);
  let tpPercent = TP_MIN_PERCENT + Math.random() * (TP_MAX_PERCENT - TP_MIN_PERCENT);
  if (tpPercent > remainingHeadroom && remainingHeadroom > 0.01) {
    tpPercent = remainingHeadroom; // last trade of the day — exactly hit target
  }
  tpPercent = +tpPercent.toFixed(4);

  const tpDelta = entryPrice * (tpPercent / 100);
  const tpRaw = direction === "BUY" ? entryPrice + tpDelta : entryPrice - tpDelta;
  const tpPrice = clampDecimals(tpRaw, pair.precision);

  // Auto-close at the end of the NEXT 5-min candle (current slot + 1 candle).
  // Closer cron (every 1 min) flips status → closed once this passes.
  const nextSlot = Math.floor(now / CANDLE_MS) * CANDLE_MS + CANDLE_MS;
  const closeAt = new Date(nextSlot);

  logger.info({ pair: pair.code, direction, entry: entryPrice, tp: tpPrice, expectedPct: tpPercent }, "[auto-engine] Smart signal detected");

  try {
    const trade = await createSignalTrade({
      pair: pair.code,
      direction,
      entryPrice,
      tpPrice,
      pipSize: pair.pipSize,
      expectedProfitPercent: tpPercent,
      scheduledAt: closeAt, // re-purposed as auto-close marker
      notes: `${AUTO_NOTES_PREFIX} | dir=${direction} body=${candle.bodyPct.toFixed(3)}%`,
      idempotencyKey: `auto:${STATE.dayKey}:${STATE.tradesToday + 1}:${pair.code}:${candle.closeTime}`,
    });

    STATE.tradesToday += 1;
    STATE.tradesSinceLastBreak += 1;
    STATE.lastTradeAt = now;
    // Optimistic profit tracking (engine always closes at TP for demo realism)
    STATE.profitPercentToday = +(STATE.profitPercentToday + tpPercent).toFixed(4);

    // Cooldown after every N trades
    if (STATE.tradesSinceLastBreak >= TRADES_BEFORE_BREAK) {
      STATE.breakUntil = now + BREAK_DURATION_MS;
      STATE.tradesSinceLastBreak = 0;
      logger.info({ until: new Date(STATE.breakUntil).toISOString() }, "[auto-engine] cooldown break engaged (1h)");
    }

    logger.info({ tradeId: trade.id, pair: pair.code, direction, tpPercent }, "[auto-engine] Trade executed successfully");
    return { ok: true, tradeId: trade.id, pair: pair.code };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, pair: pair.code }, "[auto-engine] createSignalTrade failed");
    return { ok: false, reason: "create_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: close matured auto-engine trades — called every minute by cron
// ─────────────────────────────────────────────────────────────────────────────
export async function closeMaturedAutoTrades(): Promise<number> {
  const now = new Date();
  // Find running auto-engine trades whose scheduled close time has passed
  const matured = await db
    .select({
      id: signalTradesTable.id,
      tpPrice: signalTradesTable.tpPrice,
      expectedProfitPercent: signalTradesTable.expectedProfitPercent,
    })
    .from(signalTradesTable)
    .where(
      and(
        eq(signalTradesTable.status, "running"),
        like(signalTradesTable.notes, `${AUTO_TAG}%`),
        // Defence-in-depth: only trades with NULL createdBy (engine never sets it)
        // are eligible. Admin/manual trades always set createdBy via the auth route.
        isNull(signalTradesTable.createdBy),
        lte(signalTradesTable.scheduledAt, now),
      ),
    )
    .limit(20);

  if (matured.length === 0) return 0;

  let closed = 0;
  for (const t of matured) {
    try {
      const realizedExit = t.tpPrice ? parseFloat(t.tpPrice as string) : undefined;
      const realizedPct = parseFloat(t.expectedProfitPercent as string);
      await closeSignalTrade({
        tradeId: t.id,
        realizedExitPrice: realizedExit,
        realizedProfitPercent: realizedPct,
        closeReason: "target_hit",
      });
      closed += 1;
      logger.info({ tradeId: t.id }, "[auto-engine] auto-closed at TP (candle close)");
    } catch (err: any) {
      logger.warn({ err: err?.message ?? err, tradeId: t.id }, "[auto-engine] auto-close failed");
    }
  }
  if (closed > 0) logger.info({ closed }, "[auto-engine] matured trades closed");
  return closed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: state inspector (for /api/admin or debug logs)
// ─────────────────────────────────────────────────────────────────────────────
export function getAutoEngineState() {
  resetIfNewDay();
  return {
    ...STATE,
    breakUntil: STATE.breakUntil ? new Date(STATE.breakUntil).toISOString() : null,
    lastTradeAt: STATE.lastTradeAt ? new Date(STATE.lastTradeAt).toISOString() : null,
    targetPercent: DAILY_TARGET_PERCENT,
    maxTradesPerDay: MAX_TRADES_PER_DAY,
    tradesBeforeBreak: TRADES_BEFORE_BREAK,
  };
}
