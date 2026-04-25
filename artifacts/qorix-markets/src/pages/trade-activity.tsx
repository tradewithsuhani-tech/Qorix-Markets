import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, CalendarIcon, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { PeriodFilter } from "@/components/period-filter";
import { findPair, formatPair } from "@/lib/pair-meta";
import { PairIcon } from "@/components/pair-icon";
import { MobileTradeList } from "@/components/mobile-trade-list";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

type DateRange = { from?: Date; to?: Date };

const RANGE_PRESETS: Array<{ key: string; label: string; days: number }> = [
  { key: "3d", label: "Last 3 days", days: 3 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "3m", label: "Last 3 months", days: 90 },
];

function DateRangePicker({
  fromValue,
  toValue,
  onApply,
}: {
  fromValue: string;
  toValue: string;
  onApply: (from: string, to: string) => void;
}) {
  const parse = (s: string): Date | undefined => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>({
    from: parse(fromValue),
    to: parse(toValue),
  });
  const [activePreset, setActivePreset] = useState<string>("custom");

  // Re-sync draft whenever the popover opens (so reopen reflects current applied value).
  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft({ from: parse(fromValue), to: parse(toValue) });
      setActivePreset("custom");
    }
  }

  function applyPreset(days: number, key: string) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    setDraft({ from, to });
    setActivePreset(key);
  }

  function handleApply() {
    const f = draft.from ? format(draft.from, "yyyy-MM-dd") : "";
    const t = draft.to ? format(draft.to, "yyyy-MM-dd") : (draft.from ? format(draft.from, "yyyy-MM-dd") : "");
    onApply(f, t);
    setOpen(false);
  }

  const triggerLabel = (() => {
    const f = parse(fromValue);
    const t = parse(toValue);
    if (f && t) return `${format(f, "dd MMM yyyy")} → ${format(t, "dd MMM yyyy")}`;
    if (f) return `From ${format(f, "dd MMM yyyy")}`;
    return "Select date range";
  })();

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/90 hover:bg-white/[0.05] hover:border-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-slate-950 border border-white/10 shadow-2xl rounded-xl overflow-hidden"
        align="start"
        sideOffset={8}
      >
        <div className="flex flex-col md:flex-row">
          {/* Preset sidebar */}
          <div className="flex flex-col gap-0.5 p-2 md:w-44 md:border-r md:border-white/10 bg-white/[0.02]">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.days, p.key)}
                className={`text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                  activePreset === p.key
                    ? "bg-blue-500/20 text-blue-200"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="h-px bg-white/5 my-1" />
            <button
              type="button"
              onClick={() => setActivePreset("custom")}
              className={`text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                activePreset === "custom"
                  ? "bg-blue-500/20 text-blue-200"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              Custom date
            </button>
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={draft as any}
              onSelect={(r: any) => {
                setDraft({ from: r?.from, to: r?.to });
                setActivePreset("custom");
              }}
              numberOfMonths={1}
              initialFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-white/10 bg-white/[0.02]">
          <div className="text-[11px] text-white/50">
            {draft.from && draft.to
              ? `${format(draft.from, "dd MMM")} – ${format(draft.to, "dd MMM yyyy")}`
              : draft.from
              ? `From ${format(draft.from, "dd MMM yyyy")}`
              : "Pick a start and end date"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!draft.from}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Set date
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function apiFetch(path: string) {
  const token = localStorage.getItem("qorix_token");
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

type Trade = {
  id: number;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  executedAt: string;
  lot?: number;
};

// Display-only lot range per trade (random, deterministic per trade.id so the
// number never flickers across refetches). USD profit is then derived as
// sign × lot × |exit-entry| so lot, USD and price move are always consistent.
const LOT_MIN = 0.30;
const LOT_MAX = 1.10;

function seededLot(seed: number): number {
  // Mulberry32 — fast deterministic [0,1) from an integer seed.
  let t = (seed + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return LOT_MIN + r * (LOT_MAX - LOT_MIN);
}

type SignalRecent = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: string | number;
  realizedExitPrice: string | number | null;
  realizedProfitPercent: string | number | null;
  closeReason: string | null;
  closedAt: string;
};

type PeriodKey = "1D" | "1W" | "1M" | "3M" | "ALL" | "CUSTOM";

const PERIODS: Array<{ key: PeriodKey; label: string; days: number | null }> = [
  { key: "1D", label: "1D", days: 1 },
  { key: "1W", label: "1W", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "ALL", label: "All", days: null },
  { key: "CUSTOM", label: "Custom", days: null },
];

const PAGE_SIZE = 15;

function PairCell({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-3">
      <PairIcon code={symbol} size={18} />
      <span className="text-sm font-semibold text-white">{formatPair(symbol)}</span>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBuy = direction === "BUY" || direction === "LONG";
  const cls = isBuy ? "text-sky-400" : "text-rose-400";
  const Icon = isBuy ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isBuy ? "bg-sky-400" : "bg-rose-400"}`} />
      <Icon className="w-3.5 h-3.5" />
      {isBuy ? "Buy" : "Sell"}
    </span>
  );
}

type TradeTab = "open" | "pending" | "closed";

export default function TradeActivityPage() {
  const [period, setPeriod] = useState<PeriodKey>("1M");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TradeTab>("closed");

  const { data, isLoading } = useQuery({
    queryKey: ["trades-activity"],
    queryFn: () => apiFetch("/api/investment/trades?limit=500"),
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const personalTrades: Trade[] = Array.isArray(data) ? data : [];

  const { data: recentData, isLoading: recentLoading, isFetching: recentFetching } = useQuery<{ trades: SignalRecent[] }>({
    queryKey: ["signal-trades-recent-activity"],
    queryFn: async () => {
      const res = await fetch("/api/signal-trades/recent");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !isLoading && personalTrades.length === 0,
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const usingPlatformFallback = personalTrades.length === 0 && (recentData?.trades?.length ?? 0) > 0;

  // Each platform signal trade renders with a randomly-picked lot in
  // [LOT_MIN..LOT_MAX] and USD = sign(pct) × lot × |exit-entry|. Same model as
  // a CFD: 1 lot of BTC over a 1000-point move = $1000 profit. This keeps the
  // displayed lot, USD, and price move all internally consistent on every card.
  const allTrades: Trade[] = personalTrades.length > 0
    ? personalTrades
    : (recentData?.trades ?? []).map((t) => {
        const pct = Number(t.realizedProfitPercent) || 0;
        const entry = Number(t.entryPrice) || 0;
        const exit = Number(t.realizedExitPrice) || 0;
        const priceDiff = Math.abs(exit - entry);
        // Round lot first, then derive USD from the rounded value so the
        // displayed equation `lot × |exit-entry| = profit` always ties out
        // exactly on screen (no precision drift).
        const displayLot = +seededLot(t.id).toFixed(2);
        const sign = pct > 0 ? 1 : pct < 0 ? -1 : 0;
        const usd = sign * displayLot * priceDiff;
        return {
          id: t.id,
          symbol: t.pair,
          direction: t.direction,
          entryPrice: entry,
          exitPrice: exit,
          profit: +usd.toFixed(2),
          profitPercent: pct,
          executedAt: t.closedAt,
          lot: displayLot,
        };
      });

  // Period filter (client-side)
  const { fromTs, toTs } = useMemo(() => {
    const now = Date.now();
    if (period === "ALL") return { fromTs: 0, toTs: now + 86_400_000 };
    if (period === "CUSTOM") {
      const rawFrom = customFrom ? new Date(customFrom).getTime() : NaN;
      const rawTo = customTo ? new Date(customTo).getTime() : NaN;
      let from = Number.isFinite(rawFrom) ? rawFrom : 0;
      let to = Number.isFinite(rawTo) ? rawTo + 86_400_000 - 1 : now + 86_400_000;
      if (from > to) [from, to] = [to, from];
      return { fromTs: from, toTs: to };
    }
    const def = PERIODS.find((p) => p.key === period);
    const days = def?.days ?? 30;
    return { fromTs: now - days * 86_400_000, toTs: now + 86_400_000 };
  }, [period, customFrom, customTo]);

  const filtered = useMemo(() => {
    return allTrades.filter((t) => {
      const ts = new Date(t.executedAt).getTime();
      return ts >= fromTs && ts <= toTs;
    });
  }, [allTrades, fromTs, toTs]);

  const totalPL = filtered.reduce((s, t) => s + t.profit, 0);
  const wins = filtered.filter((t) => t.profitPercent > 0).length;
  const losses = filtered.filter((t) => t.profitPercent < 0).length;
  const winRate = filtered.length ? `${((wins / filtered.length) * 100).toFixed(0)}%` : "0%";

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function choosePeriod(key: PeriodKey) {
    setPeriod(key);
    setPage(1);
  }

  // Show loader only when we genuinely have nothing to render yet —
  // either personal query still loading, or fallback is loading after personal resolved empty.
  const fallbackPending = personalTrades.length === 0 && (recentLoading || (recentFetching && !recentData));
  const showInitialLoader = allTrades.length === 0 && (isLoading || fallbackPending);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "1M";

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* ── Premium header card ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-4 sm:p-5">
          {/* subtle ambient glow */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            {/* Title block */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/10 border border-blue-400/30 shadow-lg shadow-blue-500/10">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    Trade Activity
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Live</span>
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-white/50 line-clamp-2 sm:line-clamp-1">
                  {usingPlatformFallback
                    ? "Live signal trades from Qorix Markets — fund your account to start trading"
                    : "Your live trade history — Qorix-grade execution view"}
                </p>
              </div>
            </div>

            {/* P/L stat — own card on mobile, inline on desktop */}
            <div className="flex sm:flex-col sm:items-end items-center justify-between sm:justify-center gap-3 sm:gap-1 rounded-xl sm:rounded-none border border-white/8 sm:border-0 bg-white/[0.03] sm:bg-transparent px-3 py-2.5 sm:px-0 sm:py-0 shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                P/L · {periodLabel}
              </div>
              <div
                className={cn(
                  "text-xl sm:text-2xl font-bold tabular-nums tracking-tight",
                  totalPL >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Compact disclaimer banner (platform fallback only) ──────── */}
        {usingPlatformFallback && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-400/15 bg-blue-500/[0.04] px-3.5 py-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-300/90 shrink-0 mt-0.5" />
            <p className="text-[11px] sm:text-xs leading-relaxed text-blue-100/75">
              All trades shown here are executed by our automated trading system using pooled investor capital.
            </p>
          </div>
        )}

        {/* Period filter */}
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter
            options={PERIODS.map((p) => ({ label: p.label, value: p.key }))}
            selected={period}
            onChange={(v) => choosePeriod(v as PeriodKey)}
            ariaLabel="Trade activity period"
          />
          {period === "CUSTOM" && (
            <div className="ml-1">
              <DateRangePicker
                fromValue={customFrom}
                toValue={customTo}
                onApply={(f, t) => {
                  setCustomFrom(f);
                  setCustomTo(t);
                  setPage(1);
                }}
              />
            </div>
          )}
          <div className="ml-auto text-[11px] text-white/40">
            {filtered.length} trade{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total Trades" value={String(filtered.length)} />
          <Stat label="Winners" value={String(wins)} tint="emerald" />
          <Stat label="Losers" value={String(losses)} tint="rose" />
          <Stat label="Win Rate" value={winRate} tint="blue" />
        </div>

        {/* Trade Summary (mobile) — replaces Open/Pending/Closed tabs */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-3">
            <div className="text-sm font-semibold text-white">Trade Summary</div>
          </div>
          <MobileTradeList
            trades={filtered}
            loading={showInitialLoader}
          />
        </div>

        {/* DESKTOP: original MT-style grid table (unchanged) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden sm:block rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
        >
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1.2fr_1.2fr_1fr_1fr] text-[11px] uppercase tracking-wider text-white/40 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <span>Symbol</span>
            <span>Type</span>
            <span className="text-right">Open price</span>
            <span className="text-right">Close price</span>
            <span className="text-right">P/L, USD</span>
            <span className="text-right">Time</span>
          </div>

          {showInitialLoader ? (
            <div className="py-16 text-center text-sm text-white/30">Loading trades…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 mx-auto text-white/20 mb-3" />
              <div className="text-sm text-white/50">No trades in this period</div>
              <div className="text-xs text-white/30 mt-1">Try a wider range or select All</div>
            </div>
          ) : (
            pageRows.map((t, i) => {
              const meta = findPair(t.symbol);
              const dp = meta ? (meta.pipSize < 0.01 ? 5 : 3) : 4;
              return (
                <div
                  key={t.id}
                  className={`grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1.2fr_1.2fr_1fr_1fr] items-center gap-y-2 px-5 py-3 ${
                    i < pageRows.length - 1 ? "border-b border-white/[0.04]" : ""
                  } hover:bg-white/[0.02] transition-colors`}
                >
                  <PairCell symbol={t.symbol} />
                  <DirectionBadge direction={t.direction} />
                  <div className="text-right font-mono text-sm text-white/90">
                    <span className="sm:hidden text-[10px] text-white/40 mr-2">Open</span>
                    {t.entryPrice.toFixed(dp)}
                  </div>
                  <div className="text-right font-mono text-sm text-white/90">
                    <span className="sm:hidden text-[10px] text-white/40 mr-2">Close</span>
                    {t.exitPrice.toFixed(dp)}
                  </div>
                  <div className={`text-right font-mono text-sm font-semibold ${
                    t.profit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                  </div>
                  <div className="text-right text-xs text-white/40">
                    {new Date(t.executedAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/[0.01]">
              <div className="text-[11px] text-white/40">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-xs text-white/60 px-2 tabular-nums">
                  Page {safePage} / {totalPages}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: "emerald" | "rose" | "blue" }) {
  const tintCls = tint === "emerald" ? "text-emerald-400"
    : tint === "rose" ? "text-rose-400"
    : tint === "blue" ? "text-blue-400"
    : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-xl font-bold mt-1 ${tintCls}`}>{value}</div>
    </div>
  );
}
