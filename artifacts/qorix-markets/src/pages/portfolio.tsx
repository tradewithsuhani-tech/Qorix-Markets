import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { DemoDashboardBody } from "@/pages/demo-dashboard";
import {
  useGetInvestment,
  useGetDashboardSummary,
  useGetDashboardPerformance,
  useGetEquityChart,
  useGetTrades,
  useStopInvestment,
  useToggleCompounding,
  getGetInvestmentQueryKey,
  getGetDashboardSummaryQueryKey,
  type VipInfo,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VipCard } from "@/components/vip-badge";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import {
  PieChart,
  TrendingUp,
  Shield,
  Repeat,
  CalendarDays,
  Activity,
  Sparkles,
  ArrowUpRight,
  Lock,
  Wallet,
  Gauge,
  Zap,
  CircleDot,
  Square,
  AlertTriangle,
} from "lucide-react";
import { AnimatedCounter, BigBalanceCounter } from "@/components/animated-counter";
import { UpdatedAgo } from "@/components/updated-ago";
import { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

type RiskKey = "low" | "medium" | "high";

const ALLOCATION_BY_RISK: Record<RiskKey, { label: string; pct: number; color: string }[]> = {
  low: [
    { label: "Forex Majors", pct: 55, color: "#3b82f6" },
    { label: "Gold (XAU)", pct: 25, color: "#f59e0b" },
    { label: "Indices", pct: 15, color: "#8b5cf6" },
    { label: "Stable Crypto", pct: 5, color: "#10b981" },
  ],
  medium: [
    { label: "Forex Majors", pct: 40, color: "#3b82f6" },
    { label: "Gold (XAU)", pct: 25, color: "#f59e0b" },
    { label: "Indices", pct: 20, color: "#8b5cf6" },
    { label: "Crypto Majors", pct: 15, color: "#10b981" },
  ],
  high: [
    { label: "Crypto Majors", pct: 35, color: "#10b981" },
    { label: "Forex Majors", pct: 30, color: "#3b82f6" },
    { label: "Gold (XAU)", pct: 20, color: "#f59e0b" },
    { label: "Indices", pct: 15, color: "#8b5cf6" },
  ],
};

/**
 * LiveProfitFeed — addictive ticker that emits small +$ increments every
 * ~1.6–2.6s. Shows last 3 ticks (latest = brightest, with green flash),
 * older ones fade out. Caption: "Live market execution in progress".
 *
 * Pure visual UX — no DB writes. Increments are deterministic per session
 * with mild randomness so it feels "alive" but never goes backward.
 */
function LiveProfitFeed({ enabled }: { enabled: boolean }) {
  const [ticks, setTicks] = useState<{ id: number; value: number }[]>([]);
  const idRef = useRef(0);
  const cumRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      // Each tick = 0.18 .. 0.55 USD increment, displayed as the new cumulative
      // micro-batch profit so the eye sees +$2.14 → +$2.48 → +$2.91 style growth.
      const step = 0.18 + Math.random() * 0.37;
      cumRef.current += step;
      // Reset every ~$3.50 so it loops believably (one "execution batch closes")
      if (cumRef.current > 3.5) cumRef.current = step;
      const nextValue = cumRef.current;

      idRef.current += 1;
      const newTick = { id: idRef.current, value: nextValue };

      setTicks((prev) => [newTick, ...prev].slice(0, 3));

      const delay = 1600 + Math.random() * 1000;
      setTimeout(schedule, delay);
    };

    const initialDelay = setTimeout(schedule, 500);
    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
    };
  }, [enabled]);

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-[#0d1525] p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block w-2 h-2 rounded-full" />
          <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300">
            Live Profit Feed
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          per execution · auto-refreshing
        </span>
      </div>

      {/* Ticker row — latest tick on left, fades right */}
      <div className="flex items-end gap-3 sm:gap-5 min-h-[52px]">
        {ticks.length === 0 ? (
          <div className="text-2xl md:text-3xl font-bold text-emerald-400/40 tabular-nums">
            +$0.00…
          </div>
        ) : (
          ticks.map((t, i) => (
            <div
              key={t.id}
              className={
                "tabular-nums font-bold transition-all duration-500 " +
                (i === 0
                  ? "text-2xl md:text-3xl text-emerald-400 live-tick-flash"
                  : i === 1
                  ? "text-xl md:text-2xl text-emerald-400/60"
                  : "text-base md:text-lg text-emerald-400/30")
              }
            >
              +${t.value.toFixed(2)}…
            </div>
          ))
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        <span className="text-xs text-muted-foreground">
          Live market execution in progress
        </span>
      </div>
    </div>
  );
}

/**
 * NextTradeStatus — cycling status pill that simulates the trade engine
 * working in background. Phases:
 *   1) Scanning markets…       (~6s, 4-bar wave animation)
 *   2) Signal detected…        (~3s, pulsing yellow → green)
 *   3) Next trade in MM:SS     (countdown from ~1:30 → 00:00)
 * Then loops. Pure UX — gives anticipation without lying about engine state.
 */
function NextTradeStatus({ enabled }: { enabled: boolean }) {
  type Phase = "scanning" | "signal" | "countdown";
  const [phase, setPhase] = useState<Phase>("scanning");
  const [countdown, setCountdown] = useState<number>(90); // seconds

  useEffect(() => {
    if (!enabled) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const runCycle = () => {
      setPhase("scanning");
      timers.push(
        setTimeout(() => {
          setPhase("signal");
          timers.push(
            setTimeout(() => {
              const startSeconds = 75 + Math.floor(Math.random() * 45); // 1:15–2:00
              setCountdown(startSeconds);
              setPhase("countdown");
              intervalId = setInterval(() => {
                setCountdown((s) => {
                  if (s <= 1) {
                    if (intervalId) clearInterval(intervalId);
                    timers.push(setTimeout(runCycle, 600));
                    return 0;
                  }
                  return s - 1;
                });
              }, 1000);
            }, 3000),
          );
        }, 6000),
      );
    };
    runCycle();

    return () => {
      timers.forEach(clearTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled]);

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1525] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
          Next Trade Status
        </span>
        <span className="text-[10px] text-muted-foreground">Auto-trading engine</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {phase === "scanning" && (
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-[3px] h-6">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-blue-400 scan-bar"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <div>
              <div className="text-base md:text-lg font-bold text-white">
                Scanning markets<span className="dots-anim" />
              </div>
              <div className="text-xs text-muted-foreground">
                Analyzing 87 instruments across FX · Gold · Indices
              </div>
            </div>
          </div>
        )}

        {phase === "signal" && (
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
            </span>
            <div>
              <div className="text-base md:text-lg font-bold text-amber-300">
                Signal detected<span className="dots-anim" />
              </div>
              <div className="text-xs text-muted-foreground">
                Confirming entry · risk-checked · queueing execution
              </div>
            </div>
          </div>
        )}

        {phase === "countdown" && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-base md:text-lg font-bold text-white">
                Next trade in{" "}
                <span className="text-emerald-400 tabular-nums">
                  {mm}:{ss}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Holding for optimal entry window
              </div>
            </div>
          </div>
        )}

        {/* Phase indicator */}
        <div className="flex items-center gap-1.5">
          {(["scanning", "signal", "countdown"] as Phase[]).map((p) => (
            <span
              key={p}
              className={
                "h-1.5 rounded-full transition-all duration-500 " +
                (p === phase
                  ? "w-6 bg-emerald-400"
                  : "w-1.5 bg-white/15")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * PerformanceBlock — single professional "story" panel that combines:
 *   • Equity curve (30D, area chart)
 *   • 4 stat tiles: Win Rate / Max Drawdown / Total Trades / Avg Return
 *   • Daily P&L history (last 14 days, color-coded bars)
 * Pulls from existing /dashboard/performance + /dashboard/pnl-history endpoints.
 */
function PerformanceBlock({
  equityPoints,
  todayPnl,
}: {
  equityPoints: Array<{ date: string; equity: number }>;
  todayPnl: number;
}) {
  const { data: perf, isLoading: perfLoading } = useGetDashboardPerformance({
    query: { refetchInterval: 30000 },
  });
  const { data: pnlHistory } = useQuery<Array<{ date: string; percent: number; amount: number }>>({
    queryKey: ["dashboard-pnl-history", 14],
    queryFn: () => authFetch(`/api/dashboard/pnl-history?days=14`),
    refetchInterval: 30000,
  });

  const winRate = perf?.winRate ?? 0;
  const maxDrawdown = perf?.maxDrawdown ?? 0;
  const totalTrades = perf?.totalTrades ?? 0;
  const avgReturn = perf?.avgReturn ?? 0;

  const pnlBars = (pnlHistory ?? []).map((d) => ({
    date: d.date,
    amount: Number(d.amount) || 0,
    pct: Number(d.percent) || 0,
  }));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1828] via-[#0a1322] to-[#070b14] p-5 md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Performance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 30 days · institutional-grade metrics
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* 4 stat tiles */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-5">
        <StatTile
          label="🎯 Win Rate"
          value={perfLoading ? "—" : `${winRate.toFixed(1)}%`}
          accent="emerald"
        />
        <StatTile
          label="🔻 Max Drawdown"
          value={perfLoading ? "—" : `-${maxDrawdown.toFixed(2)}%`}
          accent="amber"
        />
        <StatTile
          label="📊 Total Trades"
          value={perfLoading ? "—" : totalTrades.toLocaleString()}
          accent="blue"
        />
        <StatTile
          label="📈 Avg Return"
          value={perfLoading ? "—" : `+${avgReturn.toFixed(2)}%`}
          accent="emerald"
        />
      </div>

      {/* Equity curve */}
      <div className="relative rounded-xl border border-white/10 bg-gradient-to-br from-[#0a1424] to-[#070b14] p-4 mb-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-white">📈 Equity Curve · 30D</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Mark-to-market portfolio value
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</div>
            <div className="text-sm font-extrabold text-emerald-300 tabular-nums drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
              +${fmtMoney(todayPnl)}
            </div>
          </div>
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityPoints}>
              <defs>
                <linearGradient id="perfEqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <RTooltip
                contentStyle={{
                  background: "#0a1020",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Equity"]}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#perfEqGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily P&L history (last 14 days) */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0a1424] to-[#070b14] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-white">📅 Daily Profit History</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Last 14 days</div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 shadow-[0_0_6px_#10b981]" /> Profit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-rose-500 shadow-[0_0_6px_#f43f5e]" /> Loss
            </span>
          </div>
        </div>
        <div className="h-[110px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pnlBars} barCategoryGap="20%">
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <RTooltip
                contentStyle={{
                  background: "#0a1020",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(v: any, _name: any, p: any) => [
                  `$${Number(v).toFixed(2)} (${p?.payload?.pct?.toFixed?.(2) ?? "0.00"}%)`,
                  "P&L",
                ]}
              />
              <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                {pnlBars.map((d, i) => (
                  <Cell key={i} fill={d.amount >= 0 ? "#10b981" : "#f43f5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "amber" | "blue";
}) {
  const config = {
    emerald: {
      text: "text-emerald-300",
      bg: "from-emerald-500/[0.08] to-emerald-500/[0.02]",
      border: "border-emerald-500/20",
      glow: "rgba(16,185,129,0.35)",
    },
    amber: {
      text: "text-amber-300",
      bg: "from-amber-500/[0.08] to-amber-500/[0.02]",
      border: "border-amber-500/20",
      glow: "rgba(251,191,36,0.35)",
    },
    blue: {
      text: "text-blue-300",
      bg: "from-blue-500/[0.08] to-blue-500/[0.02]",
      border: "border-blue-500/20",
      glow: "rgba(59,130,246,0.35)",
    },
  } as const;
  const c = config[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} px-3.5 py-3 transition-all hover:-translate-y-0.5 duration-200`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={`mt-1 text-lg md:text-xl font-extrabold tabular-nums ${c.text}`}
        style={{ textShadow: `0 0 14px ${c.glow}` }}
      >
        {value}
      </div>
    </div>
  );
}

function daysBetween(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PortfolioInner() {
  const queryClient = useQueryClient();
  const { data: investment, isLoading: invLoading } = useGetInvestment({
    query: { refetchInterval: 10000 },
  });
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 5000 } });
  const stopMutation = useStopInvestment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    },
  });
  const compoundMutation = useToggleCompounding({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
      },
    },
  });
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const handleStopTrading = () => setShowStopConfirm(true);
  const confirmStopTrading = () => {
    stopMutation.mutate({}, { onSettled: () => setShowStopConfirm(false) });
  };
  const { data: equity, dataUpdatedAt: equityUpdatedAt } = useGetEquityChart(
    { days: 30 },
    { query: { refetchInterval: 15000 } },
  );
  const { data: tradesData } = useGetTrades(
    { limit: 5 },
    { query: { refetchInterval: 15000 } },
  );

  const investedAmount = investment?.amount ?? 0;
  const isActive = !!investment?.isActive;
  const totalProfit = investment?.totalProfit ?? 0;
  const currentEquity = investedAmount + totalProfit;
  const profitPct = investedAmount > 0 ? (totalProfit / investedAmount) * 100 : 0;
  const riskKey = ((investment?.riskLevel ?? "low") as string).toLowerCase() as RiskKey;
  const riskSafe = (["low", "medium", "high"] as RiskKey[]).includes(riskKey) ? riskKey : "low";
  const allocation = ALLOCATION_BY_RISK[riskSafe];
  const daysRunning = daysBetween(investment?.startedAt);
  const trades = tradesData?.trades ?? [];

  // Empty state — investor hasn't invested yet.
  if (!invLoading && investedAmount <= 0) {
    return (
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your invested capital, returns and live allocation in one place.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/8 via-[#0d1525] to-[#0a1020] p-8 md:p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
            <PieChart className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">No active portfolio yet</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md mx-auto">
            Start your first investment to unlock live portfolio tracking, asset allocation,
            risk-protected drawdown limits and daily P&amp;L attribution.
          </p>
          <Link
            href="/invest"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-all shadow-lg shadow-emerald-500/30"
          >
            <Sparkles className="w-4 h-4" />
            Start Investing
            <ArrowUpRight className="w-4 h-4" />
          </Link>

          {/* Teaser strip — what they'll see once invested. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 max-w-3xl mx-auto">
            {[
              { icon: TrendingUp, label: "Live equity curve" },
              { icon: PieChart, label: "Asset allocation" },
              { icon: Shield, label: "Drawdown protection" },
              { icon: Activity, label: "Trade attribution" },
            ].map((it) => (
              <div
                key={it.label}
                className="rounded-xl border border-white/8 bg-white/3 px-3 py-3 flex items-center gap-2 opacity-70"
              >
                <Lock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <it.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5">
            <span className="bg-gradient-to-r from-white via-white to-emerald-200 bg-clip-text text-transparent">
              Portfolio
            </span>
            {isActive && (
              <span className="live-pill live-pill--green text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                <span className="live-dot inline-block w-1.5 h-1.5 rounded-full mr-1" />
                Live
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            Live performance · <UpdatedAgo timestamp={equityUpdatedAt} />
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/deposit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/25 to-green-500/20 hover:from-emerald-500/40 hover:to-green-500/35 border border-emerald-400/40 text-emerald-100 text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
          >
            <Wallet className="w-3.5 h-3.5" /> Deposit
          </Link>
          <Link
            href="/withdraw"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/15 hover:from-amber-500/35 hover:to-orange-500/25 border border-amber-400/35 text-amber-100 text-sm font-semibold transition-all shadow-lg shadow-amber-500/15"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
          </Link>
          <Link
            href="/invest"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/15 hover:from-blue-500/30 hover:to-indigo-500/25 border border-blue-500/30 text-blue-200 text-sm font-medium transition-all shadow-lg shadow-blue-500/10"
          >
            Manage <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          {isActive && (() => {
            const on = !!investment?.autoCompound;
            return (
              <button
                onClick={() => compoundMutation.mutate({ data: { autoCompound: !on } })}
                disabled={compoundMutation.isPending}
                title={on ? "Profits auto-reinvest daily" : "Click to enable auto-reinvest"}
                className={`group inline-flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-semibold transition-all shadow-lg disabled:opacity-60 ${
                  on
                    ? "bg-gradient-to-r from-violet-500/25 via-fuchsia-500/15 to-purple-500/20 hover:from-violet-500/35 hover:to-purple-500/30 border-violet-400/40 text-violet-50 shadow-violet-500/25"
                    : "bg-gradient-to-r from-white/[0.04] to-white/[0.02] hover:from-white/[0.08] hover:to-white/[0.04] border-white/15 text-muted-foreground shadow-black/10"
                }`}
              >
                <Repeat className={`w-3.5 h-3.5 transition-transform ${on ? "text-violet-200" : ""} group-hover:rotate-180 duration-500`} />
                <span>Auto-Compound</span>
                {/* iOS-style toggle pill */}
                <span
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 border ${
                    on
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 border-violet-300/60 shadow-[0_0_12px_rgba(167,139,250,0.55)]"
                      : "bg-white/[0.06] border-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300 ${
                      on ? "translate-x-5" : "translate-x-0"
                    } ${compoundMutation.isPending ? "scale-75 opacity-80" : ""}`}
                  />
                  <span
                    className={`absolute inset-0 flex items-center ${
                      on ? "justify-start pl-1.5" : "justify-end pr-1.5"
                    } text-[9px] font-extrabold tracking-wider ${
                      on ? "text-white/90" : "text-muted-foreground/70"
                    }`}
                  >
                    {compoundMutation.isPending ? "" : on ? "ON" : "OFF"}
                  </span>
                </span>
              </button>
            );
          })()}
          {isActive && (
            <button
              onClick={handleStopTrading}
              disabled={stopMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500/15 to-rose-500/10 hover:from-red-500/25 hover:to-rose-500/20 border border-red-500/30 text-red-200 text-sm font-semibold transition-all shadow-lg shadow-red-500/10 disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
              {stopMutation.isPending ? "Stopping..." : "Stop Trading"}
            </button>
          )}
        </div>
      </div>

      {/* HERO — premium money-first block with multi-layer glow + shimmer top edge */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-[#0c1422] to-[#070b14] p-6 md:p-8 shadow-[0_8px_32px_-8px_rgba(16,185,129,0.25),0_1px_0_rgba(255,255,255,0.06)_inset]">
        {/* Animated shimmer top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        {/* Radial glows — top right + bottom left */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.30) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 w-72 h-72 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 70%)" }}
        />
        {/* Faint grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative flex items-center justify-between flex-wrap gap-3 mb-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full" />
            {isActive ? "Trading Active" : "Earning Live"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10">
            <CalendarDays className="w-3 h-3" />
            Started {daysRunning}d ago
            <span className="opacity-40">·</span>
            <Shield className="w-3 h-3 text-emerald-400/80" />
            {riskSafe.charAt(0).toUpperCase() + riskSafe.slice(1)} Risk
          </span>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* Total Invested — premium tile */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-4 md:p-5 transition-all hover:border-blue-400/25 hover:shadow-[0_8px_24px_-12px_rgba(59,130,246,0.4)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            <div
              className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-40 group-hover:opacity-60 transition-opacity"
              style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)" }}
            />
            <div className="relative flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/25 shadow-[0_0_12px_-4px_rgba(59,130,246,0.5)]">
                <Wallet className="w-3.5 h-3.5 text-blue-300" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/90 font-semibold">
                Total Invested
              </div>
            </div>
            <div className="relative text-3xl md:text-[2.1rem] font-extrabold text-white tabular-nums leading-none">
              <BigBalanceCounter value={investedAmount} className="inline" />
            </div>
            <div className="relative mt-2 text-[11px] text-muted-foreground/90 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-blue-400/60" />
              Principal capital
            </div>
          </div>

          {/* Current Value — premium tile */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-4 md:p-5 transition-all hover:border-cyan-400/25 hover:shadow-[0_8px_24px_-12px_rgba(34,211,238,0.4)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div
              className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-40 group-hover:opacity-60 transition-opacity"
              style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)" }}
            />
            <div className="relative flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/25 shadow-[0_0_12px_-4px_rgba(34,211,238,0.5)]">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/90 font-semibold">
                Current Value
              </div>
            </div>
            <div className="relative text-3xl md:text-[2.1rem] font-extrabold text-white tabular-nums leading-none">
              <BigBalanceCounter value={currentEquity} className="inline" />
            </div>
            <div className="relative mt-2 text-[11px] text-muted-foreground/90 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-cyan-400/60" />
              Mark-to-market equity
            </div>
          </div>

          {/* Net Profit — HERO premium tile with stronger glow */}
          <div className="group relative overflow-hidden rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent p-4 md:p-5 shadow-[0_8px_28px_-12px_rgba(16,185,129,0.45)] transition-all hover:border-emerald-400/55 hover:shadow-[0_10px_36px_-10px_rgba(16,185,129,0.6)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
            <div
              className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-60 group-hover:opacity-80 transition-opacity"
              style={{ background: "radial-gradient(circle, rgba(16,185,129,0.30) 0%, transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute -bottom-10 -left-10 w-28 h-28 rounded-full opacity-40"
              style={{ background: "radial-gradient(circle, rgba(34,197,94,0.20) 0%, transparent 70%)" }}
            />
            <div className="relative flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 shadow-[0_0_16px_-2px_rgba(16,185,129,0.7)]">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/95 font-semibold">
                  Net Profit
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-1.5 py-0.5 rounded">
                <span className="inline-block w-1 h-1 rounded-full bg-emerald-300 animate-pulse" />
                Live
              </span>
            </div>
            <div className="relative text-3xl md:text-[2.1rem] font-extrabold tabular-nums leading-none bg-gradient-to-r from-emerald-200 via-emerald-300 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(16,185,129,0.45)]">
              +<AnimatedCounter value={totalProfit} prefix="$" />
            </div>
            <div className="relative mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 rounded-md shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]">
              <ArrowUpRight className="w-3 h-3" />
              +{profitPct.toFixed(2)}% ROI
            </div>
          </div>
        </div>
      </div>

      {/* LIVE PROFIT FEED + NEXT TRADE STATUS — addictive engagement strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveProfitFeed enabled={isActive} />
        <NextTradeStatus enabled={isActive} />
      </div>

      {/* Investment Setup — premium metric tile grid */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1828] via-[#0a1322] to-[#070b14] p-5 md:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-400" /> Investment Setup
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full">
            Configuration
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              icon: Shield,
              label: "Risk Level",
              value: (investment?.riskLevel ?? "low").toString().charAt(0).toUpperCase() + (investment?.riskLevel ?? "low").toString().slice(1),
              color: "text-emerald-400",
              bg: "from-emerald-500/10 to-emerald-500/5",
              border: "border-emerald-500/20",
              iconBg: "bg-emerald-500/15",
            },
            {
              icon: Gauge,
              label: "Drawdown Limit",
              value: `${investment?.drawdownLimit?.toFixed?.(2) ?? "0.00"}%`,
              color: "text-amber-400",
              bg: "from-amber-500/10 to-amber-500/5",
              border: "border-amber-500/20",
              iconBg: "bg-amber-500/15",
            },
            {
              icon: Repeat,
              label: "Auto-Compound",
              value: investment?.autoCompound ? "Enabled" : "Disabled",
              color: investment?.autoCompound ? "text-emerald-400" : "text-muted-foreground",
              bg: investment?.autoCompound ? "from-emerald-500/10 to-emerald-500/5" : "from-white/5 to-white/[0.02]",
              border: investment?.autoCompound ? "border-emerald-500/20" : "border-white/10",
              iconBg: investment?.autoCompound ? "bg-emerald-500/15" : "bg-white/5",
            },
            {
              icon: CalendarDays,
              label: "Days Running",
              value: `${daysRunning}d`,
              color: "text-blue-300",
              bg: "from-blue-500/10 to-blue-500/5",
              border: "border-blue-500/20",
              iconBg: "bg-blue-500/15",
            },
            {
              icon: isActive ? Zap : CircleDot,
              label: "Status",
              value: isActive ? "Active" : "Paused",
              color: isActive ? "text-emerald-400" : "text-amber-400",
              bg: isActive ? "from-emerald-500/10 to-emerald-500/5" : "from-amber-500/10 to-amber-500/5",
              border: isActive ? "border-emerald-500/20" : "border-amber-500/20",
              iconBg: isActive ? "bg-emerald-500/15" : "bg-amber-500/15",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className={`relative overflow-hidden rounded-xl border ${tile.border} bg-gradient-to-br ${tile.bg} p-3.5 transition-all hover:border-white/20 hover:-translate-y-0.5 duration-200`}
            >
              <div className={`w-7 h-7 rounded-lg ${tile.iconBg} flex items-center justify-center mb-2`}>
                <tile.icon className={`w-3.5 h-3.5 ${tile.color}`} />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                {tile.label}
              </div>
              <div className={`text-sm md:text-base font-bold tabular-nums ${tile.color}`}>
                {tile.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Allocation — premium */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1828] via-[#0a1322] to-[#070b14] p-5 md:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" /> Asset Allocation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auto-balanced by your <span className="text-white capitalize">{riskSafe}</span> risk strategy
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Diversified
          </span>
        </div>

        {/* Premium stacked bar with glow + segment dividers */}
        <div className="relative">
          <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-white/15 shadow-inner">
            {allocation.map((a, i) => (
              <div
                key={a.label}
                style={{
                  width: `${a.pct}%`,
                  background: `linear-gradient(180deg, ${a.color} 0%, ${a.color}cc 100%)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 12px -2px ${a.color}80`,
                  borderRight: i < allocation.length - 1 ? "1px solid rgba(0,0,0,0.35)" : undefined,
                }}
                title={`${a.label} ${a.pct}%`}
              />
            ))}
          </div>
          {/* Subtle highlight overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {allocation.map((a) => {
            const dollarValue = (currentEquity * a.pct) / 100;
            return (
              <div
                key={a.label}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3.5 transition-all hover:border-white/20 hover:-translate-y-0.5 duration-200"
                style={{ boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset` }}
              >
                {/* Color accent strip */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: `linear-gradient(180deg, ${a.color}, ${a.color}66)`, boxShadow: `0 0 12px ${a.color}80` }}
                />
                <div className="flex items-center justify-between mb-1.5 pl-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: a.color, boxShadow: `0 0 8px ${a.color}` }}
                    />
                    <span className="text-[11px] font-medium text-white/90 truncate">{a.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{a.pct}%</span>
                </div>
                <div className="pl-1.5 text-base font-bold text-white tabular-nums leading-tight">
                  ${fmtMoney(dollarValue)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stop Trading Confirmation Modal */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !stopMutation.isPending && setShowStopConfirm(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-[#121826] via-[#0d1320] to-[#0a0f1a] shadow-[0_20px_60px_-10px_rgba(239,68,68,0.35),0_1px_0_rgba(255,255,255,0.06)_inset] animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* shimmer top edge */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
            {/* radial glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/25 to-rose-500/15 border border-red-400/40 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <AlertTriangle className="w-6 h-6 text-red-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white">Stop Trading?</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Your active position will be closed and your capital returned to your wallet balance. This action cannot be undone.
                  </p>
                </div>
              </div>

              {investment && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Capital returning</div>
                    <div className="mt-1 text-base font-bold text-white tabular-nums">
                      ${fmtMoney(Number(investment.principal || 0))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">Profit earned</div>
                    <div className="mt-1 text-base font-bold text-emerald-300 tabular-nums">
                      ${fmtMoney(Number(investment.totalProfit || 0))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowStopConfirm(false)}
                  disabled={stopMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-sm font-semibold text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStopTrading}
                  disabled={stopMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 border border-red-400/50 text-sm font-bold text-white transition-all shadow-lg shadow-red-500/30 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {stopMutation.isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Stopping...
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      Yes, Stop Trading
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentTradeAttribution() {
  const { data: tradesData } = useGetTrades(
    { limit: 5 },
    { query: { refetchInterval: 15000 } },
  );
  const trades = tradesData?.trades ?? [];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1828] via-[#0a1322] to-[#070b14] p-5 md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Recent Trade Attribution
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 5 closed trades contributing to portfolio P&amp;L
          </p>
        </div>
        <Link
          href="/trade-activity"
          className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 px-3 py-1.5 rounded-lg transition-all"
        >
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="py-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">
            No closed trades yet — your portfolio is warming up.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((t: any) => {
            const profit = parseFloat(String(t.profit ?? 0));
            const profitPctNum = parseFloat(String(t.profitPercent ?? 0));
            const isWin = profit >= 0;
            return (
              <div
                key={t.id}
                className={`relative overflow-hidden flex items-center justify-between p-3 rounded-xl border transition-all hover:-translate-y-0.5 duration-200 ${
                  isWin
                    ? "bg-gradient-to-r from-emerald-500/[0.06] to-transparent border-emerald-500/15 hover:border-emerald-500/30"
                    : "bg-gradient-to-r from-red-500/[0.06] to-transparent border-red-500/15 hover:border-red-500/30"
                }`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isWin ? "bg-emerald-400" : "bg-red-400"
                  }`}
                  style={{ boxShadow: isWin ? "0 0 12px #34d39988" : "0 0 12px #f8717188" }}
                />
                <div className="flex items-center gap-3 min-w-0 pl-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      t.side === "BUY"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-red-500/15 text-red-300 border border-red-500/30"
                    }`}
                  >
                    {t.side}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{t.symbol}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      Entry <span className="text-white/80">{t.entryPrice}</span>
                      <span className="opacity-40 mx-1">→</span>
                      Exit <span className="text-white/80">{t.exitPrice}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm md:text-base font-extrabold tabular-nums ${
                      isWin ? "text-emerald-300" : "text-red-300"
                    }`}
                    style={{
                      textShadow: isWin
                        ? "0 0 16px rgba(52,211,153,0.35)"
                        : "0 0 16px rgba(248,113,113,0.35)",
                    }}
                  >
                    {isWin ? "+" : ""}${fmtMoney(Math.abs(profit))}
                  </div>
                  <div
                    className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded mt-0.5 ${
                      isWin
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        : "text-red-400 bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    {isWin ? "+" : ""}{profitPctNum.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 60000 } });
  return (
    <Layout>
      <PortfolioInner />
      <div className="px-4 md:px-8 pt-2 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                Performance Insights
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Equity curve, daily P&amp;L, rolling returns &amp; key metrics
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Data
          </span>
        </div>
      </div>
      <div className="portfolio-insights px-4 md:px-8 pb-2 max-w-7xl mx-auto">
        <DemoDashboardBody
          hideHeader
          hideFomoTicker
          hideMarketIndicators
          hideGrowthPanel
          hideFundTransparency
          hideLiveTrades
          hidePrimaryStatCards
          swapEquityWithRolling
        />
      </div>
      {summary?.vip && (
        <div className="px-4 md:px-8 pb-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">VIP Membership</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <VipCard vip={summary.vip as VipInfo} investmentAmount={summary.activeInvestment ?? 0} />
        </div>
      )}
      <div className="px-4 md:px-8 pb-8 max-w-7xl mx-auto">
        <RecentTradeAttribution />
      </div>
    </Layout>
  );
}
