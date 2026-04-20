import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
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

export default function TradeActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["trades-activity"],
    queryFn: () => apiFetch("/api/investment/trades?limit=100"),
    refetchInterval: 15000,
  });

  const personalTrades: Trade[] = Array.isArray(data) ? data : [];

  // Platform-wide fallback so the page is never empty while signals are running.
  // Only queried when the user has no personal trades yet.
  const { data: recentData } = useQuery<{ trades: SignalRecent[] }>({
    queryKey: ["signal-trades-recent-activity"],
    queryFn: async () => {
      const res = await fetch("/api/signal-trades/recent");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !isLoading && personalTrades.length === 0,
    refetchInterval: 15000,
  });

  const usingPlatformFallback = personalTrades.length === 0 && (recentData?.trades?.length ?? 0) > 0;

  const trades: Trade[] = personalTrades.length > 0
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

  const totalPL = trades.reduce((s, t) => s + t.profit, 0);
  const wins = trades.filter((t) => (usingPlatformFallback ? t.profitPercent : t.profit) > 0).length;
  const losses = trades.filter((t) => (usingPlatformFallback ? t.profitPercent : t.profit) < 0).length;

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
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Total P/L</div>
              <div className={`text-lg font-bold ${totalPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {usingPlatformFallback && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200/90">
            You have no personal trades yet. Listed below are the platform's recent signal trades for reference. Your own executions will appear here once you fund your trading wallet.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total Trades" value={String(trades.length)} />
          <Stat label="Winners" value={String(wins)} tint="emerald" />
          <Stat label="Losers" value={String(losses)} tint="rose" />
          <Stat label="Win Rate" value={trades.length ? `${((wins / trades.length) * 100).toFixed(0)}%` : "0%"} tint="blue" />
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

          {isLoading ? (
            <div className="py-16 text-center text-sm text-white/30">Loading trades…</div>
          ) : trades.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-10 h-10 mx-auto text-white/20 mb-3" />
              <div className="text-sm text-white/50">No trades yet</div>
              <div className="text-xs text-white/30 mt-1">Your executed signal trades will appear here</div>
            </div>
          ) : (
            trades.map((t, i) => {
              const meta = findPair(t.symbol);
              const dp = meta ? (meta.pipSize < 0.01 ? 5 : 3) : 4;
              const pnlCls = t.profit >= 0 ? "text-emerald-400" : "text-red-400";
              return (
                <div
                  key={t.id}
                  className={`grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1.2fr_1.2fr_1fr_1fr] items-center gap-y-2 px-5 py-3 ${
                    i < trades.length - 1 ? "border-b border-white/[0.04]" : ""
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
