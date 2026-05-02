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
// Live candlestick chart (Batch V)
// ---------------------------------------------------------------------------

const CANDLE_SECONDS = 5;
const MAX_CANDLES = 60; // 60 × 5s = 5 minutes rolling window
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
 * buckets. Each tick (every ~2s from the quotes poll) updates
 * the current bucket's high/low/close; a new bucket starts when
 * the wall clock crosses a CANDLE_SECONDS boundary.
 *
 * Uses BOTH quote.mid AND quote.asOf as deps so the effect fires
 * on every poll — even when mid happens to be unchanged we still
 * want the bucket-roll machinery to advance.
 */
function useCandleSeries(quote: BotQuote | undefined): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    if (!quote || !Number.isFinite(quote.mid)) return;
    const price = quote.mid;
    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSec / CANDLE_SECONDS) * CANDLE_SECONDS;

    setCandles((prev) => {
      const last = prev[prev.length - 1];
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
        return [...prev, fresh].slice(-MAX_CANDLES);
      }
      // Update current candle
      const updated: Candle = {
        ...last,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
        ticks: last.ticks + 1,
      };
      return [...prev.slice(0, -1), updated];
    });
  }, [quote?.mid, quote?.asOf]);

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
  height = 280,
}: {
  quote: BotQuote | undefined;
  height?: number;
}) {
  const candles = useCandleSeries(quote);
  const ema = useMemo(() => computeEma(candles, EMA_PERIOD), [candles]);
  const flash = useFlash(quote?.mid ?? 0, 350);

  // Auto-scaled price range with 8% padding so candles don't kiss
  // the top/bottom edges.
  const range = useMemo(() => {
    if (candles.length === 0) {
      return { min: (quote?.mid ?? 0) - 1, max: (quote?.mid ?? 0) + 1 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (quote?.mid && Number.isFinite(quote.mid)) {
      if (quote.mid < min) min = quote.mid;
      if (quote.mid > max) max = quote.mid;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      const center = Number.isFinite(min) ? min : (quote?.mid ?? 0);
      return { min: center - 1, max: center + 1 };
    }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, [candles, quote?.mid]);

  // SVG geometry — fixed viewBox, scales responsively via class
  const W = 800;
  const H = height;
  const padTop = 12;
  const padBottom = 22;
  const padRight = 78; // room for live price tag
  const padLeft = 8;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const slotW = chartW / MAX_CANDLES;
  const bodyW = Math.max(2, slotW * 0.65);

  const priceToY = (p: number) => {
    if (range.max === range.min) return padTop + chartH / 2;
    return padTop + ((range.max - p) / (range.max - range.min)) * chartH;
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
        {/* Grid lines */}
        <g stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.5">
          {[0.2, 0.4, 0.6, 0.8].map((f) => {
            const y = padTop + chartH * f;
            return (
              <line key={f} x1={padLeft} x2={padLeft + chartW} y1={y} y2={y} />
            );
          })}
          {[0.25, 0.5, 0.75].map((f) => {
            const x = padLeft + chartW * f;
            return (
              <line key={f} x1={x} x2={x} y1={padTop} y2={padTop + chartH} />
            );
          })}
        </g>

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

        {/* Right-side y-axis price ticks */}
        <g
          fill="currentColor"
          fillOpacity="0.5"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
            const p = range.max - (range.max - range.min) * f;
            const y = padTop + chartH * f;
            return (
              <text key={i} x={padLeft + chartW + 4} y={y + 3}>
                {p.toFixed(precision)}
              </text>
            );
          })}
        </g>

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
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12px] font-bold tracking-wider">
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
      <div className="flex items-center gap-3 text-[11px] tabular-nums">
        <span
          className={cn(
            "font-mono text-base font-semibold transition-colors duration-300",
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
      <span className="text-muted-foreground font-mono tabular-nums hidden sm:inline">
        {pos.entryPrice.toFixed(precision)}
        {quote ? (
          <>
            <span className="text-muted-foreground/50 px-1">→</span>
            {quote.mid.toFixed(precision)}
          </>
        ) : null}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums font-semibold rounded px-1.5 py-0.5",
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
    <div className="border-t bg-background/30 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
        <Zap className="size-3 text-amber-400" />
        <span>{positions.length} OPEN POSITIONS</span>
        <span className="ml-auto text-muted-foreground/50 italic font-normal normal-case tracking-normal">
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

export function BotTerminalCard() {
  const { data: quotesData } = useBotQuotes();
  const { data: state } = useBotState();

  const quotes = quotesData?.quotes ?? [];
  const xau = quotes.find((q) => q.code === "XAUUSD");
  const summary = state?.summary;
  const plan = state?.bot.plan;
  const userToday = state?.userToday;
  const positions = state?.openPositions ?? [];

  const fillToast = useFillToast(state?.closedToday);

  return (
    <Card className="overflow-hidden relative">
      <JustFilledToast fill={fillToast} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="size-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold tracking-wider truncate">
            BOT TERMINAL
          </span>
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 px-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2 shrink-0">
          {summary ? (
            <>
              <span>{summary.openCount} open</span>
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

      {/* Live XAU/USD candlestick chart */}
      <ChartHeader quote={xau} />
      <div className="p-3">
        <LiveCandleChart quote={xau} height={280} />
      </div>

      {/* Open positions strip */}
      <PositionsStrip positions={positions} quotes={quotes} />

      {/* Bot plan + user share strip */}
      <div className="px-4 py-2.5 border-t bg-background/40 text-[11px] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
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
