/**
 * BOT TERMINAL — live quote feed
 *
 * Shared, Redis-cached price source for the dashboard's Bot Trading
 * Terminal widget. Powers the 4-pair live ticker (XAUUSD / EURUSD /
 * BTCUSD / USOIL) and is also reusable by future bot-trading
 * endpoints (positions live PnL, etc.).
 *
 * Design goals:
 *  - "Reality feel" — terminal must visibly tick between upstream
 *    refreshes (every 1.5s frontend poll). We anchor to a real
 *    upstream quote (Coinbase spot for BTC, Stooq for forex/metals/
 *    oil) cached 30s in Redis, then apply a small smooth-ish jitter
 *    on each request so consecutive ticks differ by ~1 pip without
 *    looking like white noise.
 *  - Zero new secrets — all upstream sources are public/free APIs
 *    already used by auto-signal-engine.ts.
 *  - Zero schema change — anchors and prev-day reference values
 *    live in Redis, no DB tables touched.
 *  - Graceful degradation — if every upstream fails, we fall back
 *    to a `base` price + synthetic walk so the terminal never goes
 *    blank (better operator UX than a 500).
 *
 * NOTE: this module deliberately does NOT touch auto-signal-engine.
 * The engine has its own `getEntryAnchor` that uses 5-minute Kraken
 * OHLC candles (correct for trade ENTRY anchoring — that's a
 * "what was the actual market price at slot fire time" answer).
 * The terminal needs LIVE feel which means spot, not delayed OHLC.
 * Keeping these separate avoids regressing the engine.
 */

import { logger } from "./logger";
import { getRedisConnection } from "./redis";

export type PairCfg = {
  code: string;        // canonical: "XAUUSD"
  display: string;     // pretty:    "XAU/USD"
  pipSize: number;     // 0.01 / 0.0001 / 1
  precision: number;   // decimals to round to
  spreadPips: number;  // total spread (bid→ask) in pips
  base: number;        // hard fallback if all sources fail
  liveSource: string;  // "coinbase:BTC-USD" | "stooq:xauusd" | …
};

/**
 * Bot terminal pairs. Order = display order (left → right) on the
 * ticker tape. Spreads are tuned to typical retail-broker values so
 * the bid/ask split looks realistic.
 */
export const BOT_PAIRS: PairCfg[] = [
  { code: "XAUUSD", display: "XAU/USD", pipSize: 0.01,   precision: 2, spreadPips: 25, base: 3320,  liveSource: "stooq:xauusd"     },
  { code: "EURUSD", display: "EUR/USD", pipSize: 0.0001, precision: 5, spreadPips: 8,  base: 1.082, liveSource: "stooq:eurusd"     },
  { code: "BTCUSD", display: "BTC/USD", pipSize: 1,      precision: 2, spreadPips: 5,  base: 78000, liveSource: "coinbase:BTC-USD" },
  { code: "USOIL",  display: "USOIL",   pipSize: 0.01,   precision: 2, spreadPips: 12, base: 71.80, liveSource: "stooq:cl.f"       },
];

const PAIR_BY_CODE: Record<string, PairCfg> = BOT_PAIRS.reduce(
  (a, p) => { a[p.code] = p; return a; },
  {} as Record<string, PairCfg>,
);

export type Quote = {
  code: string;
  display: string;
  mid: number;
  bid: number;
  ask: number;
  change24h: number;       // signed % vs reference 24h ago
  changeAbs24h: number;    // signed price delta
  spreadPips: number;
  precision: number;
  pipSize: number;
  source: string;          // upstream that won the race ("coinbase" | "stooq" | "synthetic")
  asOf: string;            // ISO of this quote's tick
  marketOpen: boolean;     // pair-specific (BTC always true)
};

/* ─────────────────────────────────────────────────────────────────
 * Upstream fetchers — all wrapped in try/catch so a single failing
 * provider can never throw out of the route handler.
 * ───────────────────────────────────────────────────────────────── */

async function fetchCoinbaseSpot(pair: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/v2/prices/${pair}/spot`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { amount?: string } };
    const p = parseFloat(j.data?.amount ?? "");
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, pair }, "[quote-feed] coinbase failed");
    return null;
  }
}

async function fetchKrakenSpot(krakenPair: string): Promise<number | null> {
  try {
    // Ticker endpoint returns LAST trade price (`c[0]`) — true spot,
    // not the 5-min OHLC delayed close that auto-signal-engine uses.
    const res = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { error?: string[]; result?: Record<string, { c?: string[] }> };
    if (j.error && j.error.length > 0) return null;
    const result = j.result ?? {};
    const k = Object.keys(result).find((kk) => kk !== "last");
    if (!k) return null;
    const c = result[k]?.c?.[0];
    const p = parseFloat(c ?? "");
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, krakenPair }, "[quote-feed] kraken failed");
    return null;
  }
}

async function fetchStooqLast(stooqSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&h&e=csv`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const txt = await res.text();
    const lines = txt.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    const cols = lines[1]!.split(",");
    // CSV columns: Symbol,Date,Time,Open,High,Low,Close,Volume → close = idx 6
    const close = parseFloat(cols[6] ?? "");
    return Number.isFinite(close) && close > 0 ? close : null;
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, stooqSymbol }, "[quote-feed] stooq failed");
    return null;
  }
}

async function fetchAnchor(pair: PairCfg): Promise<{ price: number; source: string } | null> {
  const [provider, sym] = pair.liveSource.split(":");
  if (!provider || !sym) return null;
  if (provider === "coinbase") {
    const p = await fetchCoinbaseSpot(sym);
    if (p) return { price: p, source: "coinbase" };
  }
  if (provider === "kraken") {
    const p = await fetchKrakenSpot(sym);
    if (p) return { price: p, source: "kraken" };
    // BTC fallback → coinbase spot
    if (sym === "XBTUSD") {
      const p2 = await fetchCoinbaseSpot("BTC-USD");
      if (p2) return { price: p2, source: "coinbase" };
    }
  }
  if (provider === "stooq") {
    const p = await fetchStooqLast(sym);
    if (p) return { price: p, source: "stooq" };
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────
 * Market-hours gate — mirrors the gate in auto-signal-engine.ts so
 * the terminal "MARKETS CLOSED" overlay agrees with the engine's
 * trade-firing schedule.
 * ───────────────────────────────────────────────────────────────── */
export function isForexMarketOpen(at: Date = new Date()): boolean {
  const day = at.getUTCDay();   // 0=Sun … 6=Sat
  const hour = at.getUTCHours();
  if (day === 6) return false;                       // Saturday: closed all day
  if (day === 5 && hour >= 22) return false;         // Friday: closed after 22 UTC
  if (day === 0 && hour < 22) return false;          // Sunday: closed until 22 UTC
  if (day >= 1 && day <= 4 && hour === 21) return false; // Mon–Thu CME maintenance
  return true;
}

/** BTC trades 24/7; everything else follows forex hours. */
function isPairOpen(code: string, at: Date = new Date()): boolean {
  if (code === "BTCUSD") return true;
  return isForexMarketOpen(at);
}

/* ─────────────────────────────────────────────────────────────────
 * Live tick layer
 *
 * The cached anchor refreshes every 30s — but the terminal polls
 * /quotes every ~1.5s. Without jitter, 20 consecutive polls would
 * see the EXACT same number frozen on screen — which kills the
 * "live" illusion. We add a deterministic-ish jitter on top of the
 * anchor:
 *   - Two slow sine waves (periods ~13s and ~7s) drive smooth
 *     wave-like movement → looks like real price action, not noise
 *   - A tiny random component layered on top → micro-volatility
 *   - All scaled to ±~1.5 pips so the ticker visibly moves but
 *     never drifts unrealistically far from the upstream anchor
 * ───────────────────────────────────────────────────────────────── */
function tickJitterPips(): number {
  const t = Date.now() / 1000;
  const sine = Math.sin(t / 13) * 0.6 + Math.sin(t / 7) * 0.4;
  const noise = (Math.random() - 0.5) * 0.4;
  return (sine + noise) * 1.5;
}

const ANCHOR_KEY = (code: string) => `bot:quote-anchor:${code}`;
const PREV_DAY_KEY = (code: string) => `bot:quote-prev-day:${code}`;
const ANCHOR_TTL_SEC = 30;
const PREV_DAY_TTL_SEC = 6 * 3600; // 6h — refreshed by first call after expiry

/* ─────────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────────── */
export async function getQuote(code: string): Promise<Quote | null> {
  const pair = PAIR_BY_CODE[code];
  if (!pair) return null;

  const redis = getRedisConnection();

  // 1. Try cached anchor
  let anchor: { price: number; source: string } | null = null;
  try {
    const cached = await redis.get(ANCHOR_KEY(pair.code));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.price === "number" && parsed.price > 0) {
        anchor = parsed;
      }
    }
  } catch (err: any) {
    // Redis blip — fall through to upstream fetch. Bot terminal
    // must NEVER 500 because of an Upstash wobble.
    logger.debug({ err: err?.message ?? err, code }, "[quote-feed] anchor read failed");
  }

  // 2. Refresh upstream if cache miss/expired
  if (!anchor) {
    anchor = await fetchAnchor(pair);
    if (!anchor) {
      // Total upstream failure — last-resort fallback so the
      // terminal stays alive. Operator sees source='synthetic'
      // in the response and knows to investigate.
      anchor = { price: pair.base, source: "synthetic" };
    }
    try {
      await redis.set(ANCHOR_KEY(pair.code), JSON.stringify(anchor), "EX", ANCHOR_TTL_SEC);
    } catch {
      /* best-effort cache write */
    }
  }

  // 3. Previous-day reference for change24h. Lazy-seeded on first
  //    call so we don't need a cron — first poll of the day stamps
  //    the anchor price as "yesterday's close" and 6h later it
  //    rolls forward. Imperfect vs a real prev-day close but
  //    realistic enough for terminal UX.
  let prevDay = anchor.price;
  try {
    const cachedPrev = await redis.get(PREV_DAY_KEY(pair.code));
    if (cachedPrev) {
      const v = parseFloat(cachedPrev);
      if (Number.isFinite(v) && v > 0) prevDay = v;
    } else {
      await redis.set(PREV_DAY_KEY(pair.code), String(anchor.price), "EX", PREV_DAY_TTL_SEC);
    }
  } catch {
    /* prev-day is non-critical */
  }

  // 4. Apply tick jitter + spread
  const mid = +(anchor.price + tickJitterPips() * pair.pipSize).toFixed(pair.precision);
  const halfSpread = (pair.spreadPips * pair.pipSize) / 2;
  const bid = +(mid - halfSpread).toFixed(pair.precision);
  const ask = +(mid + halfSpread).toFixed(pair.precision);

  const changeAbs24h = +(mid - prevDay).toFixed(pair.precision);
  const change24h = prevDay > 0 ? +((changeAbs24h / prevDay) * 100).toFixed(3) : 0;

  return {
    code: pair.code,
    display: pair.display,
    mid,
    bid,
    ask,
    change24h,
    changeAbs24h,
    spreadPips: pair.spreadPips,
    precision: pair.precision,
    pipSize: pair.pipSize,
    source: anchor.source,
    asOf: new Date().toISOString(),
    marketOpen: isPairOpen(pair.code),
  };
}

export async function getAllQuotes(): Promise<Quote[]> {
  // Parallel — each pair's upstream is independent. Worst case
  // one pair times out at 4s while others return instantly; we
  // accept the slowest pair's latency as the bound.
  const quotes = await Promise.all(BOT_PAIRS.map((p) => getQuote(p.code)));
  return quotes.filter((q): q is Quote => q !== null);
}
