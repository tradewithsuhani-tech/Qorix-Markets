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
 *    upstream quote (Yahoo Finance for metals/forex/oil, Coinbase
 *    spot for BTC) cached 30s in Redis, then apply a small smooth-ish
 *    jitter on each request so consecutive ticks differ by ~1 pip
 *    without looking like white noise.
 *  - Zero new secrets — Yahoo Finance is a public free API.
 *  - Zero schema change — anchors and prev-day reference values
 *    live in Redis, no DB tables touched.
 *  - Graceful degradation — if every upstream fails, we fall back
 *    to a `base` price + synthetic walk so the terminal never goes
 *    blank (better operator UX than a 500).
 *
 * NOTE: this module deliberately does NOT touch auto-signal-engine.
 * The engine has its own `getEntryAnchor` that uses 5-minute Kraken
 * OHLC candles. The terminal needs LIVE feel which means spot.
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
  yahooSymbol: string; // Yahoo Finance symbol for spot + prevClose
};

/**
 * Bot terminal pairs. Order = display order (left → right) on the
 * ticker tape. Spreads are tuned to typical retail-broker values so
 * the bid/ask split looks realistic.
 */
export const BOT_PAIRS: PairCfg[] = [
  { code: "XAUUSD", display: "XAU/USD", pipSize: 0.01,   precision: 2, spreadPips: 25, base: 4600,  yahooSymbol: "GC=F"      },
  { code: "EURUSD", display: "EUR/USD", pipSize: 0.0001, precision: 5, spreadPips: 8,  base: 1.165, yahooSymbol: "EURUSD=X"  },
  { code: "BTCUSD", display: "BTC/USD", pipSize: 1,      precision: 2, spreadPips: 5,  base: 80000, yahooSymbol: "BTC-USD"   },
  { code: "USOIL",  display: "USOIL",   pipSize: 0.01,   precision: 2, spreadPips: 12, base: 103.0, yahooSymbol: "CL=F"      },
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
  source: string;          // upstream that won the race
  asOf: string;            // ISO of this quote's tick
  marketOpen: boolean;     // pair-specific (BTC always true)
};

/* ─────────────────────────────────────────────────────────────────
 * Upstream fetchers
 * ───────────────────────────────────────────────────────────────── */

/**
 * Yahoo Finance chart API — returns { price, prevClose } for spot
 * price and previous-session close. Free, no API key needed.
 * Works reliably from server IPs unlike stooq.com.
 */
async function fetchYahooFinance(
  symbol: string,
): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
          };
        }>;
        error?: unknown;
      };
    };
    if (j.chart?.error) return null;
    const meta = j.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose;
    if (!price || !Number.isFinite(price) || price <= 0) return null;
    const prev =
      prevClose && Number.isFinite(prevClose) && prevClose > 0
        ? prevClose
        : price; // fallback: use current price (change = 0) rather than crash
    return { price, prevClose: prev };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err, symbol }, "[quote-feed] yahoo failed");
    return null;
  }
}

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

async function fetchCoinbase24hOpen(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.exchange.coinbase.com/products/BTC-USD/stats",
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { open?: string };
    const p = parseFloat(j.open ?? "");
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err }, "[quote-feed] coinbase-stats failed");
    return null;
  }
}

/** Fetch anchor + prevClose for a pair. */
async function fetchAnchorWithPrev(
  pair: PairCfg,
): Promise<{ price: number; prevClose: number; source: string } | null> {
  // Primary: Yahoo Finance (works from server, returns prevClose too)
  const yahoo = await fetchYahooFinance(pair.yahooSymbol);
  if (yahoo) {
    return { price: yahoo.price, prevClose: yahoo.prevClose, source: "yahoo" };
  }

  // BTC fallback: Coinbase spot + 24h open
  if (pair.code === "BTCUSD") {
    const price = await fetchCoinbaseSpot("BTC-USD");
    if (price) {
      const open = (await fetchCoinbase24hOpen()) ?? price;
      return { price, prevClose: open, source: "coinbase" };
    }
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────
 * Market-hours gate
 * ───────────────────────────────────────────────────────────────── */
export function isForexMarketOpen(at: Date = new Date()): boolean {
  const day = at.getUTCDay();
  const hour = at.getUTCHours();
  if (day === 6) return false;
  if (day === 5 && hour >= 22) return false;
  if (day === 0 && hour < 22) return false;
  if (day >= 1 && day <= 4 && hour === 21) return false;
  return true;
}

function isPairOpen(code: string, at: Date = new Date()): boolean {
  if (code === "BTCUSD") return true;
  return isForexMarketOpen(at);
}

/* ─────────────────────────────────────────────────────────────────
 * Live tick jitter — makes the terminal visibly tick between
 * upstream refreshes (every 30s) so it doesn't look frozen.
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
const PREV_DAY_TTL_SEC = 6 * 3600; // 6h — refreshed after expiry

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
    logger.debug({ err: err?.message ?? err, code }, "[quote-feed] anchor read failed");
  }

  // 2. Refresh upstream if cache miss/expired
  let freshPrevClose: number | null = null;
  if (!anchor) {
    const upstream = await fetchAnchorWithPrev(pair);
    if (upstream) {
      anchor = { price: upstream.price, source: upstream.source };
      freshPrevClose = upstream.prevClose;
    } else {
      // Total upstream failure — synthetic fallback
      anchor = { price: pair.base, source: "synthetic" };
      freshPrevClose = pair.base;
    }
    try {
      await redis.set(ANCHOR_KEY(pair.code), JSON.stringify(anchor), "EX", ANCHOR_TTL_SEC);
    } catch {
      /* best-effort */
    }
  }

  // 3. Previous-day reference for change24h.
  // When the key doesn't exist, seed it from the real upstream prevClose
  // (not the current price) so change24h reflects a meaningful delta.
  let prevDay = anchor.price;
  try {
    const cachedPrev = await redis.get(PREV_DAY_KEY(pair.code));
    if (cachedPrev) {
      const v = parseFloat(cachedPrev);
      if (Number.isFinite(v) && v > 0) prevDay = v;
    } else {
      // Seed with real previous-close if we just fetched it, else use current anchor.
      // Using current anchor here means change = 0 initially, but only until
      // the next cache expiry (6h) when a real prevClose is fetched.
      const seedValue = freshPrevClose ?? anchor.price;
      prevDay = seedValue;
      await redis.set(PREV_DAY_KEY(pair.code), String(seedValue), "EX", PREV_DAY_TTL_SEC);
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
  const quotes = await Promise.all(BOT_PAIRS.map((p) => getQuote(p.code)));
  return quotes.filter((q): q is Quote => q !== null);
}
