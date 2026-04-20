import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Plus, Activity, CheckCircle2,
  Target, ShieldAlert, X, Clock, RefreshCw, FileText, ChevronDown, ChevronUp,
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
  tpPrice: string | null;
  slPrice: string | null;
  pipsTarget: string;
  pipSize: string;
  exitPrice: string;
  expectedProfitPercent: string;
  realizedProfitPercent: string | null;
  realizedExitPrice: string | null;
  status: "running" | "closing" | "closed";
  closeReason: string | null;
  totalDistributed: string | null;
  affectedUsers: number | null;
  notes: string | null;
  scheduledAt: string | null;
  createdAt: string;
  closedAt: string | null;
};

import { PAIRS, PAIR_BY_CODE } from "@/lib/pair-meta";

const PAIR_DEFAULTS: Record<string, number> = Object.fromEntries(PAIRS.map(p => [p.code, p.pipSize]));

export default function AdminSignalTradesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [pair, setPair] = useState("XAUUSD");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [entryPrice, setEntryPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const pipSize = PAIR_DEFAULTS[pair.toUpperCase()] ?? 0.0001;

  // Auto-derive expected profit % from TP price move (no manual input needed)
  const derivedProfitPct = (() => {
    const e = parseFloat(entryPrice);
    const t = parseFloat(tpPrice);
    if (!e || !t || e <= 0) return 0;
    const move = direction === "BUY" ? (t - e) / e : (e - t) / e;
    return move > 0 ? +(move * 100).toFixed(4) : 0;
  })();

  const { data: runningData } = useQuery({
    queryKey: ["admin-trades-running"],
    queryFn: () => apiFetch("/api/admin/signal-trades?status=running"),
    refetchInterval: 4000,
  });
  const { data: closedData } = useQuery({
    queryKey: ["admin-trades-closed"],
    queryFn: () => apiFetch("/api/admin/signal-trades?status=closed"),
    refetchInterval: 8000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/signal-trades", "POST", {
        pair, direction,
        entryPrice: parseFloat(entryPrice),
        tpPrice: tpPrice ? parseFloat(tpPrice) : undefined,
        slPrice: slPrice ? parseFloat(slPrice) : undefined,
        pipSize,
        expectedProfitPercent: derivedProfitPct,
        scheduledAt: scheduledAt || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Trade opened", description: `${pair} ${direction} signal is live` });
      setEntryPrice(""); setTpPrice(""); setSlPrice(""); setScheduledAt("");
      qc.invalidateQueries({ queryKey: ["admin-trades-running"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const tpMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/signal-trades/${id}/tp`, "POST"),
    onSuccess: (d: any) => { toast({ title: "TP HIT", description: `+$${Number(d.distributed).toFixed(2)} → ${d.users} users` }); qc.invalidateQueries(); },
    onError: (e: any) => toast({ title: "TP failed", description: e.message, variant: "destructive" }),
  });
  const slMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/signal-trades/${id}/sl`, "POST"),
    onSuccess: (d: any) => { toast({ title: "SL HIT", description: `${Number(d.distributed).toFixed(2)} loss applied to ${d.users} users` }); qc.invalidateQueries(); },
    onError: (e: any) => toast({ title: "SL failed", description: e.message, variant: "destructive" }),
  });
  const manualMut = useMutation({
    mutationFn: (vars: { id: number; pct: number }) =>
      apiFetch(`/api/admin/signal-trades/${vars.id}/close`, "POST", { realizedProfitPercent: vars.pct, closeReason: "manual" }),
    onSuccess: (d: any) => { toast({ title: "Manual close", description: `${Number(d.distributed).toFixed(2)} distributed` }); qc.invalidateQueries(); },
    onError: (e: any) => toast({ title: "Close failed", description: e.message, variant: "destructive" }),
  });

  const running: Trade[] = runningData?.trades ?? [];
  const closed: Trade[] = closedData?.trades ?? [];

  const totalRealizedToday = closed
    .filter((t) => t.closedAt && new Date(t.closedAt).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + parseFloat(t.totalDistributed ?? "0"), 0);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
            <Activity className="w-6 h-6 text-violet-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Signal Trade Control</h1>
            <p className="text-sm text-white/50">Manual trading control — TP / SL / Manual close with double-entry distribution.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Today distributed</div>
            <div className={`text-lg font-bold ${totalRealizedToday >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              ${totalRealizedToday.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Create form */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="border border-white/10 bg-white/3 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Plus className="w-4 h-4" /> Open New Trade
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label={`Pair (pip ${pipSize})`}>
              <div className="grid grid-cols-2 gap-2">
                {PAIRS.map((p) => {
                  const active = pair === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setPair(p.code)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        active
                          ? "bg-blue-500/15 border-blue-500/50 text-white"
                          : "bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.04] hover:border-white/20"
                      }`}
                    >
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm shrink-0"
                        style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}
                      >
                        {p.icon}
                      </span>
                      <span className="text-sm font-semibold">{p.display}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Direction">
              <div className="flex gap-2">
                <button onClick={() => setDirection("BUY")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    direction === "BUY" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/5 border-white/10 text-white/60"
                  }`}>
                  <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> BUY
                </button>
                <button onClick={() => setDirection("SELL")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    direction === "SELL" ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-white/5 border-white/10 text-white/60"
                  }`}>
                  <TrendingDown className="w-3.5 h-3.5 inline mr-1" /> SELL
                </button>
              </div>
            </Field>

            <Field label="Entry Price">
              <input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="2380.50" className={inputCls} />
            </Field>

            <Field label={<><Target className="w-3 h-3 inline mr-1 text-emerald-400" /> TP Price</>}>
              <input type="number" step="any" value={tpPrice} onChange={(e) => setTpPrice(e.target.value)} placeholder={direction === "BUY" ? "above entry" : "below entry"} className={inputCls} />
              {tpPrice && entryPrice && (
                <div className="text-[10px] text-emerald-300/80 mt-1 font-mono">
                  ≈ {(Math.abs(parseFloat(tpPrice) - parseFloat(entryPrice)) / pipSize).toFixed(1)} pips
                </div>
              )}
            </Field>

            <Field label={<><ShieldAlert className="w-3 h-3 inline mr-1 text-red-400" /> SL Price</>}>
              <input type="number" step="any" value={slPrice} onChange={(e) => setSlPrice(e.target.value)} placeholder={direction === "BUY" ? "below entry" : "above entry"} className={inputCls} />
              {slPrice && entryPrice && (
                <div className="text-[10px] text-red-300/80 mt-1 font-mono">
                  ≈ {(Math.abs(parseFloat(entryPrice) - parseFloat(slPrice)) / pipSize).toFixed(1)} pips
                </div>
              )}
            </Field>

            <Field label="Date & Time (optional)">
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <PreviewBar entry={parseFloat(entryPrice)} tp={parseFloat(tpPrice)} sl={parseFloat(slPrice)} pipSize={pipSize} pct={derivedProfitPct} />
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !entryPrice || !tpPrice}
              className="px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-40 transition-colors text-sm font-medium flex items-center gap-2">
              {createMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Open Trade
            </button>
          </div>
        </motion.div>

        {/* Running */}
        <Section icon={<Clock className="w-4 h-4" />} title={`Running (${running.length})`}>
          {running.length === 0 ? (
            <Empty>No active signals — open one above.</Empty>
          ) : (
            <div className="grid gap-2">
              {running.map((t) => (
                <RunningCard key={t.id} t={t}
                  onTP={() => tpMut.mutate(t.id)}
                  onSL={() => slMut.mutate(t.id)}
                  onManual={(pct) => manualMut.mutate({ id: t.id, pct })}
                  busy={tpMut.isPending || slMut.isPending || manualMut.isPending}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Closed */}
        <Section icon={<CheckCircle2 className="w-4 h-4" />} title={`Closed (${closed.length})`}>
          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-sm">
              <thead className="text-xs text-white/40 bg-white/3">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Pair</th>
                  <th className="text-left px-3 py-2">Dir</th>
                  <th className="text-right px-3 py-2">Entry</th>
                  <th className="text-right px-3 py-2">Exit</th>
                  <th className="text-right px-3 py-2">PnL %</th>
                  <th className="text-right px-3 py-2">Distributed</th>
                  <th className="text-right px-3 py-2">Users</th>
                  <th className="text-left px-3 py-2">Outcome</th>
                  <th className="text-right px-3 py-2">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {closed.map((t) => {
                  const pct = parseFloat(t.realizedProfitPercent ?? "0");
                  return (
                    <tr key={t.id} className="text-white/80">
                      <td className="px-3 py-2 text-white/40">{t.id}</td>
                      <td className="px-3 py-2 font-medium">{t.pair}</td>
                      <td className={`px-3 py-2 font-medium ${t.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{t.direction}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{Number(t.entryPrice).toFixed(5)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{t.realizedExitPrice ? Number(t.realizedExitPrice).toFixed(5) : "—"}</td>
                      <td className={`px-3 py-2 text-right font-mono ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pct.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-mono">${Number(t.totalDistributed ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{t.affectedUsers ?? 0}</td>
                      <td className="px-3 py-2 text-xs"><OutcomeBadge reason={t.closeReason} /></td>
                      <td className="px-3 py-2 text-right text-[10px] text-white/40">{t.closedAt ? new Date(t.closedAt).toLocaleString() : "—"}</td>
                    </tr>
                  );
                })}
                {closed.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-white/30">No closed trades yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </Layout>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-white/50 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-white/70 text-sm font-medium">{icon} {title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-10 text-white/30 text-sm border border-white/5 rounded-xl">{children}</div>;
}

function OutcomeBadge({ reason }: { reason: string | null }) {
  if (reason === "target_hit") return <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-medium">TP</span>;
  if (reason === "stop_loss") return <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px] font-medium">SL</span>;
  if (reason === "manual") return <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-medium">MANUAL</span>;
  return <span className="text-white/40 text-[10px]">{reason ?? "—"}</span>;
}

function PreviewBar({ entry, tp, sl, pipSize, pct }: { entry: number; tp: number; sl: number; pipSize: number; pct: number }) {
  const tpPips = entry && tp ? Math.abs(tp - entry) / pipSize : 0;
  const slPips = entry && sl ? Math.abs(entry - sl) / pipSize : 0;
  const hasPct = Number.isFinite(pct) && pct > 0;
  const lossPct = hasPct && tpPips ? -1 * pct * (slPips / tpPips) : 0;
  if (!entry) return <div />;
  return (
    <div className="text-xs text-white/40 flex flex-wrap gap-3 items-center">
      {tp > 0 && (
        <span>
          TP: <span className="text-emerald-300">{tpPips.toFixed(1)} pips</span>
          {hasPct && <span className="text-emerald-300"> → +{pct.toFixed(2)}%</span>}
        </span>
      )}
      {sl > 0 && (
        <span>
          SL: <span className="text-red-300">{slPips.toFixed(1)} pips</span>
          {hasPct && tpPips > 0 && <span className="text-red-300"> → {lossPct.toFixed(2)}%</span>}
        </span>
      )}
      {!hasPct && (tp > 0 || sl > 0) && (
        <span className="text-amber-300/80">Set Expected Profit % to enable Open Trade</span>
      )}
    </div>
  );
}

function RunningCard({ t, onTP, onSL, onManual, busy }: {
  t: Trade; onTP: () => void; onSL: () => void; onManual: (pct: number) => void; busy: boolean;
}) {
  const [confirmAction, setConfirmAction] = useState<"tp" | "sl" | null>(null);
  const [manualPct, setManualPct] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const expectedPct = parseFloat(t.expectedProfitPercent);

  return (
    <div className="border border-white/10 rounded-xl bg-white/3 overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${t.direction === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{t.direction}</div>
          <div className="font-medium text-white">{t.pair}</div>
          <div className="text-xs text-white/40">#{t.id}</div>
          {t.status === "closing" && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">CLOSING…</span>}
        </div>
        <div className="text-xs text-white/60 flex gap-3 flex-wrap">
          <span>Entry <span className="text-white/90 font-mono">{Number(t.entryPrice).toFixed(5)}</span></span>
          {t.tpPrice && <span>TP <span className="text-emerald-300 font-mono">{Number(t.tpPrice).toFixed(5)}</span></span>}
          {t.slPrice && <span>SL <span className="text-red-300 font-mono">{Number(t.slPrice).toFixed(5)}</span></span>}
          <span className="text-emerald-300">+{expectedPct.toFixed(2)}%</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {t.tpPrice && (
            <button
              onClick={() => confirmAction === "tp" ? onTP() : setConfirmAction("tp")}
              disabled={busy || t.status !== "running"}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                confirmAction === "tp" ? "bg-emerald-500/40 border-emerald-400 text-white" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              <Target className="w-3 h-3 inline mr-1" />
              {confirmAction === "tp" ? "Confirm TP" : "TP HIT"}
            </button>
          )}
          {t.slPrice && (
            <button
              onClick={() => confirmAction === "sl" ? onSL() : setConfirmAction("sl")}
              disabled={busy || t.status !== "running"}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                confirmAction === "sl" ? "bg-red-500/40 border-red-400 text-white" : "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
              }`}
            >
              <ShieldAlert className="w-3 h-3 inline mr-1" />
              {confirmAction === "sl" ? "Confirm SL" : "SL HIT"}
            </button>
          )}
          {confirmAction && (
            <button onClick={() => setConfirmAction(null)} className="px-2 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs"><X className="w-3 h-3" /></button>
          )}
          <button onClick={() => setShowAudit((v) => !v)} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs">
            <FileText className="w-3 h-3 inline mr-1" />Audit {showAudit ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/5 pt-3 bg-white/2">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Manual close</span>
        <input type="number" step="0.01" value={manualPct} onChange={(e) => setManualPct(e.target.value)} placeholder="profit %"
          className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none" />
        <button onClick={() => manualPct && onManual(parseFloat(manualPct))} disabled={busy || !manualPct || t.status !== "running"}
          className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/25 disabled:opacity-40">
          Manual Close
        </button>
        {t.notes && <span className="text-[11px] text-white/40 ml-auto italic">{t.notes}</span>}
      </div>
      <AnimatePresence>
        {showAudit && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5">
            <AuditLog tradeId={t.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuditLog({ tradeId }: { tradeId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trade-audit", tradeId],
    queryFn: () => apiFetch(`/api/admin/signal-trades/${tradeId}/audit`),
    refetchInterval: 5000,
  });
  const log = (data?.log ?? []) as { id: number; action: string; actorUserId: number | null; details: string | null; createdAt: string }[];
  return (
    <div className="px-4 py-3 bg-black/20">
      {isLoading ? <div className="text-xs text-white/30">loading…</div> : log.length === 0 ? (
        <div className="text-xs text-white/30">no audit entries</div>
      ) : (
        <div className="space-y-1.5">
          {log.map((e) => (
            <div key={e.id} className="text-[11px] flex items-start gap-2">
              <span className="text-white/30 font-mono w-32 shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-medium uppercase">{e.action}</span>
              {e.actorUserId && <span className="text-white/40">u#{e.actorUserId}</span>}
              {e.details && <span className="text-white/50 break-all">{e.details}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
