/**
 * BotTerminalCard — Batch T + U + V (live candlestick chart)
 *
 * Dashboard widget for the Bot Trading Terminal. Layout:
 *
 *   1. Header strip       — LIVE pulse + open count + today realized %
 *   2. XAU/USD candle chart — 5-second candles forming live from
 *                              the quote stream, with EMA(20) overlay
 *                              and right-side live price tag
 *   3. Open positions     — horizontal scroller of bot's active trades
 *                           with client-side live P/L
 *   4. Plan / share strip — slot progress + next-slot countdown +
 *                           the calling user's distribution share
 *   5. JUST-FILLED toast  — top-right banner whenever closedToday[]
 *                           grows (4s auto-dismiss)
 *
 * Data sources:
 *   - useBotQuotes()  -> public, 2s poll, drives candles + live P/L
 *   - useBotState()   -> auth, 5s poll, drives positions/plan/share/toast
 *
 * The candle series is built CLIENT-SIDE from the quote stream:
 * each ~5s bucket aggregates ticks into OHLC. Backed by 2s polling
 * means each candle gets 2-3 ticks, enough for visible high/low
 * variation without flatlining.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useBotQuotes,
  useBotState,
  type BotQuote,
  type BotStateClosedTrade,
  type BotStateOpenPosition,
} from "@/hooks/use-bot-terminal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(value: number, precision: number) {
  return value.toFixed(Math.max(0, Math.min(8, precision)));
}

function formatPct(value: number) {
  const s = value.toFixed(2);
  return value >= 0 ? `+${s}%` : `${s}%`;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

function useFlash(value: number, durationMs = 400): "up" | "down" | null {
  const prev = usePrevious(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (prev === undefined || prev === value || !Number.isFinite(value)) return;
    setFlash(value > prev ? "up" : "down");
    const t = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(t);
  }, [value, prev, durationMs]);
  return flash;
}

function CountdownLabel({ to }: { to: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!to) return null;
  const target = new Date(to).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  if (diff <= 0) return <span className="font-mono">now</span>;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return <span className="font-mono">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

// ---------------------------------------------------------------------------
// Client-side market-maker (Batch W)
// ---------------------------------------------------------------------------
//
// The /api/bot-trading/quotes feed updates only every ~2s and the
// per-poll jitter is intentionally tiny (sine-noise around an
// anchor). At 5s candle resolution that produces near-flat candles —
// users see "0.02 of variation on a $4610 price" and the chart looks
// dead.
//
// useSynthQuotes() is a pure-frontend market-maker simulator. For
// each pair it:
//   - Tracks a "real anchor" target (latest API mid).
//   - Linearly interpolates a smooth path from the previous synthetic
//     value to the new anchor over the 2s poll window.
//   - At ~5 ticks/sec, advances a synthetic price = path + drift +
//     gaussian-ish noise (uniform-pair, scaled by mid * 0.0025%).
//   - Hard-caps deviation at 0.1% of mid so the synth never wanders
//     visibly off the real anchor.
//
// Net effect: ~25 synth ticks per 5s candle → real-looking OHLC
// variation. The bot's open-position P/L pills also benefit because
// they read mid from the same synth stream.

const SYNTH_TICK_MS = 200; // 5 ticks/sec
const SYNTH_WINDOW_MS = 2000; // poll cadence
const SYNTH_DRIFT = 0.3; // 30% pull toward path per tick
const SYNTH_NOISE_REL = 0.000025; // 0.0025% of mid per tick
const SYNTH_CAP_REL = 0.001; // 0.1% max deviation from path

type SynthState = {
  base: number; // synth value at last anchor change
  target: number; // current real-API mid
  targetAt: number; // ms timestamp of last anchor change
  current: number; // current synth value
};

function useSynthQuotes(realQuotes: BotQuote[]): BotQuote[] {
  const stateRef = useRef<Map<string, SynthState>>(new Map());
  const realQuotesRef = useRef<BotQuote[]>(realQuotes);
  const [, setTick] = useState(0);

  // Sync targets whenever a fresh API poll lands.
  useEffect(() => {
    realQuotesRef.current = realQuotes;
    const now = Date.now();
    for (const q of realQuotes) {
      if (!Number.isFinite(q.mid)) continue;
      const existing = stateRef.current.get(q.code);
      if (!existing) {
        stateRef.current.set(q.code, {
          base: q.mid,
          target: q.mid,
          targetAt: now,
          current: q.mid,
        });
      } else {
        existing.base = existing.current;
        existing.target = q.mid;
        existing.targetAt = now;
      }
    }
  }, [realQuotes]);

  // Single stable interval, started once on mount.
  useEffect(() => {
    const id = setInterval(() => {
      const reals = realQuotesRef.current;
      if (reals.length === 0) return;
      const now = Date.now();
      let dirty = false;
      stateRef.current.forEach((s, code) => {
        const ref = reals.find((q) => q.code === code);
        if (!ref || !Number.isFinite(ref.mid) || ref.mid <= 0) return;
        const elapsed = now - s.targetAt;
        const progress = Math.min(1, elapsed / SYNTH_WINDOW_MS);
        const path = s.base + (s.target - s.base) * progress;
        const noiseAmp = ref.mid * SYNTH_NOISE_REL;
        const noise = (Math.random() - 0.5) * 2 * noiseAmp;
        const drift = (path - s.current) * SYNTH_DRIFT;
        let next = s.current + drift + noise;
        const cap = ref.mid * SYNTH_CAP_REL;
        const dev = next - path;
        if (Math.abs(dev) > cap) {
          next = path + Math.sign(dev) * cap;
        }
        s.current = next;
        dirty = true;
      });
      if (dirty) setTick((t) => (t + 1) & 0xffff);
    }, SYNTH_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Build the synth view. New objects every render (intentional —
  // the candle aggregator's useEffect deps fire on each tick).
  return realQuotes.map((q) => {
    const s = stateRef.current.get(q.code);
    const synthMid = s?.current ?? q.mid;
    const halfSpread = Math.abs(q.ask - q.bid) / 2;
    return {
      ...q,
      mid: synthMid,
      bid: synthMid - halfSpread,
      ask: synthMid + halfSpread,
      asOf: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Live candlestick chart (Batch V)
// ---------------------------------------------------------------------------

const CANDLE_SECONDS = 1; // 1-second scalp candles
const MAX_CANDLES = 90; // 90 × 1s = 90s rolling window
const EMA_PERIOD = 20;

type Candle = {
  bucket: number; // unix seconds, floor to CANDLE_SECONDS
  open: number;
  high: number;
  low: number;
  close: number;
  ticks: number;
};

/**
 * Aggregates the live quote stream into 5-second OHLC candles
 * client-side. Returns a rolling buffer of the last MAX_CANDLES
 * buckets. Each tick (every ~200ms via the synth-quote market-maker)
 * updates the current bucket's high/low/close; a new bucket starts
 * when the wall clock crosses a CANDLE_SECONDS boundary.
 *
 * When `persistKey` is provided, the rolling buffer is saved to
 * localStorage on a 2s heartbeat (and on tab unload) and loaded
 * back synchronously on mount, so the chart survives full-page
 * refreshes instead of restarting from "Waiting for first tick…".
 */

/**
 * Build a localStorage key that encodes BOTH the pair and the
 * candle period. If the period is ever changed (CANDLE_SECONDS),
 * old persisted buckets are auto-ignored on next load instead of
 * being treated as same-period buckets.
 */
function persistedKey(persistKey: string): string {
  return `qorix:candles:${persistKey}:${CANDLE_SECONDS}s`;
}

/**
 * Synchronously load candles from localStorage on mount. Filters
 * out malformed entries and anything older than the rolling
 * window. Safe in SSR / private-mode (returns []).
 */
function loadPersistedCandles(persistKey: string | undefined): Candle[] {
  if (!persistKey || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(persistedKey(persistKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff =
      Math.floor(Date.now() / 1000) - MAX_CANDLES * CANDLE_SECONDS;
    const valid: Candle[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const c = entry as Partial<Candle>;
      if (
        Number.isFinite(c.bucket) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close) &&
        (c.bucket as number) >= cutoff
      ) {
        valid.push({
          bucket: c.bucket as number,
          open: c.open as number,
          high: c.high as number,
          low: c.low as number,
          close: c.close as number,
          ticks: Number.isFinite(c.ticks) ? (c.ticks as number) : 1,
        });
      }
    }
    return valid.slice(-MAX_CANDLES);
  } catch {
    return [];
  }
}

function useCandleSeries(
  quote: BotQuote | undefined,
  persistKey?: string,
): Candle[] {
  // Lazy init from localStorage so the chart shows yesterday's
  // tail immediately on refresh instead of "Waiting for first tick…".
  const [candles, setCandles] = useState<Candle[]>(() =>
    loadPersistedCandles(persistKey),
  );

  // Seed synthetic history on the FIRST quote tick if we don't have
  // a full window yet. Prevents the "60% empty chart" look on a fresh
  // visit (only ~10 candles after 50s) by back-filling toward the
  // current price with a small random walk so the chart appears
  // visually full immediately.
  const seededRef = useRef(false);

  useEffect(() => {
    if (!quote || !Number.isFinite(quote.mid)) return;
    const price = quote.mid;
    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSec / CANDLE_SECONDS) * CANDLE_SECONDS;

    setCandles((prev) => {
      let working = prev;

      // Synthetic back-fill (run once per mount)
      if (!seededRef.current) {
        seededRef.current = true;
        if (working.length < MAX_CANDLES) {
          const need = MAX_CANDLES - working.length;
          const targetPrice = working[0]?.open ?? price;
          const oldestBucket = working[0]?.bucket ?? bucket;
          // Walk BACKWARDS in price space from targetPrice using
          // small random steps (~±0.01% per 5s candle). Then reverse
          // so the array is oldest -> newest and ends at targetPrice
          // for a seamless join with real / persisted candles.
          const prices: number[] = [targetPrice];
          let p = targetPrice;
          for (let i = 0; i < need; i++) {
            const stepPct = (Math.random() - 0.5) * 0.0002; // ±0.01%
            p = p / (1 + stepPct);
            prices.push(p);
          }
          prices.reverse();
          const synthetic: Candle[] = [];
          for (let i = 0; i < need; i++) {
            const b = oldestBucket - (need - i) * CANDLE_SECONDS;
            const open = prices[i];
            const close = prices[i + 1];
            const span = Math.abs(close - open);
            const high =
              Math.max(open, close) + span * (0.2 + Math.random() * 0.6);
            const low =
              Math.min(open, close) - span * (0.2 + Math.random() * 0.6);
            synthetic.push({
              bucket: b,
              open,
              high,
              low,
              close,
              ticks: 4 + Math.floor(Math.random() * 8),
            });
          }
          working = [...synthetic, ...working];
        }
      }

      const last = working[working.length - 1];
      if (!last || last.bucket !== bucket) {
        // New candle: open from prev close (gapless) when we have a
        // previous candle, otherwise from the current price.
        const open = last ? last.close : price;
        const fresh: Candle = {
          bucket,
          open,
          high: Math.max(open, price),
          low: Math.min(open, price),
          close: price,
          ticks: 1,
        };
        return [...working, fresh].slice(-MAX_CANDLES);
      }
      // Update current candle
      const updated: Candle = {
        ...last,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
        ticks: last.ticks + 1,
      };
      return [...working.slice(0, -1), updated];
    });
  }, [quote?.mid, quote?.asOf]);

  // Persist on a 2s heartbeat + on tab unload + on cleanup. Reading
  // through a ref avoids restarting the heartbeat every time the
  // candles array changes (which is every ~200ms with the synth).
  const candlesRef = useRef(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    const key = persistedKey(persistKey);
    const save = () => {
      try {
        const arr = candlesRef.current;
        if (!arr || arr.length === 0) return;
        window.localStorage.setItem(key, JSON.stringify(arr));
      } catch {
        // quota / private-mode — silently ignore
      }
    };
    const id = window.setInterval(save, 2000);
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [persistKey]);

  return candles;
}

/**
 * Simple moving-average style EMA over candle closes. Returns an
 * array aligned with `candles`; entries before period are null.
 */
function computeEma(candles: Candle[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (ema === null) {
      // Seed with simple average of first `period` closes
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
      ema = sum / period;
    } else {
      ema = close * k + ema * (1 - k);
    }
    out.push(ema);
  }
  return out;
}

function LiveCandleChart({
  quote,
  persistKey,
  positions = [],
  height = 280,
}: {
  quote: BotQuote | undefined;
  persistKey: string;
  positions?: BotStateOpenPosition[];
  height?: number;
}) {
  // Persist key is driven by the parent's `featuredCode` so that
  // switching the featured pair (e.g. XAUUSD → BTCUSD on weekends)
  // doesn't bleed buckets across pairs. The candle period is folded
  // into the storage key inside useCandleSeries, so period changes
  // are self-invalidating too.
  const candles = useCandleSeries(quote, persistKey);
  const ema = useMemo(() => computeEma(candles, EMA_PERIOD), [candles]);
  const flash = useFlash(quote?.mid ?? 0, 350);

  // Auto-scaled price range with 8% padding. Featured positions ARE
  // folded into the range so entries render at their TRUE y position
  // (chips + dashed lines + right tags spread across the chart like
  // MT5), instead of being clamped to the chart edge. To prevent a
  // single far-away entry from squashing candles into a sliver, the
  // position-driven extension is capped at 2.5× the raw candle range.
  const range = useMemo(() => {
    if (candles.length === 0) {
      return { min: (quote?.mid ?? 0) - 1, max: (quote?.mid ?? 0) + 1 };
    }
    let cMin = Infinity;
    let cMax = -Infinity;
    for (const c of candles) {
      if (c.low < cMin) cMin = c.low;
      if (c.high > cMax) cMax = c.high;
    }
    if (quote?.mid && Number.isFinite(quote.mid)) {
      if (quote.mid < cMin) cMin = quote.mid;
      if (quote.mid > cMax) cMax = quote.mid;
    }
    if (!Number.isFinite(cMin) || !Number.isFinite(cMax) || cMin === cMax) {
      const center = Number.isFinite(cMin) ? cMin : (quote?.mid ?? 0);
      return { min: center - 1, max: center + 1 };
    }
    const candleSpan = cMax - cMin;
    // Cap position extension so candles never shrink below ~28% of
    // the visible price area: max total span = candleSpan × 3.5
    // (i.e. positions can extend up to 1.25× candleSpan on each side).
    const maxExt = candleSpan * 1.25;
    let min = cMin;
    let max = cMax;
    for (const p of positions) {
      if (!Number.isFinite(p.entryPrice)) continue;
      const ePrice = p.entryPrice as number;
      if (ePrice < min) min = Math.max(ePrice, cMin - maxExt);
      if (ePrice > max) max = Math.min(ePrice, cMax + maxExt);
    }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, [candles, quote?.mid, positions]);

  // Volume scale — uses live tick count per candle as a proxy for
  // activity. Feels organic because busy candles (lots of synth
  // ticks) get tall bars and quiet ones get short bars.
  const maxTicks = useMemo(() => {
    let m = 1;
    for (const c of candles) if ((c.ticks ?? 1) > m) m = c.ticks ?? 1;
    return m;
  }, [candles]);

  // SVG geometry — fixed viewBox, scales responsively via class.
  // Bottom 18% reserved for the volume strip; the price area uses
  // priceH and the volume area sits below with a 4px gap.
  const W = 800;
  const H = height;
  const padTop = 12;
  const padBottom = 22;
  const padRight = 78; // room for live price tag
  // padLeft includes a 145px "chip gutter" on the left so the
  // bot-position chips render OUTSIDE the candle area (MT5 style),
  // never overlapping the price action. chipX is anchored at 2 so
  // chips occupy x=[2..142] and candles fill x=[152..padLeft+chartW].
  const padLeft = 152;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const VOL_GAP = 4;
  const volH = chartH * 0.18;
  const priceH = chartH - volH - VOL_GAP;
  const volTop = padTop + priceH + VOL_GAP;
  const volBottom = padTop + chartH;
  const slotW = chartW / MAX_CANDLES;
  const bodyW = Math.max(2, slotW * 0.65);

  const priceToY = (p: number) => {
    if (range.max === range.min) return padTop + priceH / 2;
    return padTop + ((range.max - p) / (range.max - range.min)) * priceH;
  };

  // Right-anchored: most recent candle sits at chartW edge
  const offsetX = chartW - candles.length * slotW;

  const precision = quote?.precision ?? 2;
  const liveY = quote?.mid !== undefined ? priceToY(quote.mid) : null;

  return (
    <div
      className={cn(
        "relative w-full transition-colors duration-300 rounded-md",
        flash === "up" && "bg-emerald-500/[0.04]",
        flash === "down" && "bg-rose-500/[0.04]",
      )}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        preserveAspectRatio="none"
        style={{ minHeight: 200 }}
      >
        {/* Grid lines (price area only) */}
        <g stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.5">
          {[0.2, 0.4, 0.6, 0.8].map((f) => {
            const y = padTop + priceH * f;
            return (
              <line key={f} x1={padLeft} x2={padLeft + chartW} y1={y} y2={y} />
            );
          })}
          {[0.25, 0.5, 0.75].map((f) => {
            const x = padLeft + chartW * f;
            return (
              <line key={f} x1={x} x2={x} y1={padTop} y2={padTop + priceH} />
            );
          })}
        </g>

        {/* Volume baseline + bars */}
        <line
          x1={padLeft}
          x2={padLeft + chartW}
          y1={volBottom}
          y2={volBottom}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="0.5"
        />
        {candles.map((c, i) => {
          const cx = padLeft + offsetX + i * slotW + slotW / 2;
          const ratio = (c.ticks ?? 1) / maxTicks;
          const barH = Math.max(1, ratio * (volH - 2));
          const isUp = c.close >= c.open;
          const color = isUp ? "#34d399" : "#fb7185";
          return (
            <rect
              key={`v-${c.bucket}`}
              x={cx - bodyW / 2}
              y={volBottom - barH}
              width={bodyW}
              height={barH}
              fill={color}
              opacity={0.32}
            />
          );
        })}

        {/* Candles */}
        {candles.map((c, i) => {
          const cx = padLeft + offsetX + i * slotW + slotW / 2;
          const yOpen = priceToY(c.open);
          const yClose = priceToY(c.close);
          const yHigh = priceToY(c.high);
          const yLow = priceToY(c.low);
          const isUp = c.close >= c.open;
          const color = isUp ? "#34d399" : "#fb7185";
          const bodyTop = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <g key={c.bucket}>
              <line
                x1={cx}
                x2={cx}
                y1={yHigh}
                y2={yLow}
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
                opacity={isUp ? 0.92 : 0.95}
              />
            </g>
          );
        })}

        {/* EMA(20) overlay */}
        {ema.some((v) => v !== null) ? (
          <polyline
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.25"
            strokeOpacity="0.85"
            points={ema
              .map((v, i) => {
                if (v === null) return null;
                const cx = padLeft + offsetX + i * slotW + slotW / 2;
                return `${cx.toFixed(2)},${priceToY(v).toFixed(2)}`;
              })
              .filter(Boolean)
              .join(" ")}
          />
        ) : null}

        {/* Bot position entry markers — MT5/TradingView retail-broker
            style:
            - A 3-section chip on the LEFT edge of the chart with
              [SIDE] [0.01 Lots] [±0.XX USD] (live P&L vs current
              price, recomputed every tick).
            - A full-width dashed horizontal line at the entry price.
            - A small colored tag on the RIGHT y-axis showing the
              entry price (overlays the regular price ticks).
            - Chips & right tags stack vertically when entries cluster
              at similar prices.
            - Off-chart entries (price outside the visible candle
              range) clamp to top/bottom edge with a ↑ / ↓ arrow on
              the chip; right tag is hidden for off-chart entries. */}
        {(() => {
          const minY = padTop + 7;
          const maxY = padTop + priceH - 7;
          const livePrice = quote?.mid;
          const chipX = 2; // anchored to svg left edge (chip gutter)
          const chipW = 140;
          const chipH = 13;
          const tagW = padRight - 22;
          const tagH = 12;

          // Build per-position info, then split into 3 stacking
          // groups so chips never collapse on top of each other when
          // many entries are off-chart at the same edge.
          const enriched = positions
            .map((p) => {
              const trueY = priceToY(p.entryPrice);
              const offTop = trueY < minY;
              const offBottom = trueY > maxY;
              const y = offTop ? minY : offBottom ? maxY : trueY;
              return { p, y, trueY, offTop, offBottom };
            })
            .sort((a, b) => a.y - b.y);

          const stackY = new Map<number, { chipY: number; tagY: number }>();
          // Top group: clamp to minY, stack DOWN
          let topCursor = minY;
          for (const v of enriched.filter((e) => e.offTop)) {
            stackY.set(v.p.id, { chipY: topCursor, tagY: topCursor });
            topCursor += chipH + 1;
          }
          // Bottom group: clamp to maxY-chipH, stack UP
          let botCursor = maxY - chipH;
          for (const v of enriched.filter((e) => e.offBottom).reverse()) {
            stackY.set(v.p.id, { chipY: botCursor, tagY: botCursor });
            botCursor -= chipH + 1;
          }
          // Middle group: at trueY, push down on overlap, but never
          // beyond maxY (in which case clamp to maxY-chipH and stop).
          let lastMidBottom = -Infinity;
          for (const v of enriched.filter(
            (e) => !e.offTop && !e.offBottom,
          )) {
            let chipY = v.y - chipH / 2;
            if (chipY < lastMidBottom + 1) chipY = lastMidBottom + 1;
            if (chipY + chipH > maxY) chipY = maxY - chipH;
            if (chipY < minY) chipY = minY;
            stackY.set(v.p.id, { chipY, tagY: chipY });
            lastMidBottom = chipY + chipH;
          }

          return enriched.map(({ p, y, offTop, offBottom }) => {
            const isBuy = p.direction.toUpperCase() === "BUY";
            const color = isBuy ? "#34d399" : "#fb7185";
            const offChart = offTop || offBottom;
            const sideLabel = isBuy ? "BUY" : "SELL";

            // Synthetic lot size — deterministic per position id so it
            // stays stable across re-renders. Mostly 0.01 Lots, with
            // occasional 0.02/0.05 for variety.
            const sizeBuckets = [
              0.01, 0.01, 0.01, 0.01, 0.02, 0.01, 0.01, 0.05, 0.01, 0.01,
            ];
            const lots =
              sizeBuckets[Math.abs(p.id) % sizeBuckets.length];

            // Live USD P&L = (live - entry) × lots × side. For BTC
            // 0.01 lots a $1 price move ≈ $0.01 P&L, so chip values
            // stay realistically small even on a quiet candle.
            const pnlUsd =
              livePrice !== undefined && Number.isFinite(livePrice)
                ? (isBuy ? 1 : -1) * (livePrice - p.entryPrice) * lots
                : 0;
            const pnlPositive = pnlUsd >= 0;
            const pnlColor = pnlPositive ? "#34d399" : "#fb7185";
            const pnlSign = pnlPositive ? "+" : "";

            // Look up pre-computed stack Y (top/mid/bot grouped)
            const stack = stackY.get(p.id) ?? { chipY: y - chipH / 2, tagY: y - tagH / 2 };
            const chipY = stack.chipY;
            const tagY = stack.tagY;

            return (
              <g key={`pos-${p.id}`}>
                {/* Full-width dashed entry-price line — spans the
                    whole candle area (from end of chip gutter to right
                    edge of candles), like MT5. */}
                {!offChart ? (
                  <line
                    x1={chipX + chipW + 2}
                    x2={padLeft + chartW}
                    y1={y}
                    y2={y}
                    stroke={color}
                    strokeOpacity="0.45"
                    strokeWidth="0.6"
                    strokeDasharray="3 3"
                  />
                ) : null}

                {/* 3-section chip in the LEFT GUTTER (outside the
                    candle plot, never overlapping price action). */}
                <rect
                  x={chipX}
                  y={chipY}
                  width={chipW}
                  height={chipH}
                  rx={2}
                  fill={color}
                  opacity={offChart ? 0.3 : 0.22}
                />
                {/* Section 1: side */}
                <text
                  x={chipX + 6}
                  y={chipY + 9}
                  fill={color}
                  fontSize="9"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight="700"
                >
                  {sideLabel}
                </text>
                {/* Separator 1 */}
                <line
                  x1={chipX + 35}
                  x2={chipX + 35}
                  y1={chipY + 2}
                  y2={chipY + chipH - 2}
                  stroke={color}
                  strokeOpacity="0.55"
                  strokeWidth="0.5"
                />
                {/* Section 2: size */}
                <text
                  x={chipX + 40}
                  y={chipY + 9}
                  fill="currentColor"
                  fillOpacity="0.85"
                  fontSize="9"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {lots.toFixed(2)} Lots
                </text>
                {/* Separator 2 */}
                <line
                  x1={chipX + 87}
                  x2={chipX + 87}
                  y1={chipY + 2}
                  y2={chipY + chipH - 2}
                  stroke={color}
                  strokeOpacity="0.55"
                  strokeWidth="0.5"
                />
                {/* Section 3: live USD P&L (independent color) */}
                <text
                  x={chipX + 92}
                  y={chipY + 9}
                  fill={pnlColor}
                  fontSize="9"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight="700"
                >
                  {pnlSign}
                  {pnlUsd.toFixed(2)} USD
                </text>
                {/* Off-chart arrow */}
                {offChart ? (
                  <text
                    x={chipX + chipW - 8}
                    y={chipY + 9}
                    fill={color}
                    fontSize="10"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontWeight="700"
                  >
                    {offTop ? "↑" : "↓"}
                  </text>
                ) : null}

                {/* Right-side entry-price tag — ALWAYS rendered so
                    every position has a y-axis label even when its
                    chip is clamped to the chart edge (off-chart). The
                    tag y matches chip y (both come from stackY); the
                    text always shows the TRUE entry price so the
                    user can read the actual fill price even for
                    out-of-range entries. */}
                <g>
                  <rect
                    x={padLeft + chartW + 1}
                    y={tagY}
                    width={tagW}
                    height={tagH}
                    rx={1.5}
                    fill={color}
                    opacity={offChart ? 0.7 : 0.85}
                  />
                  <text
                    x={padLeft + chartW + 1 + tagW / 2}
                    y={tagY + 8.5}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="8"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontWeight="700"
                  >
                    {p.entryPrice.toFixed(precision)}
                  </text>
                </g>
              </g>
            );
          });
        })()}

        {/* Right-side y-axis price ticks (price area only) */}
        <g
          fill="currentColor"
          fillOpacity="0.5"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
            const p = range.max - (range.max - range.min) * f;
            const y = padTop + priceH * f;
            return (
              <text key={i} x={padLeft + chartW + 4} y={y + 3}>
                {p.toFixed(precision)}
              </text>
            );
          })}
        </g>

        {/* "VOL" label at top of volume strip */}
        <text
          x={padLeft + chartW + 4}
          y={volTop + 8}
          fill="currentColor"
          fillOpacity="0.4"
          fontSize="8"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          VOL
        </text>

        {/* Live price horizontal line + tag */}
        {liveY !== null && quote ? (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + chartW}
              y1={liveY}
              y2={liveY}
              stroke={
                flash === "down"
                  ? "#fb7185"
                  : flash === "up"
                    ? "#34d399"
                    : "#fbbf24"
              }
              strokeOpacity="0.6"
              strokeWidth="0.85"
              strokeDasharray="3 3"
            />
            <rect
              x={padLeft + chartW + 1}
              y={liveY - 9}
              width={padRight - 4}
              height={18}
              rx={2}
              fill={
                flash === "down"
                  ? "#fb7185"
                  : flash === "up"
                    ? "#34d399"
                    : "#fbbf24"
              }
              opacity="0.95"
            />
            <text
              x={padLeft + chartW + padRight / 2 - 1}
              y={liveY + 4}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight="700"
            >
              {quote.mid.toFixed(precision)}
            </text>
          </g>
        ) : null}
      </svg>

      {/* Empty state overlay while series fills (first few seconds) */}
      {candles.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
          Waiting for first tick…
        </div>
      ) : null}
    </div>
  );
}

function ChartHeader({ quote }: { quote: BotQuote | undefined }) {
  const flash = useFlash(quote?.mid ?? 0);
  if (!quote) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider">XAU/USD</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          waiting for quotes…
        </span>
      </div>
    );
  }
  const change = quote.change24h;
  const isUp = change > 0;
  const isFlat = change === 0;
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <span className="text-[11px] sm:text-[12px] font-bold tracking-wider">
          {quote.display}
        </span>
        {quote.marketOpen ? (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] gap-1 px-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-slate-500/30 bg-slate-500/10 text-slate-400 text-[9px] px-1.5"
          >
            CLOSED
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
          5s candles
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-[11px] tabular-nums">
        <span
          className={cn(
            "font-mono text-sm sm:text-base font-semibold transition-colors duration-300",
            flash === "up" && "text-emerald-400",
            flash === "down" && "text-rose-400",
          )}
        >
          {quote.mid.toFixed(quote.precision)}
        </span>
        <span
          className={cn(
            "font-mono inline-flex items-center gap-0.5",
            isUp
              ? "text-emerald-400"
              : isFlat
                ? "text-muted-foreground"
                : "text-rose-400",
          )}
        >
          {isUp ? (
            <ArrowUp className="size-3" />
          ) : isFlat ? null : (
            <ArrowDown className="size-3" />
          )}
          {formatPct(change)}
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          spread {quote.spreadPips}p
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open positions strip (live P/L)
// ---------------------------------------------------------------------------

function PositionPill({
  pos,
  quote,
}: {
  pos: BotStateOpenPosition;
  quote: BotQuote | undefined;
}) {
  const livePct = useMemo(() => {
    if (!quote || !pos.entryPrice) return 0;
    const sign = pos.direction.toUpperCase() === "BUY" ? 1 : -1;
    return ((quote.mid - pos.entryPrice) / pos.entryPrice) * 100 * sign;
  }, [quote?.mid, pos.entryPrice, pos.direction]);

  const flash = useFlash(livePct, 350);
  const profit = livePct >= 0;
  const precision = quote?.precision ?? 2;
  const dirUpper = pos.direction.toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-[11px] whitespace-nowrap shrink-0 transition-colors duration-200",
        flash === "up" && "border-emerald-500/40",
        flash === "down" && "border-rose-500/40",
      )}
    >
      <span className="font-semibold">{pos.pair}</span>
      <span
        className={cn(
          "font-bold",
          dirUpper === "BUY" ? "text-emerald-400" : "text-rose-400",
        )}
      >
        {dirUpper}
      </span>
      <span className="text-muted-foreground font-mono tabular-nums hidden sm:inline-flex items-baseline justify-end min-w-[140px]">
        <span className="inline-block text-right">
          {pos.entryPrice.toFixed(precision)}
        </span>
        {quote ? (
          <>
            <span className="text-muted-foreground/50 px-1">→</span>
            <span className="inline-block text-right">
              {quote.mid.toFixed(precision)}
            </span>
          </>
        ) : null}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums font-semibold rounded px-1.5 py-0.5 inline-block text-right min-w-[68px]",
          profit
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-rose-500/15 text-rose-400",
        )}
      >
        {profit ? "+" : ""}
        {livePct.toFixed(3)}%
      </span>
    </div>
  );
}

function PositionsStrip({
  positions,
  quotes,
}: {
  positions: BotStateOpenPosition[];
  quotes: BotQuote[];
}) {
  const quotesByPair = useMemo(() => {
    const m = new Map<string, BotQuote>();
    for (const q of quotes) m.set(q.code, q);
    return m;
  }, [quotes]);

  if (positions.length === 0) return null;

  return (
    <div className="border-t bg-background/30 px-2.5 sm:px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
        <Zap className="size-3 text-amber-400 shrink-0" />
        <span className="truncate">
          {positions.length} OPEN
          <span className="hidden sm:inline"> POSITIONS</span>
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground/50 italic font-normal normal-case tracking-normal">
          live P/L
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {positions.map((p) => (
          <PositionPill key={p.id} pos={p} quote={quotesByPair.get(p.pair)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live tape — phantom-fill stream (Batch Z)
// ---------------------------------------------------------------------------
//
// To make the terminal feel like an actual trading desk where the
// bot is constantly working, we generate a stream of "fake fills"
// tied to the live synth quote. Every ~380ms one to three small
// prints pop at random sides/sizes around the current mid, with
// prices jittered by ±6 pips. The strip then renders the last 6
// prints with a slide-in animation per row, giving the dashboard
// a scrolling Time-&-Sales feed that visually moves 24/7.
//
// These prints are PURELY visual — they are NOT signals, NOT real
// orders, and do not affect any persisted state or backend. The
// header keeps a small "feed only" disclaimer for transparency.

type TapePrint = {
  id: number;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  at: number;
};

const TAPE_INTERVAL_MS = 380;
const TAPE_MAX = 24;
const TAPE_VISIBLE = 6;

function randomTapeSize(code: string): number {
  if (code === "BTCUSD") {
    return Math.round((0.003 + Math.random() * 0.097) * 1000) / 1000;
  }
  if (code === "EURUSD") return Math.round(2 + Math.random() * 48);
  if (code === "XAUUSD") {
    return Math.round((0.1 + Math.random() * 1.9) * 100) / 100;
  }
  return Math.round(1 + Math.random() * 49);
}

function formatTapeSize(code: string, size: number): string {
  if (code === "BTCUSD") return size.toFixed(3);
  if (code === "XAUUSD") return size.toFixed(2);
  return String(size);
}

function usePrintTape(quote: BotQuote | undefined): TapePrint[] {
  const [prints, setPrints] = useState<TapePrint[]>([]);
  const idRef = useRef(0);
  const quoteRef = useRef(quote);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  // Stable interval — reads latest quote via ref so the timer never
  // restarts on synth ticks (200ms cadence).
  useEffect(() => {
    const id = setInterval(() => {
      const q = quoteRef.current;
      if (!q || !Number.isFinite(q.mid)) return;
      const n = 1 + Math.floor(Math.random() * 3); // 1-3 prints / interval
      const fresh: TapePrint[] = [];
      for (let i = 0; i < n; i++) {
        const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
        const jitter = (Math.random() - 0.5) * 2 * q.pipSize * 6;
        fresh.push({
          id: idRef.current++,
          side,
          size: randomTapeSize(q.code),
          price: q.mid + jitter,
          at: Date.now() + i,
        });
      }
      setPrints((prev) => [...fresh, ...prev].slice(0, TAPE_MAX));
    }, TAPE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return prints;
}

function LiveTapeStrip({ quote }: { quote: BotQuote | undefined }) {
  const prints = usePrintTape(quote);
  const visible = prints.slice(0, TAPE_VISIBLE);
  const precision = quote?.precision ?? 2;
  const pairLabel = quote?.display ?? "—";

  return (
    <div className="border-t bg-background/30 px-3 py-2">
      <div className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>LIVE TAPE</span>
        <span className="text-foreground/70 font-mono">{pairLabel}</span>
        <span className="hidden sm:inline text-muted-foreground/40 normal-case font-normal tracking-normal italic">
          indicative · feed only
        </span>
        <span className="ml-auto font-mono text-muted-foreground/40 normal-case font-normal tracking-normal">
          {prints.length}
        </span>
      </div>
      <div
        className="font-mono text-[10px] relative"
        style={{ minHeight: TAPE_VISIBLE * 16 }}
      >
        <AnimatePresence initial={false}>
          {visible.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1 - idx * 0.13, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              layout
              className="flex items-center gap-2 sm:gap-3 tabular-nums leading-4 h-4"
            >
              <span className="text-muted-foreground/60 w-[52px] sm:w-16 shrink-0">
                {new Date(p.at).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span
                className={cn(
                  "w-9 sm:w-10 font-bold shrink-0",
                  p.side === "BUY" ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {p.side}
              </span>
              <span className="w-12 sm:w-14 text-foreground/80 shrink-0">
                {quote ? formatTapeSize(quote.code, p.size) : p.size}
              </span>
              <span
                className={cn(
                  "tabular-nums shrink-0",
                  p.side === "BUY"
                    ? "text-emerald-400/85"
                    : "text-rose-400/85",
                )}
              >
                {p.price.toFixed(precision)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "JUST FILLED" toast
// ---------------------------------------------------------------------------

function useFillToast(closedToday: BotStateClosedTrade[] | undefined) {
  const [toast, setToast] = useState<BotStateClosedTrade | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const initialRef = useRef(true);

  useEffect(() => {
    if (!closedToday) return;
    if (initialRef.current) {
      closedToday.forEach((c) => seenIdsRef.current.add(c.id));
      initialRef.current = false;
      return;
    }
    let newest: BotStateClosedTrade | null = null;
    for (const c of closedToday) {
      if (!seenIdsRef.current.has(c.id)) {
        seenIdsRef.current.add(c.id);
        newest = c;
      }
    }
    if (!newest) return;
    setToast(newest);
    const fillId = newest.id;
    const t = setTimeout(() => {
      setToast((prev) => (prev?.id === fillId ? null : prev));
    }, 4000);
    return () => clearTimeout(t);
  }, [closedToday]);

  return toast;
}

function JustFilledToast({ fill }: { fill: BotStateClosedTrade | null }) {
  return (
    <AnimatePresence>
      {fill ? (
        <motion.div
          key={fill.id}
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "absolute top-2 right-2 z-20 rounded-md border px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm pointer-events-none",
            (fill.realizedProfitPercent ?? 0) >= 0
              ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-100"
              : "bg-rose-500/25 border-rose-500/50 text-rose-100",
          )}
        >
          <div className="font-semibold flex items-center gap-1.5 text-[10px] tracking-wider">
            <Target className="size-3" />
            JUST FILLED
          </div>
          <div className="mt-0.5 font-mono tabular-nums">
            {fill.pair} {fill.direction.toUpperCase()}{" "}
            <span className="font-semibold">
              {(fill.realizedProfitPercent ?? 0) >= 0 ? "+" : ""}
              {(fill.realizedProfitPercent ?? 0).toFixed(2)}%
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bot-thinking ticker (Batch AB)
// ---------------------------------------------------------------------------
//
// A slim status row mounted between the chart header and the chart
// itself, cycling through short bot-state phrases every ~2.8s with a
// crossfade. Adds an "always working" presence without being noisy.

const BOT_STATUS_PHRASES = [
  "Scanning markets…",
  "Computing risk…",
  "Watching liquidity…",
  "Probing depth…",
  "Reading order flow…",
  "Calibrating signals…",
  "Sizing positions…",
  "Modeling volatility…",
  "Polling liquidity venues…",
];

function BotThinkingTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % BOT_STATUS_PHRASES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);
  const phrase = BOT_STATUS_PHRASES[idx];
  return (
    <div className="px-3 sm:px-4 py-1.5 border-b bg-background/20 flex items-center gap-2 text-[10px] text-muted-foreground overflow-hidden">
      <span className="size-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
      <span className="font-mono text-foreground/60 shrink-0 tracking-wider">
        BOT
      </span>
      <div className="relative flex-1 min-w-0 h-3.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phrase}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="absolute inset-0 italic truncate"
          >
            {phrase}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="hidden sm:inline shrink-0 font-mono text-muted-foreground/40 text-[9px] tracking-wider">
        AUTOPILOT
      </span>
    </div>
  );
}

export function BotTerminalCard() {
  const { data: quotesData } = useBotQuotes();
  const { data: state } = useBotState();

  // The market-maker hook turns each pair's 2s real-API tick into a
  // smooth ~5 ticks/sec synthetic stream. Everything downstream — the
  // candle aggregator, the live price tag, the open-position P/L
  // pills — reads from these synth quotes for proper trading-feel
  // volatility without touching the backend.
  const realQuotes = quotesData?.quotes ?? [];
  const quotes = useSynthQuotes(realQuotes);
  // Featured pair for the live chart. Forex / metals close on
  // weekends — BTC trades 24/7 so we use it whenever the legacy
  // XAU/USD session is shut. The chart's persist key tracks the
  // featured pair so storage doesn't bleed across pairs.
  const featuredCode = "BTCUSD";
  const featured = quotes.find((q) => q.code === featuredCode);
  const summary = state?.summary;
  const plan = state?.bot.plan;
  const userToday = state?.userToday;
  const positions = state?.openPositions ?? [];

  // Featured-pair entry lines — pick the 4 positions whose entry
  // price is closest to the current market price, so chips are
  // always within the chart's visible range. (Filtering by recency
  // could include trades opened hours ago at very different prices,
  // which would all fall off-chart.)
  const featuredMid = featured?.mid;
  const featuredPositions = useMemo(() => {
    if (!Number.isFinite(featuredMid)) return [];
    const mid = featuredMid as number;
    // Only show positions whose entry is within ±1% of current price
    // so the chart looks like real MT5 — chips + dashed lines + right
    // tags all fit naturally in the visible candle range. Stale,
    // far-away positions (e.g. opened hours ago when BTC was $1800
    // below current) are hidden from the chart but remain in the
    // open-positions count above the chart.
    const band = mid * 0.01;
    return positions
      .filter((p) => p.pair === featuredCode)
      .filter(
        (p) =>
          Number.isFinite(p.entryPrice) &&
          Math.abs((p.entryPrice as number) - mid) <= band,
      )
      .slice()
      .sort(
        (a, b) =>
          Math.abs(a.entryPrice - mid) - Math.abs(b.entryPrice - mid),
      )
      .slice(0, 4);
  }, [positions, featuredCode, featuredMid]);

  const fillToast = useFillToast(state?.closedToday);

  // -------------------------------------------------------------------------
  // Dual scalp-bot simulator (frontend-only, no DB writes)
  // -------------------------------------------------------------------------
  // Two virtual bots watch the live featured-pair quote:
  //   • LONG  bot opens a BUY  on every up-tick (when no open BUY)
  //   • SHORT bot opens a SELL on every down-tick (when no open SELL)
  // Per-trade lifecycle:
  //   • SL = entry ± SL_PCT (0.05% scalp stop) for the first 3 s
  //   • At 3 s mark → SL trails to BREAKEVEN (entry) — risk-free
  //   • TP = open (let it run); closes only on SL/BE touch or 30 s timeout
  // Win/loss accounting:
  //   • Closed at sl < entry (BUY) / sl > entry (SELL) → LOSS
  //   • Closed at BE (sl == entry) → WIN (zero-risk scalp)
  // -------------------------------------------------------------------------
  const SCALP_SL_PCT = 0.0005;          // 0.05% risk
  const SCALP_TP_PCT = 0.0010;          // 0.10% target → 2:1 R:R
  const SCALP_BE_DELAY_MS = 3000;
  const SCALP_MAX_LIFETIME_MS = 30000;
  const SCALP_CLOSED_FADE_MS = 4000;
  const SCALP_COOLDOWN_MS = 2000;       // throttle same-direction stacking

  type Scalp = {
    id: number;
    bot: "LONG" | "SHORT";
    direction: "BUY" | "SELL";
    entry: number;
    sl: number;
    tp: number;
    openedAt: number;
    status: "open" | "won_tp" | "won_be" | "lost";
    closedAt?: number;
  };

  const [scalps, setScalps] = useState<Scalp[]>([]);
  const [scalpStats, setScalpStats] = useState({
    longWins: 0,
    longLosses: 0,
    shortWins: 0,
    shortLosses: 0,
  });
  type ScalpEvent = {
    id: number;
    bot: "LONG" | "SHORT";
    outcome: "TP" | "BE" | "SL";
    pnlUsd: number;
    at: number;
  };
  const [scalpEvents, setScalpEvents] = useState<ScalpEvent[]>([]);
  const scalpEventIdRef = useRef(0);
  // Cumulative scalp P&L — persisted to localStorage so it accumulates
  // across reloads and we can see how much the virtual desk grinds out.
  const SCALP_PNL_KEY = "qorix.scalp.totalPnl.v1";
  const [scalpTotalPnl, setScalpTotalPnl] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(SCALP_PNL_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCALP_PNL_KEY, String(scalpTotalPnl));
  }, [scalpTotalPnl]);
  // Daily/session target — default $100, override via
  // localStorage.setItem("qorix.scalp.target.v1", "250") + reload.
  const SCALP_TARGET_KEY = "qorix.scalp.target.v1";
  const SCALP_DEFAULT_TARGET = 100;
  const scalpTarget = useMemo(() => {
    if (typeof window === "undefined") return SCALP_DEFAULT_TARGET;
    const raw = window.localStorage.getItem(SCALP_TARGET_KEY);
    const n = raw ? Number(raw) : SCALP_DEFAULT_TARGET;
    return Number.isFinite(n) && n > 0 ? n : SCALP_DEFAULT_TARGET;
  }, []);
  const scalpTargetPct = Math.max(
    0,
    Math.min(100, (scalpTotalPnl / scalpTarget) * 100),
  );
  // Owner-only debug HUD. Public dashboard hides all scalp metrics
  // (P&L badge, target progress, L/S counters, SCALP events strip).
  // Enable on YOUR browser only:
  //   localStorage.setItem("qorix.dev.showScalp", "1"); location.reload();
  const showScalpDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("qorix.dev.showScalp") === "1";
  }, []);
  const lastMidRef = useRef<number | null>(null);
  const scalpIdRef = useRef(-1);

  // Drop scalp events older than 5 s so the ticker stays clean.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setScalpEvents((evts) => evts.filter((e) => now - e.at < 5000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mid = featuredMid;
    if (!Number.isFinite(mid)) return;
    const m = mid as number;
    const now = Date.now();
    const prev = lastMidRef.current;
    lastMidRef.current = m;

    setScalps((curr) => {
      const closedThisTick: Scalp[] = [];
      let next: Scalp[] = curr.map((s) => {
        if (s.status !== "open") return s;
        const age = now - s.openedAt;
        let sl = s.sl;
        // Move SL → BE at 3 s
        if (age >= SCALP_BE_DELAY_MS && sl !== s.entry) sl = s.entry;
        // Check TP hit FIRST (full +0.10% target, 2x SL distance)
        const tpHit = s.direction === "BUY" ? m >= s.tp : m <= s.tp;
        if (tpHit) {
          const closed: Scalp = {
            ...s,
            sl,
            status: "won_tp",
            closedAt: now,
          };
          closedThisTick.push(closed);
          return closed;
        }
        // Check SL hit
        const slHit = s.direction === "BUY" ? m <= sl : m >= sl;
        if (slHit) {
          const lost =
            (s.direction === "BUY" && sl < s.entry) ||
            (s.direction === "SELL" && sl > s.entry);
          const closed: Scalp = {
            ...s,
            sl,
            status: lost ? "lost" : "won_be",
            closedAt: now,
          };
          closedThisTick.push(closed);
          return closed;
        }
        // 30 s lifetime → close as BE win (BE-protected, never reached TP)
        if (age >= SCALP_MAX_LIFETIME_MS) {
          const closed: Scalp = {
            ...s,
            sl: s.entry,
            status: "won_be",
            closedAt: now,
          };
          closedThisTick.push(closed);
          return closed;
        }
        return { ...s, sl };
      });

      // Open new trades on direction change (with cooldown to avoid stacking)
      const dir = prev == null ? 0 : Math.sign(m - prev);
      if (dir !== 0) {
        const bot: "LONG" | "SHORT" = dir > 0 ? "LONG" : "SHORT";
        const direction: "BUY" | "SELL" = dir > 0 ? "BUY" : "SELL";
        const hasOpen = next.some(
          (s) => s.bot === bot && s.status === "open",
        );
        // Cooldown: skip if this bot just closed a trade <2s ago
        const recentClose = next.some(
          (s) =>
            s.bot === bot &&
            s.status !== "open" &&
            s.closedAt != null &&
            now - s.closedAt < SCALP_COOLDOWN_MS,
        );
        if (!hasOpen && !recentClose) {
          const sl =
            direction === "BUY"
              ? m * (1 - SCALP_SL_PCT)
              : m * (1 + SCALP_SL_PCT);
          const tp =
            direction === "BUY"
              ? m * (1 + SCALP_TP_PCT)
              : m * (1 - SCALP_TP_PCT);
          const id = scalpIdRef.current--;
          next.push({
            id,
            bot,
            direction,
            entry: m,
            sl,
            tp,
            openedAt: now,
            status: "open",
          });
        }
      }

      // Update stats counters from this tick's closures
      if (closedThisTick.length > 0) {
        setScalpStats((s) => {
          const ns = { ...s };
          for (const c of closedThisTick) {
            const isWin = c.status === "won_tp" || c.status === "won_be";
            if (c.bot === "LONG") {
              if (isWin) ns.longWins++;
              else ns.longLosses++;
            } else {
              if (isWin) ns.shortWins++;
              else ns.shortLosses++;
            }
          }
          return ns;
        });
        // Compute fresh events + pnl OUTSIDE the setScalpEvents updater
        // so the cumulative total reads the real sum (the updater is
        // queued and runs later — reading tickPnlSum from inside it
        // would always yield 0 at the time of setScalpTotalPnl).
        let tickPnlSum = 0;
        const fresh: ScalpEvent[] = closedThisTick.map((c) => {
          // Synthetic notional $5k–$8k (deterministic by id).
          //   • TP hit  →  +0.10% × notional   ≈  +$5.00–$8.00  (big win)
          //   • SL hit  →  −0.05% × notional   ≈  −$2.50–$4.00  (loss)
          //   • BE      →  small +vig $0.05–$0.35 (tiny grind, breakeven)
          const notional = 5000 + (Math.abs(c.id) % 7) * 500;
          let pnlUsd: number;
          let outcome: "TP" | "BE" | "SL";
          if (c.status === "won_tp") {
            pnlUsd = SCALP_TP_PCT * notional;
            outcome = "TP";
          } else if (c.status === "lost") {
            pnlUsd = -SCALP_SL_PCT * notional;
            outcome = "SL";
          } else {
            pnlUsd = 0.05 * (1 + (Math.abs(c.id) % 7));
            outcome = "BE";
          }
          tickPnlSum += pnlUsd;
          return {
            id: scalpEventIdRef.current++,
            bot: c.bot,
            outcome,
            pnlUsd,
            at: now,
          };
        });
        setScalpEvents((evts) => [...fresh, ...evts].slice(0, 8));
        if (tickPnlSum !== 0) {
          setScalpTotalPnl((p) => p + tickPnlSum);
        }
      }

      // Cleanup: drop closed trades after fade window
      next = next.filter((s) => {
        if (s.status === "open") return true;
        return now - (s.closedAt ?? 0) < SCALP_CLOSED_FADE_MS;
      });

      return next;
    });
  }, [featuredMid]);

  // Convert open scalps into BotStateOpenPosition shape so the chart
  // can render them with the existing chip/tag/dashed-line code path.
  const virtualScalpPositions = useMemo<BotStateOpenPosition[]>(() => {
    return scalps
      .filter((s) => s.status === "open")
      .map((s) => ({
        id: s.id,
        pair: featuredCode,
        direction: s.direction,
        entryPrice: s.entry,
        tpPrice: null,
        slPrice: s.sl,
        expectedProfitPercent: 0,
        openedAt: new Date(s.openedAt).toISOString(),
        livePnlPct: null,
      }));
  }, [scalps, featuredCode]);

  // Scalps render FIRST (most recent at top of chip stack), then
  // real platform positions fill remaining slots up to 4.
  const chartPositions = useMemo(
    () => [...virtualScalpPositions, ...featuredPositions].slice(0, 4),
    [virtualScalpPositions, featuredPositions],
  );

  return (
    <Card className="overflow-hidden relative">
      <JustFilledToast fill={fillToast} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Activity className="size-4 text-emerald-400 shrink-0" />
          <span className="text-[13px] sm:text-sm font-semibold tracking-wider truncate">
            BOT TERMINAL
          </span>
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 px-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
          {showScalpDebug && (
          <div
            className={cn(
              "relative h-6 shrink-0 rounded-md border overflow-hidden flex items-center gap-1.5 px-2 text-[11px] sm:text-xs font-bold tabular-nums transition-colors",
              scalpTotalPnl >= 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/15 text-rose-300",
            )}
            title={`Scalp bot P&L $${scalpTotalPnl.toFixed(2)} of $${scalpTarget.toFixed(0)} target (${scalpTargetPct.toFixed(1)}%) — override via localStorage qorix.scalp.target.v1`}
          >
            {/* Progress fill bar (only when positive, shows journey to target) */}
            {scalpTotalPnl > 0 && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-emerald-500/15 transition-[width] duration-500 ease-out"
                style={{ width: `${scalpTargetPct}%` }}
              />
            )}
            <span className="relative opacity-60 text-[9px] tracking-wider hidden sm:inline">
              P&L
            </span>
            <span className="relative">
              {scalpTotalPnl >= 0 ? "+" : "−"}$
              {Math.abs(scalpTotalPnl).toFixed(2)}
            </span>
            <span className="relative opacity-50 text-[10px] hidden sm:inline">
              / ${scalpTarget.toFixed(0)}
            </span>
            <span className="relative opacity-70 text-[9px] tabular-nums">
              {scalpTargetPct.toFixed(0)}%
            </span>
          </div>
          )}
        </div>
        <div className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showScalpDebug && (
            <>
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="text-emerald-400 font-semibold">L</span>
                <span className="text-emerald-400/80">{scalpStats.longWins}W</span>
                <span className="text-rose-400/80">{scalpStats.longLosses}L</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="text-rose-400 font-semibold">S</span>
                <span className="text-emerald-400/80">{scalpStats.shortWins}W</span>
                <span className="text-rose-400/80">{scalpStats.shortLosses}L</span>
              </span>
            </>
          )}
          {summary ? (
            <>
              <span className="text-muted-foreground/50 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{summary.openCount} open</span>
              <span className="text-muted-foreground/50">•</span>
              <span
                className={cn(
                  summary.closedTodayPctSum > 0
                    ? "text-emerald-400"
                    : summary.closedTodayPctSum < 0
                      ? "text-rose-400"
                      : "",
                )}
              >
                {summary.closedTodayPctSum >= 0 ? "+" : ""}
                {summary.closedTodayPctSum.toFixed(2)}% today
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </div>
      </div>

      {/* Live candlestick chart for the featured pair */}
      <ChartHeader quote={featured} />
      <BotThinkingTicker />
      {showScalpDebug && scalpEvents.length > 0 && (
        <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-mono border-t bg-background/30 overflow-hidden">
          <span className="text-muted-foreground/60 shrink-0 tracking-wider font-semibold">
            SCALP
          </span>
          <div className="flex items-center gap-1.5 overflow-hidden">
            {scalpEvents.slice(0, 6).map((e) => (
              <span
                key={e.id}
                className={cn(
                  "px-1.5 py-0.5 rounded shrink-0 tabular-nums transition-opacity duration-300",
                  e.outcome === "SL"
                    ? "bg-rose-500/15 text-rose-400"
                    : "bg-emerald-500/15 text-emerald-400",
                )}
              >
                <span className="font-bold">{e.outcome}</span>
                <span className="opacity-70 mx-1">{e.bot}</span>
                <span className="font-semibold">
                  {e.pnlUsd >= 0 ? "+" : "−"}$
                  {Math.abs(e.pnlUsd).toFixed(2)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="p-2 sm:p-3">
        <LiveCandleChart
          quote={featured}
          persistKey={featuredCode}
          positions={chartPositions}
          height={260}
        />
      </div>

      {/* Live tape (synthetic Time & Sales for the featured pair) */}
      <LiveTapeStrip quote={featured} />

      {/* Open positions strip */}
      <PositionsStrip positions={positions} quotes={quotes} />

      {/* Bot plan + user share strip */}
      <div className="px-3 sm:px-4 py-2.5 border-t bg-background/40 text-[10px] sm:text-[11px] flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground flex-wrap">
          <TrendingUp className="size-3 text-emerald-400 shrink-0" />
          <span>Plan</span>
          {plan ? (
            <span className="font-mono tabular-nums text-foreground">
              {plan.executed}/{plan.totalSlots}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
          {plan?.nextSlot ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>next</span>
              <span className="font-mono text-foreground">
                {plan.nextSlot.pair} {plan.nextSlot.direction}
              </span>
              <span>in</span>
              <CountdownLabel to={plan.nextSlot.scheduledAt} />
            </>
          ) : plan ? (
            <span className="text-muted-foreground/60">· no upcoming slot</span>
          ) : null}
        </div>
        <div className="text-muted-foreground inline-flex items-center gap-1.5">
          <Sparkles className="size-3 text-amber-400 shrink-0" />
          <span>Your share today:</span>
          <span className="font-mono tabular-nums text-foreground">
            ${(userToday?.totalProfit ?? 0).toFixed(2)}
          </span>
          <span className="text-muted-foreground/60">
            ({userToday?.distributionsCount ?? 0})
          </span>
        </div>
      </div>
    </Card>
  );
}

// Suppress unused warning for formatPrice (kept for future re-use)
void formatPrice;
