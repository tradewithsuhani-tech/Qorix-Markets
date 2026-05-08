import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Activity,
  Minus,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Wallet as WalletIcon,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { Layout } from "@/components/layout";

// ─────────────────────────────────────────────────────────────────────
// Pair catalog — purely visual demo prices
// ─────────────────────────────────────────────────────────────────────
type Pair = {
  symbol: string;
  base: number;
  digits: number;
  pip: number;
  spread: number;
  vol: number;
  contract: number;
  binance?: string; // when present, live price comes from Binance WS/REST
};
const PAIRS: Pair[] = [
  { symbol: "XAU/USD",  base: 4683.74, digits: 2, pip: 0.01, spread: 0.25, vol: 0.0008, contract: 100 },
  { symbol: "EUR/USD",  base: 1.0892,  digits: 5, pip: 0.0001, spread: 0.00012, vol: 0.00025, contract: 100000, binance: "EURUSDT" },
  { symbol: "GBP/USD",  base: 1.2734,  digits: 5, pip: 0.0001, spread: 0.00018, vol: 0.0003, contract: 100000 },
  { symbol: "USD/JPY",  base: 156.42,  digits: 3, pip: 0.01, spread: 0.018, vol: 0.04, contract: 100000 },
  { symbol: "BTC/USD",  base: 71240.5, digits: 1, pip: 0.1,  spread: 8.5, vol: 0.0012, contract: 1,        binance: "BTCUSDT" },
  { symbol: "ETH/USD",  base: 3458.2,  digits: 2, pip: 0.01, spread: 0.6, vol: 0.0014, contract: 1,        binance: "ETHUSDT" },
];

// Seeded PRNG for stable candle history
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  bv: number; // buy volume (4 bot buyers)
  sv: number; // sell volume (4 bot sellers)
};

// Bot-scalp-style: 3-second candles, 90 in rolling window (~4.5 min)
const CANDLE_MS = 3000;
const MAX_CANDLES = 90;
const BOT_BUYERS = 100;
const BOT_SELLERS = 100;

// Simulate per-tick liquidity from BOT_BUYERS buy bots + BOT_SELLERS sell bots.
// Real-feel rules:
//   • Bias scales with % price move (not absolute) so XAU/JPY/BTC behave the same
//   • Strong directional dominance on real moves (60-90% one side)
//   • Occasional whale bursts (3-8x normal) for spiky TradingView-style bars
//   • Variable activity per tick (sparse → dense) so adjacent candles differ
function botTickVolumes(priceDelta: number, price: number, baseUnit: number): { bv: number; sv: number } {
  const deltaPct = price > 0 ? priceDelta / price : 0;
  const bias = Math.tanh(deltaPct * 800); // -1..1, strong on real % moves
  // Whale burst: ~6% of ticks get 3-8x normal volume
  const burst = Math.random() < 0.06 ? 3 + Math.random() * 5 : 1;
  // Activity floor + random spread so candles vary visibly
  const activity = (0.15 + Math.random() * 0.85) * burst;
  // Buy share: 0.5 baseline ± 0.4 from bias + ±0.12 random noise
  const noise = (Math.random() - 0.5) * 0.24;
  const rawShare = 0.5 + bias * 0.4 + noise;
  const buyShare = Math.max(0.08, Math.min(0.92, rawShare));
  const totalBots = BOT_BUYERS + BOT_SELLERS;
  const totalVol = totalBots * baseUnit * activity;
  const bv = Math.round(totalVol * buyShare);
  const sv = Math.round(totalVol * (1 - buyShare));
  return { bv, sv };
}

function buildHistory(pair: Pair, count: number = MAX_CANDLES): Candle[] {
  const r = rng(Math.floor(pair.base * 1000));
  const out: Candle[] = [];
  let price = pair.base;
  const now = Date.now();
  const baseBucket = Math.floor(now / CANDLE_MS) * CANDLE_MS;
  for (let i = count - 1; i >= 0; i--) {
    const t = baseBucket - i * CANDLE_MS;
    const drift = (r() - 0.5) * pair.base * pair.vol * 0.5;
    const o = price;
    const c = +(o + drift).toFixed(pair.digits);
    const h = +Math.max(o, c, o + Math.abs(drift) * (0.4 + r() * 0.8)).toFixed(pair.digits);
    const l = +Math.min(o, c, o - Math.abs(drift) * (0.4 + r() * 0.8)).toFixed(pair.digits);
    const baseUnit = 8 + r() * 12;
    const bv = Math.round((BOT_BUYERS * baseUnit) * (0.6 + r() * 0.8));
    const sv = Math.round((BOT_SELLERS * baseUnit) * (0.6 + r() * 0.8));
    out.push({ t, o, h, l, c, v: bv + sv, bv, sv });
    price = c;
  }
  return out;
}

// Re-seed history anchored to a real live price (used when the first
// live tick arrives, so the chart doesn't show a vertical jump from
// stale synthetic seed → real price).
function seedFromLivePrice(pair: Pair, livePrice: number, count: number = MAX_CANDLES): Candle[] {
  const out: Candle[] = [];
  const baseBucket = Math.floor(Date.now() / CANDLE_MS) * CANDLE_MS;
  // Random walk BACKWARDS from livePrice with ~0.05% steps, then reverse
  const prices: number[] = [livePrice];
  let p = livePrice;
  for (let i = 0; i < count; i++) {
    const step = (Math.random() - 0.5) * pair.base * pair.vol * 0.6;
    p = p - step;
    prices.push(p);
  }
  prices.reverse(); // now oldest -> newest, ends at livePrice
  for (let i = 0; i < count; i++) {
    const t = baseBucket - (count - 1 - i) * CANDLE_MS;
    const o = +prices[i].toFixed(pair.digits);
    const c = +prices[i + 1].toFixed(pair.digits);
    const span = Math.abs(c - o);
    const h = +(Math.max(o, c) + span * (0.2 + Math.random() * 0.6)).toFixed(pair.digits);
    const l = +(Math.min(o, c) - span * (0.2 + Math.random() * 0.6)).toFixed(pair.digits);
    const baseUnit = 8 + Math.random() * 12;
    const bv = Math.round((BOT_BUYERS * baseUnit) * (0.6 + Math.random() * 0.8));
    const sv = Math.round((BOT_SELLERS * baseUnit) * (0.6 + Math.random() * 0.8));
    out.push({ t, o, h, l, c, v: bv + sv, bv, sv });
  }
  return out;
}

// Aggregate a single live price tick into the rolling candle buffer.
// `silent=true` updates price ONLY (no bot volume) — used by the heartbeat
// jitter so we don't pile fake equal volume on every candle.
function aggregateTick(
  history: Candle[],
  price: number,
  digits: number,
  baseUnit: number,
  silent: boolean = false,
): Candle[] {
  if (!isFinite(price) || price <= 0) return history;
  const bucket = Math.floor(Date.now() / CANDLE_MS) * CANDLE_MS;
  if (history.length === 0) {
    const { bv, sv } = silent ? { bv: 0, sv: 0 } : botTickVolumes(0, price, baseUnit);
    return [{ t: bucket, o: price, h: price, l: price, c: price, v: bv + sv, bv, sv }];
  }
  const last = history[history.length - 1];
  const delta = price - last.c;
  const { bv: tickBv, sv: tickSv } = silent
    ? { bv: 0, sv: 0 }
    : botTickVolumes(delta, price, baseUnit);

  if (last.t === bucket) {
    const updated: Candle = {
      ...last,
      h: +Math.max(last.h, price).toFixed(digits),
      l: +Math.min(last.l, price).toFixed(digits),
      c: +price.toFixed(digits),
      bv: last.bv + tickBv,
      sv: last.sv + tickSv,
      v: last.v + tickBv + tickSv,
    };
    return [...history.slice(0, -1), updated];
  }
  // Fill any skipped buckets with flat low-volume candles so x-axis stays uniform
  const open = last.c;
  const skipped: Candle[] = [];
  let b = last.t + CANDLE_MS;
  while (b < bucket) {
    skipped.push({ t: b, o: open, h: open, l: open, c: open, v: 0, bv: 0, sv: 0 });
    b += CANDLE_MS;
  }
  const fresh: Candle = {
    t: bucket,
    o: open,
    h: +Math.max(open, price).toFixed(digits),
    l: +Math.min(open, price).toFixed(digits),
    c: +price.toFixed(digits),
    bv: tickBv,
    sv: tickSv,
    v: tickBv + tickSv,
  };
  return [...history, ...skipped, fresh].slice(-MAX_CANDLES);
}

type Position = {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  lots: number;
  entry: number;
  sl: number | null;
  tp: number | null;
  openedAt: number;
  contract: number;
};
type ClosedPosition = Position & {
  closedAt: number;
  exit: number;
  pnl: number;
  reason: "manual" | "sl" | "tp";
};

function fmtPrice(v: number, digits: number) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function fmtMoney(v: number) {
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function pnl(p: Position, mid: number) {
  const dir = p.side === "BUY" ? 1 : -1;
  return +(((mid - p.entry) * dir) * p.lots * p.contract).toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
export default function SelfTradePage() {
  const [symbol, setSymbol] = useState<string>("XAU/USD");
  const pair = useMemo(() => PAIRS.find((p) => p.symbol === symbol)!, [symbol]);

  const [history, setHistory] = useState<Candle[]>(() => buildHistory(pair));
  const [tick, setTick] = useState(0);
  const [isLive, setIsLive] = useState(false);
  // Tracks whether we've already replaced synthetic seed with a live-anchored seed.
  // Reset to false on every pair change so each pair re-anchors on its first tick.
  const liveSeededRef = useRef(false);

  // Per-tick per-bot liquidity unit. With 200 bots ticking, keep each bot's
  // contribution tiny so totals stay visually readable in the volume strip.
  const baseUnit = useMemo(() => {
    const c = pair.contract || 100;
    return Math.max(1, Math.round(c / 80));
  }, [pair]);

  // when pair changes, rebuild history (synthetic seed; replaced by live below if available)
  useEffect(() => {
    setHistory(buildHistory(pair));
    setIsLive(false);
    liveSeededRef.current = false;
  }, [pair]);

  // Helper: ingest a real live price. On the first one, drop the synthetic
  // seed and re-anchor history to the live price (no vertical jump).
  const ingestLive = (px: number) => {
    setIsLive(true);
    if (!liveSeededRef.current) {
      liveSeededRef.current = true;
      setHistory(seedFromLivePrice(pair, px));
      return;
    }
    setHistory((h) => aggregateTick(h, px, pair.digits, baseUnit));
  };

  // ── LIVE feed via Binance @trade stream (when pair has .binance) ──
  // Bot-scalp style: real-time per-trade ticks → 5s candle aggregator
  useEffect(() => {
    if (!pair.binance) return;
    let cancelled = false;
    const sym = pair.binance;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym.toLowerCase()}@trade`);
      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data);
          const px = +msg?.p;
          if (!isFinite(px) || px <= 0) return;
          ingestLive(px);
        } catch {}
      };
      ws.onerror = () => setIsLive(false);
      ws.onclose = () => setIsLive(false);
    } catch {}

    return () => {
      cancelled = true;
      try { ws?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  // ── LIVE feed via gold-api for XAU/USD (free, no key, CORS-enabled) ──
  useEffect(() => {
    if (pair.symbol !== "XAU/USD") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("https://api.gold-api.com/price/XAU");
        if (!r.ok) return;
        const j = await r.json();
        const px = +(+j.price).toFixed(pair.digits);
        if (!isFinite(px) || px <= 0 || cancelled) return;
        ingestLive(px);
      } catch {}
    };
    poll();
    const id = window.setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.symbol, pair.digits]);

  // ── Synthetic price tick for unmapped pairs (GBP/USD, USD/JPY) ──
  // 200ms ticks fed into the 1s aggregator → bot-scalp feel
  useEffect(() => {
    if (pair.binance) return;
    if (pair.symbol === "XAU/USD") return;
    const id = window.setInterval(() => {
      setHistory((h) => {
        const last = h[h.length - 1];
        const ref = last ? last.c : pair.base;
        const drift = (Math.random() - 0.5) * pair.base * pair.vol * 0.22;
        const px = +(ref + drift).toFixed(pair.digits);
        setTick((t) => t + 1);
        return aggregateTick(h, px, pair.digits, baseUnit);
      });
    }, 200);
    return () => clearInterval(id);
  }, [pair.binance, pair.symbol, pair.base, pair.vol, pair.digits, baseUnit]);

  // ── Heartbeat for LIVE pairs (XAU + Binance) ──
  // Even when real ticks pause briefly (between gold-api polls, low-trade
  // moments, network hiccups), inject ±0.005% jitter every 200ms around
  // the last close so the candle stays visibly alive instead of freezing.
  // Real ticks always overwrite jitter on the next message.
  useEffect(() => {
    if (!pair.binance && pair.symbol !== "XAU/USD") return;
    const id = window.setInterval(() => {
      if (!liveSeededRef.current) return; // wait for first real tick to anchor
      setHistory((h) => {
        if (h.length === 0) return h;
        const last = h[h.length - 1];
        const jitter = (Math.random() - 0.5) * last.c * 0.0001; // ±0.005%
        const px = +(last.c + jitter).toFixed(pair.digits);
        // silent=true: price-only update, no fake bot volume during heartbeat
        return aggregateTick(h, px, pair.digits, baseUnit, true);
      });
    }, 200);
    return () => clearInterval(id);
  }, [pair.binance, pair.symbol, pair.digits, baseUnit]);

  const mid = history.length ? history[history.length - 1].c : pair.base;
  const bid = +(mid - pair.spread / 2).toFixed(pair.digits);
  const ask = +(mid + pair.spread / 2).toFixed(pair.digits);
  const sessionOpen = history[0]?.o ?? pair.base;
  const dayPct = sessionOpen > 0 ? ((mid - sessionOpen) / sessionOpen) * 100 : 0;

  // ── Order ticket state ──
  const [lots, setLots] = useState(0);
  // SL/TP are now PRICE strings (Exness-style). Empty = no SL/TP.
  const [slPx, setSlPx] = useState<string>("");
  const [tpPx, setTpPx] = useState<string>("");

  // derived absolute distance in pts from mid (for risk calc + preview)
  const slPts = useMemo(() => {
    const v = parseFloat(slPx);
    return isFinite(v) && v > 0 ? Math.round(Math.abs(v - mid) / pair.pip) : 0;
  }, [slPx, mid, pair]);
  const tpPts = useMemo(() => {
    const v = parseFloat(tpPx);
    return isFinite(v) && v > 0 ? Math.round(Math.abs(v - mid) / pair.pip) : 0;
  }, [tpPx, mid, pair]);

  // when pair changes, clear SL/TP (avoid stale price from previous pair)
  useEffect(() => {
    setSlPx("");
    setTpPx("");
  }, [pair.symbol]);

  // ── Account ──
  const [balance] = useState(10000);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closed, setClosed] = useState<ClosedPosition[]>([]);

  const openPnL = positions.reduce((s, p) => s + pnl(p, mid), 0);
  const equity = +(balance + openPnL + closed.reduce((s, c) => s + c.pnl, 0)).toFixed(2);
  const usedMargin = positions.reduce((s, p) => s + (p.entry * p.lots * p.contract) / 200, 0);
  const freeMargin = +(equity - usedMargin).toFixed(2);
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  const placeOrder = (side: "BUY" | "SELL") => {
    if (!(lots > 0)) return;
    const entry = side === "BUY" ? ask : bid;
    // SL/TP are typed as PRICE. Use as-is when on the correct side of entry,
    // else mirror the distance so it lands on the valid side.
    const slRaw = parseFloat(slPx);
    const tpRaw = parseFloat(tpPx);
    const sl = isFinite(slRaw) && slRaw > 0
      ? side === "BUY"
        ? +(slRaw < entry ? slRaw : entry - Math.abs(slRaw - entry)).toFixed(pair.digits)
        : +(slRaw > entry ? slRaw : entry + Math.abs(slRaw - entry)).toFixed(pair.digits)
      : null;
    const tp = isFinite(tpRaw) && tpRaw > 0
      ? side === "BUY"
        ? +(tpRaw > entry ? tpRaw : entry + Math.abs(tpRaw - entry)).toFixed(pair.digits)
        : +(tpRaw < entry ? tpRaw : entry - Math.abs(tpRaw - entry)).toFixed(pair.digits)
      : null;
    setPositions((ps) => [
      ...ps,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pair: pair.symbol,
        side,
        lots,
        entry,
        sl,
        tp,
        openedAt: Date.now(),
        contract: pair.contract,
      },
    ]);
  };

  const closePosition = (id: string, reason: ClosedPosition["reason"] = "manual") => {
    setPositions((ps) => {
      const target = ps.find((p) => p.id === id);
      if (!target) return ps;
      const exit = target.side === "BUY" ? bid : ask;
      const realized = pnl(target, exit);
      setClosed((cs) =>
        [{ ...target, closedAt: Date.now(), exit, pnl: realized, reason }, ...cs].slice(0, 50),
      );
      return ps.filter((p) => p.id !== id);
    });
  };

  const modifyPosition = (id: string, sl: number | null, tp: number | null) => {
    setPositions((ps) => ps.map((p) => (p.id === id ? { ...p, sl, tp } : p)));
  };

  const closeAll = () => {
    positions.forEach((p) => closePosition(p.id, "manual"));
  };

  // ── Modify dialog state ──
  const [modifyId, setModifyId] = useState<string | null>(null);

  // SL/TP auto-trigger
  useEffect(() => {
    positions.forEach((p) => {
      const px = p.side === "BUY" ? bid : ask;
      if (p.sl !== null) {
        if ((p.side === "BUY" && px <= p.sl) || (p.side === "SELL" && px >= p.sl)) {
          closePosition(p.id, "sl");
          return;
        }
      }
      if (p.tp !== null) {
        if ((p.side === "BUY" && px >= p.tp) || (p.side === "SELL" && px <= p.tp)) {
          closePosition(p.id, "tp");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, ask]);

  // ── Chart data ──
  const chartData = useMemo(
    () =>
      history.map((c, i) => ({
        i,
        t: new Date(c.t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v,
        bv: c.bv,
        sv: c.sv,
        // stems for candle visual
        wickLow: c.l,
        wickHigh: c.h,
        bodyLow: Math.min(c.o, c.c),
        bodyHigh: Math.max(c.o, c.c),
        up: c.c >= c.o,
      })),
    [history],
  );

  // Tight Y domain so candles render at proper scale (auto domain breaks because
  // stacked Bar baselines push range to 0).
  const yDomain = useMemo<[number, number]>(() => {
    if (history.length === 0) return [pair.base * 0.999, pair.base * 1.001];
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of history) {
      if (c.l < lo) lo = c.l;
      if (c.h > hi) hi = c.h;
    }
    // include open positions (entry/SL/TP) + ticket-preview SL/TP + mid
    for (const p of positions.filter((p) => p.pair === symbol)) {
      lo = Math.min(lo, p.entry);
      hi = Math.max(hi, p.entry);
      if (p.sl !== null) {
        lo = Math.min(lo, p.sl);
        hi = Math.max(hi, p.sl);
      }
      if (p.tp !== null) {
        lo = Math.min(lo, p.tp);
        hi = Math.max(hi, p.tp);
      }
    }
    if (slPts > 0) {
      lo = Math.min(lo, ask - slPts * pair.pip);
      hi = Math.max(hi, bid + slPts * pair.pip);
    }
    if (tpPts > 0) {
      lo = Math.min(lo, bid - tpPts * pair.pip);
      hi = Math.max(hi, ask + tpPts * pair.pip);
    }
    lo = Math.min(lo, mid);
    hi = Math.max(hi, mid);
    const span = Math.max(hi - lo, pair.pip * 20);
    const pad = span * 0.18;
    return [+(lo - pad).toFixed(pair.digits), +(hi + pad).toFixed(pair.digits)];
  }, [history, positions, symbol, mid, pair, slPts, tpPts, ask, bid]);

  return (
    <Layout>
      <div className="min-h-screen bg-[#05070d] text-white">
        {/* ── Header bar ───────────────────────────────────────────── */}
        <div className="border-b border-white/8 bg-[#080c16] sticky top-0 z-20 backdrop-blur">
          <div className="px-3 sm:px-5 py-2.5 flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <PairPicker symbol={symbol} onChange={setSymbol} />

            <div className="flex items-center gap-3 ml-1 shrink-0">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-rose-400/80">Bid</div>
                <div className="text-base font-bold tabular-nums text-rose-300">
                  {fmtPrice(bid, pair.digits)}
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-emerald-400/80">Ask</div>
                <div className="text-base font-bold tabular-nums text-emerald-300">
                  {fmtPrice(ask, pair.digits)}
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">Spread</div>
                <div className="text-sm font-mono tabular-nums text-white/80">
                  {fmtPrice(pair.spread, pair.digits)}
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">Day</div>
                <div
                  className={`text-sm font-bold tabular-nums ${
                    dayPct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {dayPct >= 0 ? "+" : ""}
                  {dayPct.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3 shrink-0 pl-3 border-l border-white/10">
              <div className="text-right">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">
                  Equity
                </div>
                <div className="text-sm font-bold tabular-nums">{fmtMoney(equity)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">
                  Free Margin
                </div>
                <div className="text-sm font-bold tabular-nums text-white/80">
                  {fmtMoney(freeMargin)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Beta / demo-only notice ──────────────────────────────── */}
        <div className="px-3 sm:px-5 pt-3">
          <div className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-3 py-2 flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/50 text-[9px] font-mono uppercase tracking-[0.16em] text-amber-200 shrink-0">
              beta
            </span>
            <p className="text-[11px] sm:text-xs text-amber-100/85 leading-snug">
              This is a <span className="font-semibold">beta version</span> — only <span className="font-semibold">demo trading</span> for testing purposes. No real funds are used and no orders reach a live market.
            </p>
          </div>
        </div>

        {/* ── Body grid ────────────────────────────────────────────── */}
        <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/8 bg-gradient-to-b from-[#0a0f1a] to-[#06090f] overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/5">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <Activity style={{ width: 13, height: 13 }} className="text-emerald-400 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/55 whitespace-nowrap">
                  {symbol} · 3s
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[9px] font-mono uppercase tracking-[0.14em] text-emerald-300 inline-flex items-center gap-1 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  live
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono uppercase tracking-[0.14em] text-white/55 whitespace-nowrap">
                  100 buy · 100 sell bots
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] font-mono uppercase tracking-[0.14em] text-amber-300 whitespace-nowrap">
                  beta · demo only
                </span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] font-mono uppercase tracking-[0.14em] text-amber-300">
                  beta · demo only
                </span>
              </div>
              <div className="text-[10px] font-mono text-white/40 whitespace-nowrap shrink-0">
                {fmtPrice(mid, pair.digits)}
              </div>
            </div>
            <div className="h-[360px] sm:h-[440px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 6 }}>
                  <defs>
                    <linearGradient id="stPriceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(245,158,11,0.22)" />
                      <stop offset="100%" stopColor="rgba(245,158,11,0)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "#475569", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 8))}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    domain={yDomain}
                    allowDataOverflow
                    tickFormatter={(v) => fmtPrice(Number(v), pair.digits)}
                    width={60}
                    orientation="right"
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(148,163,184,0.25)", strokeDasharray: "2 3" }}
                    contentStyle={{
                      background: "rgba(8,12,22,0.96)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(v: any, k: any) => {
                      const key = typeof k === "string" ? k : "";
                      if (
                        !key ||
                        key === "wickHigh" ||
                        key === "wickLow" ||
                        key === "bodyLow" ||
                        key === "bodyHigh" ||
                        key === "up"
                      )
                        return null as any;
                      return [fmtPrice(Number(v), pair.digits), key.toUpperCase()];
                    }}
                  />
                  {/* Soft area under close for depth */}
                  <Area
                    type="monotone"
                    dataKey="c"
                    stroke="transparent"
                    fill="url(#stPriceFill)"
                    isAnimationActive={false}
                  />
                  {/* Wicks (thin line) */}
                  <Bar
                    dataKey="wickLow"
                    fill="transparent"
                    stackId="wick"
                    isAnimationActive={false}
                    legendType="none"
                  />
                  <Bar
                    dataKey={(d: any) => d.wickHigh - d.wickLow}
                    stackId="wick"
                    barSize={1.4}
                    isAnimationActive={false}
                    legendType="none"
                    shape={(props: any) => {
                      const fill = props?.payload?.up
                        ? "rgba(16,185,129,0.85)"
                        : "rgba(244,63,94,0.85)";
                      return (
                        <rect
                          x={props.x + props.width / 2 - 0.7}
                          y={props.y}
                          width={1.4}
                          height={Math.max(props.height, 1)}
                          fill={fill}
                        />
                      );
                    }}
                  />
                  {/* Bodies (thick) */}
                  <Bar
                    dataKey="bodyLow"
                    fill="transparent"
                    stackId="body"
                    isAnimationActive={false}
                    legendType="none"
                  />
                  <Bar
                    dataKey={(d: any) => Math.max(d.bodyHigh - d.bodyLow, pair.pip * 0.6)}
                    stackId="body"
                    barSize={7}
                    isAnimationActive={false}
                    legendType="none"
                    shape={(props: any) => {
                      const up = !!props?.payload?.up;
                      const fill = up ? "rgba(16,185,129,0.95)" : "rgba(244,63,94,0.95)";
                      const stroke = up ? "rgba(52,211,153,1)" : "rgba(251,113,133,1)";
                      return (
                        <rect
                          x={props.x}
                          y={props.y}
                          width={props.width}
                          height={Math.max(props.height, 1)}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={0.6}
                          rx={1}
                        />
                      );
                    }}
                  />
                  {/* Smooth close overlay */}
                  <Line
                    type="monotone"
                    dataKey="c"
                    stroke="rgba(245,158,11,0.9)"
                    strokeWidth={1.3}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Open position entry + SL + TP lines */}
                  {positions
                    .filter((p) => p.pair === symbol)
                    .flatMap((p) => {
                      const items: any[] = [
                        <ReferenceLine
                          key={`${p.id}-e`}
                          y={p.entry}
                          stroke={p.side === "BUY" ? "#10b981" : "#f43f5e"}
                          strokeDasharray="4 3"
                          strokeWidth={1}
                          label={{
                            value: `${p.side} ${p.lots} @ ${fmtPrice(p.entry, pair.digits)}`,
                            position: "left",
                            fill: p.side === "BUY" ? "#34d399" : "#fb7185",
                            fontSize: 9,
                            fontFamily: "monospace",
                          }}
                        />,
                      ];
                      if (p.sl !== null) {
                        items.push(
                          <ReferenceLine
                            key={`${p.id}-sl`}
                            y={p.sl}
                            stroke="rgba(244,63,94,0.85)"
                            strokeDasharray="2 4"
                            strokeWidth={1}
                            label={{
                              value: `SL ${fmtPrice(p.sl, pair.digits)}`,
                              position: "left",
                              fill: "#fb7185",
                              fontSize: 9,
                              fontFamily: "monospace",
                            }}
                          />,
                        );
                      }
                      if (p.tp !== null) {
                        items.push(
                          <ReferenceLine
                            key={`${p.id}-tp`}
                            y={p.tp}
                            stroke="rgba(16,185,129,0.85)"
                            strokeDasharray="2 4"
                            strokeWidth={1}
                            label={{
                              value: `TP ${fmtPrice(p.tp, pair.digits)}`,
                              position: "left",
                              fill: "#34d399",
                              fontSize: 9,
                              fontFamily: "monospace",
                            }}
                          />,
                        );
                      }
                      return items;
                    })}
                  {/* Ticket SL/TP preview (ghost lines from current Ask for BUY, Bid for SELL) */}
                  {slPts > 0 && (
                    <>
                      <ReferenceLine
                        y={+(ask - slPts * pair.pip).toFixed(pair.digits)}
                        stroke="rgba(244,63,94,0.45)"
                        strokeDasharray="1 5"
                        strokeWidth={1}
                        label={{
                          value: `BUY SL`,
                          position: "right",
                          fill: "rgba(251,113,133,0.7)",
                          fontSize: 8.5,
                          fontFamily: "monospace",
                        }}
                      />
                      <ReferenceLine
                        y={+(bid + slPts * pair.pip).toFixed(pair.digits)}
                        stroke="rgba(244,63,94,0.45)"
                        strokeDasharray="1 5"
                        strokeWidth={1}
                        label={{
                          value: `SELL SL`,
                          position: "right",
                          fill: "rgba(251,113,133,0.7)",
                          fontSize: 8.5,
                          fontFamily: "monospace",
                        }}
                      />
                    </>
                  )}
                  {tpPts > 0 && (
                    <>
                      <ReferenceLine
                        y={+(ask + tpPts * pair.pip).toFixed(pair.digits)}
                        stroke="rgba(16,185,129,0.45)"
                        strokeDasharray="1 5"
                        strokeWidth={1}
                        label={{
                          value: `BUY TP`,
                          position: "right",
                          fill: "rgba(52,211,153,0.7)",
                          fontSize: 8.5,
                          fontFamily: "monospace",
                        }}
                      />
                      <ReferenceLine
                        y={+(bid - tpPts * pair.pip).toFixed(pair.digits)}
                        stroke="rgba(16,185,129,0.45)"
                        strokeDasharray="1 5"
                        strokeWidth={1}
                        label={{
                          value: `SELL TP`,
                          position: "right",
                          fill: "rgba(52,211,153,0.7)",
                          fontSize: 8.5,
                          fontFamily: "monospace",
                        }}
                      />
                    </>
                  )}
                  {/* Mid price line with label */}
                  <ReferenceLine
                    y={mid}
                    stroke="rgba(59,130,246,0.7)"
                    strokeDasharray="2 3"
                    strokeWidth={1}
                    label={{
                      value: fmtPrice(mid, pair.digits),
                      position: "right",
                      fill: "#60a5fa",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Bot order-flow volume strip — 4 buy bots vs 4 sell bots per 5s candle */}
            <div className="px-2 pb-2">
              <div className="h-[64px] sm:h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="t" hide />
                    <YAxis
                      tick={{ fill: "#475569", fontSize: 8 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      orientation="right"
                      tickFormatter={(v) => String(Math.round(Number(v)))}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(148,163,184,0.2)", strokeDasharray: "2 3" }}
                      contentStyle={{
                        background: "rgba(8,12,22,0.96)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 10,
                      }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(v: any, k: any) => {
                        const key = typeof k === "string" ? k : "";
                        if (key === "bv") return [Math.round(Number(v)), "BUY VOL"];
                        if (key === "sv") return [Math.round(Number(v)), "SELL VOL"];
                        return null as any;
                      }}
                    />
                    <Bar dataKey="bv" stackId="vol" fill="rgba(16,185,129,0.75)" isAnimationActive={false} />
                    <Bar dataKey="sv" stackId="vol" fill="rgba(244,63,94,0.75)" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* Order ticket */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/8 bg-gradient-to-b from-[#0a0f1a] to-[#06090f] p-4 flex flex-col gap-3 h-fit"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/55">
                New Order
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-amber-400/70">
                market
              </span>
            </div>

            {/* Lot stepper */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45 mb-1.5">
                Lot Size
              </div>
              <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <button
                  onClick={() => setLots((l) => +Math.max(0, l - 0.01).toFixed(2))}
                  className="px-3 py-2 text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Minus style={{ width: 13, height: 13 }} />
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={lots === 0 ? "" : lots}
                  placeholder="0.00"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") { setLots(0); return; }
                    const v = parseFloat(raw);
                    setLots(isNaN(v) ? 0 : Math.max(0, +v.toFixed(2)));
                  }}
                  className="flex-1 bg-transparent outline-none text-center text-base font-bold tabular-nums py-2 placeholder-white/25"
                />
                <button
                  onClick={() => setLots((l) => +(l + 0.01).toFixed(2))}
                  className="px-3 py-2 text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Plus style={{ width: 13, height: 13 }} />
                </button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0.01, 0.05, 0.1, 0.5, 1].map((v) => (
                  <button
                    key={v}
                    onClick={() => setLots(v)}
                    className={`flex-1 py-1 rounded-md text-[10px] font-mono tabular-nums border ${
                      lots === v
                        ? "border-blue-400/50 bg-blue-500/10 text-blue-300"
                        : "border-white/8 text-white/55 hover:border-white/20"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* SL / TP — price inputs, autofill live mid on focus (Exness-style) */}
            <div className="grid grid-cols-2 gap-2">
              <SlTpInput
                label="SL (price)"
                value={slPx}
                onChange={setSlPx}
                tone="rose"
                live={mid}
                digits={pair.digits}
              />
              <SlTpInput
                label="TP (price)"
                value={tpPx}
                onChange={setTpPx}
                tone="emerald"
                live={mid}
                digits={pair.digits}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {[0, 50, 100, 200, 500].map((v) => (
                <button
                  key={`sl-${v}`}
                  onClick={() => setSlPx(v === 0 ? "" : (mid - v * pair.pip).toFixed(pair.digits))}
                  className={`flex-1 min-w-[40px] py-1 rounded-md text-[9.5px] font-mono tabular-nums border ${
                    slPts === v
                      ? "border-rose-400/50 bg-rose-500/10 text-rose-300"
                      : "border-white/8 text-white/45 hover:border-white/20"
                  }`}
                >
                  SL{v}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[0, 50, 100, 200, 500].map((v) => (
                <button
                  key={`tp-${v}`}
                  onClick={() => setTpPx(v === 0 ? "" : (mid + v * pair.pip).toFixed(pair.digits))}
                  className={`flex-1 min-w-[40px] py-1 rounded-md text-[9.5px] font-mono tabular-nums border ${
                    tpPts === v
                      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                      : "border-white/8 text-white/45 hover:border-white/20"
                  }`}
                >
                  TP{v}
                </button>
              ))}
            </div>

            {/* Risk / Reward preview */}
            {(slPts > 0 || tpPts > 0) && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    Risk
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-rose-300">
                    {slPts > 0 ? fmtMoney(slPts * pair.pip * lots * pair.contract) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    Reward
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-emerald-300">
                    {tpPts > 0 ? fmtMoney(tpPts * pair.pip * lots * pair.contract) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    R:R
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-amber-300">
                    {slPts > 0 && tpPts > 0 ? `1 : ${(tpPts / slPts).toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Risk / Reward preview */}
            {(slPts > 0 || tpPts > 0) && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    Risk
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-rose-300">
                    {slPts > 0 ? fmtMoney(slPts * pair.pip * lots * pair.contract) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    Reward
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-emerald-300">
                    {tpPts > 0 ? fmtMoney(tpPts * pair.pip * lots * pair.contract) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-white/40">
                    R:R
                  </div>
                  <div className="text-[11px] font-bold tabular-nums text-amber-300">
                    {slPts > 0 && tpPts > 0 ? `1 : ${(tpPts / slPts).toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Buy / Sell buttons */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => placeOrder("SELL")}
                className="relative py-3 rounded-xl border border-rose-400/40 overflow-hidden group"
                style={{
                  background: "linear-gradient(180deg, rgba(244,63,94,0.22), rgba(244,63,94,0.08))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 22px -8px rgba(244,63,94,0.55)",
                }}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-rose-300/85">
                  Sell
                </div>
                <div className="text-base font-bold tabular-nums text-rose-200 mt-0.5">
                  {fmtPrice(bid, pair.digits)}
                </div>
                <ArrowDown
                  style={{ width: 14, height: 14 }}
                  className="absolute top-2 right-2 text-rose-400/70"
                />
              </button>
              <button
                onClick={() => placeOrder("BUY")}
                className="relative py-3 rounded-xl border border-emerald-400/40 overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 22px -8px rgba(16,185,129,0.55)",
                }}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-300/85">
                  Buy
                </div>
                <div className="text-base font-bold tabular-nums text-emerald-200 mt-0.5">
                  {fmtPrice(ask, pair.digits)}
                </div>
                <ArrowUp
                  style={{ width: 14, height: 14 }}
                  className="absolute top-2 right-2 text-emerald-400/70"
                />
              </button>
            </div>

            {/* Account snapshot */}
            <div className="mt-2 pt-3 border-t border-white/8 grid grid-cols-2 gap-3 text-[11px]">
              <Snap label="Balance" value={fmtMoney(balance)} icon={WalletIcon} />
              <Snap
                label="Open P&L"
                value={fmtMoney(openPnL)}
                tone={openPnL >= 0 ? "emerald" : "rose"}
                icon={openPnL >= 0 ? TrendingUp : TrendingDown}
              />
              <Snap label="Used Margin" value={fmtMoney(usedMargin)} />
              <Snap
                label="Margin Lvl"
                value={`${marginLevel ? marginLevel.toFixed(0) : "—"}%`}
                tone={marginLevel > 0 && marginLevel < 200 ? "amber" : undefined}
                icon={ShieldAlert}
              />
            </div>
          </motion.div>
        </div>

        {/* ── Open Positions ───────────────────────────────────────── */}
        <div className="px-3 sm:px-5 pb-4">
          {positions.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40">
                {positions.length} open · net{" "}
                <span className={openPnL >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {fmtMoney(openPnL)}
                </span>
              </span>
              <button
                onClick={closeAll}
                className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] border border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
              >
                close all
              </button>
            </div>
          )}
          <PositionTable
            title="Open Positions"
            empty="No open positions. Place a Buy or Sell to start."
            rows={positions.map((p) => {
              const px = p.side === "BUY" ? bid : ask;
              const live = pnl(p, px);
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs text-white/80">{p.pair}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase tracking-[0.12em] border ${
                        p.side === "BUY"
                          ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                          : "text-rose-300 border-rose-400/40 bg-rose-500/10"
                      }`}
                    >
                      {p.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/70">{p.lots.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/70">
                    {fmtPrice(p.entry, PAIRS.find((x) => x.symbol === p.pair)?.digits ?? 2)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/70">
                    {fmtPrice(px, PAIRS.find((x) => x.symbol === p.pair)?.digits ?? 2)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/55">
                    {p.sl ? fmtPrice(p.sl, PAIRS.find((x) => x.symbol === p.pair)?.digits ?? 2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/55">
                    {p.tp ? fmtPrice(p.tp, PAIRS.find((x) => x.symbol === p.pair)?.digits ?? 2) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-xs font-bold tabular-nums ${
                      live >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {fmtMoney(live)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setModifyId(p.id)}
                        className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.12em] border border-amber-400/30 text-amber-300/85 hover:text-amber-200 hover:border-amber-400/55"
                      >
                        modify
                      </button>
                      <button
                        onClick={() => closePosition(p.id)}
                        className="px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.12em] border border-white/10 text-white/70 hover:text-white hover:border-white/30 inline-flex items-center gap-1"
                      >
                        <X style={{ width: 11, height: 11 }} /> close
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          />
        </div>

        {/* ── Closed History ───────────────────────────────────────── */}
        {closed.length > 0 && (
          <div className="px-3 sm:px-5 pb-8">
            <PositionTable
              title="Recent Closed"
              empty=""
              compact
              rows={closed.map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="px-3 py-2 font-mono text-xs text-white/80">{c.pair}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase tracking-[0.12em] border ${
                        c.side === "BUY"
                          ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                          : "text-rose-300 border-rose-400/40 bg-rose-500/10"
                      }`}
                    >
                      {c.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/70">{c.lots.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/55">
                    {fmtPrice(c.entry, PAIRS.find((x) => x.symbol === c.pair)?.digits ?? 2)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-white/70">
                    {fmtPrice(c.exit, PAIRS.find((x) => x.symbol === c.pair)?.digits ?? 2)}
                  </td>
                  <td
                    className={`px-3 py-2 text-xs font-bold tabular-nums ${
                      c.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {fmtMoney(c.pnl)}
                  </td>
                  <td className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40">
                    {c.reason}
                  </td>
                </tr>
              ))}
            />
          </div>
        )}
      </div>
      <AnimatePresence>
        {modifyId && (
          <ModifyDialog
            position={positions.find((p) => p.id === modifyId)!}
            pair={PAIRS.find((x) => x.symbol === positions.find((p) => p.id === modifyId)?.pair)!}
            onClose={() => setModifyId(null)}
            onSave={(sl, tp) => {
              modifyPosition(modifyId, sl, tp);
              setModifyId(null);
            }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────
function PairPicker({
  symbol,
  onChange,
}: {
  symbol: string;
  onChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      >
        <span className="text-sm font-bold tracking-tight">{symbol}</span>
        <ChevronDown style={{ width: 13, height: 13 }} className="text-white/55" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-40 top-full mt-1 left-0 min-w-[180px] rounded-xl border border-white/10 bg-[#0a0f1a] shadow-2xl overflow-hidden"
            >
              {PAIRS.map((p) => (
                <button
                  key={p.symbol}
                  onClick={() => {
                    onChange(p.symbol);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 ${
                    p.symbol === symbol ? "bg-blue-500/10" : ""
                  }`}
                >
                  <span className="text-sm font-bold">{p.symbol}</span>
                  <span className="text-[10px] font-mono text-white/45">
                    {fmtPrice(p.base, p.digits)}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SlTpInput({
  label,
  value,
  onChange,
  tone,
  live,
  digits,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tone: "rose" | "emerald";
  live: number;
  digits: number;
}) {
  const color =
    tone === "rose"
      ? "text-rose-300/90 border-rose-400/30 focus-within:border-rose-400/70"
      : "text-emerald-300/90 border-emerald-400/30 focus-within:border-emerald-400/70";
  return (
    <div>
      <div className={`text-[10px] font-mono uppercase tracking-[0.14em] mb-1.5 ${color.split(" ")[0]}`}>
        {label}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onFocus={(e) => {
          if (!value || value === "0") {
            const px = live.toFixed(digits);
            onChange(px);
            // select after state propagates
            const el = e.currentTarget;
            requestAnimationFrame(() => {
              try {
                el.setSelectionRange(0, px.length);
              } catch {}
            });
          }
        }}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          onChange(cleaned);
        }}
        placeholder={live.toFixed(digits)}
        className={`w-full rounded-xl bg-white/[0.03] border outline-none px-3 py-2 text-sm font-mono tabular-nums ${color}`}
      />
    </div>
  );
}

function Snap({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose" | "amber";
  icon?: any;
}) {
  const c =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "rose"
      ? "text-rose-400"
      : tone === "amber"
      ? "text-amber-400"
      : "text-white/85";
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon style={{ width: 12, height: 12 }} className="text-white/40" />}
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/45 leading-tight">
          {label}
        </div>
        <div className={`text-xs font-bold tabular-nums ${c}`}>{value}</div>
      </div>
    </div>
  );
}

function PositionTable({
  title,
  rows,
  empty,
  compact = false,
}: {
  title: string;
  rows: any[];
  empty: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-[#0a0f1a] to-[#06090f] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/55">
          {title}
        </span>
        <span className="text-[10px] font-mono text-white/40">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-white/40">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] text-[9.5px] font-mono uppercase tracking-[0.14em] text-white/45">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Side</th>
                <th className="px-3 py-2">Lots</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">{compact ? "Exit" : "Live"}</th>
                {!compact && <th className="px-3 py-2">SL</th>}
                {!compact && <th className="px-3 py-2">TP</th>}
                <th className="px-3 py-2">P&L</th>
                {!compact ? <th className="px-3 py-2 text-right">Action</th> : <th className="px-3 py-2">Reason</th>}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ModifyDialog({
  position,
  pair,
  onClose,
  onSave,
}: {
  position: Position;
  pair: Pair;
  onClose: () => void;
  onSave: (sl: number | null, tp: number | null) => void;
}) {
  const [slPx, setSlPx] = useState<string>(position.sl !== null ? position.sl.toFixed(pair.digits) : "");
  const [tpPx, setTpPx] = useState<string>(position.tp !== null ? position.tp.toFixed(pair.digits) : "");

  const slNum = slPx.trim() === "" ? null : +parseFloat(slPx).toFixed(pair.digits);
  const tpNum = tpPx.trim() === "" ? null : +parseFloat(tpPx).toFixed(pair.digits);

  const slDist =
    slNum !== null
      ? Math.round(Math.abs(slNum - position.entry) / pair.pip)
      : 0;
  const tpDist =
    tpNum !== null
      ? Math.round(Math.abs(tpNum - position.entry) / pair.pip)
      : 0;
  const riskMoney = slNum !== null ? slDist * pair.pip * position.lots * pair.contract : 0;
  const rewardMoney = tpNum !== null ? tpDist * pair.pip * position.lots * pair.contract : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a0f1a] to-[#06090f] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
              Modify Position
            </div>
            <div className="text-base font-bold mt-0.5 flex items-center gap-2">
              <span>{position.pair}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase tracking-[0.12em] border ${
                  position.side === "BUY"
                    ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                    : "text-rose-300 border-rose-400/40 bg-rose-500/10"
                }`}
              >
                {position.side} {position.lots}
              </span>
            </div>
            <div className="text-[10px] font-mono text-white/40 mt-0.5">
              entry @ {fmtPrice(position.entry, pair.digits)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-white/55 hover:text-white hover:bg-white/5"
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-rose-300/80 mb-1.5">
              Stop Loss (price)
            </div>
            <input
              value={slPx}
              onChange={(e) => setSlPx(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-white/[0.03] border border-rose-400/30 outline-none focus:border-rose-400/60 px-3 py-2 text-sm font-mono tabular-nums text-rose-200"
            />
            <div className="text-[9px] font-mono text-white/40 mt-1">
              {slNum !== null ? `${slDist} pts · ${fmtMoney(riskMoney)} risk` : "no SL"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-emerald-300/80 mb-1.5">
              Take Profit (price)
            </div>
            <input
              value={tpPx}
              onChange={(e) => setTpPx(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-white/[0.03] border border-emerald-400/30 outline-none focus:border-emerald-400/60 px-3 py-2 text-sm font-mono tabular-nums text-emerald-200"
            />
            <div className="text-[9px] font-mono text-white/40 mt-1">
              {tpNum !== null ? `${tpDist} pts · ${fmtMoney(rewardMoney)} reward` : "no TP"}
            </div>
          </div>
        </div>

        {slNum !== null && tpNum !== null && slDist > 0 && (
          <div className="mt-3 text-center text-[10px] font-mono uppercase tracking-[0.14em] text-amber-300/80">
            R:R 1 : {(tpDist / slDist).toFixed(2)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={onClose}
            className="py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/30 text-xs font-mono uppercase tracking-[0.14em]"
          >
            cancel
          </button>
          <button
            onClick={() => onSave(slNum, tpNum)}
            className="py-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 text-xs font-bold font-mono uppercase tracking-[0.14em]"
          >
            save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
