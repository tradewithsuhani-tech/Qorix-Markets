import { Layout } from "@/components/layout";
import { isFeatureHidden } from "@/lib/hidden-features";
import { Link } from "wouter";
import { DemoDashboardBody } from "@/pages/dashboard";
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
  type GetInvestmentQueryResult,
  type GetDashboardSummaryQueryResult,
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
  LineChart,
  Calendar,
  Target,
} from "lucide-react";
import { AnimatedCounter, BigBalanceCounter } from "@/components/animated-counter";
import { UpdatedAgo } from "@/components/updated-ago";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
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

// ---------------------------------------------------------------------------
// Daily Return Projection helpers
// ---------------------------------------------------------------------------
// Each risk tier maps to a monthly return % range. Average is used to derive
// the monthly target $; the range is shown to the user as a band.
// Fixed monthly target per risk tier — distributed evenly across 22 forex
// trading days. Conservative 4%/mo, Balanced 6%/mo, Aggressive 8%/mo.
// Daily rate ≈ monthly / 22.
const MONTHLY_RETURN_BY_RISK: Record<RiskKey, { min: number; max: number; avg: number }> = {
  low: { min: 4, max: 4, avg: 4 },
  medium: { min: 6, max: 6, avg: 6 },
  high: { min: 8, max: 8, avg: 8 },
};

// Mulberry32 — tiny seeded PRNG, deterministic per (seed) so the daily
// breakdown stays stable across renders for the same user/month.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Forex working days = Mon–Fri (skip Sat/Sun). Returns Date[] for given month.
function forexWorkingDaysOfMonth(year: number, month0: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dt = new Date(year, month0, d);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) days.push(dt);
  }
  return days;
}

type DayProjection = {
  date: Date;
  amount: number;
  pct: number; // share of monthly target (%)
  isToday: boolean;
  isPast: boolean;
};

function buildDailyProjection(args: {
  amount: number;
  riskKey: RiskKey;
  year: number;
  month0: number;
}): {
  monthlyTarget: number;
  monthlyMinPct: number;
  monthlyMaxPct: number;
  monthlyAvgPct: number;
  workingDays: number;
  dailyAvg: number;
  todayAmount: number;
  mtdProjected: number;
  remainingProjected: number;
  days: DayProjection[];
} {
  const tier = MONTHLY_RETURN_BY_RISK[args.riskKey];
  const monthlyTarget = (args.amount * tier.avg) / 100;
  const days = forexWorkingDaysOfMonth(args.year, args.month0);
  const n = days.length;

  // Seed: amount + tier + year/month so it's stable but unique per user/month.
  const seed =
    Math.floor(args.amount * 100) +
    args.year * 1000 +
    (args.month0 + 1) * 31 +
    (args.riskKey === "low" ? 1 : args.riskKey === "medium" ? 2 : 3) * 7919;
  const rand = mulberry32(seed);

  // Generate weights in 0.6..1.4 then normalize so sum * monthlyTarget = monthlyTarget.
  const raw: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.6 + rand() * 0.8;
    raw.push(w);
    total += w;
  }

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === args.year && today.getMonth() === args.month0;
  const todayDate = today.getDate();

  let mtd = 0;
  let todayAmt = 0;
  const projection: DayProjection[] = days.map((dt, i) => {
    const share = raw[i] / total;
    const amount = +(share * monthlyTarget).toFixed(2);
    const pct = +(share * 100).toFixed(2);
    const isToday = isCurrentMonth && dt.getDate() === todayDate;
    const isPast = isCurrentMonth ? dt.getDate() < todayDate : false;
    if (isPast || isToday) mtd += amount;
    if (isToday) todayAmt = amount;
    return { date: dt, amount, pct, isToday, isPast };
  });

  return {
    monthlyTarget: +monthlyTarget.toFixed(2),
    monthlyMinPct: tier.min,
    monthlyMaxPct: tier.max,
    monthlyAvgPct: tier.avg,
    workingDays: n,
    dailyAvg: +(monthlyTarget / Math.max(1, n)).toFixed(2),
    todayAmount: +todayAmt.toFixed(2),
    mtdProjected: +mtd.toFixed(2),
    remainingProjected: +(monthlyTarget - mtd).toFixed(2),
    days: projection,
  };
}

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
    <div className="rounded-2xl border border-emerald-500/20 bg-[#0d1525] p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="live-dot inline-block w-2 h-2 rounded-full shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300 whitespace-nowrap">
            Live Profit Feed
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
          auto-refreshing
        </span>
      </div>

      {/* Ticker row — latest tick on left, fades right */}
      <div className="flex items-end gap-3 sm:gap-5 min-h-[52px] overflow-hidden">
        {ticks.length === 0 ? (
          <div className="text-2xl md:text-3xl font-bold text-emerald-400/40 tabular-nums whitespace-nowrap">
            +$0.00…
          </div>
        ) : (
          ticks.map((t, i) => (
            <div
              key={t.id}
              className={
                "tabular-nums font-bold transition-all duration-500 whitespace-nowrap " +
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
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        <span className="text-[11px] sm:text-xs text-muted-foreground truncate">
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

  // Per-phase theming so the whole card breathes the current state.
  const theme =
    phase === "scanning"
      ? { ring: "border-blue-500/25", bg: "bg-blue-500/10", dot: "bg-blue-400", text: "text-blue-300", accent: "from-blue-500/40 via-blue-400/20" }
      : phase === "signal"
      ? { ring: "border-amber-500/30", bg: "bg-amber-500/10", dot: "bg-amber-400", text: "text-amber-300", accent: "from-amber-500/40 via-amber-400/20" }
      : { ring: "border-emerald-500/30", bg: "bg-emerald-500/10", dot: "bg-emerald-400", text: "text-emerald-300", accent: "from-emerald-500/40 via-emerald-400/20" };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#0d1525] p-4 sm:p-5 overflow-hidden">
      {/* Phase-colored accent bar at the top */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${theme.accent} to-transparent`} />

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground whitespace-nowrap">
            Next Trade Status
          </span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${theme.ring} ${theme.bg} whitespace-nowrap shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          <span className={`text-[10px] font-semibold tracking-wider ${theme.text}`}>AUTO ENGINE</span>
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Phase icon — fixed size, color-themed container */}
        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border ${theme.ring} ${theme.bg} flex items-center justify-center shrink-0`}>
          {phase === "scanning" && (
            <div className="flex items-end gap-[3px] h-5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-blue-400 scan-bar"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
          {phase === "signal" && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
            </span>
          )}
          {phase === "countdown" && (
            <Activity className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          {phase === "scanning" && (
            <>
              <div className="text-sm sm:text-base font-bold text-white truncate">
                Scanning markets<span className="dots-anim" />
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Analyzing <span className="text-white/80 font-semibold">87</span> instruments · FX, Gold, Indices
              </div>
            </>
          )}
          {phase === "signal" && (
            <>
              <div className="text-sm sm:text-base font-bold text-amber-300 truncate">
                Signal detected<span className="dots-anim" />
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                Risk-checked · queueing execution
              </div>
            </>
          )}
          {phase === "countdown" && (
            <>
              <div className="text-sm sm:text-base font-bold text-white truncate">
                Next trade in{" "}
                <span className="text-emerald-400 tabular-nums font-mono">
                  {mm}:{ss}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                Holding for optimal entry window
              </div>
            </>
          )}
        </div>
      </div>

      {/* Phase indicator strip — bottom, full-width, segmented progress */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
          {(["scanning", "signal", "countdown"] as Phase[]).map((p) => {
            const active = p === phase;
            return (
              <div
                key={p}
                className={
                  "h-1 rounded-full transition-all duration-500 " +
                  (active ? `flex-[2] ${theme.dot}` : "flex-1 bg-white/10")
                }
              />
            );
          })}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold whitespace-nowrap">
          {phase === "scanning" ? "Phase 1 / 3" : phase === "signal" ? "Phase 2 / 3" : "Phase 3 / 3"}
        </span>
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
    query: { refetchInterval: 120000 },
  });
  const { data: pnlHistory } = useQuery<Array<{ date: string; percent: number; amount: number }>>({
    queryKey: ["dashboard-pnl-history", 14],
    queryFn: () => authFetch(`/api/dashboard/pnl-history?days=14`),
    refetchInterval: 120000,
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

// Investment + summary are owned by PortfolioPage and passed down so we don't
// run two React Query subscriptions for the same query keys. Both pieces of
// data are consumed heavily inside PortfolioInner *and* by the page-level
// "Performance Insights" lock + VIP card, so lifting the queries to the parent
// keeps the network fetch count to one per key.
// React Query's `data` is `T | undefined` until first successful fetch.
type InvestmentData = GetInvestmentQueryResult | undefined;
type SummaryData = GetDashboardSummaryQueryResult | undefined;

interface PortfolioInnerProps {
  investment: InvestmentData;
  invLoading: boolean;
  summary: SummaryData;
}

function PortfolioInner({ investment, invLoading, summary }: PortfolioInnerProps) {
  const queryClient = useQueryClient();
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
    stopMutation.mutate(undefined, { onSettled: () => setShowStopConfirm(false) });
  };
  const { data: equity, dataUpdatedAt: equityUpdatedAt } = useGetEquityChart(
    { days: 30 },
    { query: { refetchInterval: 60000 } },
  );
  const { data: tradesData } = useGetTrades(
    { limit: 5 },
    { query: { refetchInterval: 60000 } },
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
  const trades = tradesData ?? [];

  // Daily Return Projection (forex working days, deterministic per user/month)
  const now = new Date();
  // todayKey ensures projection re-derives on day rollover so "Today" /
  // MTD markers don't go stale within the same month.
  const todayKey = now.toDateString();
  const projection = useMemo(
    () =>
      buildDailyProjection({
        amount: investedAmount,
        riskKey: riskSafe,
        year: now.getFullYear(),
        month0: now.getMonth(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investedAmount, riskSafe, todayKey],
  );
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Locked state — either user hasn't invested yet, or trading is stopped.
  // In both cases: data shows zero, all features locked, single CTA to start trading.
  if (false && !invLoading && (investedAmount <= 0 || !isActive)) {
    const hasStoppedInvestment = investedAmount > 0 && !isActive;
    return (
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your trading fund, returns and live allocation in one place.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/8 via-[#0d1525] to-[#0a1020] p-6 md:p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
            {hasStoppedInvestment ? (
              <Lock className="w-8 h-8 text-amber-400" />
            ) : (
              <PieChart className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">
            {hasStoppedInvestment ? "Trading is paused" : "No active portfolio yet"}
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md mx-auto">
            {hasStoppedInvestment
              ? "Your trading fund is idle. Resume trading to unlock live portfolio tracking, returns and P&L."
              : "Start your first trading fund to unlock live portfolio tracking, asset allocation, risk-protected drawdown limits and daily P&L attribution."}
          </p>
          <Link
            href="/invest"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-all shadow-lg shadow-emerald-500/30"
          >
            <Sparkles className="w-4 h-4" />
            {hasStoppedInvestment ? "Resume Trading" : "Start Trading"}
            <ArrowUpRight className="w-4 h-4" />
          </Link>

          {/* Zero-data stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 max-w-4xl mx-auto">
            {[
              { label: "Trading Fund", value: "$0.00" },
              { label: "Total P&L", value: "$0.00" },
              { label: "Rolling Return", value: "0.00%" },
              { label: "Win Rate", value: "0%" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/8 bg-white/3 px-3 py-3 text-left"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                  {s.label}
                </div>
                <div className="text-lg font-bold text-muted-foreground mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Locked features teaser */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 max-w-4xl mx-auto">
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
          {isActive ? (
            <Link
              href="/withdraw"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/15 hover:from-amber-500/35 hover:to-orange-500/25 border border-amber-400/35 text-amber-100 text-sm font-semibold transition-all shadow-lg shadow-amber-500/15"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Start trading to enable"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground text-sm font-semibold cursor-not-allowed opacity-60"
            >
              <Lock className="w-3.5 h-3.5" /> Withdraw
            </button>
          )}
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
                    ? "bg-gradient-to-r from-emerald-500/25 via-green-500/15 to-emerald-500/20 hover:from-emerald-500/35 hover:to-emerald-500/30 border-emerald-400/40 text-emerald-50 shadow-emerald-500/25"
                    : "bg-gradient-to-r from-white/[0.04] to-white/[0.02] hover:from-white/[0.08] hover:to-white/[0.04] border-white/15 text-muted-foreground shadow-black/10"
                }`}
              >
                <Repeat className={`w-3.5 h-3.5 transition-transform ${on ? "text-emerald-200" : ""} group-hover:rotate-180 duration-500`} />
                <span>Auto-Compound</span>
                {/* iOS-style toggle pill */}
                <span
                  className={`relative inline-flex items-center h-6 w-14 rounded-full transition-colors duration-300 border ${
                    on
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-300/60 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
                      : "bg-white/[0.06] border-white/15"
                  }`}
                >
                  <span
                    className={`absolute inset-0 flex items-center ${
                      on ? "justify-start pl-2" : "justify-end pr-2"
                    } text-[9px] font-extrabold tracking-wider ${
                      on ? "text-white/90" : "text-muted-foreground/80"
                    }`}
                  >
                    {compoundMutation.isPending ? "" : on ? "ON" : "OFF"}
                  </span>
                  <span
                    className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full shadow-md transition-all duration-300 ${
                      on
                        ? "translate-x-[32px] bg-gradient-to-br from-emerald-300 to-green-500 shadow-emerald-900/50"
                        : "translate-x-0 bg-gradient-to-br from-red-400 to-rose-600 shadow-red-900/50"
                    } ${compoundMutation.isPending ? "scale-75 opacity-80" : ""}`}
                  />
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
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1828] via-[#0a1322] to-[#070b14] p-4 sm:p-5 md:p-6">
        {/* Top hairline highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        {/* Subtle ambient glow in the corner */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)" }}
        />

        <div className="relative flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white whitespace-nowrap leading-tight">
                Investment Setup
              </h3>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mt-0.5 whitespace-nowrap">
                Strategy parameters
              </div>
            </div>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border whitespace-nowrap shrink-0",
            isActive
              ? "bg-emerald-500/10 border-emerald-500/25"
              : "bg-amber-500/10 border-amber-500/25"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            )} />
            <span className={cn(
              "text-[10px] font-bold tracking-wider uppercase",
              isActive ? "text-emerald-300" : "text-amber-300"
            )}>
              {isActive ? "Active" : "Paused"}
            </span>
          </span>
        </div>

        {/* 4 tiles — 2-col mobile, 4-col desktop. Status moved to header pill so we
            avoid the orphaned 5th tile that used to sit alone on a new row. */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            {
              icon: Shield,
              label: "Risk Level",
              value: (investment?.riskLevel ?? "low").toString().charAt(0).toUpperCase() + (investment?.riskLevel ?? "low").toString().slice(1),
              hint: (() => {
                const r = (investment?.riskLevel ?? "low").toString().toLowerCase();
                if (r === "high") return "Aggressive growth";
                if (r === "medium") return "Balanced approach";
                return "Conservative & safe";
              })(),
              color: "text-emerald-400",
              bg: "from-emerald-500/[0.08] to-emerald-500/[0.02]",
              border: "border-emerald-500/20",
              iconBg: "bg-emerald-500/15",
              ring: "shadow-[inset_0_1px_0_0_rgba(16,185,129,0.08)]",
            },
            {
              icon: Gauge,
              label: "Drawdown",
              value: `${investment?.drawdownLimit?.toFixed?.(2) ?? "0.00"}%`,
              hint: "Max allowed loss",
              color: "text-amber-400",
              bg: "from-amber-500/[0.08] to-amber-500/[0.02]",
              border: "border-amber-500/20",
              iconBg: "bg-amber-500/15",
              ring: "shadow-[inset_0_1px_0_0_rgba(245,158,11,0.08)]",
            },
            {
              icon: Repeat,
              label: "Auto-Compound",
              value: investment?.autoCompound ? "Enabled" : "Disabled",
              hint: investment?.autoCompound ? "Profits reinvested daily" : "Profits paid out daily",
              color: investment?.autoCompound ? "text-emerald-400" : "text-slate-300",
              bg: investment?.autoCompound ? "from-emerald-500/[0.08] to-emerald-500/[0.02]" : "from-white/[0.04] to-white/[0.01]",
              border: investment?.autoCompound ? "border-emerald-500/20" : "border-white/10",
              iconBg: investment?.autoCompound ? "bg-emerald-500/15" : "bg-white/5",
              ring: "",
            },
            {
              icon: CalendarDays,
              label: "Days Running",
              value: `${daysRunning}d`,
              hint: daysRunning >= 30 ? "Diamond hands" : "Building streak",
              color: "text-blue-300",
              bg: "from-blue-500/[0.08] to-blue-500/[0.02]",
              border: "border-blue-500/20",
              iconBg: "bg-blue-500/15",
              ring: "shadow-[inset_0_1px_0_0_rgba(59,130,246,0.08)]",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25",
                tile.border, tile.bg, tile.ring
              )}
            >
              {/* Hover sheen */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.04] to-transparent" />

              <div className="relative flex items-start justify-between mb-2.5">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", tile.iconBg)}>
                  <tile.icon className={cn("w-3.5 h-3.5", tile.color)} />
                </div>
              </div>
              <div className="relative text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 truncate">
                {tile.label}
              </div>
              <div className={cn("relative text-base sm:text-lg font-bold tabular-nums leading-tight truncate", tile.color)}>
                {tile.value}
              </div>
              <div className="relative text-[10px] text-muted-foreground/70 mt-1 truncate">
                {tile.hint}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Return Projection — investment-based forex-day breakdown */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.06] via-[#0a1322] to-[#070b14] p-4 sm:p-5 md:p-6">
        {/* Top hairline highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)" }}
        />
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mb-5">
          {/* Row 1: icon + title + pill — single line, no wrap */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]">
                <LineChart className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-white whitespace-nowrap leading-tight">
                Daily Returns
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 sm:py-1 rounded-full font-bold shrink-0">
              <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="whitespace-nowrap">{projection.workingDays} Days</span>
            </span>
          </div>
          {/* Row 2: description — full width below, no indent on mobile so it fits 1 line */}
          <p className="text-[10.5px] sm:text-xs text-muted-foreground leading-relaxed sm:pl-[46px] whitespace-nowrap overflow-hidden text-ellipsis">
            Indicative profit · Mon–Fri · {monthLabel}
          </p>
        </div>

        {investedAmount <= 0 ? (
          <div className="relative rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">
              Start a trading fund to see your daily profit projection.
            </div>
          </div>
        ) : (
          <>
            {/* Hero: Monthly Potential — full-width premium showcase */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.14] via-emerald-500/[0.05] to-transparent p-4 sm:p-5 mb-3 shadow-[0_0_32px_-12px_rgba(16,185,129,0.5)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
              <div
                className="pointer-events-none absolute -bottom-16 -left-12 w-56 h-56 rounded-full opacity-50"
                style={{ background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)" }}
              />
              <div className="relative flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                        <Target className="w-3.5 h-3.5 text-emerald-300" />
                      </div>
                      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-emerald-300 font-bold whitespace-nowrap">
                        Monthly Potential
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-200/90 bg-emerald-500/15 border border-emerald-400/30 px-1.5 py-0.5 rounded font-bold shrink-0 whitespace-nowrap">
                      <Sparkles className="w-2.5 h-2.5" /> Projected
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tabular-nums bg-gradient-to-r from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent leading-none">
                      ${((investedAmount * projection.monthlyMinPct) / 100).toFixed(2)}
                    </span>
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-300/70 tabular-nums leading-none">
                      –
                    </span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tabular-nums bg-gradient-to-r from-emerald-200 via-emerald-300 to-green-400 bg-clip-text text-transparent leading-none">
                      ${((investedAmount * projection.monthlyMaxPct) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-emerald-200/80 font-medium">
                      <TrendingUp className="w-3 h-3" />
                      {projection.monthlyMinPct}–{projection.monthlyMaxPct}%
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>Estimated monthly range</span>
                  </div>
                </div>
                {/* Mini sparkline-style progress visual */}
                <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0 pt-1">
                  <div className="flex items-end gap-0.5 h-10">
                    {[40, 55, 45, 70, 60, 80, 65, 90, 75, 100].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-sm bg-gradient-to-t from-emerald-500/30 to-emerald-300/80"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-emerald-300/70 font-bold">
                    Trend
                  </div>
                </div>
              </div>
            </div>

            {/* Supporting metrics — list on mobile (horizontal flow, no truncation),
                3-col grid on tablet+ */}
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
              {[
                {
                  icon: Wallet,
                  label: "Investment",
                  value: `$${investedAmount.toFixed(2)}`,
                  sub: `${riskSafe.charAt(0).toUpperCase() + riskSafe.slice(1)} risk strategy`,
                  color: "text-blue-300",
                  iconBg: "bg-blue-500/20 border-blue-400/30",
                  border: "border-blue-500/20 hover:border-blue-400/40",
                  bg: "from-blue-500/[0.08] to-blue-500/[0.02]",
                },
                {
                  icon: TrendingUp,
                  label: "Range",
                  value: `${projection.monthlyMinPct}–${projection.monthlyMaxPct}%`,
                  sub: "Monthly performance band",
                  color: "text-violet-300",
                  iconBg: "bg-violet-500/20 border-violet-400/30",
                  border: "border-violet-500/20 hover:border-violet-400/40",
                  bg: "from-violet-500/[0.08] to-violet-500/[0.02]",
                },
                {
                  icon: Activity,
                  label: "Today",
                  value: `$${projection.todayAmount.toFixed(2)}`,
                  sub: investedAmount > 0
                    ? `+${((projection.todayAmount / investedAmount) * 100).toFixed(3)}% on capital`
                    : "—",
                  color: "text-amber-300",
                  iconBg: "bg-amber-500/20 border-amber-400/30",
                  border: "border-amber-500/20 hover:border-amber-400/40",
                  bg: "from-amber-500/[0.08] to-amber-500/[0.02]",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-3.5 transition-all hover:-translate-y-0.5 duration-200",
                    m.border, m.bg
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.04] to-transparent" />

                  {/* Mobile: horizontal layout (icon left, content right) — full width, no truncation */}
                  <div className="relative flex sm:hidden items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", m.iconBg)}>
                      <m.icon className={cn("w-4 h-4", m.color)} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className={cn("text-[10px] uppercase tracking-wider font-bold", m.color)}>
                          {m.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {m.sub}
                        </div>
                      </div>
                      <div className="text-base font-bold text-white tabular-nums shrink-0">
                        {m.value}
                      </div>
                    </div>
                  </div>

                  {/* Tablet+: stacked layout */}
                  <div className="relative hidden sm:block">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center shrink-0", m.iconBg)}>
                        <m.icon className={cn("w-3 h-3", m.color)} />
                      </div>
                      <div className={cn("text-[10px] uppercase tracking-wider font-bold", m.color)}>
                        {m.label}
                      </div>
                    </div>
                    <div className="text-lg md:text-xl font-bold text-white tabular-nums leading-tight">
                      {m.value}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {m.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Today + MTD strip */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              {(() => {
                const dow = now.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isTradingDay = !isWeekend && projection.todayAmount > 0;
                return (
                  <div className="md:col-span-1 rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.10] to-emerald-500/[0.02] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                        {isTradingDay ? "Today's Profit" : "Markets Closed"}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded ${isTradingDay ? "text-emerald-300 bg-emerald-500/15 border-emerald-400/30" : "text-amber-300 bg-amber-500/15 border-amber-400/30"}`}>
                        <span className={`inline-block w-1 h-1 rounded-full ${isTradingDay ? "bg-emerald-300 animate-pulse" : "bg-amber-300"}`} />
                        {isTradingDay ? "Live" : "Off"}
                      </span>
                    </div>
                    {isTradingDay ? (
                      <>
                        <div className="text-2xl md:text-3xl font-extrabold tabular-nums bg-gradient-to-r from-emerald-200 to-green-400 bg-clip-text text-transparent">
                          ${projection.todayAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Settles at end of session
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl md:text-2xl font-bold text-white">
                          Weekend Pause
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Forex desk resumes Monday
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Earned This Month
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  ${projection.mtdProjected.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
                  {investedAmount > 0
                    ? `+${((projection.mtdProjected / investedAmount) * 100).toFixed(2)}% on capital · ${monthLabel}`
                    : monthLabel}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Active Trading Days Left
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {projection.days.filter((d) => !d.isPast && !d.isToday).length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  Forex sessions remaining this month
                </div>
              </div>
            </div>

            {/* Daily breakdown calendar grid — premium */}
            <div className="relative">
              {(() => {
                const totalDays = projection.days.length;
                const settledDays = projection.days.filter((d) => d.isPast).length;
                const todayDays = projection.days.filter((d) => d.isToday).length;
                const completedDays = settledDays + todayDays;
                const settledAmount = projection.days
                  .filter((d) => d.isPast || d.isToday)
                  .reduce((s, d) => s + d.amount, 0);
                const progressPct = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

                return (
                  <>
                    {/* Header row */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-xs uppercase tracking-wider text-white font-bold whitespace-nowrap">
                              Daily Breakdown
                            </div>
                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium whitespace-nowrap">
                              Forex working days
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold tabular-nums">
                            {completedDays}/{totalDays}
                          </div>
                          <div className="text-[9px] text-muted-foreground tabular-nums">
                            ${settledAmount.toFixed(2)} earned
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="relative h-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500/80 via-emerald-400 to-green-400 transition-all duration-700 shadow-[0_0_12px_-2px_rgba(16,185,129,0.6)]"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Legend */}
                      <div className="flex items-center justify-between flex-wrap gap-2 mt-2.5">
                        <div className="flex items-center gap-2.5 text-[9px] sm:text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                            <span className="font-semibold text-emerald-300/90">Today</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-emerald-500/40" />
                            <span>Settled</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-blue-400/40" />
                            <span>Upcoming</span>
                          </span>
                        </div>
                        <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold tabular-nums">
                          {progressPct.toFixed(0)}% complete
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-1.5 sm:gap-2">
                {projection.days.map((d, idx) => {
                  const dayNum = d.date.getDate();
                  const dow = d.date.toLocaleString("en-US", { weekday: "short" });
                  const status = d.isToday ? "today" : d.isPast ? "past" : "upcoming";
                  const cls = d.isToday
                    ? "border-emerald-400/60 bg-gradient-to-br from-emerald-500/[0.20] via-emerald-500/[0.10] to-emerald-500/[0.05] shadow-[0_0_18px_-4px_rgba(16,185,129,0.7),inset_0_1px_0_0_rgba(16,185,129,0.15)]"
                    : d.isPast
                      ? "border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.05] to-emerald-500/[0.01] hover:border-emerald-500/30"
                      : "border-blue-400/15 bg-gradient-to-br from-blue-500/[0.05] to-blue-500/[0.01] hover:border-blue-400/30";
                  const dayNumCls = d.isToday
                    ? "text-white"
                    : d.isPast
                      ? "text-white/85"
                      : "text-white";
                  const dowCls = d.isToday
                    ? "text-emerald-300"
                    : d.isPast
                      ? "text-emerald-400/70"
                      : "text-blue-300/80";
                  const showAmount = d.isPast || d.isToday;
                  const ariaLabel = showAmount
                    ? `${d.date.toDateString()}, ${status}: profit $${d.amount.toFixed(2)}`
                    : `${d.date.toDateString()}, upcoming forex day — amount revealed at session close`;
                  return (
                    <div
                      key={idx}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border p-1.5 sm:p-2 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 hover:-translate-y-0.5",
                        cls
                      )}
                      title={ariaLabel}
                    >
                      {/* Today live dot indicator */}
                      {d.isToday && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                      )}
                      {/* Past settled checkmark */}
                      {d.isPast && (
                        <svg
                          className="absolute top-1 right-1 w-2.5 h-2.5 text-emerald-400/80"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}

                      <div className={cn("text-[8.5px] sm:text-[9px] uppercase tracking-wider font-bold mt-0.5", dowCls)}>
                        {dow}
                      </div>
                      <div className={cn("text-base sm:text-lg font-extrabold tabular-nums leading-none mt-0.5", dayNumCls)}>
                        {dayNum}
                      </div>
                      {showAmount ? (
                        <div
                          className={cn(
                            "text-[9.5px] sm:text-[10px] font-bold tabular-nums mt-1",
                            d.isToday
                              ? "text-emerald-300"
                              : "text-emerald-400/75"
                          )}
                        >
                          ${d.amount.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-[9.5px] sm:text-[10px] font-medium tabular-nums mt-1 text-blue-300/40">
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-3 sm:p-3.5">
                <h4 className="text-xs sm:text-sm font-bold text-emerald-300 leading-tight">
                  Trading never sleeps — but earnings settle smart.
                </h4>
                <p className="text-[10.5px] sm:text-[11px] text-muted-foreground/90 leading-relaxed mt-1.5">
                  Your capital works through Mon–Fri global forex sessions, locking in real profits as markets close. Weekends rest; the engine is back live every Monday. Returns are driven by live market performance and protected by your active risk controls.
                </p>
              </div>
            </div>
          </>
        )}
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
                      ${fmtMoney(Number(investment.amount || 0))}
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
    { query: { refetchInterval: 60000 } },
  );
  const trades = tradesData ?? [];
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
  // Single owner for investment + summary queries on the Portfolio page.
  // PortfolioInner used to subscribe to these too — that produced two
  // subscribers per key (extra renders + the shorter refetchInterval silently
  // winning). Now we fetch once here and pass the data down as props.
  // 30s for summary preserves the previous *effective* polling cadence (when
  // both PortfolioPage @60s and PortfolioInner @30s were subscribed, React
  // Query used the shorter interval).
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: investment, isLoading: invLoading } = useGetInvestment({
    query: { refetchInterval: 60000 },
  });
  const investedAmount = investment?.amount ?? 0;
  const isActive = !!investment?.isActive;
  const isLocked = !invLoading && (investedAmount <= 0 || !isActive);

  return (
    <Layout>
      <PortfolioInner investment={investment} invLoading={invLoading} summary={summary} />
      {/* Performance Insights — temporarily hidden via the
          hidden-features registry (`portfolio:performance-insights`).
          The block stays in code so we can bring it back later
          unchanged; just remove the registry entry. While hidden,
          we suppress BOTH the lock-mask card AND the blurred
          DemoDashboardBody underneath, so users see no half-finished
          section regardless of whether they've invested. */}
      {!isFeatureHidden("portfolio:performance-insights") && (
      <div className="relative">
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            <div className="pointer-events-auto rounded-2xl border border-amber-500/30 bg-[#0d1525]/90 backdrop-blur-md px-6 py-5 text-center shadow-2xl shadow-black/60 max-w-md mx-4">
              <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mb-3">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white">Performance Insights Locked</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1.5">
                Start trading to unlock your live equity curve, daily P&amp;L, rolling returns, performance metrics and recent trade attribution.
              </p>
              <Link
                href="/invest"
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" /> Start Trading <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
        <div className={isLocked ? "blur-md select-none pointer-events-none" : ""} aria-hidden={isLocked}>
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
          <div className="px-4 md:px-8 pb-8 max-w-7xl mx-auto">
            <RecentTradeAttribution />
          </div>
        </div>
      </div>
      )}
      {summary?.vip && (
        <div className="px-4 md:px-8 pb-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">VIP Membership</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <VipCard vip={summary.vip as VipInfo} investmentAmount={summary.activeInvestment ?? 0} />
        </div>
      )}
    </Layout>
  );
}
