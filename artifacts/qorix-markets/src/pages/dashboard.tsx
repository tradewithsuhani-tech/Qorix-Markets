import {
  useGetDashboardSummary,
  useGetEquityChart,
  useGetTrades,
  useGetDashboardPerformance,
  useGetDashboardFundStats,
  useGetInvestment,
  useUpdateProtection,
  getGetInvestmentQueryKey,
  type VipInfo,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AdminPopup } from "@/components/admin-popup";
import { PeriodFilter, DAYS_PERIOD_OPTIONS } from "@/components/period-filter";
import { GrowthPanel } from "@/components/growth-panel";
import { IdleBalanceBanner } from "@/components/idle-balance-banner";
import { UpdatedAgo } from "@/components/updated-ago";
import { VipBadge, VipCard } from "@/components/vip-badge";
import { MarketsStatusPill, InsightRotatorPill } from "@/components/header-status-pills";
import { AnimatedCounter, BigBalanceCounter } from "@/components/animated-counter";
import { useAuth } from "@/hooks/use-auth";
import { generateMonthlyReport } from "@/lib/report-generator";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity, Clock, TrendingUp,
  TrendingDown, Zap, Target, ShieldCheck, BarChart2, Layers,
  RefreshCw, Globe, PieChart, Award, Shield, AlertTriangle, CheckCircle, FileDown,
  Users, UserCheck, Banknote, X, Sparkles, CircleDot, Trophy, Flame, Gauge
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid
} from "recharts";

import { BannerCarousel } from "@/components/banner-carousel";

const DASHBOARD_BANNERS = [
  { src: `${import.meta.env.BASE_URL}promo/banner-1-manual-trading.png`, alt: "Manual Trading Is Breaking You — Trade Smart with Qorix" },
  { src: `${import.meta.env.BASE_URL}promo/banner-2-tired.png`, alt: "Tired of Manual Trading — You Deserve Better" },
  { src: `${import.meta.env.BASE_URL}promo/banner-3-freedom.png`, alt: "Your Gateway to Financial Freedom — Start with $10" },
];

const periodLabel = (days: number) =>
  DAYS_PERIOD_OPTIONS.find((o) => o.value === days)?.label ?? `${days}D`;

function PointsPill() {
  const [, navigate] = useLocation();
  const { data } = useQuery<{ balance: number }>({
    queryKey: ["/api/points"],
    queryFn: async () => {
      let token: string | null = null;
      try { token = localStorage.getItem("qorix_token"); } catch {}
      const res = await fetch("/api/points", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load points");
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const balance = data?.balance ?? 0;
  return (
    <button
      type="button"
      onClick={() => navigate("/tasks")}
      title="Earn more points by completing tasks"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all"
    >
      <Award style={{ width: 13, height: 13 }} className="text-amber-400" />
      <span>{balance.toLocaleString()} pts</span>
    </button>
  );
}

function FomoTicker({ messages }: { messages: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 3500);
    return () => clearInterval(t);
  }, [messages.length]);
  if (!messages.length) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
      <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
        <span className="live-dot" /> Live
      </div>
      <div className="flex-1 min-w-0 relative h-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 text-sm text-emerald-100 font-medium truncate"
          >
            {messages[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DemoProfitTicker({ base }: { base: number }) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    setValue(base);
    const id = setInterval(() => {
      setValue((v) => v + Math.random() * 4 + 0.5);
    }, 2200);
    return () => clearInterval(id);
  }, [base]);
  return (
    <div className="relative h-[68px] md:h-20 flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={value.toFixed(2)}
          initial={{ y: 18, opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -18, opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute text-5xl md:text-6xl font-black tabular-nums leading-none"
          style={{
            background: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 24px rgba(16,185,129,0.45))",
          }}
        >
          +${value.toFixed(2)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProfitTicker({ value, prev }: { value: number; prev: number }) {
  const up = value >= prev;
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value.toFixed(2)}
        initial={{ y: up ? 8 : -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: up ? -8 : 8, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={`font-mono text-sm font-bold tabular-nums ${up ? "profit-text" : "loss-text"}`}
      >
        {up ? "+" : ""}${value.toFixed(2)}
      </motion.span>
    </AnimatePresence>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-3 py-2.5 text-xs border border-white/10 shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
};

const DrawdownTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-3 py-2.5 text-xs border border-white/10 shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-red-400">
        P&L: {Number(payload[0]?.value) >= 0 ? "+" : ""}${Number(payload[0]?.value).toFixed(2)}
      </p>
    </div>
  );
};

function RiskBadge({ score }: { score: string }) {
  const colors: Record<string, string> = {
    Low: "bg-green-500/15 text-green-400 border-green-500/25",
    Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    High: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${colors[score] ?? colors["Low"]}`}>
      {score} Risk
    </span>
  );
}

type InvestmentInfo = {
  isActive: boolean;
  isPaused: boolean;
  amount: number;
  drawdown: number;
  drawdownLimit: number;
  riskLevel: string;
  pausedAt?: string | null;
  peakBalance?: number;
  drawdownFromPeak?: number;
  recoveryPct?: number;
};

function CapitalProtectionWidget({
  investment,
  isLoading,
  pendingLimit,
  setPendingLimit,
  onSave,
  isSaving,
}: {
  investment: InvestmentInfo | null;
  isLoading: boolean;
  pendingLimit: number | null;
  setPendingLimit: (v: number) => void;
  onSave: (limit: number) => void;
  isSaving: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    );
  }

  const amount = investment?.amount ?? 0;
  const drawdown = investment?.drawdown ?? 0;
  const drawdownLimit = investment?.drawdownLimit ?? 5;
  const isActive = investment?.isActive ?? false;
  const isPaused = investment?.isPaused ?? false;
  const drawdownFromPeak = investment?.drawdownFromPeak ?? 0;
  const recoveryPct = investment?.recoveryPct ?? 0;
  const atPeak = drawdownFromPeak === 0;

  const drawdownPct = amount > 0 ? (drawdown / amount) * 100 : 0;
  const usagePct = drawdownLimit > 0 ? Math.min((drawdownPct / drawdownLimit) * 100, 100) : 0;
  const isTriggered = isPaused && !isActive;
  const isTrading = isActive && !isPaused;

  const selectedLimit = pendingLimit ?? drawdownLimit;
  const hasChanges = pendingLimit !== null && pendingLimit !== drawdownLimit;
  const [showConfirm, setShowConfirm] = useState(false);
  const labelFor = (p: number) => (p <= 3 ? "Conservative" : p <= 5 ? "Balanced" : "Aggressive");
  const currentBuffer = (amount * drawdownLimit) / 100;
  const newBuffer = pendingLimit !== null ? (amount * pendingLimit) / 100 : currentBuffer;
  const bufferDiff = newBuffer - currentBuffer;
  const isWider = pendingLimit !== null && pendingLimit > drawdownLimit;

  const statusBg = isTriggered
    ? "bg-red-500/15 text-red-400 border-red-500/25"
    : isTrading
    ? "bg-green-500/15 text-green-400 border-green-500/25"
    : "bg-white/8 text-muted-foreground border-white/10";

  const statusLabel = isTriggered ? "Triggered" : isTrading ? "Active" : "Inactive";

  const barColor = isTriggered
    ? "#ef4444"
    : usagePct > 70
    ? "#f97316"
    : "#22c55e";

  const bufferLeft = Math.max(0, (amount * drawdownLimit / 100) - drawdown);

  return (
    <div className="glass-card p-5 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Shield style={{ width: 14, height: 14 }} className="text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">Capital Protection System</div>
            <div className="text-[11px] text-muted-foreground">Auto-stops trading at your drawdown limit</div>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${statusBg}`}>
          {isTrading && <span className="live-dot" style={{ width: 5, height: 5 }} />}
          {isTriggered && <AlertTriangle style={{ width: 10, height: 10 }} />}
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Drawdown gauge */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Current Drawdown</span>
              <span className={`font-bold tabular-nums ${isTriggered ? "text-red-400" : usagePct > 70 ? "text-orange-400" : "text-green-400"}`}>
                {drawdownPct.toFixed(2)}% (${drawdown.toFixed(2)})
              </span>
            </div>
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${barColor}88, ${barColor})` }}
              />
              <div
                className="absolute top-0 bottom-0 w-px bg-white/20"
                style={{ left: "100%" }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>0%</span>
              <span className="font-medium">{drawdownLimit}% limit = ${((amount * drawdownLimit) / 100).toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Used", value: `${drawdownPct.toFixed(2)}%`, sub: `$${drawdown.toFixed(2)}`, color: isTriggered ? "text-red-400" : "text-orange-400" },
              { label: "Limit", value: `${drawdownLimit}%`, sub: `$${((amount * drawdownLimit) / 100).toFixed(2)}`, color: "text-blue-400" },
              { label: "Buffer Left", value: `$${bufferLeft.toFixed(2)}`, sub: "remaining", color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                <div className="text-[10px] text-muted-foreground mb-1">{s.label}</div>
                <div className={`font-bold text-xs tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {isTriggered && investment?.pausedAt && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-xs text-muted-foreground">
              <AlertTriangle style={{ width: 12, height: 12 }} className="text-red-400 shrink-0" />
              Triggered at {new Date(investment.pausedAt).toLocaleString()}
            </div>
          )}

          {/* Peak balance / recovery row */}
          {amount > 0 && (
            <div className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
              atPeak
                ? "bg-emerald-500/8 border-emerald-500/20"
                : "bg-orange-500/8 border-orange-500/20"
            }`}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp style={{ width: 12, height: 12 }} className={atPeak ? "text-emerald-400" : "text-orange-400"} />
                <span>From peak:</span>
                <span className={`font-semibold tabular-nums ${atPeak ? "text-emerald-400" : "text-orange-400"}`}>
                  {atPeak ? "At Peak" : `-${drawdownFromPeak.toFixed(2)}%`}
                </span>
              </div>
              {!atPeak && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight style={{ width: 11, height: 11 }} className="text-blue-400" />
                  <span>Need</span>
                  <span className="font-semibold text-blue-400 tabular-nums">+{recoveryPct.toFixed(2)}%</span>
                  <span>to recover</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Limit Selector */}
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Set Protection Limit
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { pct: 3, label: "3%", hint: "Conservative", color: "blue" },
              { pct: 5, label: "5%", hint: "Balanced", color: "indigo" },
              { pct: 10, label: "10%", hint: "Aggressive", color: "orange" },
            ].map(({ pct, label, hint, color }) => {
              const active = selectedLimit === pct;
              const colorMap: Record<string, string> = {
                blue: active ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]" : "bg-white/3 text-muted-foreground border-white/8 hover:border-white/15 hover:text-white",
                indigo: active ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]" : "bg-white/3 text-muted-foreground border-white/8 hover:border-white/15 hover:text-white",
                orange: active ? "bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]" : "bg-white/3 text-muted-foreground border-white/8 hover:border-white/15 hover:text-white",
              };
              return (
                <button
                  key={pct}
                  onClick={() => setPendingLimit(pct)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${colorMap[color]}`}
                >
                  <div>{label}</div>
                  <div className={`text-[10px] font-normal mt-0.5 ${active ? "" : "text-muted-foreground"}`}>{hint}</div>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {hasChanges && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <CheckCircle style={{ width: 13, height: 13 }} /> Review Change
              </motion.button>
            )}
          </AnimatePresence>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-muted-foreground leading-relaxed">
            When your drawdown reaches <span className="text-white font-medium">{selectedLimit}%</span> of invested capital,
            trading is automatically stopped and your remaining funds are secured.
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && pendingLimit !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0b1020] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Shield style={{ width: 16, height: 16 }} className="text-blue-400" />
                  <h3 className="font-semibold">Confirm Protection Change</h3>
                </div>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Review how this change affects your capital protection before applying.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
                    <div className="text-2xl font-bold">{drawdownLimit}%</div>
                    <div className="text-[11px] text-muted-foreground">{labelFor(drawdownLimit)}</div>
                    <div className="pt-2 border-t border-white/5 mt-2">
                      <div className="text-[10px] text-muted-foreground">Max loss buffer</div>
                      <div className="text-sm font-semibold text-white">${currentBuffer.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className={`rounded-xl border p-3 space-y-1 ${isWider ? "border-amber-500/35 bg-amber-500/5" : "border-emerald-500/35 bg-emerald-500/5"}`}>
                    <div className={`text-[10px] uppercase tracking-wider ${isWider ? "text-amber-400" : "text-emerald-400"}`}>After change</div>
                    <div className={`text-2xl font-bold ${isWider ? "text-amber-300" : "text-emerald-300"}`}>{pendingLimit}%</div>
                    <div className="text-[11px] text-muted-foreground">{labelFor(pendingLimit)}</div>
                    <div className="pt-2 border-t border-white/5 mt-2">
                      <div className="text-[10px] text-muted-foreground">Max loss buffer</div>
                      <div className={`text-sm font-semibold ${isWider ? "text-amber-300" : "text-emerald-300"}`}>${newBuffer.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${
                  isWider ? "border-amber-500/25 bg-amber-500/5 text-amber-300/95" : "border-emerald-500/25 bg-emerald-500/8 text-emerald-300/95"
                }`}>
                  {isWider ? (
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {isWider
                      ? <>You are <b>widening</b> the cap — trading can run longer in losses. Stop-out will trigger at a <b>${Math.abs(bufferDiff).toFixed(2)} larger</b> drawdown.</>
                      : <>You are <b>tightening</b> the cap — trading will stop sooner. Stop-out will trigger at a <b>${Math.abs(bufferDiff).toFixed(2)} smaller</b> drawdown for faster capital protection.</>}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isSaving}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onSave(pendingLimit);
                      setShowConfirm(false);
                    }}
                    disabled={isSaving}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Applying…</>
                    ) : (
                      <>Apply {pendingLimit}% Limit</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [chartDays, setChartDays] = useState(30);
  const [returnsDays, setReturnsDays] = useState(30);
  const [pendingLimit, setPendingLimit] = useState<number | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const prevProfitRef = useRef(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { refetchInterval: 5000 }
  });
  const { data: equity, isLoading: equityLoading, dataUpdatedAt: equityUpdatedAt } = useGetEquityChart(
    { days: chartDays },
    { query: { refetchInterval: 15000 } }
  );
  const { data: returnsEquity, isLoading: returnsLoading } = useGetEquityChart(
    { days: returnsDays },
    { query: { refetchInterval: 30000 } }
  );
  const { data: tradesData, isLoading: tradesLoading } = useQuery<{ trades: Array<{ id: number; pair: string; direction: string; createdAt: string }> }>({
    queryKey: ["signal-trades-running"],
    queryFn: async () => {
      const res = await fetch("/api/signal-trades/running");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 5000,
  });
  const { data: recentTradesData } = useQuery<{ trades: Array<{ id: number; pair: string; direction: string; entryPrice: string; realizedExitPrice: string | null; realizedProfitPercent: string; closeReason: string | null; closedAt: string }> }>({
    queryKey: ["signal-trades-recent"],
    queryFn: async () => {
      const res = await fetch("/api/signal-trades/recent");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
  });
  const { data: perf, isLoading: perfLoading } = useGetDashboardPerformance({
    query: { refetchInterval: 30000 }
  });
  const { data: fundStats, isLoading: fundLoading } = useGetDashboardFundStats({
    query: { refetchInterval: 30000 }
  });
  const { data: investment, isLoading: investLoading } = useGetInvestment({
    query: { refetchInterval: 10000 }
  });
  // Single source of truth for /public/market-indicators (includes both legacy
  // metrics and the new conversion-mode fields not yet in the openapi spec).
  const { data: marketIndicators } = useQuery<{
    activeInvestors: number;
    usersEarningNow: number;
    withdrawals24h: number;
    avgMonthlyReturn: number;
    demoModeEnabled: boolean;
    demoProfitEnabled: boolean;
    demoProfitValue: number;
    fomoMessages: string[];
  }>({
    queryKey: ["/api/public/market-indicators"],
    queryFn: async () => {
      const res = await fetch("/api/public/market-indicators");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const conversion = marketIndicators;
  const protectionMutation = useUpdateProtection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Protection limit updated", description: "Capital protection limit has been saved." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        setPendingLimit(null);
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      },
    },
  });

  const trades = Array.isArray(tradesData?.trades) ? tradesData.trades : [];
  const equityArr = Array.isArray(equity) ? equity : [];

  // Daily P&L is now derived from Total Equity (= Total AUM) × today's % rate,
  // so the displayed $ amount always ties to the equity card and the % shown.
  const totalEquityValue = fundStats?.totalAUM ?? summary?.totalBalance ?? 0;
  const dailyPct = summary?.dailyProfitPercent || 0;
  const dailyPL = +(totalEquityValue * (dailyPct / 100)).toFixed(2);
  const isPositive = dailyPL >= 0;
  // Total Profit scales with Total Equity using the same profit-to-equity ratio
  // as the underlying user, so all three cards (Equity, Daily P&L, Total Profit)
  // grow together consistently.
  const equityScale =
    (summary?.totalBalance ?? 0) > 0 ? totalEquityValue / (summary?.totalBalance ?? 1) : 1;
  // Baseline floor — admin-controlled in system_settings.baseline_total_profit.
  // Total Profit starts here, then accumulates upward as equity grows.
  const totalProfitBaseline = Number((fundStats as any)?.totalProfitBaseline ?? 0) || 0;
  const totalProfitDisplay = +(totalProfitBaseline + (summary?.totalProfit ?? 0) * equityScale).toFixed(2);

  const prevProfit = prevProfitRef.current;
  useEffect(() => {
    prevProfitRef.current = summary?.totalProfit || 0;
  }, [summary?.totalProfit]);

  const chartData = equityArr.map(e => ({
    date: format(new Date(e.date), "MMM dd"),
    equity: e.equity,
    profit: e.profit,
  }));

  const drawdownData = equityArr.map((e) => ({
    date: format(new Date(e.date), "MMM dd"),
    value: e.profit,
  }));

  const handleDownloadReport = async () => {
    if (!user || !summary || !perf) {
      toast({ title: "Data not ready", description: "Please wait for data to load.", variant: "destructive" });
      return;
    }
    setIsGeneratingReport(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      generateMonthlyReport({
        user: { fullName: user.fullName, email: user.email, id: user.id },
        summary: {
          totalBalance: summary.totalBalance,
          activeInvestment: summary.activeInvestment,
          totalProfit: summary.totalProfit,
          profitBalance: summary.profitBalance,
          tradingBalance: summary.tradingBalance,
          dailyProfitLoss: summary.dailyProfitLoss,
          dailyProfitPercent: summary.dailyProfitPercent,
          isTrading: summary.isTrading,
          riskLevel: summary.riskLevel ?? null,
        },
        performance: {
          winRate: perf.winRate,
          totalTrades: perf.totalTrades,
          avgReturn: perf.avgReturn,
          maxDrawdown: perf.maxDrawdown,
          drawdown: perf.drawdown,
          riskScore: perf.riskScore,
        },
        vip: summary.vip
          ? {
              tier: summary.vip.tier,
              label: summary.vip.label,
              profitBonus: summary.vip.profitBonus,
              withdrawalFee: summary.vip.withdrawalFee,
            }
          : undefined,
      });
      toast({ title: "Report downloaded", description: "Your monthly performance report has been saved." });
    } catch {
      toast({ title: "Download failed", description: "Could not generate the report.", variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const statCards = [
    {
      label: "Total Equity",
      icon: <Wallet style={{ width: 16, height: 16 }} className="text-blue-400" />,
      value: <BigBalanceCounter value={fundStats?.totalAUM ?? summary?.totalBalance ?? 0} className="text-2xl md:text-3xl" />,
      sub: (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
          <ArrowUpRight style={{ width: 12, height: 12 }} />
          +{(dailyPct || 0).toFixed(2)}% today
        </span>
      ),
      accent: "blue",
      glow: "rgba(59,130,246,0.12)",
    },
    {
      label: "Daily P&L",
      icon: isPositive
        ? <TrendingUp style={{ width: 16, height: 16 }} className="text-green-400" />
        : <TrendingDown style={{ width: 16, height: 16 }} className="text-red-400" />,
      value: (
        <span className={`text-2xl md:text-3xl font-bold ${isPositive ? "profit-text" : "loss-text"}`}>
          {isPositive ? "+" : ""}<AnimatedCounter value={Math.abs(dailyPL)} prefix="$" />
        </span>
      ),
      sub: (
        <span className={`text-xs font-medium flex items-center gap-1 ${isPositive ? "profit-text" : "loss-text"}`}>
          {isPositive ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
          {isPositive ? "+" : ""}{dailyPct.toFixed(2)}% today
        </span>
      ),
      accent: isPositive ? "green" : "red",
      glow: isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
    },
    {
      label: "Active Trading Fund",
      // synced with Active Capital (Fund Transparency) — same value across both cards
      icon: <Zap style={{ width: 16, height: 16 }} className="text-indigo-400" />,
      value: <BigBalanceCounter value={fundStats?.activeCapital ?? summary?.activeInvestment ?? 0} className="text-2xl md:text-3xl" />,
      sub: summary?.isTrading ? (
        <div className="flex items-center gap-1.5">
          <span className="live-dot" style={{ width: 6, height: 6 }} />
          <span className="text-xs text-green-400 font-medium">Trading Active</span>
        </div>
      ) : <span className="text-xs text-muted-foreground">Not active</span>,
      accent: "indigo",
      glow: "rgba(99,102,241,0.1)",
    },
    {
      label: "Total Profit",
      // synced with Total Equity — scales proportionally to fund size
      icon: <Activity style={{ width: 16, height: 16 }} className="text-emerald-400" />,
      value: (
        <span className="text-2xl md:text-3xl font-bold profit-text">
          +<AnimatedCounter value={totalProfitDisplay} prefix="$" />
        </span>
      ),
      sub: <span className="text-xs text-muted-foreground">All time earnings</span>,
      accent: "green",
      glow: "rgba(16,185,129,0.1)",
    },
  ];

  const perfCards = [
    {
      label: "Win Rate",
      value: perfLoading ? null : `${perf?.winRate ?? 0}%`,
      icon: <Award style={{ width: 16, height: 16 }} className="text-yellow-400" />,
      sub: `${perf?.totalTrades ?? 0} total trades`,
      color: "text-yellow-400",
      bar: perf?.winRate ?? 0,
      barColor: "#facc15",
    },
    {
      label: "Max Drawdown",
      value: perfLoading ? null : `-${perf?.maxDrawdown ?? 0}%`,
      icon: <BarChart2 style={{ width: 16, height: 16 }} className="text-red-400" />,
      sub: "Peak to trough",
      color: "text-red-400",
      bar: Math.min(perf?.maxDrawdown ?? 0, 100),
      barColor: "#ef4444",
    },
    {
      label: "Avg Return",
      value: perfLoading ? null : `${(perf?.avgReturn ?? 0) >= 0 ? "+" : ""}${perf?.avgReturn ?? 0}%`,
      icon: <Target style={{ width: 16, height: 16 }} className="text-blue-400" />,
      sub: "Per trade average",
      color: (perf?.avgReturn ?? 0) >= 0 ? "text-green-400" : "text-red-400",
      bar: Math.min(Math.abs(perf?.avgReturn ?? 0), 100),
      barColor: (perf?.avgReturn ?? 0) >= 0 ? "#22c55e" : "#ef4444",
    },
    {
      label: "Risk Score",
      value: perfLoading ? null : perf?.riskScore,
      icon: <ShieldCheck style={{ width: 16, height: 16 }} className="text-purple-400" />,
      sub: summary?.riskLevel ? `${summary.riskLevel} profile` : "Not set",
      color: perf?.riskScore === "High" ? "text-red-400" : perf?.riskScore === "Medium" ? "text-yellow-400" : "text-green-400",
      bar: perf?.riskScore === "High" ? 80 : perf?.riskScore === "Medium" ? 50 : 25,
      barColor: perf?.riskScore === "High" ? "#ef4444" : perf?.riskScore === "Medium" ? "#facc15" : "#22c55e",
    },
  ];

  const fundCards = [
    {
      label: "Total AUM",
      value: fundLoading ? null : `$${(fundStats?.totalAUM ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Globe style={{ width: 16, height: 16 }} className="text-blue-400" />,
      sub: `${fundStats?.activeInvestors ?? 0} active investors`,
      color: "text-blue-400",
    },
    {
      label: "Active Capital",
      value: fundLoading ? null : `$${(fundStats?.activeCapital ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Layers style={{ width: 16, height: 16 }} className="text-indigo-400" />,
      sub: `${fundStats?.utilizationRate ?? 0}% utilization`,
      color: "text-indigo-400",
    },
    {
      label: "Reserve Fund",
      value: fundLoading ? null : `$${(fundStats?.reserveFund ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <PieChart style={{ width: 16, height: 16 }} className="text-emerald-400" />,
      sub: "Platform liquidity",
      color: "text-emerald-400",
    },
  ];

  return (
    <Layout>
      <AdminPopup />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-5 md:space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Overview</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Portfolio performance dashboard</p>
          </div>
          <div className="flex items-center gap-2.5">
            {summary?.riskLevel && <RiskBadge score={perf?.riskScore ?? "Low"} />}
            {summary?.vip && (summary.vip.tier as string) !== "none" && (
              <VipBadge tier={summary.vip.tier as "silver" | "gold" | "platinum"} size="sm" />
            )}
            <PointsPill />

            <button
              onClick={handleDownloadReport}
              disabled={isGeneratingReport || summaryLoading || perfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown style={{ width: 12, height: 12 }} />
              {isGeneratingReport ? "Generating…" : "Download Report"}
            </button>
            <MarketsStatusPill />
            <InsightRotatorPill
              insights={[
                { icon: Trophy, label: "Win Rate 87%", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/25" },
                { icon: Flame, label: "Streak 7d", color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/25" },
                { icon: Gauge, label: "Avg Daily +0.42%", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
                { icon: Sparkles, label: "Top 5% Earner", color: "text-fuchsia-300", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/25" },
              ]}
            />
          </div>
        </div>

        {/* Promo Banners — hidden per request */}
        {false && (
          <BannerCarousel
            slides={DASHBOARD_BANNERS.map((b) => ({ ...b, onClick: () => navigate("/deposit") }))}
            intervalMs={4500}
          />
        )}

        {/* Demo Mode Hero — hidden per request */}
        {false && conversion?.demoModeEnabled !== false && !investment?.isActive && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-blue-500/30 p-6 md:p-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,28,68,0.65) 0%, rgba(40,22,82,0.55) 50%, rgba(15,15,45,0.65) 100%)",
            }}
          >
            {/* Animated glow blobs */}
            <motion.div
              className="absolute -top-24 -right-20 w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.45) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.75, 0.5] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(168,85,247,0.45) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.75, 0.5] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
              }}
            />

            <div className="relative flex flex-col items-center text-center gap-5 md:gap-6">
              {/* 1. Glowing DEMO MODE badge */}
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 18px rgba(59,130,246,0.45), 0 0 32px rgba(59,130,246,0.25)",
                    "0 0 28px rgba(168,85,247,0.65), 0 0 50px rgba(168,85,247,0.35)",
                    "0 0 18px rgba(59,130,246,0.45), 0 0 32px rgba(59,130,246,0.25)",
                  ],
                }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/40"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                </span>
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.22em]"
                  style={{
                    background: "linear-gradient(90deg, #93c5fd, #c4b5fd, #f0abfc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Demo Mode
                </span>
              </motion.div>

              {/* 2. Dynamic profit ticker */}
              {conversion?.demoProfitEnabled !== false && (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
                    Your simulated profit
                  </div>
                  <DemoProfitTicker base={conversion?.demoProfitValue ?? 28.45} />
                  {/* 3. Subtitle */}
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <Sparkles style={{ width: 11, height: 11 }} className="text-emerald-400/70" />
                    Based on real market simulation
                  </div>
                </div>
              )}

              {/* 4. Urgency line */}
              <p className="text-base md:text-lg text-white/90 max-w-md leading-snug">
                Activate live trading to start earning{" "}
                <span
                  className="font-bold"
                  style={{
                    background: "linear-gradient(90deg, #60a5fa, #c084fc, #f472b6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  real profits
                </span>
              </p>

              {/* 5. Powerful CTA with animated glow */}
              <motion.button
                onClick={() => navigate("/deposit")}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                animate={{
                  boxShadow: [
                    "0 0 30px rgba(59,130,246,0.55), 0 0 0px rgba(168,85,247,0.4)",
                    "0 0 50px rgba(168,85,247,0.75), 0 0 80px rgba(236,72,153,0.4)",
                    "0 0 30px rgba(59,130,246,0.55), 0 0 0px rgba(168,85,247,0.4)",
                  ],
                }}
                transition={{ boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }}
                className="group relative inline-flex items-center gap-2.5 px-8 md:px-10 py-4 md:py-5 rounded-2xl text-base md:text-lg font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 transition-colors"
              >
                <Zap style={{ width: 18, height: 18 }} />
                Start Live Trading
                <ArrowUpRight
                  style={{ width: 18, height: 18 }}
                  className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                />
              </motion.button>

              {/* 6. Trust line */}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle style={{ width: 12, height: 12 }} className="text-emerald-400" />
                  Start from $10
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5">
                  <CheckCircle style={{ width: 12, height: 12 }} className="text-emerald-400" />
                  Withdraw anytime
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Live Activity FOMO Ticker */}
        {conversion?.fomoMessages && conversion.fomoMessages.length > 0 && (
          <FomoTicker messages={conversion.fomoMessages} />
        )}

        {/* Investment CTA + Trust block — only for users who haven't activated trading */}
        {conversion?.demoModeEnabled !== false && !investment?.isActive && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-4"
          >
            {/* Activate Trading CTA */}
            <div className="lg:col-span-3 rounded-2xl border border-blue-500/25 bg-gradient-to-br from-[#0d1117] via-[#0d1117] to-blue-950/30 p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 mb-1">Start Trading</div>
                  <h3 className="text-xl md:text-2xl font-bold leading-tight">Start from <span className="gradient-text">$10</span></h3>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-emerald-500/10 border-emerald-500/25 text-emerald-300">
                  <CheckCircle style={{ width: 11, height: 11 }} /> No lock-in
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: "Low", returns: "2–5%/mo", bg: "bg-emerald-500/5 border-emerald-500/20", text: "text-emerald-300" },
                  { name: "Balanced", returns: "4–6%/mo", bg: "bg-blue-500/5 border-blue-500/20", text: "text-blue-300" },
                  { name: "Growth", returns: "5–8%/mo", bg: "bg-violet-500/5 border-violet-500/20", text: "text-violet-300" },
                ].map((mode) => (
                  <div
                    key={mode.name}
                    className={`rounded-xl border p-2.5 sm:p-3 text-center ${mode.bg} min-w-0`}
                  >
                    <div className={`text-xs font-semibold ${mode.text} mb-1 truncate`}>{mode.name}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{mode.returns}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate("/deposit")}
                className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-600/30 transition-all"
              >
                Activate Trading →
              </button>
              <div className="text-[11px] text-muted-foreground text-center">Start small. Scale anytime. Withdraw with one click.</div>
            </div>

            {/* Trust Block */}
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck style={{ width: 16, height: 16 }} className="text-emerald-400" />
                <h3 className="font-semibold">Why Qorix</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Fully automated execution",
                  "No manual trading required",
                  "Risk-managed strategies",
                  "Transparent dashboard",
                  "Withdraw anytime",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Investor Psychology Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {(
            [
              {
                icon: Users,
                label: "Active Investors",
                value: marketIndicators?.activeInvestors ?? 0,
                decimals: 0,
                suffix: "",
                sub: undefined as string | undefined,
                color: "text-blue-400",
                bg: "bg-blue-500/5 border-blue-500/15",
              },
              {
                icon: UserCheck,
                label: "Earning Now",
                value: marketIndicators?.usersEarningNow ?? 0,
                decimals: 0,
                suffix: "",
                sub: "users",
                color: "text-emerald-400",
                bg: "bg-emerald-500/5 border-emerald-500/15",
              },
              {
                icon: Banknote,
                label: "Withdrawals (24h)",
                value: marketIndicators?.withdrawals24h ?? 0,
                decimals: 0,
                suffix: "",
                sub: "processed",
                color: "text-amber-400",
                bg: "bg-amber-500/5 border-amber-500/15",
              },
              {
                icon: TrendingUp,
                label: "Avg Monthly Return",
                value: marketIndicators?.avgMonthlyReturn ?? 0,
                decimals: 1,
                suffix: "%",
                sub: "net of fees · 30d avg",
                color: "text-violet-400",
                bg: "bg-violet-500/5 border-violet-500/15",
              },
          ]).map(({ icon: Icon, label, value, decimals, suffix, sub, color, bg }) => (
            <div key={label} className={`glass-card rounded-xl px-4 py-3 border ${bg} flex items-center gap-3`}>
              <div className={`shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center`}>
                <Icon style={{ width: 14, height: 14 }} className={color} />
              </div>
              <div className="min-w-0">
                <div className={`text-base font-bold ${color} tabular-nums leading-tight`}>
                  {marketIndicators == null ? (
                    "—"
                  ) : (
                    <AnimatedCounter value={value} decimals={decimals} suffix={suffix} />
                  )}
                  {sub ? <span className="text-xs font-normal text-muted-foreground ml-1">{sub}</span> : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Limited Slots Banner */}
        {fundStats && fundStats.maxSlots > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
              fundStats.isFull
                ? "bg-red-500/8 border-red-500/25"
                : fundStats.availableSlots !== null && fundStats.availableSlots <= Math.ceil(fundStats.maxSlots * 0.2)
                ? "bg-red-500/8 border-red-500/20"
                : "bg-amber-500/8 border-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${fundStats.isFull ? "bg-red-500/15" : "bg-amber-500/15"}`}>
                <Layers style={{ width: 14, height: 14, color: fundStats.isFull ? "#f87171" : "#fbbf24" }} />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${fundStats.isFull ? "text-red-400" : "text-amber-400"}`}>
                  {fundStats.isFull ? "All Investor Slots Are Full" : "Limited Slots Available"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {fundStats.isFull
                    ? `All ${fundStats.maxSlots} slots are currently occupied`
                    : `${fundStats.availableSlots} of ${fundStats.maxSlots} slots remaining`}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="text-xs tabular-nums font-semibold" style={{ color: fundStats.isFull ? "#f87171" : "#fbbf24" }}>
                {fundStats.activeInvestors}/{fundStats.maxSlots}
              </div>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (fundStats.activeInvestors / fundStats.maxSlots) * 100)}%`,
                    background: fundStats.isFull ? "#ef4444" : "linear-gradient(90deg, #f59e0b, #f97316)"
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Primary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className="stat-card p-4 md:p-5 rounded-2xl space-y-2.5 relative overflow-hidden"
              style={{ boxShadow: `0 4px 24px ${card.glow}, 0 1px 0 rgba(255,255,255,0.07) inset` }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
                style={{ background: card.glow, filter: "blur(20px)", transform: "translate(30%,-30%)" }}
              />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
                {card.icon}
              </div>
              {summaryLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="font-bold leading-tight">{card.value}</div>
              )}
              {card.sub && !summaryLoading && <div>{card.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* Equity Chart + Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Equity Curve */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl col-span-1 lg:col-span-2 flex flex-col"
            style={{ minHeight: 340 }}
          >
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold whitespace-nowrap flex items-center gap-2">
                  Equity Curve
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider inline-flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    Live Performance
                  </p>
                  <span className="text-muted-foreground/40">·</span>
                  <UpdatedAgo timestamp={equityUpdatedAt} />
                </div>
              </div>
              <div className="-mx-1 overflow-x-auto scrollbar-hide sm:mx-0 sm:overflow-visible">
                <PeriodFilter
                  options={DAYS_PERIOD_OPTIONS}
                  selected={chartDays}
                  onChange={(v) => setChartDays(Number(v))}
                  ariaLabel="Equity curve period"
                />
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: 260 }}>
              {equityLoading ? (
                <div className="w-full h-full flex items-end gap-1 pb-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-white/5 rounded-t animate-pulse" style={{ height: `${30 + (i * 3) % 60}%` }} />
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(96,165,250,0.35)" />
                        <stop offset="100%" stopColor="rgba(96,165,250,0.00)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${Number(v).toLocaleString()}`}
                      width={70}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "rgba(148,163,184,0.25)", strokeWidth: 1 }}
                      wrapperStyle={{ outline: "none" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      name="Equity"
                      stroke="rgba(96,165,250,1)"
                      strokeWidth={2}
                      fill="url(#equityGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: "rgba(96,165,250,1)", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Recent Trades Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl flex flex-col"
            style={{ minHeight: 340 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Live Trades</h3>
              <div className="flex items-center gap-1.5">
                <RefreshCw style={{ width: 10, height: 10, animationDuration: "3s" }} className="text-green-400 animate-spin" />
                <span className="text-[10px] text-green-400 font-medium">LIVE</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {tradesLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
              ) : trades.length === 0 ? (
                <div className="flex flex-col h-full">
                  {/* Waiting for setup — animated with gradient highlight */}
                  <div className="flex-1 flex flex-col items-center justify-center py-6 relative overflow-hidden rounded-xl">
                    {/* Ambient gradient backdrop */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10" />
                    <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
                    <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

                    {/* Shimmer sweep */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute -inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent animate-pulse" />
                    </div>

                    {/* Icon with gradient ring */}
                    <div className="relative w-20 h-20 mb-4">
                      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-500/30 blur-md animate-ping" />
                      <span className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/20 animate-ping" style={{ animationDelay: "0.4s" }} />
                      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-400/30 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(59,130,246,0.6)]">
                        <Activity className="w-7 h-7 text-blue-300 animate-pulse" strokeWidth={2.25} />
                      </div>
                    </div>

                    <p className="text-sm font-semibold bg-gradient-to-r from-blue-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent tracking-wide">
                      Waiting for setup…
                    </p>
                    <p className="text-[11px] text-white/50 mt-1">Scanning markets for next signal</p>

                    {/* Animated progress dots */}
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>

                  {/* Recent closed strip */}
                  {recentTradesData?.trades && recentTradesData.trades.length > 0 && (
                    <div className="border-t border-white/5 pt-2.5 mt-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Recent</div>
                      <div className="space-y-1.5">
                        {recentTradesData.trades.slice(0, 3).map((t: any) => {
                          const pct = parseFloat(t.realizedProfitPercent || "0");
                          const isManual = t.closeReason === 'manual';
                          const isWin = pct >= 0;
                          const badgeLabel = isManual ? 'MANUAL' : (isWin ? 'TP HIT' : 'SL HIT');
                          const badgeCls = isManual
                            ? 'bg-amber-500/15 text-amber-400'
                            : (isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400');
                          const valueCls = isWin ? 'text-emerald-400' : 'text-red-400';
                          const entry = parseFloat(t.entryPrice || "0");
                          const exit = parseFloat(t.realizedExitPrice || "0");
                          const dp = t.pair === 'XAUUSD' || t.pair === 'USOIL' ? 2 : t.pair === 'BTCUSD' ? 1 : 4;
                          const fmt = (n: number) => Number.isFinite(n) && n > 0
                            ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
                            : '—';
                          const isBuy = t.direction === 'BUY' || t.direction === 'LONG';
                          return (
                            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">{t.pair}</span>
                                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${isBuy ? 'bg-sky-500/15 text-sky-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                    {isBuy ? 'BUY' : 'SELL'}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${badgeCls}`}>
                                    {badgeLabel}
                                  </span>
                                </div>
                                <span className={`text-[11px] font-mono font-semibold ${valueCls}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                <span>Entry <span className="text-white/80">{fmt(entry)}</span></span>
                                <span className="opacity-40">→</span>
                                <span>Exit <span className="text-white/80">{fmt(exit)}</span></span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                trades.map((trade: any, i: number) => {
                  const isBuy = trade.direction === 'BUY' || trade.direction === 'LONG';
                  return (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/20 hover:bg-white/[0.05] transition-all duration-150"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1 h-9 rounded-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {trade.pair}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                              {trade.direction}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">In progress…</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
                          </span>
                          RUNNING
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Managed by Qorix system</div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Drawdown Chart + Rolling Returns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* Daily P&L / Drawdown Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl flex flex-col"
            style={{ minHeight: 240 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Daily P&L</h3>
                <p className="text-xs text-muted-foreground">Drawdown analysis</p>
              </div>
              <div className="text-xs text-muted-foreground bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
                {periodLabel(chartDays)}
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: 180 }}>
              {equityLoading ? (
                <div className="w-full h-full flex items-end gap-1 pb-2">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex-1 animate-pulse rounded" style={{
                      height: `${30 + (i * 5) % 50}%`,
                      background: i % 3 === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'
                    }} />
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={drawdownData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${Number(v).toFixed(0)}`}
                      width={55}
                    />
                    <Tooltip
                      content={<DrawdownTooltip />}
                      cursor={{ fill: "rgba(148,163,184,0.08)" }}
                      wrapperStyle={{ outline: "none" }}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 2" />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {drawdownData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.value >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Rolling Returns — line chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl flex flex-col"
            style={{ minHeight: 240 }}
          >
            <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold">Rolling Returns</h3>
                <p className="text-xs text-muted-foreground">Cumulative return over selected period</p>
              </div>
              <PeriodFilter
                options={DAYS_PERIOD_OPTIONS}
                selected={returnsDays}
                onChange={(v) => setReturnsDays(Number(v))}
                ariaLabel="Rolling returns period"
              />
            </div>

            {(() => {
              const rawArr = Array.isArray(returnsEquity) ? (returnsEquity as Array<{ date: string; equity: number }>) : [];
              const arr = [...rawArr].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              const base = arr.length > 0 ? Number(arr[0].equity) || 0 : 0;
              const series = arr.map(p => ({
                date: format(new Date(p.date), "MMM dd"),
                ret: base > 0 ? ((Number(p.equity) - base) / base) * 100 : 0,
              }));
              const last = series.length > 0 ? series[series.length - 1].ret : 0;
              const isPos = last >= 0;
              const stroke = isPos ? "rgba(34,197,94,1)" : "rgba(239,68,68,1)";
              const gradTop = isPos ? "rgba(34,197,94,0.32)" : "rgba(239,68,68,0.32)";

              return (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-2xl font-bold tabular-nums ${isPos ? "profit-text" : "loss-text"}`}>
                      {isPos ? "+" : ""}{last.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      over {periodLabel(returnsDays)}
                    </span>
                  </div>
                  <div className="flex-1" style={{ minHeight: 160 }}>
                    {returnsLoading ? (
                      <div className="w-full h-full flex items-end gap-1 pb-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="flex-1 bg-white/5 rounded-t animate-pulse" style={{ height: `${30 + (i * 3) % 60}%` }} />
                        ))}
                      </div>
                    ) : series.length < 2 ? (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        Not enough data for this period yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="returnsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={gradTop} />
                              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => `${Number(v).toFixed(1)}%`}
                            width={48}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(15,23,42,0.95)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Return"]}
                          />
                          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
                          <Area
                            type="monotone"
                            dataKey="ret"
                            name="Return"
                            stroke={stroke}
                            strokeWidth={2}
                            fill="url(#returnsGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Live Profit Ticker */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Profit</span>
                <div className="flex items-center gap-2">
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  <ProfitTicker value={totalProfitDisplay} prev={prevProfit} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Today's gain</span>
                <span className={isPositive ? "profit-text font-semibold" : "loss-text font-semibold"}>
                  {isPositive ? "+" : ""}${dailyPL.toFixed(2)} ({isPositive ? "+" : ""}{dailyPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Performance Metrics</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {perfCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.07, duration: 0.35 }}
                className="stat-card p-4 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
                  {card.icon}
                </div>
                {perfLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                )}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{card.sub}</div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${card.bar}%` }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: card.barColor }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Capital Protection Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Capital Protection</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <CapitalProtectionWidget
            investment={investment ?? null}
            isLoading={investLoading}
            pendingLimit={pendingLimit}
            setPendingLimit={setPendingLimit}
            onSave={(limit) => protectionMutation.mutate({ data: { drawdownLimit: limit } })}
            isSaving={protectionMutation.isPending}
          />
        </motion.div>

        {/* VIP Membership */}
        {summary?.vip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-semibold">VIP Membership</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <VipCard vip={summary.vip as VipInfo} investmentAmount={summary.activeInvestment ?? 0} />
          </motion.div>
        )}

        {/* Growth & Leaderboard Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.53, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Growth & Rankings</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <GrowthPanel />
        </motion.div>

        <IdleBalanceBanner
          balance={summary?.totalBalance ?? 0}
          isActive={!!investment?.isActive}
        />

        {/* Fund Transparency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.4 }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h2 className="text-base font-semibold">Fund Transparency</h2>
            <span className="text-[10px] text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full">Public</span>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl sm:text-[22px] font-extrabold bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
              $1M+ Managed Capital
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-400/30 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {fundCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.07, duration: 0.35 }}
                className="glass-card-glow p-4 md:p-5 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
                  {card.icon}
                </div>
                {fundLoading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <div className={`text-xl md:text-2xl font-bold ${card.color}`}>{card.value}</div>
                )}
                {!fundLoading && <div className="text-xs text-muted-foreground">{card.sub}</div>}
              </motion.div>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </Layout>
  );
}
