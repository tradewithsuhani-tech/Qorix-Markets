import { db, signalTradesTable } from "@workspace/db";
import { and, eq, gte, isNull, like, lte } from "drizzle-orm";
import { logger } from "./logger";
import { createSignalTrade, closeSignalTrade } from "./signal-trade-service";
import { redisConnection } from "./redis";

/**
 * AUTO SIGNAL ENGINE — v2 (planned daily target)
 *
 * Generates a deterministic daily plan of 25 signal trades that, in aggregate,
 * deliver a daily profit target of 0.30%–0.50% of "Active Capital", spread
 * across an 8-hour window with random 15–25 min gaps.
 *
 * Behaviour:
 *  - Window: 12:30 UTC → 20:30 UTC (8 h, 480 min)
 *  - 25 trade slots, gaps randomised in [15, 25] min (avg 19.2)
 *  - Daily target % chosen once per day (uniform random in [0.30, 0.50]%)
 *  - 1 or 2 randomly-chosen "loser" slots/day → ~92–96% win rate
 *  - Loser per-trade %: -0.05 to -0.15
 *  - Winner % distributed across remaining slots so total target is hit
 *  - Real Kraken price (or Coinbase spot fallback) is used as ENTRY anchor;
 *    EXIT is engineered from entry + planned %.
 *
 * Plan is persisted in Redis (key `auto:plan:YYYY-MM-DD`, TTL 36h) and
 * re-loaded on server restart so executed slots are not duplicated.
 *
 * The cron tick runs every minute; each tick executes the earliest
 * pending-and-due slot (one trade per tick, at most).
 */

const AUTO_TAG = "[AUTO-ENGINE-v2#daily-plan]";
const AUTO_NOTES_PREFIX = `${AUTO_TAG} planned slot`;

// Window 12:30 → 20:30 UTC = 480 min = 8 h
const WINDOW_START_HHMM = { h: 12, m: 30 };
const WINDOW_END_HHMM = { h: 20, m: 30 };

const TOTAL_SLOTS = 100;
const MIN_GAP_MIN = 4;
const MAX_GAP_MIN = 6;
const DAILY_TARGET_MIN_PCT = 0.30;
const DAILY_TARGET_MAX_PCT = 0.50;
const LOSER_PCT_MIN = 0.05;
const LOSER_PCT_MAX = 0.15;
// Loser ratio target: ~5% of slots/day (computed dynamically — see loserCount
// derivation in `generateDailyPlan`). This constant is unused but kept as a
// sentinel for future picker tweaks.
const LOSER_COUNT_OPTIONS: number[] = [4, 5, 6];

type PairCfg = {
  code: string;
  base: number;
  pipSize: number;
  precision: number;
  volPercent: number;
  liveSource?: string; // `kraken:<symbol>`
};

const PAIRS: PairCfg[] = [
  { code: "BTCUSD", base: 78000, pipSize: 1,      precision: 2, volPercent: 0.20, liveSource: "kraken:XBTUSD" },
  { code: "XAUUSD", base: 3320,  pipSize: 0.01,   precision: 2, volPercent: 0.15, liveSource: "stooq:xauusd" },
  { code: "EURUSD", base: 1.082, pipSize: 0.0001, precision: 5, volPercent: 0.08, liveSource: "stooq:eurusd" },
  { code: "USOIL",  base: 71.80, pipSize: 0.01,   precision: 2, volPercent: 0.18, liveSource: "stooq:cl.f" },
];
const PAIR_BY_CODE: Record<string, PairCfg> = PAIRS.reduce((acc, p) => {
  acc[p.code] = p; return acc;
}, {} as Record<string, PairCfg>);

/**
 * Market-hours gate (UTC). All pairs (forex, metals, oil, crypto) follow the
 * same broker-style schedule: closed Fri 22:00 UTC → Sun 22:00 UTC (full
 * weekend) plus daily CME maintenance break 21:00–22:00 UTC on Mon–Thu.
 * Saturday & Sunday (until 22:00 UTC) → no trades fire for any pair.
 */
function isMarketOpen(_pairCode: string, atTime: Date): boolean {
  const day = atTime.getUTCDay();   // 0=Sun … 6=Sat
  const hour = atTime.getUTCHours();
  if (day === 6) return false;                       // Saturday: closed all day
  if (day === 5 && hour >= 22) return false;         // Friday: closed after 22 UTC
  if (day === 0 && hour < 22) return false;          // Sunday: closed until 22 UTC
  if (day >= 1 && day <= 4 && hour === 21) return false; // Mon-Thu maintenance
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live price anchors
// ─────────────────────────────────────────────────────────────────────────────
type LiveAnchor = { price: number; source: string };

async function fetchKrakenLastPrice(krakenPair: string): Promise<LiveAnchor | null> {
  try {
    const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { error?: string[]; result?: Record<string, any> };
    if (j.error && j.error.length > 0) return null;
    const result = j.result ?? {};
    const ohlcKey = Object.keys(result).find((k) => k !== "last");
    if (!ohlcKey) return null;
    const arr = result[ohlcKey] as any[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const closed = [...arr].reverse().find((c) => Number(c[0]) + 300 <= nowSec);
    if (!closed) return null;
    return { price: parseFloat(closed[4]), source: "kraken" };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, krakenPair }, "[auto-engine] kraken fetch failed");
    return null;
  }
}

async function fetchCoinbaseSpot(coinbasePair: string): Promise<LiveAnchor | null> {
  try {
    const url = `https://api.coinbase.com/v2/prices/${coinbasePair}/spot`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { amount?: string } };
    const spot = parseFloat(j.data?.amount ?? "");
    if (!Number.isFinite(spot) || spot <= 0) return null;
    return { price: spot, source: "coinbase-spot" };
  } catch {
    return null;
  }
}

/**
 * Stooq free CSV quote endpoint — works for forex (eurusd), metals (xauusd),
 * commodities (cl.f WTI crude). Updates roughly every minute during market
 * hours; on weekends returns last Friday close, which still seeds a realistic
 * anchor.  CSV format: Symbol,Date,Time,Open,High,Low,Close,Volume
 */
async function fetchStooqLastPrice(stooqSymbol: string): Promise<LiveAnchor | null> {
  try {
    const url = `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const txt = await res.text();
    const lines = txt.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const cols = lines[1]!.split(",");
    // Close is column index 6
    const close = parseFloat(cols[6] ?? "");
    if (!Number.isFinite(close) || close <= 0) return null;
    return { price: close, source: "stooq" };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, stooqSymbol }, "[auto-engine] stooq fetch failed");
    return null;
  }
}

// Per-pair drifting anchor for synthetic pricing (non-crypto pairs without live source)
const lastAnchorByPair: Record<string, number> = {};

async function getEntryAnchor(pair: PairCfg): Promise<LiveAnchor> {
  if (pair.liveSource) {
    const [provider, symbol] = pair.liveSource.split(":");
    if (provider === "kraken" && symbol) {
      const live = await fetchKrakenLastPrice(symbol);
      if (live) {
        lastAnchorByPair[pair.code] = live.price;
        return { price: +live.price.toFixed(pair.precision), source: live.source };
      }
      const cb = symbol === "XBTUSD" ? await fetchCoinbaseSpot("BTC-USD") : null;
      if (cb) {
        lastAnchorByPair[pair.code] = cb.price;
        return { price: +cb.price.toFixed(pair.precision), source: cb.source };
      }
    }
    if (provider === "stooq" && symbol) {
      const live = await fetchStooqLastPrice(symbol);
      if (live) {
        lastAnchorByPair[pair.code] = live.price;
        return { price: +live.price.toFixed(pair.precision), source: live.source };
      }
    }
  }
  // Synthetic random walk for pairs without live source (fallback if API down)
  const prev = lastAnchorByPair[pair.code] ?? pair.base;
  const drift = (Math.random() * 2 - 1) * pair.volPercent / 100;
  const next = +(prev * (1 + drift)).toFixed(pair.precision);
  lastAnchorByPair[pair.code] = next;
  return { price: next, source: "synthetic" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily plan
// ─────────────────────────────────────────────────────────────────────────────
type SlotPlan = {
  index: number;
  pair: string;
  direction: "BUY" | "SELL";
  isLoser: boolean;
  pct: number;            // signed: positive = winner, negative = loser
  scheduledAtMs: number;
  status: "pending" | "executed" | "failed";
  tradeId?: number;
  error?: string;
};

type DailyPlan = {
  dayKey: string;
  windowStartMs: number;
  windowEndMs: number;
  effectiveStartMs: number;
  targetPct: number;
  loserCount: number;
  slots: SlotPlan[];
  generatedAt: number;
};

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dayWindowMs(dayKey: string): { startMs: number; endMs: number } {
  const start = Date.UTC(
    Number(dayKey.slice(0, 4)),
    Number(dayKey.slice(5, 7)) - 1,
    Number(dayKey.slice(8, 10)),
    WINDOW_START_HHMM.h, WINDOW_START_HHMM.m, 0, 0,
  );
  const end = Date.UTC(
    Number(dayKey.slice(0, 4)),
    Number(dayKey.slice(5, 7)) - 1,
    Number(dayKey.slice(8, 10)),
    WINDOW_END_HHMM.h, WINDOW_END_HHMM.m, 0, 0,
  );
  return { startMs: start, endMs: end };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickOpenPairAt(d: Date): PairCfg | null {
  const open = PAIRS.filter((p) => isMarketOpen(p.code, d));
  if (open.length === 0) return null;
  return pick(open);
}

/** Quick check: does the day-window have ANY open trading time? */
function windowHasOpenTime(startMs: number, endMs: number): boolean {
  for (let t = startMs; t <= endMs; t += 5 * 60_000) {
    const d = new Date(t);
    if (PAIRS.some((p) => isMarketOpen(p.code, d))) return true;
  }
  return false;
}

/**
 * Generate the day's plan. Honours partial windows: if the engine starts
 * mid-window, slot count is reduced so MIN_GAP_MIN is preserved.
 */
function generateDailyPlan(dayKey: string): DailyPlan {
  const { startMs, endMs } = dayWindowMs(dayKey);
  const now = Date.now();
  const effectiveStart = Math.max(startMs, now + 2 * 60_000);
  const effectiveDurationMin = Math.max(0, (endMs - effectiveStart) / 60_000);

  // How many slots fit in the remaining window with at least MIN_GAP_MIN spacing?
  // For full window (480 min, MIN_GAP=4): floor(480/4)+1 = 121 → cap to 100.
  // For partial window (e.g. 180 min): floor(180/15)+1 = 13.
  let slotCount = TOTAL_SLOTS;
  if (effectiveDurationMin <= 0) {
    slotCount = 0;
  } else if (effectiveDurationMin < (TOTAL_SLOTS - 1) * MIN_GAP_MIN) {
    slotCount = Math.max(1, Math.floor(effectiveDurationMin / MIN_GAP_MIN) + 1);
  }

  // Weekend / fully-closed-day guard: if no pair is ever open in this window,
  // don't schedule any trades for the day.
  if (slotCount > 0 && !windowHasOpenTime(effectiveStart, endMs)) {
    slotCount = 0;
  }

  // Random gaps in [MIN_GAP_MIN, MAX_GAP_MIN], scaled to fit
  const gapsCount = Math.max(0, slotCount - 1);
  const rawGaps: number[] = [];
  for (let i = 0; i < gapsCount; i++) rawGaps.push(randomBetween(MIN_GAP_MIN, MAX_GAP_MIN));
  const sumGaps = rawGaps.reduce((a, b) => a + b, 0) || 1;
  const targetTotal = Math.max(0, effectiveDurationMin - 5); // leave ~5 min buffer
  const scale = sumGaps > 0 && targetTotal > 0 ? Math.min(1, targetTotal / sumGaps) : 1;
  const gaps = rawGaps.map((g) => g * scale);

  // Schedule slot times (rounded to nearest minute)
  const scheduledTimes: number[] = [];
  let cursorMs = effectiveStart;
  for (let i = 0; i < slotCount; i++) {
    scheduledTimes.push(Math.round(cursorMs / 60_000) * 60_000);
    if (i < gaps.length) cursorMs += gaps[i]! * 60_000;
  }

  // Pick loser count (skip if very few slots)
  // Loser count = ~5% of slot count with ±1 jitter, so a 25-slot day has 1-2
  // losers and a 100-slot day has 5-6 losers (~95% win rate either way).
  const loserCount = slotCount >= 5
    ? Math.max(1, Math.min(slotCount - 1, Math.round(slotCount * 0.05) + Math.floor(Math.random() * 2)))
    : 0;
  const loserIdxSet = new Set<number>();
  while (loserIdxSet.size < loserCount && slotCount > 1) {
    // Avoid first slot (let day start with a win)
    const idx = 1 + Math.floor(Math.random() * (slotCount - 1));
    loserIdxSet.add(idx);
  }

  // Daily target %
  const targetPct = +randomBetween(DAILY_TARGET_MIN_PCT, DAILY_TARGET_MAX_PCT).toFixed(4);

  // Loser pcts
  const loserPcts: number[] = [];
  let totalLossPct = 0;
  for (let i = 0; i < loserCount; i++) {
    const lp = +randomBetween(LOSER_PCT_MIN, LOSER_PCT_MAX).toFixed(4);
    loserPcts.push(lp);
    totalLossPct += lp;
  }

  // Winner pcts: distribute (targetPct + totalLossPct) across non-loser slots
  // with weighted variation so individual trades differ in size.
  const winnerCount = slotCount - loserCount;
  const totalWinnerPct = +(targetPct + totalLossPct).toFixed(4);
  const winnerWeights: number[] = [];
  for (let i = 0; i < winnerCount; i++) winnerWeights.push(randomBetween(0.5, 2.0));
  const sumW = winnerWeights.reduce((a, b) => a + b, 0) || 1;
  const winnerPcts = winnerWeights.map((w) => +(w / sumW * totalWinnerPct).toFixed(4));
  // Reconcile rounding residual on the last winner so sum(winners) === totalWinnerPct
  // exactly. Without this, per-slot rounding can drift the daily total off target
  // by ~0.0001-0.001%.
  if (winnerPcts.length > 0) {
    const sumWinners = winnerPcts.reduce((a, b) => a + b, 0);
    const residual = +(totalWinnerPct - sumWinners).toFixed(4);
    if (residual !== 0) {
      winnerPcts[winnerPcts.length - 1] = +(winnerPcts[winnerPcts.length - 1]! + residual).toFixed(4);
    }
  }

  // Build slot list
  const slots: SlotPlan[] = [];
  let winnerCursor = 0;
  let loserCursor = 0;
  for (let i = 0; i < slotCount; i++) {
    const scheduledAtMs = scheduledTimes[i]!;
    const slotDate = new Date(scheduledAtMs);
    const pair = pickOpenPairAt(slotDate) ?? PAIRS[0]!; // safety: shouldn't trigger after windowHasOpenTime guard
    const direction: "BUY" | "SELL" = Math.random() < 0.5 ? "BUY" : "SELL";
    const isLoser = loserIdxSet.has(i);
    const pct = isLoser ? -loserPcts[loserCursor++]! : winnerPcts[winnerCursor++]!;
    slots.push({
      index: i,
      pair: pair.code,
      direction,
      isLoser,
      pct: +pct.toFixed(4),
      scheduledAtMs,
      status: "pending",
    });
  }

  return {
    dayKey,
    windowStartMs: startMs,
    windowEndMs: endMs,
    effectiveStartMs: effectiveStart,
    targetPct,
    loserCount,
    slots,
    generatedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan persistence (Redis)
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_REDIS_KEY_PREFIX = "auto:plan:";
const PLAN_TTL_SECONDS = 36 * 60 * 60;

async function loadPlan(dayKey: string): Promise<DailyPlan | null> {
  try {
    const raw = await redisConnection.get(PLAN_REDIS_KEY_PREFIX + dayKey);
    if (!raw) return null;
    return JSON.parse(raw) as DailyPlan;
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, dayKey }, "[auto-engine] load plan failed");
    return null;
  }
}

async function savePlan(plan: DailyPlan): Promise<void> {
  try {
    await redisConnection.set(
      PLAN_REDIS_KEY_PREFIX + plan.dayKey,
      JSON.stringify(plan),
      "EX",
      PLAN_TTL_SECONDS,
    );
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, dayKey: plan.dayKey }, "[auto-engine] save plan failed");
  }
}

/**
 * Load today's plan or create one. On first creation, scans DB for any
 * already-executed trades whose idempotency key matches a slot, and marks
 * them executed in the new plan to prevent duplicate creation.
 */
async function getOrCreatePlan(dayKey: string): Promise<DailyPlan> {
  const existing = await loadPlan(dayKey);
  if (existing) return existing;

  const plan = generateDailyPlan(dayKey);

  // Replay: find any DB rows already created for today's v2 slots
  try {
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
    const rows = await db
      .select({
        id: signalTradesTable.id,
        idempotencyKey: signalTradesTable.idempotencyKey,
      })
      .from(signalTradesTable)
      .where(
        and(
          like(signalTradesTable.notes, `${AUTO_TAG}%`),
          isNull(signalTradesTable.createdBy),
          gte(signalTradesTable.createdAt, dayStart),
        ),
      );
    for (const r of rows) {
      const m = (r.idempotencyKey ?? "").match(/auto:v2:[\d-]+:slot(\d+)/);
      if (!m) continue;
      const slotIdx = parseInt(m[1]!, 10);
      const slot = plan.slots.find((s) => s.index === slotIdx);
      if (slot) {
        slot.status = "executed";
        slot.tradeId = r.id;
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err }, "[auto-engine] plan replay failed");
  }

  await savePlan(plan);
  const executed = plan.slots.filter((s) => s.status === "executed").length;
  logger.info(
    {
      dayKey,
      slots: plan.slots.length,
      executed,
      targetPct: plan.targetPct,
      loserCount: plan.loserCount,
      windowStart: new Date(plan.effectiveStartMs).toISOString(),
      windowEnd: new Date(plan.windowEndMs).toISOString(),
    },
    "[auto-engine] daily plan generated",
  );
  return plan;
}

function clampDecimals(n: number, decimals: number): number {
  return +n.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: tick — runs every minute
// ─────────────────────────────────────────────────────────────────────────────
export async function tickAutoSignalEngine(opts: { force?: boolean } = {}): Promise<{
  ok: boolean;
  reason?: string;
  tradeId?: number;
  pair?: string;
  slotIndex?: number;
}> {
  const now = Date.now();
  const dayKey = utcDayKey(new Date(now));
  const plan = await getOrCreatePlan(dayKey);

  // Pick earliest pending slot. If `force`, take next pending regardless of due time.
  const pending = plan.slots
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

  let slot: SlotPlan | undefined;
  if (opts.force) {
    slot = pending[0];
  } else {
    slot = pending.find((s) => s.scheduledAtMs <= now);
  }
  if (!slot) {
    return { ok: false, reason: pending.length === 0 ? "all_slots_done" : "no_due_slot" };
  }

  // Re-check market hours; if planned pair (and any pair) is closed at
  // execution time, mark this slot failed and skip — engine sirf market hours
  // me trades fire karta hai (no BTC weekend fallback anymore).
  const pairCode = slot.pair;
  if (!isMarketOpen(pairCode, new Date(now))) {
    const fallback = PAIRS.find((p) => isMarketOpen(p.code, new Date(now)));
    if (!fallback) {
      slot.status = "failed";
      slot.error = "market_closed";
      await savePlan(plan);
      logger.info({ slotIndex: slot.index, pair: pairCode }, "[auto-engine] slot skipped — market closed");
      return { ok: false, reason: "market_closed", slotIndex: slot.index };
    }
    logger.warn({ slotIndex: slot.index, originalPair: pairCode, fallback: fallback.code }, "[auto-engine] swapping to open pair");
    slot.pair = fallback.code;
  }
  const pair = PAIR_BY_CODE[slot.pair]!;

  logger.info(
    { slotIndex: slot.index, pair: slot.pair, direction: slot.direction, plannedPct: slot.pct, isLoser: slot.isLoser },
    "[auto-engine] AI scanning market...",
  );

  // Anchor entry to a real (or synthetic) market price
  const anchor = await getEntryAnchor(pair);
  const entry = clampDecimals(anchor.price, pair.precision);

  // Engineer exit from entry + planned pct
  // direction sign: BUY = +1 (price up = profit), SELL = -1 (price down = profit)
  // loser flips the move so price moves AGAINST the direction
  const dirSign = slot.direction === "BUY" ? 1 : -1;
  const moveSign = slot.isLoser ? -dirSign : dirSign;
  const moveFraction = Math.abs(slot.pct) / 100;
  let exit = clampDecimals(entry * (1 + moveSign * moveFraction), pair.precision);

  // Build TP and SL (both always set for visual realism)
  let tpPrice: number;
  let slPrice: number;
  if (slot.isLoser) {
    slPrice = exit;
    const winFraction = randomBetween(0.05, 0.15) / 100;
    tpPrice = clampDecimals(entry * (1 + dirSign * winFraction), pair.precision);
  } else {
    tpPrice = exit;
    const lossFraction = randomBetween(0.05, 0.15) / 100;
    slPrice = clampDecimals(entry * (1 - dirSign * lossFraction), pair.precision);
  }

  // Validation safety: ensure TP/SL on correct sides of entry
  const minTick = pair.pipSize;
  if (slot.direction === "BUY") {
    if (tpPrice <= entry) tpPrice = clampDecimals(entry + minTick, pair.precision);
    if (slPrice >= entry) slPrice = clampDecimals(entry - minTick, pair.precision);
    if (slot.isLoser && exit >= entry) exit = clampDecimals(entry - minTick, pair.precision);
  } else {
    if (tpPrice >= entry) tpPrice = clampDecimals(entry - minTick, pair.precision);
    if (slPrice <= entry) slPrice = clampDecimals(entry + minTick, pair.precision);
    if (slot.isLoser && exit <= entry) exit = clampDecimals(entry + minTick, pair.precision);
  }

  const realizedPct = slot.pct;
  const closeReason: "target_hit" | "stop_loss" = slot.isLoser ? "stop_loss" : "target_hit";
  const idempotencyKey = `auto:v2:${dayKey}:slot${slot.index}`;

  logger.info(
    {
      slotIndex: slot.index,
      pair: slot.pair,
      direction: slot.direction,
      entry,
      exit,
      tpPrice,
      slPrice,
      realizedPct,
      isLoser: slot.isLoser,
      anchorSource: anchor.source,
    },
    "[auto-engine] Smart signal — instant close (planned slot)",
  );

  try {
    const trade = await createSignalTrade({
      pair: pair.code,
      direction: slot.direction,
      entryPrice: entry,
      tpPrice,
      slPrice,
      pipSize: pair.pipSize,
      // expectedProfitPercent stored as ABS so existing UI/audit conventions stay positive.
      // Realized sign is applied on close.
      expectedProfitPercent: Math.abs(realizedPct),
      scheduledAt: new Date(slot.scheduledAtMs),
      notes: `${AUTO_NOTES_PREFIX} #${slot.index} | ${slot.direction} ${realizedPct.toFixed(4)}% ${slot.isLoser ? "[SL]" : "[TP]"} src=${anchor.source}`,
      idempotencyKey,
    });

    try {
      await closeSignalTrade({
        tradeId: trade.id,
        realizedExitPrice: exit,
        realizedProfitPercent: realizedPct,
        closeReason,
      });
    } catch (err: any) {
      logger.warn({ err: err?.message ?? err, tradeId: trade.id }, "[auto-engine] instant close failed");
      slot.status = "failed";
      slot.error = String(err?.message ?? err);
      await savePlan(plan);
      return { ok: false, reason: "close_failed", tradeId: trade.id, slotIndex: slot.index };
    }

    slot.status = "executed";
    slot.tradeId = trade.id;
    await savePlan(plan);

    logger.info(
      {
        tradeId: trade.id,
        slotIndex: slot.index,
        pair: pair.code,
        direction: slot.direction,
        realizedPct,
        isLoser: slot.isLoser,
      },
      "[auto-engine] Trade executed and closed",
    );

    return { ok: true, tradeId: trade.id, pair: pair.code, slotIndex: slot.index };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, slotIndex: slot.index, pair: pair.code }, "[auto-engine] createSignalTrade failed");
    slot.status = "failed";
    slot.error = String(err?.message ?? err);
    await savePlan(plan);
    return { ok: false, reason: "create_failed", slotIndex: slot.index };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: closer — handles ONLY legacy v1 trades. v2 trades are always
// instant-closed inside `tickAutoSignalEngine` and never left running, so
// matching v1-only here prevents a race where the closer would settle a v2
// trade as a winner using the abs(expected) value before tick closes it
// with the planned (possibly negative) realized %.
// ─────────────────────────────────────────────────────────────────────────────
export async function closeMaturedAutoTrades(): Promise<number> {
  const now = new Date();
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
        like(signalTradesTable.notes, `[AUTO-ENGINE-v1#%`),
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
      logger.info({ tradeId: t.id }, "[auto-engine] legacy auto-closed at TP");
    } catch (err: any) {
      logger.warn({ err: err?.message ?? err, tradeId: t.id }, "[auto-engine] legacy auto-close failed");
    }
  }
  return closed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: rehydrate (called once at startup)
// ─────────────────────────────────────────────────────────────────────────────
export async function rehydrateAutoEngineState(): Promise<void> {
  const dayKey = utcDayKey();
  await getOrCreatePlan(dayKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: state inspector (admin /admin/auto-engine/state)
// ─────────────────────────────────────────────────────────────────────────────
export async function getAutoEngineState() {
  const dayKey = utcDayKey();
  const plan = await loadPlan(dayKey);
  if (!plan) {
    return { dayKey, plan: null };
  }
  const executed = plan.slots.filter((s) => s.status === "executed").length;
  const pending = plan.slots.filter((s) => s.status === "pending").length;
  const failed = plan.slots.filter((s) => s.status === "failed").length;
  const next = plan.slots
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs)[0];
  const cumulativeRealizedPct = plan.slots
    .filter((s) => s.status === "executed")
    .reduce((acc, s) => acc + s.pct, 0);
  return {
    dayKey: plan.dayKey,
    targetPct: plan.targetPct,
    loserCount: plan.loserCount,
    totalSlots: plan.slots.length,
    executed,
    pending,
    failed,
    cumulativeRealizedPct: +cumulativeRealizedPct.toFixed(4),
    nextSlot: next
      ? {
          index: next.index,
          pair: next.pair,
          direction: next.direction,
          pct: next.pct,
          isLoser: next.isLoser,
          scheduledAt: new Date(next.scheduledAtMs).toISOString(),
        }
      : null,
    windowStart: new Date(plan.windowStartMs).toISOString(),
    windowEnd: new Date(plan.windowEndMs).toISOString(),
    effectiveStart: new Date(plan.effectiveStartMs).toISOString(),
  };
}
