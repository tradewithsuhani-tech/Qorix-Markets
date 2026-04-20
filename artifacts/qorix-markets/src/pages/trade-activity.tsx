import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Layout } from "@/components/layout";
import { findPair, formatPair } from "@/lib/pair-meta";
import { PairIcon } from "@/components/pair-icon";

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
};

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

export default function TradeActivityPage() {
  const [period, setPeriod] = useState<PeriodKey>("1M");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [page, setPage] = useState(1);

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

  const allTrades: Trade[] = personalTrades.length > 0
    ? personalTrades
    : (recentData?.trades ?? []).map((t) => ({
        id: t.id,
        symbol: t.pair,
        direction: t.direction,
        entryPrice: Number(t.entryPrice) || 0,
        exitPrice: Number(t.realizedExitPrice) || 0,
        profit: 0,
        profitPercent: Number(t.realizedProfitPercent) || 0,
        executedAt: t.closedAt,
      }));

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
  const totalPctAvg = filtered.length > 0
    ? filtered.reduce((s, t) => s + (t.profitPercent || 0), 0) / filtered.length
    : 0;
  const wins = filtered.filter((t) => (usingPlatformFallback ? t.profitPercent : t.profit) > 0).length;
  const losses = filtered.filter((t) => (usingPlatformFallback ? t.profitPercent : t.profit) < 0).length;
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30">
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Trade Activity</h1>
            <p className="text-sm text-white/50">
              {usingPlatformFallback
                ? "Showing recent platform signal trades — deposit to start participating"
                : "All your executed signal trades — live MT-style terminal view"}
            </p>
          </div>
          {!usingPlatformFallback && (
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                P/L ({PERIODS.find((p) => p.key === period)?.label})
              </div>
              <div className={`text-lg font-bold ${totalPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}
              </div>
            </div>
          )}
          {usingPlatformFallback && (
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                Avg P/L ({PERIODS.find((p) => p.key === period)?.label})
              </div>
              <div className={`text-lg font-bold ${totalPctAvg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalPctAvg >= 0 ? "+" : ""}{totalPctAvg.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {usingPlatformFallback && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200/90">
            You have no personal trades yet. Listed below are the platform's recent signal trades for reference. Your own executions will appear here once you fund your trading wallet.
          </div>
        )}

        {/* Period filter */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => choosePeriod(p.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 border ${
                period === p.key
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  : "text-white/60 hover:text-white hover:bg-white/5 border-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === "CUSTOM" && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-blue-500/40"
              />
              <span className="text-white/40 text-xs">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-blue-500/40"
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

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
        >
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1.2fr_1.2fr_1fr_1fr] text-[11px] uppercase tracking-wider text-white/40 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <span>Symbol</span>
            <span>Type</span>
            <span className="text-right">Open price</span>
            <span className="text-right">Close price</span>
            <span className="text-right">{usingPlatformFallback ? "P/L, %" : "P/L, USD"}</span>
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
                    (usingPlatformFallback ? t.profitPercent : t.profit) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {usingPlatformFallback
                      ? `${t.profitPercent >= 0 ? "+" : ""}${t.profitPercent.toFixed(2)}%`
                      : `${t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}`}
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
