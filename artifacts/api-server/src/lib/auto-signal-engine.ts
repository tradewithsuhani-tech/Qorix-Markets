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
const MIN_BODY_PERCENT = 0.005; // skip true dojis only — real BTC 5m can be very tight

type PairCfg = {
  code: string;
  base: number;        // last-known anchor — fallback only if live fetch fails
  pipSize: number;     // matches frontend pair-meta
  precision: number;   // decimals for entry price string
  volPercent: number;  // typical 5-min body volatility (%) — fallback synth
  liveSource?: string; // `kraken:<pair>` or `coinbase:<pair>` for live OHLC fetch
};

// Base prices are last-known anchors used only if live fetch fails.
const PAIRS: PairCfg[] = [
  { code: "BTCUSD", base: 78000, pipSize: 1,      precision: 2, volPercent: 0.20, liveSource: "kraken:XBTUSD" },
  { code: "XAUUSD", base: 3320,  pipSize: 0.01,   precision: 2, volPercent: 0.15 },
  { code: "EURUSD", base: 1.082, pipSize: 0.0001, precision: 5, volPercent: 0.08 },
  { code: "USOIL",  base: 71.80, pipSize: 0.01,   precision: 2, volPercent: 0.18 },
];
const PAIR_BY_CODE: Record<string, PairCfg> = PAIRS.reduce((acc, p) => {
  acc[p.code] = p; return acc;
}, {} as Record<string, PairCfg>);

/**
 * Market-hours gate (UTC).
 * - Crypto: 24/7
 * - Forex / Gold / Oil: closed Fri 22:00 UTC → Sun 22:00 UTC (weekend)
 * Note: this is a simplified gate (ignores daily 1h CME break + holidays).
 */
function isMarketOpen(pairCode: string, now = new Date()): boolean {
  if (pairCode === "BTCUSD") return true;
  const day = now.getUTCDay();   // 0=Sun … 6=Sat
  const hour = now.getUTCHours();
  if (day === 6) return false;             // all of Saturday
  if (day === 5 && hour >= 22) return false; // Friday after 22:00 UTC
  if (day === 0 && hour < 22) return false;  // Sunday before 22:00 UTC
  return true;
}

type LiveCandle = {
  openTime: number; closeTime: number;
  open: number; high: number; low: number; close: number;
  source: string;
};

/**
 * Fetch a real, fully-closed 5-min candle from Kraken's public REST API.
 * Kraken returns OHLC tuples [time, open, high, low, close, vwap, volume, count].
 * `time` is the candle's open second (epoch). closeTime = time + 300s.
 * The last entry is usually the still-forming candle, so we pick the most recent
 * one whose closeTime has passed.
 */
async function fetchKrakenLastClosedCandle(krakenPair: string): Promise<LiveCandle> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
  const j = (await res.json()) as { error?: string[]; result?: Record<string, any> };
  if (j.error && j.error.length > 0) throw new Error(`Kraken: ${j.error.join(",")}`);
  const result = j.result ?? {};
  // Kraken returns the data under a key like "XXBTZUSD" (varies by pair) plus "last"
  const ohlcKey = Object.keys(result).find((k) => k !== "last");
  if (!ohlcKey) throw new Error("Kraken: no OHLC key in result");
  const arr = result[ohlcKey] as any[];
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Kraken: empty OHLC");
  const nowSec = Math.floor(Date.now() / 1000);
  const closed = [...arr].reverse().find((c) => Number(c[0]) + 300 <= nowSec);
  if (!closed) throw new Error("Kraken: no closed candle in window");
  return {
    openTime: Number(closed[0]) * 1000,
    closeTime: (Number(closed[0]) + 300) * 1000,
    open: parseFloat(closed[1]),
    high: parseFloat(closed[2]),
    low: parseFloat(closed[3]),
    close: parseFloat(closed[4]),
    source: "kraken",
  };
}

/**
 * Fallback: Coinbase spot price (no OHLC). We synthesise a tight candle around
 * the spot price using a small jitter so the body still has a direction. Only
 * used if Kraken is unreachable.
 */
async function fetchCoinbaseSpotCandle(coinbasePair: string, pair: PairCfg): Promise<LiveCandle> {
  const url = `https://api.coinbase.com/v2/prices/${coinbasePair}/spot`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { amount?: string } };
  const spot = parseFloat(j.data?.amount ?? "");
  if (!Number.isFinite(spot) || spot <= 0) throw new Error("Coinbase: invalid spot");
  const now = Date.now();
  const slot = Math.floor(now / CANDLE_MS) * CANDLE_MS;
  const closeTime = slot - CANDLE_MS;
  const openTime = closeTime - CANDLE_MS;
  // Tight 0.05% jitter so direction isn't always the same
  const jitter = (Math.random() * 2 - 1) * 0.0005;
  const open = +(spot * (1 - jitter / 2)).toFixed(pair.precision);
  const close = +(spot * (1 + jitter / 2)).toFixed(pair.precision);
  return {
    openTime, closeTime,
    open, close,
    high: Math.max(open, close), low: Math.min(open, close),
    source: "coinbase-spot",
  };
}

/**
 * Try the configured live source for a pair (e.g. `kraken:XBTUSD`).
 * On failure, returns null so the caller can fall back to synthetic.
 */
async function tryFetchLiveCandle(pair: PairCfg): Promise<LiveCandle | null> {
  if (!pair.liveSource) return null;
  const [provider, symbol] = pair.liveSource.split(":");
  try {
    if (provider === "kraken") return await fetchKrakenLastClosedCandle(symbol!);
    // No Coinbase OHLC endpoint without auth — only spot fallback
  } catch (err: any) {
    logger.warn({ pair: pair.code, provider, err: err?.message ?? err }, "[auto-engine] kraken fetch failed — trying coinbase spot");
    try {
      // Map Kraken symbols → Coinbase format
      const coinbasePair = symbol === "XBTUSD" ? "BTC-USD" : null;
      if (coinbasePair) return await fetchCoinbaseSpotCandle(coinbasePair, pair);
    } catch (err2: any) {
      logger.warn({ pair: pair.code, err: err2?.message ?? err2 }, "[auto-engine] coinbase spot fallback also failed");
    }
  }
  return null;
}

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

function pickPair(): PairCfg | null {
  const open = PAIRS.filter((p) => isMarketOpen(p.code));
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)]!;
}

/**
 * Get the last CLOSED 5-min candle for a pair.
 * - For pairs with `liveSource`: try the configured public API.
 * - On any failure (network, rate limit, geo-block, etc.): fall back to the
 *   synthetic random-walk candle anchored to the last known close.
 */
async function getLastClosedCandle(pair: PairCfg) {
  const live = await tryFetchLiveCandle(pair);
  if (live) {
    const open = +live.open.toFixed(pair.precision);
    const close = +live.close.toFixed(pair.precision);
    const high = +live.high.toFixed(pair.precision);
    const low = +live.low.toFixed(pair.precision);
    const bodyPct = open === 0 ? 0 : ((close - open) / open) * 100;
    lastCloseByPair[pair.code] = close;
    logger.info(
      { pair: pair.code, source: live.source, open, close, bodyPct: +bodyPct.toFixed(4) },
      "[auto-engine] real candle fetched",
    );
    return { openTime: live.openTime, closeTime: live.closeTime, open, close, high, low, bodyPct };
  }
  logger.warn({ pair: pair.code }, "[auto-engine] no live source available — using synthetic");
  return simulateLastClosedCandle(pair);
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
export async function tickAutoSignalEngine(opts: { force?: boolean; pair?: string } = {}): Promise<{ ok: boolean; reason?: string; tradeId?: number; pair?: string }> {
  resetIfNewDay();
  const now = Date.now();

  // `force` is a debug escape hatch: bypasses cooldown, daily target, and max-trades.
  // Used by the admin debug endpoint (`POST /admin/auto-engine/tick?force=1`).
  if (!opts.force && STATE.breakUntil && now < STATE.breakUntil) {
    const minsLeft = Math.ceil((STATE.breakUntil - now) / 60000);
    logger.info({ minsLeft }, "[auto-engine] paused — cooldown break in progress");
    return { ok: false, reason: `break:${minsLeft}m` };
  }
  if (!opts.force && STATE.tradesToday >= MAX_TRADES_PER_DAY) {
    return { ok: false, reason: "max_trades_reached" };
  }
  if (!opts.force && STATE.profitPercentToday >= DAILY_TARGET_PERCENT) {
    return { ok: false, reason: "daily_target_hit" };
  }

  // AI-scanning realism log
  logger.info("[auto-engine] AI scanning market...");

  let pair: PairCfg | null;
  if (opts.pair) {
    const forced = PAIR_BY_CODE[opts.pair];
    if (!forced) return { ok: false, reason: `unknown_pair:${opts.pair}` };
    if (!opts.force && !isMarketOpen(forced.code)) {
      return { ok: false, reason: `market_closed:${forced.code}` };
    }
    pair = forced;
  } else {
    pair = pickPair();
  }
  if (!pair) {
    logger.info({ utcDay: new Date().getUTCDay() }, "[auto-engine] all eligible markets closed");
    return { ok: false, reason: "all_markets_closed" };
  }
  const candle = await getLastClosedCandle(pair);

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
