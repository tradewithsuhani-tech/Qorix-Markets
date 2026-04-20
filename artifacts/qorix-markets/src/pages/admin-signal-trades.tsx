import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Plus, X, Activity, CheckCircle2,
  AlertTriangle, Clock, Users, DollarSign, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function authHeaders() {
  const t = localStorage.getItem("qorix_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function apiFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(path, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

type Trade = {
  id: number;
  pair: string;
  direction: "BUY" | "SELL";
  entryPrice: string;
  pipsTarget: string;
  pipSize: string;
  exitPrice: string;
  expectedProfitPercent: string;
  realizedProfitPercent: string | null;
  realizedExitPrice: string | null;
  status: "running" | "closed";
  closeReason: string | null;
  totalDistributed: string | null;
  affectedUsers: number | null;
  createdAt: string;
  closedAt: string | null;
};

const PAIR_DEFAULTS: Record<string, number> = {
  XAUUSD: 0.01, BTCUSD: 1, ETHUSD: 0.1,
  EURUSD: 0.0001, GBPUSD: 0.0001, USDJPY: 0.01,
};

export default function AdminSignalTradesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pair, setPair] = useState("XAUUSD");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [entryPrice, setEntryPrice] = useState("");
  const [pipsTarget, setPipsTarget] = useState("");
  const [profitPct, setProfitPct] = useState("");
  const [notes, setNotes] = useState("");

  const pipSize = PAIR_DEFAULTS[pair.toUpperCase()] ?? 0.0001;
  const previewExit = (() => {
    const e = parseFloat(entryPrice);
    const p = parseFloat(pipsTarget);
    if (!e || !p) return null;
    const move = p * pipSize;
    return direction === "BUY" ? e + move : e - move;
  })();

  const { data: runningData, refetch: refetchRunning } = useQuery({
    queryKey: ["admin-trades-running"],
    queryFn: () => apiFetch("/api/admin/signal-trades?status=running"),
    refetchInterval: 5000,
  });
  const { data: closedData } = useQuery({
    queryKey: ["admin-trades-closed"],
    queryFn: () => apiFetch("/api/admin/signal-trades?status=closed"),
    refetchInterval: 10000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/signal-trades", "POST", {
        pair,
        direction,
        entryPrice: parseFloat(entryPrice),
        pipsTarget: parseFloat(pipsTarget),
        pipSize,
        expectedProfitPercent: parseFloat(profitPct),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Trade created", description: `${pair} ${direction} signal opened` });
      setEntryPrice(""); setPipsTarget(""); setProfitPct(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["admin-trades-running"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeMut = useMutation({
    mutationFn: (vars: { id: number; pct?: number; manual?: boolean }) =>
      apiFetch(`/api/admin/signal-trades/${vars.id}/close`, "POST", {
        realizedProfitPercent: vars.pct,
        closeReason: vars.manual ? "manual" : "target_hit",
      }),
    onSuccess: (d: any) => {
      toast({
        title: "Trade closed",
        description: `Distributed $${Number(d.distributed).toFixed(2)} to ${d.users} users`,
      });
      qc.invalidateQueries({ queryKey: ["admin-trades-running"] });
      qc.invalidateQueries({ queryKey: ["admin-trades-closed"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const running: Trade[] = runningData?.trades ?? [];
  const closed: Trade[] = closedData?.trades ?? [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
            <Activity className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Signal Trades</h1>
            <p className="text-sm text-white/50">Create signals, close trades, distribute profit to all active traders.</p>
          </div>
        </div>

        {/* Create form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-white/10 bg-white/3 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Signal Trade
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Pair</label>
              <input
                type="text"
                value={pair}
                onChange={(e) => setPair(e.target.value.toUpperCase())}
                placeholder="XAUUSD"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
              />
              <div className="text-[10px] text-white/30 mt-1">pip size: {pipSize}</div>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Direction</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDirection("BUY")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    direction === "BUY"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> BUY
                </button>
                <button
                  onClick={() => setDirection("SELL")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    direction === "SELL"
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 inline mr-1" /> SELL
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="2380.50"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Pips Target</label>
              <input
                type="number"
                step="any"
                value={pipsTarget}
                onChange={(e) => setPipsTarget(e.target.value)}
                placeholder="50"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Expected Profit %</label>
              <input
                type="number"
                step="0.01"
                value={profitPct}
                onChange={(e) => setProfitPct(e.target.value)}
                placeholder="1.25"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="text-xs text-white/50 block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="London open breakout"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-white/50">
              {previewExit !== null && (
                <span>
                  Calculated exit: <span className="text-white/90 font-mono">{previewExit.toFixed(5)}</span>
                </span>
              )}
            </div>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !entryPrice || !pipsTarget || !profitPct}
              className="px-5 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-40 transition-colors text-sm font-medium flex items-center gap-2"
            >
              {createMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Open Signal
            </button>
          </div>
        </motion.div>

        {/* Running trades */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <Clock className="w-4 h-4" /> Running Trades ({running.length})
          </div>
          {running.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm border border-white/5 rounded-xl">No active signals</div>
          ) : (
            <div className="grid gap-2">
              {running.map((t) => (
                <RunningRow key={t.id} t={t} onClose={(pct, manual) => closeMut.mutate({ id: t.id, pct, manual })} closing={closeMut.isPending} />
              ))}
            </div>
          )}
        </div>

        {/* Closed history */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Recent Closed ({closed.length})
          </div>
          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-sm">
              <thead className="text-xs text-white/40 bg-white/3">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Pair</th>
                  <th className="text-left px-3 py-2">Dir</th>
                  <th className="text-right px-3 py-2">Entry</th>
                  <th className="text-right px-3 py-2">Exit</th>
                  <th className="text-right px-3 py-2">Realized %</th>
                  <th className="text-right px-3 py-2">Distributed</th>
                  <th className="text-right px-3 py-2">Users</th>
                  <th className="text-left px-3 py-2">Reason</th>
                  <th className="text-right px-3 py-2">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {closed.map((t) => (
                  <tr key={t.id} className="text-white/80">
                    <td className="px-3 py-2 text-white/40">{t.id}</td>
                    <td className="px-3 py-2 font-medium">{t.pair}</td>
                    <td className={`px-3 py-2 font-medium ${t.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{t.direction}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(t.entryPrice).toFixed(5)}</td>
                    <td className="px-3 py-2 text-right font-mono">{t.realizedExitPrice ? Number(t.realizedExitPrice).toFixed(5) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-mono ${parseFloat(t.realizedProfitPercent ?? "0") >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.realizedProfitPercent ? `${parseFloat(t.realizedProfitPercent).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">${Number(t.totalDistributed ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{t.affectedUsers ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-white/50">{t.closeReason ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs text-white/40">{t.closedAt ? new Date(t.closedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {closed.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-white/30">No closed trades yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function RunningRow({ t, onClose, closing }: { t: Trade; onClose: (pct?: number, manual?: boolean) => void; closing: boolean }) {
  const [override, setOverride] = useState("");
  return (
    <div className="border border-white/10 rounded-xl p-4 bg-white/3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${t.direction === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
          {t.direction}
        </div>
        <div className="font-medium text-white">{t.pair}</div>
        <div className="text-xs text-white/40">#{t.id}</div>
      </div>
      <div className="text-xs text-white/60 flex gap-3 flex-wrap">
        <span>Entry: <span className="text-white/90 font-mono">{Number(t.entryPrice).toFixed(5)}</span></span>
        <span>Target: <span className="text-white/90 font-mono">{Number(t.exitPrice).toFixed(5)}</span></span>
        <span>{t.pipsTarget} pips</span>
        <span className="text-emerald-300">{Number(t.expectedProfitPercent).toFixed(2)}%</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder="override %"
          className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
        />
        <button
          onClick={() => onClose(override ? parseFloat(override) : undefined, false)}
          disabled={closing}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/25 disabled:opacity-40"
        >
          Close @ Target
        </button>
        <button
          onClick={() => onClose(override ? parseFloat(override) : undefined, true)}
          disabled={closing || !override}
          className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/25 disabled:opacity-40"
          title="Force close with manual % (bypasses slippage check)"
        >
          <AlertTriangle className="w-3 h-3 inline mr-1" /> Manual
        </button>
      </div>
    </div>
  );
}
