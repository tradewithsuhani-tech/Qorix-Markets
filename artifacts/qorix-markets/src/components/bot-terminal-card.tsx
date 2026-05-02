/**
 * BotTerminalCard — Batch T + Batch U (trading-feel upgrade)
 *
 * Dashboard widget for the Bot Trading Terminal. Layers:
 *
 *   1. Header strip       — LIVE pulse + open count + today realized %
 *   2. 4 ticker tiles     — XAU/EUR/BTC/OIL with tick-flash + sparkline
 *   3. Open positions     — horizontal scroller of bot's 25 active trades
 *                           with client-side live P/L
 *   4. Plan / share strip — slot progress + next-slot countdown +
 *                           the calling user's distribution share
 *   5. JUST-FILLED toast  — top-right banner whenever closedToday[]
 *                           grows (4s auto-dismiss, FOMO trigger)
 *
 * Data sources:
 *   - useBotQuotes()  -> public, 2s poll, drives tickers + live P/L
 *   - useBotState()   -> auth, 5s poll, drives positions/plan/share/toast
 *
 * The card stays useful for logged-out visitors: quotes are public so
 * the 4 tiles always render. State silently 401s and the bot strips
 * show graceful "—" placeholders.
 *
 * All animations are pure-frontend, derived from existing data — no
 * extra backend calls.
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

/**
 * Brief "tick-flash" hint: returns "up"/"down" for ~400ms after the
 * passed numeric value changes. Used to flash the ticker tile
 * background green/red on every quote tick — the signature
 * Bloomberg/MT5 visual cue.
 */
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

/**
 * Counts down to a future ISO timestamp ("in 2m 22s" / "in 14s" /
 * "now"). Updates once per second via a single tab-scoped interval.
 */
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
// Sparkline
// ---------------------------------------------------------------------------

const HISTORY_LEN = 30;
const SPARK_W = 60;
const SPARK_H = 18;

/**
 * Per-pair circular buffer of recent mid prices, fed from the live
 * quote stream. Yields {pair -> number[]} ready to drop into a
 * Sparkline. Skips no-op ticks where mid is unchanged so the
 * sparkline doesn't flatten artificially during low-volatility
 * windows.
 */
function usePriceHistory(quotes: BotQuote[] | undefined) {
  const [hist, setHist] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!quotes || quotes.length === 0) return;
    setHist((prev) => {
      const next = { ...prev };
      let dirty = false;
      for (const q of quotes) {
        const arr = next[q.code] ?? [];
        if (arr.length === 0 || arr[arr.length - 1] !== q.mid) {
          next[q.code] = [...arr, q.mid].slice(-HISTORY_LEN);
          dirty = true;
        }
      }
      return dirty ? next : prev;
    });
  }, [quotes]);
  return hist;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <svg width={SPARK_W} height={SPARK_H} className="opacity-40" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = SPARK_W / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = SPARK_H - 1 - ((v - min) / range) * (SPARK_H - 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={SPARK_W} height={SPARK_H} className="opacity-80 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Ticker tile (with flash + sparkline)
// ---------------------------------------------------------------------------

function TickerTile({ q, history }: { q: BotQuote; history: number[] }) {
  const flash = useFlash(q.mid);
  const change = q.change24h;
  const isUp = change > 0;
  const isFlat = change === 0;
  const sparkColor = isUp ? "#34d399" : isFlat ? "#94a3b8" : "#fb7185";

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/50 p-3 flex flex-col gap-1.5 min-w-0 transition-colors duration-300",
        flash === "up" && "bg-emerald-500/15 border-emerald-500/40",
        flash === "down" && "bg-rose-500/15 border-rose-500/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground truncate">
          {q.display}
        </span>
        {q.marketOpen ? (
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
      </div>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="font-mono text-base font-semibold tabular-nums truncate">
          {formatPrice(q.mid, q.precision)}
        </div>
        <Sparkline values={history} color={sparkColor} />
      </div>
      <div className="flex items-center justify-between text-[11px] gap-2">
        <span
          className={cn(
            "font-mono tabular-nums inline-flex items-center gap-0.5",
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
        <span className="text-muted-foreground tabular-nums shrink-0">
          {q.spreadPips}p
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
  // Live P/L computed client-side from the quote stream so the pill
  // ticks at 2s cadence rather than the 5s state-poll cadence — it's
  // the single biggest contributor to the "trading terminal feel"
  // because user sees the number wiggle on every quote refresh.
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

/**
 * Watches closedToday[] and emits a 4-second toast every time a new
 * trade ID appears. Skips the initial load (we don't want to spam
 * 25 toasts on first render). Only the latest unseen fill is shown
 * — if multiple trades close in the same 5s window, the rest are
 * silently marked as seen.
 */
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
        // Last-wins: if backend ordering puts most recent at the
        // start of the array we still pick the right one because we
        // overwrite on each unseen-id sighting.
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
  const { data: quotesData, isLoading: quotesLoading } = useBotQuotes();
  const { data: state } = useBotState();

  const quotes = quotesData?.quotes ?? [];
  const summary = state?.summary;
  const plan = state?.bot.plan;
  const userToday = state?.userToday;
  const positions = state?.openPositions ?? [];

  const history = usePriceHistory(quotes);
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

      {/* 4 ticker tiles */}
      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {quotesLoading || quotes.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border bg-background/50 p-3 h-[88px] animate-pulse"
              />
            ))
          : quotes.map((q) => (
              <TickerTile key={q.code} q={q} history={history[q.code] ?? []} />
            ))}
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
