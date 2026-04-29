import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageContainer } from "@/components/page-container";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

async function apiFetch(path: string) {
  return authFetch(path);
}

type HistoryItem = {
  id: number;
  tradeId: number;
  profitAmount: string;
  shareBasis: string;
  createdAt: string;
  pair: string;
  direction: "BUY" | "SELL";
  realizedProfitPercent: string | null;
  entryPrice: string;
  realizedExitPrice: string | null;
};

export default function SignalHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["signal-history"],
    queryFn: () => apiFetch("/api/signal-trades/history"),
    refetchInterval: 15000,
  });

  const history: HistoryItem[] = data?.history ?? [];
  const totalProfit = history.reduce((s, h) => s + parseFloat(h.profitAmount), 0);

  return (
    <Layout>
      <PageContainer maxWidth="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
            <Activity className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Trade History</h1>
            <p className="text-sm text-white/50">Your share of every closed signal trade.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="Total Trades" value={history.length.toString()} />
          <Stat label="Total Profit" value={`$${totalProfit.toFixed(2)}`} accent />
          <Stat label="Avg / Trade" value={history.length ? `$${(totalProfit / history.length).toFixed(2)}` : "$0.00"} />
        </div>

        <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/3">
          {isLoading ? (
            <div className="text-center py-10 text-white/40 text-sm">Loading…</div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">No trades yet — once admin closes a signal you'll see your share here.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {history.map((h) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/3"
                >
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${h.direction === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                    {h.direction === "BUY" ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                    {h.direction}
                  </div>
                  <div className="font-medium text-white">{h.pair}</div>
                  <div className="text-xs text-white/40 font-mono">#{h.tradeId}</div>
                  <div className="text-xs text-white/50 hidden sm:block">
                    {Number(h.entryPrice).toFixed(5)} → {h.realizedExitPrice ? Number(h.realizedExitPrice).toFixed(5) : "—"}
                  </div>
                  <div className={`text-xs font-mono ml-auto ${parseFloat(h.realizedProfitPercent ?? "0") >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {h.realizedProfitPercent ? `${parseFloat(h.realizedProfitPercent).toFixed(2)}%` : "—"}
                  </div>
                  <div className="text-sm font-semibold text-white tabular-nums w-24 text-right">
                    +${parseFloat(h.profitAmount).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-white/30 w-32 text-right">{new Date(h.createdAt).toLocaleString()}</div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </Layout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-white/10 bg-white/3 rounded-xl p-4">
      <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? "text-emerald-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
