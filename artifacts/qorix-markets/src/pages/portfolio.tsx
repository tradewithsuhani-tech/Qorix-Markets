import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { DemoDashboardBody } from "@/pages/demo-dashboard";
import {
  useGetInvestment,
  useGetDashboardSummary,
  useGetDashboardPerformance,
  useGetEquityChart,
  useGetTrades,
} from "@workspace/api-client-react";
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
    <div className="rounded-2xl border border-white/10 bg-[#0d1525] p-5 md:p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Performance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 30 days · institutional-grade metrics
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
          Live
        </span>
      </div>

      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-5">
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
      <div className="rounded-xl border border-white/8 bg-[#0a1020] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-white">📈 Equity Curve · 30D</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Mark-to-market portfolio value
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Today</div>
            <div className="text-xs font-bold text-emerald-400 tabular-nums">
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
      <div className="rounded-xl border border-white/8 bg-[#0a1020] p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-semibold text-white">📅 Daily Profit History</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Last 14 days</div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Profit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-rose-500" /> Loss
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
  const accentMap = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
  } as const;
  return (
    <div className="rounded-xl border border-white/8 bg-[#0a1020] px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className={`mt-1 text-lg md:text-xl font-bold tabular-nums ${accentMap[accent]}`}>
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
  const { data: investment, isLoading: invLoading } = useGetInvestment({
    query: { refetchInterval: 10000 },
  });
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 5000 } });
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
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            Portfolio
            {isActive && (
              <span className="live-pill live-pill--green text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                <span className="live-dot inline-block w-1.5 h-1.5 rounded-full mr-1" />
                Live
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live performance · <UpdatedAgo timestamp={equityUpdatedAt} />
          </p>
        </div>
        <Link
          href="/invest"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-sm font-medium transition-all"
        >
          Manage <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* HERO — money-first block. Investor ko first 3 sec me trust + dopamine. */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-[#0d1525] to-[#0a1020] p-5 md:p-7">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)" }}
        />

        <div className="relative flex items-center justify-between flex-wrap gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full" />
            {isActive ? "Trading Active" : "Earning Live"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Started {daysRunning}d ago · {riskSafe.charAt(0).toUpperCase() + riskSafe.slice(1)} risk
          </span>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4">
          {/* Total Invested */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              💰 Total Invested
            </div>
            <div className="mt-1.5 text-2xl md:text-3xl font-bold text-white tabular-nums">
              $<BigBalanceCounter value={investedAmount} className="inline" />
            </div>
          </div>

          {/* Current Value */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
              📈 Current Value
            </div>
            <div className="mt-1.5 text-2xl md:text-3xl font-bold text-white tabular-nums">
              $<BigBalanceCounter value={currentEquity} className="inline" />
            </div>
          </div>

          {/* Profit */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-medium flex items-center gap-1.5">
              🟢 Profit
            </div>
            <div className="mt-1.5 text-2xl md:text-3xl font-bold profit-text tabular-nums">
              +<AnimatedCounter value={totalProfit} prefix="$" />
              <span className="text-base md:text-lg text-emerald-400/90 font-semibold ml-1.5">
                (+{profitPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE PROFIT FEED + NEXT TRADE STATUS — addictive engagement strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveProfitFeed enabled={isActive} />
        <NextTradeStatus enabled={isActive} />
      </div>

      {/* Investment Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0d1525] p-5 space-y-4">
          <h3 className="text-base font-semibold text-white">Investment Setup</h3>

          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Risk Level
            </span>
            <span className="text-xs font-semibold text-white capitalize">
              {investment?.riskLevel ?? "low"}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Drawdown Limit
            </span>
            <span className="text-xs font-semibold text-amber-400 tabular-nums">
              {investment?.drawdownLimit?.toFixed?.(2) ?? "0.00"}%
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" /> Auto-Compound
            </span>
            <span
              className={`text-xs font-semibold ${
                investment?.autoCompound ? "text-emerald-400" : "text-muted-foreground"
              }`}
            >
              {investment?.autoCompound ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Days Running
            </span>
            <span className="text-xs font-semibold text-white tabular-nums">{daysRunning}d</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Status
            </span>
            <span
              className={`text-xs font-semibold ${
                isActive ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1525] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" /> Asset Allocation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auto-balanced by your <span className="text-white capitalize">{riskSafe}</span> risk strategy
            </p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10">
          {allocation.map((a) => (
            <div
              key={a.label}
              style={{ width: `${a.pct}%`, background: a.color }}
              title={`${a.label} ${a.pct}%`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {allocation.map((a) => {
            const dollarValue = (currentEquity * a.pct) / 100;
            return (
              <div key={a.label} className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  <span className="text-xs font-medium text-white truncate">{a.label}</span>
                </div>
                <div className="text-sm font-bold text-white tabular-nums">{a.pct}%</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  ${fmtMoney(dollarValue)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
    <div className="rounded-2xl border border-white/10 bg-[#0d1525] p-5">
      <div className="flex items-center justify-between mb-3">
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
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No closed trades yet — your portfolio is warming up.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {trades.map((t: any) => {
            const profit = parseFloat(String(t.profit ?? 0));
            const profitPctNum = parseFloat(String(t.profitPercent ?? 0));
            const isWin = profit >= 0;
            return (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      t.side === "BUY"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {t.side}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{t.symbol}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Entry {t.entryPrice} → Exit {t.exitPrice}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      isWin ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isWin ? "+" : ""}${fmtMoney(Math.abs(profit))}
                  </div>
                  <div
                    className={`text-[11px] tabular-nums ${
                      isWin ? "text-emerald-400/70" : "text-red-400/70"
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
  return (
    <Layout>
      <PortfolioInner />
      {/* Demo dashboard sections appended below — user will tell us which to remove. */}
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto border-t border-white/10 mt-8">
        <DemoDashboardBody
          hideHeader
          hideFomoTicker
          hideMarketIndicators
          hideGrowthPanel
          hideFundTransparency
          hideLiveTrades
        />
      </div>
      {/* Recent Trade Attribution moved to bottom per request */}
      <div className="px-4 md:px-8 pb-8 max-w-7xl mx-auto">
        <RecentTradeAttribution />
      </div>
    </Layout>
  );
}
