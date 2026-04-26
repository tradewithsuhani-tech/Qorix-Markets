import { Layout } from "@/components/layout";
import { PeriodFilter, DAYS_PERIOD_OPTIONS } from "@/components/period-filter";
import {
  useGetEquityChart,
  useGetDashboardPerformance,
  useGetInvestment,
  useGetMonthlyPerformance,
  useGenerateReport,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  BarChart2,
  TrendingUp,
  PieChart,
  Target,
  RefreshCw,
  CalendarDays,
  Trophy,
  ShieldAlert,
  FileCheck,
  Copy,
  CheckCheck,
  Loader2,
  ExternalLink,
  Lock,
  Crown,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScatterController,
  type ChartDataset,
} from "chart.js";
import { Line, Bar, Scatter, Radar, Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const TIME_FILTERS = DAYS_PERIOD_OPTIONS.map((o) => ({ label: o.label, days: o.value }));

const PERF_FILTERS = [
  { label: "3 Months", value: "3m" as const },
  { label: "6 Months", value: "6m" as const },
  { label: "All Time", value: "all" as const },
] as const;

const CHART_DEFAULTS = {
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(10,14,26,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 10,
      cornerRadius: 10,
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: { color: "#64748b", font: { size: 11 } },
      border: { display: false },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: { color: "#64748b", font: { size: 11 } },
      border: { display: false },
    },
  },
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  animation: { duration: 600, easing: "easeOutQuart" as const },
};


function ChartCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  loading,
  stat,
  statColor,
  children,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  loading: boolean;
  stat?: string;
  statColor?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card p-5 rounded-2xl flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}28` }}
          >
            <Icon style={{ width: 14, height: 14, color: iconColor }} />
          </div>
          <div>
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {stat && (
          <span
            className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-full"
            style={{
              background: `${statColor ?? "#22c55e"}18`,
              color: statColor ?? "#22c55e",
              border: `1px solid ${statColor ?? "#22c55e"}28`,
            }}
          >
            {stat}
          </span>
        )}
      </div>
      <div className="flex-1" style={{ minHeight: 220 }}>
        {loading ? (
          <div className="flex items-end gap-1 h-full pb-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-white/5 rounded-t animate-pulse"
                style={{ height: `${25 + (i * 4 + 13) % 60}%` }}
              />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [perfFilter, setPerfFilter] = useState<"3m" | "6m" | "all">("6m");
  const [generatedMap, setGeneratedMap] = useState<Record<string, string>>({});
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);
  const [copiedMonth, setCopiedMonth] = useState<string | null>(null);
  const { toast } = useToast();

  const generateMutation = useGenerateReport({
    mutation: {
      onSuccess: (data, variables) => {
        const yearMonth = variables.data.yearMonth;
        setGeneratedMap((prev) => ({ ...prev, [yearMonth]: data.hashId }));
        setGeneratingMonth(null);
        toast({
          title: data.alreadyExisted ? "Report Already Exists" : "Report Generated",
          description: `Report ID: ${data.hashId.slice(0, 12)}… — share the verification link.`,
        });
      },
      onError: () => {
        setGeneratingMonth(null);
        toast({ title: "Generation Failed", description: "Could not generate report. Try again.", variant: "destructive" });
      },
    },
  });

  function handleGenerateReport(yearMonth: string) {
    setGeneratingMonth(yearMonth);
    generateMutation.mutate({ data: { yearMonth } });
  }

  function handleCopyLink(yearMonth: string, hashId: string) {
    const base = window.location.origin + (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "");
    const link = `${base}/verify/${hashId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedMonth(yearMonth);
      setTimeout(() => setCopiedMonth(null), 2000);
    });
  }

  const { data: equityRaw, isLoading: equityLoading } = useGetEquityChart(
    { days },
    { query: { refetchInterval: 30000 } },
  );
  const { data: perf, isLoading: perfLoading } = useGetDashboardPerformance({
    query: { refetchInterval: 30000 },
  });
  const { data: investment, isLoading: invLoading } = useGetInvestment({
    query: { refetchInterval: 15000 },
  });
  const { data: monthlyRaw, isLoading: monthlyLoading } = useGetMonthlyPerformance(
    { filter: perfFilter },
    { query: { refetchInterval: 60000 } },
  );

  const monthlyData = Array.isArray(monthlyRaw) ? monthlyRaw : [];

  const equityArr = Array.isArray(equityRaw) ? [...equityRaw].reverse() : [];

  const labels = equityArr.map((e) => {
    try {
      return format(parseISO(e.date), days <= 7 ? "EEE" : days <= 30 ? "MMM d" : "MMM d");
    } catch {
      return e.date;
    }
  });

  const equityValues = equityArr.map((e) => e.equity);
  const profitValues = equityArr.map((e) => e.profit);

  const drawdownValues = (() => {
    let peak = 0;
    return equityValues.map((eq) => {
      if (eq > peak) peak = eq;
      return peak > 0 ? -((peak - eq) / peak) * 100 : 0;
    });
  })();

  const totalProfit = profitValues.reduce((a, b) => a + b, 0);
  const totalProfitStr =
    totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`;

  const currentDrawdownPct =
    drawdownValues.length > 0 ? drawdownValues[drawdownValues.length - 1]! : 0;

  const latestEquity =
    equityValues.length > 0 ? equityValues[equityValues.length - 1]! : 0;
  const firstEquity = equityValues.length > 0 ? equityValues[0]! : 0;
  const equityReturn =
    firstEquity > 0 ? (((latestEquity - firstEquity) / firstEquity) * 100).toFixed(2) : "0.00";

  const positiveProfit = profitValues.filter((p) => p > 0);
  const negativeProfit = profitValues.filter((p) => p < 0);

  const winRate = profitValues.length > 0
    ? ((positiveProfit.length / profitValues.length) * 100).toFixed(0)
    : "0";

  const riskProfiles = [
    {
      label: "Conservative",
      drawdown: 3,
      returnPct: (perf?.rollingReturns?.find((r) => r.period === "30D")?.return ?? 0) * 0.6,
    },
    {
      label: "Balanced",
      drawdown: 5,
      returnPct: perf?.rollingReturns?.find((r) => r.period === "30D")?.return ?? 0,
    },
    {
      label: "Aggressive",
      drawdown: 10,
      returnPct: (perf?.rollingReturns?.find((r) => r.period === "30D")?.return ?? 0) * 1.5,
    },
    {
      label: "Your Profile",
      drawdown: investment?.drawdownLimit ?? 5,
      returnPct: perf?.rollingReturns?.find((r) => r.period === "30D")?.return ?? 0,
    },
  ];

  const loading = equityLoading;

  // Premium gate — Analytics is for large fund investors only
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const ANALYTICS_MIN_FUND = 10000;
  const investorFund = Math.max(
    Number(summary?.totalBalance ?? 0),
    Number(summary?.activeInvestment ?? 0),
    Number(investment?.amount ?? 0),
  );
  const hasAccess = investorFund >= ANALYTICS_MIN_FUND;
  const progressPct = Math.min(100, (investorFund / ANALYTICS_MIN_FUND) * 100);

  if (!hasAccess) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center min-h-[70vh] p-4"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-[#1a1408] via-[#0d1320] to-[#070b14] shadow-[0_20px_60px_-10px_rgba(245,158,11,0.25),0_1px_0_rgba(255,255,255,0.06)_inset]">
            {/* Shimmer top edge */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
            {/* Radial glows */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-8 md:p-10 text-center">
              {/* Premium crown badge */}
              <div className="inline-flex flex-col items-center gap-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-400/30 blur-2xl rounded-full animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400/25 via-yellow-500/15 to-orange-500/20 border border-amber-300/50 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                    <Crown className="w-10 h-10 text-amber-300" strokeWidth={1.5} />
                    <Lock className="w-4 h-4 text-amber-200 absolute bottom-2 right-2 bg-[#1a1408] rounded-full p-0.5 border border-amber-400/50" />
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Premium Tier
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                Advanced Analytics Suite
              </h1>
              <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Institutional-grade analytics including monthly performance reports, verified on-chain attestations, rolling returns, drawdown analysis, and risk-adjusted metrics.
              </p>
              <p className="mt-4 text-amber-200/90 text-sm font-semibold">
                Exclusively available for investors with a fund of{" "}
                <span className="text-amber-300 font-bold">${ANALYTICS_MIN_FUND.toLocaleString()}+</span>
              </p>

              {/* Feature list */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-md mx-auto">
                {[
                  "Monthly verified performance reports",
                  "On-chain report attestations",
                  "Rolling returns & drawdown analytics",
                  "Risk-adjusted Sharpe & Sortino ratios",
                ].map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-xs text-white/80 rounded-lg px-3 py-2 bg-white/[0.03] border border-white/10"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-7 max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Your fund</span>
                  <span className="font-bold text-white tabular-nums">
                    ${investorFund.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="text-muted-foreground"> / ${ANALYTICS_MIN_FUND.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06] border border-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Add{" "}
                  <span className="text-amber-300 font-semibold">
                    ${Math.max(0, ANALYTICS_MIN_FUND - investorFund).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>{" "}
                  more to unlock
                </p>
              </div>

              {/* CTAs */}
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/deposit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-sm font-bold shadow-lg shadow-amber-500/30 transition-all"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Deposit & Unlock
                </Link>
                <Link
                  href="/invest"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 text-white text-sm font-semibold transition-all"
                >
                  Explore Plans
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">
              Advanced Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Deep-dive into your trading performance and risk metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/[0.03] border border-white/8 rounded-full px-3 py-1.5">
              <RefreshCw style={{ width: 10, height: 10, animationDuration: "4s" }} className="text-green-400 animate-spin" />
              <span className="text-green-400 font-medium">Live</span>
            </div>
            <PeriodFilter
              options={DAYS_PERIOD_OPTIONS}
              selected={days}
              onChange={(v) => setDays(v)}
              ariaLabel="Equity & drawdown period"
            />
          </div>
        </div>

        {/* Summary strip — values sourced from the same /api/dashboard/performance
            and /api/dashboard/summary endpoints the main dashboard uses, so the
            two screens never disagree. Period Return falls back to the equity-
            derived figure when the selected window doesn't have a server-side
            rolling return (server only emits 7D/30D/90D). */}
        {(() => {
          const periodKey = `${days}D`;
          const rollingPick = perf?.rollingReturns?.find((r) => r.period === periodKey)?.return;
          const periodReturnNum =
            typeof rollingPick === "number" ? rollingPick : Number(equityReturn);
          const periodReturnStr = `${periodReturnNum >= 0 ? "+" : ""}${periodReturnNum.toFixed(2)}%`;

          // Canonical lifetime profit shown on the dashboard's headline card.
          const totalProfitCanonical = Number(summary?.totalProfit ?? 0);
          const totalProfitDisplay =
            totalProfitCanonical >= 0
              ? `+$${totalProfitCanonical.toFixed(2)}`
              : `-$${Math.abs(totalProfitCanonical).toFixed(2)}`;

          // Reconstruct the W/L counts from the server-blessed win-rate so the
          // sub-line matches the headline percentage exactly (no rounding drift).
          const winRateCanonical = Number(perf?.winRate ?? 0);
          const tradesCanonical = Number(perf?.totalTrades ?? 0);
          const wins = Math.round((winRateCanonical / 100) * tradesCanonical);
          const losses = Math.max(0, tradesCanonical - wins);

          const maxDdCanonical = Number(perf?.maxDrawdown ?? 0);
          const cardsLoading = loading || perfLoading;

          return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Period Return",
              value: periodReturnStr,
              color: periodReturnNum >= 0 ? "#22c55e" : "#ef4444",
              sub: `${TIME_FILTERS.find((f) => f.days === days)?.label} performance`,
              loading: cardsLoading,
            },
            {
              label: "Total P&L",
              value: totalProfitDisplay,
              color: totalProfitCanonical >= 0 ? "#22c55e" : "#ef4444",
              sub: tradesCanonical > 0 ? `${tradesCanonical} total trades` : `${profitValues.length} trading days`,
              loading: cardsLoading,
            },
            {
              label: "Win Rate",
              value: `${winRateCanonical.toFixed(1)}%`,
              color: "#facc15",
              sub: `${wins}W / ${losses}L`,
              loading: cardsLoading,
            },
            {
              label: "Max Drawdown",
              value: `${maxDdCanonical.toFixed(2)}%`,
              color: "#ef4444",
              sub: "Peak-to-trough",
              loading: cardsLoading,
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="stat-card p-4 rounded-2xl"
            >
              <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                {s.label}
              </div>
              {s.loading ? (
                <Skeleton className="h-7 w-24 mb-1" />
              ) : (
                <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>
                  {s.value}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">{s.sub}</div>
            </motion.div>
          ))}
        </div>
          );
        })()}

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 1. Equity Curve */}
          <ChartCard
            title="Equity Curve"
            subtitle="Portfolio value over time"
            icon={TrendingUp}
            iconColor="#60a5fa"
            loading={loading}
            stat={loading ? undefined : `${Number(equityReturn) >= 0 ? "+" : ""}${equityReturn}%`}
            statColor={Number(equityReturn) >= 0 ? "#22c55e" : "#ef4444"}
            delay={0.1}
          >
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: "Equity",
                    data: equityValues,
                    borderColor: "rgba(96,165,250,1)",
                    borderWidth: 2,
                    backgroundColor: (ctx: any) => {
                      const chart = ctx.chart;
                      const { ctx: c, chartArea } = chart;
                      if (!chartArea) return "transparent";
                      const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                      grad.addColorStop(0, "rgba(96,165,250,0.28)");
                      grad.addColorStop(1, "rgba(96,165,250,0.00)");
                      return grad;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: days <= 7 ? 4 : 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "rgba(96,165,250,1)",
                  },
                ],
              }}
              options={{
                ...CHART_DEFAULTS,
                plugins: {
                  ...CHART_DEFAULTS.plugins,
                  tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                      label: (ctx: any) => ` Equity: $${Number(ctx.raw).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    },
                  },
                },
                scales: {
                  x: CHART_DEFAULTS.scales.x,
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    ticks: {
                      ...CHART_DEFAULTS.scales.y.ticks,
                      callback: (v: any) => `$${Number(v).toLocaleString()}`,
                    },
                  },
                },
              }}
            />
          </ChartCard>

          {/* 2. Drawdown Chart */}
          <ChartCard
            title="Drawdown Chart"
            subtitle="Peak-to-trough portfolio decline"
            icon={BarChart2}
            iconColor="#ef4444"
            loading={loading}
            stat={loading ? undefined : `${Math.abs(currentDrawdownPct).toFixed(2)}% now`}
            statColor="#ef4444"
            delay={0.15}
          >
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: "Drawdown %",
                    data: drawdownValues,
                    borderColor: "rgba(239,68,68,0.9)",
                    borderWidth: 2,
                    backgroundColor: (ctx: any) => {
                      const chart = ctx.chart;
                      const { ctx: c, chartArea } = chart;
                      if (!chartArea) return "transparent";
                      const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                      grad.addColorStop(0, "rgba(239,68,68,0.25)");
                      grad.addColorStop(1, "rgba(239,68,68,0.02)");
                      return grad;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: days <= 7 ? 4 : 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "rgba(239,68,68,1)",
                  },
                  ...(investment?.drawdownLimit
                    ? [
                        {
                          label: "Protection Limit",
                          data: labels.map(() => -(investment.drawdownLimit)),
                          borderColor: "rgba(249,115,22,0.6)",
                          borderWidth: 1.5,
                          borderDash: [6, 4],
                          pointRadius: 0,
                          fill: false,
                          tension: 0,
                        },
                      ]
                    : []),
                ],
              }}
              options={{
                ...CHART_DEFAULTS,
                plugins: {
                  ...CHART_DEFAULTS.plugins,
                  legend: {
                    display: !!investment?.drawdownLimit,
                    labels: {
                      color: "#64748b",
                      boxWidth: 12,
                      font: { size: 11 },
                    },
                  },
                  tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                      label: (ctx: any) => {
                        if (ctx.dataset.label === "Protection Limit")
                          return ` Limit: -${investment?.drawdownLimit}%`;
                        return ` Drawdown: ${Number(ctx.raw).toFixed(2)}%`;
                      },
                    },
                  },
                },
                scales: {
                  x: CHART_DEFAULTS.scales.x,
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    ticks: {
                      ...CHART_DEFAULTS.scales.y.ticks,
                      callback: (v: any) => `${Number(v).toFixed(1)}%`,
                    },
                  },
                },
              }}
            />
          </ChartCard>

          {/* 3. Profit Distribution */}
          <ChartCard
            title="Profit Distribution"
            subtitle="Daily P&L bar breakdown"
            icon={PieChart}
            iconColor="#a78bfa"
            loading={loading}
            stat={loading ? undefined : `${winRate}% win rate`}
            statColor="#facc15"
            delay={0.2}
          >
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    label: "Daily P&L",
                    data: profitValues,
                    backgroundColor: profitValues.map((v) =>
                      v >= 0 ? "rgba(34,197,94,0.65)" : "rgba(239,68,68,0.65)",
                    ),
                    borderColor: profitValues.map((v) =>
                      v >= 0 ? "rgba(34,197,94,1)" : "rgba(239,68,68,1)",
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                  },
                ],
              }}
              options={{
                ...CHART_DEFAULTS,
                plugins: {
                  ...CHART_DEFAULTS.plugins,
                  tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                      label: (ctx: any) => {
                        const v = Number(ctx.raw);
                        return ` P&L: ${v >= 0 ? "+" : ""}$${v.toFixed(2)}`;
                      },
                    },
                  },
                },
                scales: {
                  x: CHART_DEFAULTS.scales.x,
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    ticks: {
                      ...CHART_DEFAULTS.scales.y.ticks,
                      callback: (v: any) => `$${Number(v).toFixed(0)}`,
                    },
                  },
                },
              }}
            />
          </ChartCard>

          {/* 4. Risk vs Return */}
          <ChartCard
            title="Risk vs Return"
            subtitle="Drawdown limit vs projected monthly return"
            icon={Target}
            iconColor="#34d399"
            loading={perfLoading || invLoading}
            delay={0.25}
          >
            <Scatter
              data={{
                datasets: [
                  {
                    label: "Risk Profiles",
                    data: riskProfiles.slice(0, 3).map((p) => ({
                      x: p.drawdown,
                      y: p.returnPct,
                    })),
                    backgroundColor: [
                      "rgba(96,165,250,0.7)",
                      "rgba(99,102,241,0.7)",
                      "rgba(249,115,22,0.7)",
                    ],
                    pointBackgroundColor: [
                      "rgba(96,165,250,0.9)",
                      "rgba(99,102,241,0.9)",
                      "rgba(249,115,22,0.9)",
                    ],
                    pointBorderColor: "transparent",
                    pointRadius: 10,
                    pointHoverRadius: 13,
                  },
                  {
                    label: "Your Profile",
                    data: [
                      {
                        x: riskProfiles[3]!.drawdown,
                        y: riskProfiles[3]!.returnPct,
                      },
                    ],
                    backgroundColor: "rgba(52,211,153,0.9)",
                    pointBackgroundColor: "rgba(52,211,153,1)",
                    pointBorderColor: "rgba(52,211,153,0.3)",
                    pointBorderWidth: 4,
                    pointRadius: 12,
                    pointHoverRadius: 15,
                  },
                ],
              }}
              options={{
                ...CHART_DEFAULTS,
                plugins: {
                  ...CHART_DEFAULTS.plugins,
                  legend: {
                    display: true,
                    position: "top" as const,
                    labels: {
                      color: "#64748b",
                      boxWidth: 10,
                      boxHeight: 10,
                      borderRadius: 5,
                      font: { size: 11 },
                      padding: 12,
                    },
                  },
                  tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                      title: (items: any) => {
                        const idx = items[0]?.dataIndex;
                        const dsIdx = items[0]?.datasetIndex;
                        if (dsIdx === 1) return "Your Profile";
                        return riskProfiles[idx ?? 0]?.label ?? "";
                      },
                      label: (ctx: any) =>
                        [
                          ` Risk (drawdown): ${ctx.parsed.x}%`,
                          ` Return (30D): ${ctx.parsed.y >= 0 ? "+" : ""}${Number(ctx.parsed.y).toFixed(2)}%`,
                        ],
                    },
                  },
                },
                scales: {
                  x: {
                    ...CHART_DEFAULTS.scales.x,
                    title: {
                      display: true,
                      text: "Max Drawdown (%)",
                      color: "#64748b",
                      font: { size: 11 },
                    },
                    ticks: {
                      ...CHART_DEFAULTS.scales.x.ticks,
                      callback: (v: any) => `${v}%`,
                    },
                  },
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    title: {
                      display: true,
                      text: "Expected Return (%)",
                      color: "#64748b",
                      font: { size: 11 },
                    },
                    ticks: {
                      ...CHART_DEFAULTS.scales.y.ticks,
                      callback: (v: any) => `${Number(v).toFixed(1)}%`,
                    },
                  },
                },
              }}
            />
          </ChartCard>
        </div>

        {/* Performance Dashboard — Monthly History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4 }}
          className="space-y-4"
        >
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/15 border border-indigo-500/25">
                <CalendarDays style={{ width: 14, height: 14, color: "#818cf8" }} />
              </div>
              <div>
                <div className="font-semibold text-sm">Performance Dashboard</div>
                <div className="text-[11px] text-muted-foreground">Monthly returns, drawdown & win rate</div>
              </div>
            </div>
            <PeriodFilter
              options={PERF_FILTERS}
              selected={perfFilter}
              onChange={(v) => setPerfFilter(v as "3m" | "6m" | "all")}
              ariaLabel="Monthly performance period"
            />
          </div>

          {/* Monthly KPI strip */}
          {monthlyData.length > 0 && (() => {
            const totalReturn = monthlyData.reduce((a, m) => a + m.monthlyReturn, 0);
            const avgWinRate = monthlyData.reduce((a, m) => a + m.winRate, 0) / monthlyData.length;
            const worstDrawdown = Math.max(...monthlyData.map((m) => m.maxDrawdown));
            const totalProfit = monthlyData.reduce((a, m) => a + m.totalProfit, 0);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Cumulative Return", value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`, color: totalReturn >= 0 ? "#22c55e" : "#ef4444", sub: `${monthlyData.length} months` },
                  { label: "Avg Win Rate", value: `${avgWinRate.toFixed(1)}%`, color: "#facc15", sub: "Per month" },
                  { label: "Peak Drawdown", value: `${worstDrawdown.toFixed(2)}%`, color: "#ef4444", sub: "Worst month" },
                  { label: "Total Profit", value: `${totalProfit >= 0 ? "+" : ""}$${Math.abs(totalProfit).toFixed(2)}`, color: totalProfit >= 0 ? "#22c55e" : "#ef4444", sub: "USD earned" },
                ].map((s) => (
                  <div key={s.label} className="stat-card p-4 rounded-2xl">
                    <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">{s.label}</div>
                    <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {monthlyData.length === 0 && !monthlyLoading && (
            <div className="glass-card p-8 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
              <CalendarDays style={{ width: 32, height: 32, color: "#4b5563" }} />
              <div className="text-sm text-muted-foreground">No monthly performance data yet.</div>
              <div className="text-[11px] text-muted-foreground">Data is recorded daily after each profit distribution run.</div>
            </div>
          )}

          {monthlyLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          )}

          {/* Monthly charts grid */}
          {monthlyData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Monthly Returns Chart */}
              <ChartCard
                title="Monthly Returns"
                subtitle="Return % per calendar month"
                icon={TrendingUp}
                iconColor="#818cf8"
                loading={monthlyLoading}
                stat={monthlyLoading ? undefined : (() => {
                  const last = monthlyData[monthlyData.length - 1];
                  return last ? `${last.monthlyReturn >= 0 ? "+" : ""}${last.monthlyReturn.toFixed(2)}%` : undefined;
                })()}
                statColor={(() => {
                  const last = monthlyData[monthlyData.length - 1];
                  return last && last.monthlyReturn >= 0 ? "#22c55e" : "#ef4444";
                })()}
                delay={0}
              >
                <Bar
                  data={{
                    labels: monthlyData.map((m) => {
                      try { return format(parseISO(`${m.yearMonth}-01`), "MMM yy"); } catch { return m.yearMonth; }
                    }),
                    datasets: [
                      {
                        label: "Monthly Return %",
                        data: monthlyData.map((m) => m.monthlyReturn),
                        backgroundColor: monthlyData.map((m) =>
                          m.monthlyReturn >= 0 ? "rgba(129,140,248,0.65)" : "rgba(239,68,68,0.65)",
                        ),
                        borderColor: monthlyData.map((m) =>
                          m.monthlyReturn >= 0 ? "rgba(129,140,248,1)" : "rgba(239,68,68,1)",
                        ),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                      },
                    ],
                  }}
                  options={{
                    ...CHART_DEFAULTS,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                          label: (ctx: any) => {
                            const v = Number(ctx.raw);
                            return ` Return: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: CHART_DEFAULTS.scales.x,
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          callback: (v: any) => `${Number(v).toFixed(1)}%`,
                        },
                      },
                    },
                  }}
                />
              </ChartCard>

              {/* Monthly Drawdown Chart */}
              <ChartCard
                title="Monthly Max Drawdown"
                subtitle="Peak-to-trough decline per month"
                icon={ShieldAlert}
                iconColor="#f97316"
                loading={monthlyLoading}
                stat={monthlyLoading ? undefined : (() => {
                  const worst = Math.max(...monthlyData.map((m) => m.maxDrawdown));
                  return `${worst.toFixed(2)}% peak`;
                })()}
                statColor="#f97316"
                delay={0.05}
              >
                <Bar
                  data={{
                    labels: monthlyData.map((m) => {
                      try { return format(parseISO(`${m.yearMonth}-01`), "MMM yy"); } catch { return m.yearMonth; }
                    }),
                    datasets: [
                      {
                        label: "Max Drawdown %",
                        data: monthlyData.map((m) => m.maxDrawdown),
                        backgroundColor: "rgba(249,115,22,0.55)",
                        borderColor: "rgba(249,115,22,1)",
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                      },
                    ],
                  }}
                  options={{
                    ...CHART_DEFAULTS,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                          label: (ctx: any) => ` Drawdown: ${Number(ctx.raw).toFixed(2)}%`,
                        },
                      },
                    },
                    scales: {
                      x: CHART_DEFAULTS.scales.x,
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        min: 0,
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          callback: (v: any) => `${Number(v).toFixed(1)}%`,
                        },
                      },
                    },
                  }}
                />
              </ChartCard>

              {/* Win Rate Chart */}
              <ChartCard
                title="Monthly Win Rate"
                subtitle="% of profitable trading days per month"
                icon={Trophy}
                iconColor="#facc15"
                loading={monthlyLoading}
                stat={monthlyLoading ? undefined : (() => {
                  const avg = monthlyData.reduce((a, m) => a + m.winRate, 0) / monthlyData.length;
                  return `${avg.toFixed(1)}% avg`;
                })()}
                statColor="#facc15"
                delay={0.1}
              >
                <Chart
                  type="bar"
                  data={{
                    labels: monthlyData.map((m) => {
                      try { return format(parseISO(`${m.yearMonth}-01`), "MMM yy"); } catch { return m.yearMonth; }
                    }),
                    datasets: [
                      {
                        type: "bar" as const,
                        label: "Win Rate %",
                        data: monthlyData.map((m) => m.winRate),
                        backgroundColor: monthlyData.map((m) =>
                          m.winRate >= 50 ? "rgba(250,204,21,0.55)" : "rgba(239,68,68,0.55)",
                        ),
                        borderColor: monthlyData.map((m) =>
                          m.winRate >= 50 ? "rgba(250,204,21,1)" : "rgba(239,68,68,1)",
                        ),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                      } satisfies ChartDataset<"bar", number[]>,
                      {
                        type: "line" as const,
                        label: "50% Threshold",
                        data: monthlyData.map(() => 50),
                        borderColor: "rgba(255,255,255,0.2)",
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false,
                        tension: 0,
                      } satisfies ChartDataset<"line", number[]>,
                    ],
                  }}
                  options={{
                    ...CHART_DEFAULTS,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      legend: {
                        display: true,
                        labels: {
                          color: "#64748b",
                          boxWidth: 12,
                          font: { size: 11 },
                        },
                      },
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                          label: (ctx: any) => {
                            if (ctx.dataset.label === "50% Threshold") return " 50% break-even";
                            const v = Number(ctx.raw);
                            const idx = ctx.dataIndex;
                            const entry = monthlyData[idx];
                            return [
                              ` Win Rate: ${v.toFixed(1)}%`,
                              entry ? ` (${entry.winningDays}W / ${entry.tradingDays - entry.winningDays}L of ${entry.tradingDays} days)` : "",
                            ];
                          },
                        },
                      },
                    },
                    scales: {
                      x: CHART_DEFAULTS.scales.x,
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        min: 0,
                        max: 100,
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          callback: (v: any) => `${Number(v).toFixed(0)}%`,
                        },
                      },
                    },
                  }}
                />
              </ChartCard>

              {/* Monthly P&L Summary table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="glass-card p-5 rounded-2xl flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-green-500/15 border border-green-500/25">
                      <BarChart2 style={{ width: 14, height: 14, color: "#4ade80" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Monthly Breakdown</div>
                      <div className="text-[11px] text-muted-foreground">Detailed per-month stats</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto" style={{ maxHeight: 260 }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-white/8">
                        <th className="pb-2 text-left font-medium">Month</th>
                        <th className="pb-2 text-right font-medium">Return</th>
                        <th className="pb-2 text-right font-medium">Max DD</th>
                        <th className="pb-2 text-right font-medium">Win Rate</th>
                        <th className="pb-2 text-right font-medium">P&L</th>
                        <th className="pb-2 text-right font-medium">Verify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthlyData].reverse().map((m) => {
                        const label = (() => { try { return format(parseISO(`${m.yearMonth}-01`), "MMM yyyy"); } catch { return m.yearMonth; } })();
                        const existingHash = generatedMap[m.yearMonth];
                        const isGenerating = generatingMonth === m.yearMonth;
                        const isCopied = copiedMonth === m.yearMonth;
                        return (
                          <tr key={m.yearMonth} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="py-2 font-medium">{label}</td>
                            <td className={`py-2 text-right tabular-nums font-semibold ${m.monthlyReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {m.monthlyReturn >= 0 ? "+" : ""}{m.monthlyReturn.toFixed(2)}%
                            </td>
                            <td className="py-2 text-right tabular-nums text-orange-400">{m.maxDrawdown.toFixed(2)}%</td>
                            <td className={`py-2 text-right tabular-nums ${m.winRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                              {m.winRate.toFixed(1)}%
                            </td>
                            <td className={`py-2 text-right tabular-nums font-semibold ${m.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {m.totalProfit >= 0 ? "+" : ""}${Math.abs(m.totalProfit).toFixed(2)}
                            </td>
                            <td className="py-2 text-right">
                              {existingHash ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Link
                                    href={`/verify/${existingHash}`}
                                    className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Open verification page"
                                  >
                                    <ExternalLink style={{ width: 11, height: 11 }} />
                                  </Link>
                                  <button
                                    onClick={() => handleCopyLink(m.yearMonth, existingHash)}
                                    className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                    title={isCopied ? "Copied!" : "Copy verification link"}
                                  >
                                    {isCopied
                                      ? <CheckCheck style={{ width: 11, height: 11, color: "#4ade80" }} />
                                      : <Copy style={{ width: 11, height: 11 }} />}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGenerateReport(m.yearMonth)}
                                  disabled={isGenerating || !!generatingMonth}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  title="Generate verification report"
                                >
                                  {isGenerating
                                    ? <Loader2 style={{ width: 10, height: 10, animation: "spin 1s linear infinite" }} />
                                    : <FileCheck style={{ width: 10, height: 10 }} />}
                                  {isGenerating ? "…" : "Generate"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Rolling Returns Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="glass-card p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="font-semibold text-sm">Rolling Returns Comparison</div>
              <div className="text-[11px] text-muted-foreground">7D / 30D / 90D period returns</div>
            </div>
          </div>
          {perfLoading ? (
            <Skeleton className="h-10 w-full rounded-xl" />
          ) : (
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: perf?.rollingReturns?.map((r) => r.period) ?? ["7D", "30D", "90D"],
                  datasets: [
                    {
                      label: "Return %",
                      data: perf?.rollingReturns?.map((r) => r.return) ?? [0, 0, 0],
                      backgroundColor: (perf?.rollingReturns ?? []).map((r) =>
                        r.return >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
                      ),
                      borderColor: (perf?.rollingReturns ?? []).map((r) =>
                        r.return >= 0 ? "rgba(34,197,94,1)" : "rgba(239,68,68,1)",
                      ),
                      borderWidth: 1.5,
                      borderRadius: 8,
                      borderSkipped: false,
                    },
                  ],
                }}
                options={{
                  ...CHART_DEFAULTS,
                  plugins: {
                    ...CHART_DEFAULTS.plugins,
                    tooltip: {
                      ...CHART_DEFAULTS.plugins.tooltip,
                      callbacks: {
                        label: (ctx: any) => {
                          const v = Number(ctx.raw);
                          return ` ${ctx.label} return: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: { ...CHART_DEFAULTS.scales.x },
                    y: {
                      ...CHART_DEFAULTS.scales.y,
                      ticks: {
                        ...CHART_DEFAULTS.scales.y.ticks,
                        callback: (v: any) => `${Number(v).toFixed(1)}%`,
                      },
                    },
                  },
                }}
              />
            </div>
          )}
        </motion.div>

      </motion.div>
    </Layout>
  );
}
