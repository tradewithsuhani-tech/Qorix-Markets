import { Layout } from "@/components/layout";
import { PeriodFilter, DAYS_PERIOD_OPTIONS } from "@/components/period-filter";
import {
  useGetEquityChart,
  useGetDashboardPerformance,
  useGetInvestment,
  useGetMonthlyPerformance,
  useGenerateReport,
  useGetDashboardSummary,
  useGetDashboardFundStats,
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
  secondaryStat,
  secondaryStatColor,
  controls,
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
  // Optional secondary stat pill (e.g. "Peak DD: -3.40%") rendered below
  // the main stat. Keeps the headline number prominent while still letting
  // hedge-fund-style charts surface a second metric without crowding the row.
  secondaryStat?: string;
  secondaryStatColor?: string;
  // Optional controls slot for the header (e.g. a per-chart PeriodFilter).
  // Rendered on a second row beneath the title so the title/stat row stays
  // compact and mobile-friendly.
  controls?: React.ReactNode;
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
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}28` }}
          >
            <Icon style={{ width: 14, height: 14, color: iconColor }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{title}</div>
            <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
          </div>
        </div>
        {(stat || secondaryStat) && (
          <div className="flex flex-col items-end gap-1 shrink-0">
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
            {secondaryStat && (
              <span
                className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  background: `${secondaryStatColor ?? "#64748b"}14`,
                  color: secondaryStatColor ?? "#94a3b8",
                  border: `1px solid ${secondaryStatColor ?? "#64748b"}22`,
                }}
              >
                {secondaryStat}
              </span>
            )}
          </div>
        )}
      </div>
      {controls && (
        <div className="mb-3 -mx-1 px-1 overflow-x-auto scrollbar-hide sm:mx-0 sm:px-0 sm:overflow-visible">
          {controls}
        </div>
      )}
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

  // Sort the equity series strictly ASCENDING by date (oldest → newest).
  // The Demo Dashboard does the same explicit sort, so both screens see
  // arr[0] = oldest point and arr[length-1] = newest point regardless of
  // what order the API returns. The previous .reverse() assumed the API
  // always returned descending order; when it returned ascending order
  // (which it currently does for the "All" range), .reverse() inverted
  // the series and made Period Return show large negative values like
  // -99.84% on accounts that were actually deeply profitable.
  const equityArr = Array.isArray(equityRaw)
    ? [...equityRaw].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    : [];

  // Time-aware label formatter. The equity-chart endpoint returns
  // intraday points for 1D, daily points for 7D/30D, and longer
  // aggregates beyond. Using "EEE" (day name) for everything inside
  // 7 days collapsed every intraday point on the 1D view to the same
  // weekday string ("Sun, Sun, Sun…"), making the x-axis useless.
  // Now we pick the format from `days`:
  //   ≤1d → "HH:mm" (intraday)
  //   ≤2d → "EEE HH:mm"
  //   ≤7d → "EEE d"
  //   ≤90d → "MMM d"
  //   >90d → "MMM yy"
  const labelFmt =
    days <= 1
      ? "HH:mm"
      : days <= 2
        ? "EEE HH:mm"
        : days <= 7
          ? "EEE d"
          : days <= 90
            ? "MMM d"
            : "MMM yy";
  const labels = equityArr.map((e) => {
    try {
      return format(parseISO(e.date), labelFmt);
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

  // Cumulative return from the start of the selected period, expressed as
  // a percentage. Rises (or falls) from 0% as equity moves away from the
  // first point in the window. Used as the second line on the Drawdown
  // Chart's underwater-style view so the chart has real movement to
  // contextualize the drawdown line — exactly the way professional fund
  // tearsheets pair "% gain" against "drawdown from peak".
  const gainPctValues = (() => {
    const base = equityValues[0] ?? 0;
    if (base <= 0) return equityValues.map(() => 0);
    return equityValues.map((eq) => ((eq - base) / base) * 100);
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

  // Per-Trade Risk vs Monthly Return — anchored to the platform's
  // hard safety policy:
  //   • Per-trade loss is capped at 1.0 % (engine-level stop-loss).
  //   • Target monthly return is capped at 10 % (risk-budget ceiling).
  // Each tier sits on the platform's 10:1 reward-to-risk diagonal
  // (monthlyReturn ≈ perTradeLoss × 10), so the three preset bubbles
  // line up cleanly inside the safe zone. The previous formulation —
  // industry-Sharpe benchmarks on a drawdown axis — was abstract and
  // didn't map to anything the user could verify; this one reflects
  // the actual policy the trading engine enforces.
  const userMonthlyReturn = perf?.rollingReturns?.find((r) => r.period === "30D")?.return ?? 0;
  const userDrawdownLimit = investment?.drawdownLimit ?? 5;
  // Derive the user's effective per-trade risk from their drawdown
  // limit: a 5 % drawdown allowance roughly tolerates 5 consecutive
  // 1 % losses, so perTradeLoss ≈ drawdownLimit / 5. Visually clamped
  // to the same x-domain as the chart (0–1.4 %) so the marker stays
  // on-canvas even for unusually high drawdown limits.
  const userPerTradeLoss = Math.max(0.05, Math.min(userDrawdownLimit / 5, 1.3));
  // Y is clamped to the chart's y-domain so the user marker stays on
  // canvas. Tooltip continues to show the true value.
  const userReturnDisplay = Math.max(0, Math.min(userMonthlyReturn, 11.5));
  const PLATFORM_LOSS_CAP = 1.0;
  const PLATFORM_RETURN_CAP = 10.0;
  const riskProfiles = [
    { label: "Conservative", perTradeLoss: 0.3, monthlyReturn: 3,  isUser: false, actualReturn: 3 },
    { label: "Balanced",     perTradeLoss: 0.6, monthlyReturn: 6,  isUser: false, actualReturn: 6 },
    { label: "Aggressive",   perTradeLoss: 1.0, monthlyReturn: 10, isUser: false, actualReturn: 10 },
    { label: "Your Profile", perTradeLoss: userPerTradeLoss, monthlyReturn: userReturnDisplay, isUser: true, actualReturn: userMonthlyReturn },
  ];

  const loading = equityLoading;

  // Premium gate — Analytics is for large fund investors only.
  // We also fetch fundStats here so the summary strip below can apply the
  // same scaling formula the Demo Dashboard uses (totalAUM-based equityScale
  // + admin-controlled baseline). Without this, the Total P&L on Analytics
  // would show the raw per-user $ figure while the dashboard's headline shows
  // the much larger fund-scaled figure — making the two screens disagree.
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: fundStats, isLoading: fundStatsLoading } = useGetDashboardFundStats({ query: { refetchInterval: 30000 } });

  // Fund-scaling primitives — derived once at the component level so every
  // dollar figure on this page (summary strip, monthly KPI, per-month table)
  // reflects the same scale the Demo Dashboard headline shows. Percentages
  // (returns, win rate, drawdown) are equity-invariant and need NO scaling.
  const totalEquityValue =
    (fundStats as any)?.totalAUM ?? summary?.totalBalance ?? 0;
  const equityScale =
    (summary?.totalBalance ?? 0) > 0
      ? totalEquityValue / (summary?.totalBalance ?? 1)
      : 1;
  const totalProfitBaseline =
    Number((fundStats as any)?.totalProfitBaseline ?? 0) || 0;
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

        {/* Summary strip — every value here is derived from the SAME inputs
            the Demo Dashboard uses, so the two screens always agree:
            • Period Return: local (last - first) / first × 100 on the equity
              chart for the selected period — identical formula to the
              dashboard's "Rolling Returns" card. We deliberately do NOT use
              perf.rollingReturns here: that server endpoint can apply a
              different baseline/scaling and would re-introduce the
              mismatch the user reported.
            • Total P&L: fund-scaled formula identical to the dashboard
              headline (totalProfitBaseline + summary.totalProfit * equityScale).
            • Win Rate / Max Drawdown: canonical perf.* fields. */}
        {(() => {
          const periodReturnNum =
            firstEquity > 0 ? ((latestEquity - firstEquity) / firstEquity) * 100 : 0;
          const periodReturnStr = `${periodReturnNum >= 0 ? "+" : ""}${periodReturnNum.toFixed(2)}%`;

          // Canonical lifetime profit — uses the component-scope fund-scale
          // primitives (totalEquityValue / equityScale / totalProfitBaseline)
          // so this card shows exactly what the Demo Dashboard headline shows
          // for the same user at the same moment.
          const totalProfitCanonical =
            totalProfitBaseline + Number(summary?.totalProfit ?? 0) * equityScale;
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
          // Include summary + fundStats loading so the Total P&L card shows a
          // skeleton until we have BOTH inputs to the scaling formula. Without
          // this gate, the card would briefly render the unscaled raw figure
          // while fundStats is in-flight, transiently disagreeing with the
          // dashboard.
          const cardsLoading =
            loading || perfLoading || summaryLoading || fundStatsLoading;

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
          {/* Stat ("X% now") mirrors the Demo Dashboard's Capital Protection
              "Current Drawdown" line exactly:
                drawdownPct = investment.drawdown / investment.amount * 100
              displayed as "5.20% (-$156.40) now". Previously the stat was
              derived from the equity-chart's peak-to-trough math, which
              shows 0% on monotonically growing accounts and disagreed with
              the dashboard's server-tracked drawdown. The chart LINE itself
              continues to visualize the historical peak-to-trough series
              from equity points — that's a useful timeline view, just not
              the right number to put on the headline stat. */}
          {(() => {
            // Headline stat: server-tracked live drawdown — mirrors Demo
            // Dashboard's "Current Drawdown" exactly. Independent of the
            // page-level period filter (it's a real-time figure, not a
            // historical one).
            const investAmount = Number(investment?.amount ?? 0);
            const investDrawdownDollars = Number(investment?.drawdown ?? 0);
            const drawdownPctCanonical =
              investAmount > 0 ? (investDrawdownDollars / investAmount) * 100 : 0;
            const drawdownStat = `${drawdownPctCanonical.toFixed(2)}% (-$${investDrawdownDollars.toFixed(2)}) now`;
            // Display series for the grey "Drawdown" line on the chart.
            // Historical points keep the peak-to-trough math (truthful — the
            // account has never been below its prior peak in the equity
            // series). The LATEST point is overridden with the live
            // server-tracked drawdown (-drawdownPctCanonical) so that the
            // tail of the line lands on the same number the headline pill
            // shows ("0.17% (-$0.85) now"). This includes the unrealized
            // SL exposure of currently open positions, which the equity
            // series alone can't surface. Earlier the chart was always
            // glued to 0% on monotonically growing accounts even though
            // open trades had a real live drawdown.
            const drawdownDisplayValues =
              drawdownValues.length > 0
                ? [...drawdownValues.slice(0, -1), -drawdownPctCanonical]
                : drawdownValues;
            // Secondary "Peak DD" pill: worst drawdown WITHIN the period
            // currently selected by the GLOBAL page filter (top-right).
            // Sourced from the same display series so it stays consistent
            // with the line on the chart and the live headline value.
            const peakDrawdownPct =
              drawdownDisplayValues.length > 0
                ? Math.min(...drawdownDisplayValues)
                : 0;
            const peakStat =
              equityValues.length > 0
                ? `Peak DD: ${peakDrawdownPct.toFixed(2)}%`
                : undefined;
            const ddLoading = loading || invLoading;
            return (
          <ChartCard
            title="Drawdown Chart"
            subtitle="Drawdown vs cumulative return — underwater view"
            icon={BarChart2}
            iconColor="#ef4444"
            loading={ddLoading}
            stat={ddLoading ? undefined : drawdownStat}
            statColor="#ef4444"
            secondaryStat={ddLoading ? undefined : peakStat}
            secondaryStatColor="#fb923c"
            delay={0.15}
          >
            <Line
              data={{
                labels,
                datasets: [
                  {
                    // Primary line — % gain from the start of the selected
                    // period. Always has movement (rises with profit), so
                    // the chart never reads as "empty" even when the
                    // account has never been below its peak. Painted in
                    // amber/orange to match the reference design.
                    label: "Cumulative Return %",
                    data: gainPctValues,
                    borderColor: "rgba(245,158,11,0.95)",
                    borderWidth: 2.25,
                    backgroundColor: (ctx: any) => {
                      const chart = ctx.chart;
                      const { ctx: c, chartArea } = chart;
                      if (!chartArea) return "transparent";
                      const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                      grad.addColorStop(0, "rgba(245,158,11,0.28)");
                      grad.addColorStop(1, "rgba(245,158,11,0.02)");
                      return grad;
                    },
                    fill: true,
                    tension: 0.35,
                    pointRadius: days <= 7 ? 3 : 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "rgba(245,158,11,1)",
                    pointBorderColor: "rgba(15,23,42,0.9)",
                    pointBorderWidth: 1,
                    order: 2,
                  },
                  {
                    // Secondary line — peak-to-trough drawdown (always
                    // ≤ 0). Stays at 0% on monotonic accounts, dips into
                    // negative territory on real losses. Slate/grey so it
                    // visually recedes behind the primary return line,
                    // matching the example's two-tone aesthetic.
                    label: "Drawdown from Peak %",
                    data: drawdownDisplayValues,
                    borderColor: "rgba(148,163,184,0.85)",
                    borderWidth: 1.75,
                    backgroundColor: "transparent",
                    fill: false,
                    tension: 0.3,
                    pointRadius: days <= 7 ? 2.5 : 0,
                    pointHoverRadius: 4,
                    pointBackgroundColor: "rgba(148,163,184,1)",
                    pointBorderColor: "rgba(15,23,42,0.9)",
                    pointBorderWidth: 1,
                    order: 1,
                  },
                  // Protection Limit dashed reference. Only included when
                  // it's within ~2x of the actual data range — otherwise
                  // pinning a -5% line on a chart whose data lives between
                  // -0.2% and +0.5% (e.g. the 1D view) collapses every
                  // real series into a flat smear at the top of the panel.
                  // The headline pill still surfaces the live drawdown so
                  // the limit context is never lost.
                  ...((() => {
                    const lim = Number(investment?.drawdownLimit ?? 0);
                    if (!lim) return [];
                    const series = [...gainPctValues, ...drawdownDisplayValues];
                    const dataMin = series.length ? Math.min(...series) : 0;
                    const showLimit = -lim >= dataMin - lim * 0.5;
                    if (!showLimit) return [];
                    return [
                      {
                        label: "Protection Limit",
                        data: labels.map(() => -lim),
                        borderColor: "rgba(239,68,68,0.65)",
                        borderWidth: 1.25,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        fill: false,
                        tension: 0,
                        order: 0,
                      },
                    ];
                  })()),
                ],
              }}
              options={{
                ...CHART_DEFAULTS,
                plugins: {
                  ...CHART_DEFAULTS.plugins,
                  legend: {
                    display: true,
                    position: "bottom" as const,
                    labels: {
                      color: "#94a3b8",
                      boxWidth: 12,
                      boxHeight: 2,
                      padding: 12,
                      font: { size: 10, weight: 600 as const },
                      usePointStyle: true,
                    },
                  },
                  tooltip: {
                    ...CHART_DEFAULTS.plugins.tooltip,
                    callbacks: {
                      label: (ctx: any) => {
                        const v = Number(ctx.raw);
                        if (ctx.dataset.label === "Protection Limit")
                          return ` Limit: -${investment?.drawdownLimit}%`;
                        if (ctx.dataset.label === "Cumulative Return %")
                          return ` Return: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                        return ` Drawdown: ${v.toFixed(2)}%`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ...CHART_DEFAULTS.scales.x,
                    ticks: {
                      ...CHART_DEFAULTS.scales.x.ticks,
                      // Cap visible x-tick labels so 1D's ~30 intraday
                      // points don't print "10:0010:0510:10…" on top of
                      // each other. Chart.js auto-skips with this hint.
                      maxTicksLimit: 8,
                      maxRotation: 0,
                      autoSkip: true,
                    },
                  },
                  y: {
                    ...CHART_DEFAULTS.scales.y,
                    // Data-driven y-axis bounds. Without this Chart.js
                    // expanded the axis to fit the -5% protection line
                    // (when included), squashing the actual return /
                    // drawdown lines into a 1-pixel band at the top of
                    // the panel — exactly the "bahut chipka hai" the
                    // user reported on the 1D view. We add 25% padding
                    // (with sane min absolute padding of 0.25%) so the
                    // line never touches the top/bottom edge.
                    ...((() => {
                      const series = [...gainPctValues, ...drawdownDisplayValues];
                      if (!series.length) return {};
                      const rawMin = Math.min(...series, 0);
                      const rawMax = Math.max(...series, 0);
                      const span = Math.max(rawMax - rawMin, 0.5);
                      const pad = Math.max(span * 0.25, 0.25);
                      return {
                        suggestedMin: rawMin - pad,
                        suggestedMax: rawMax + pad,
                      };
                    })()),
                    ticks: {
                      ...CHART_DEFAULTS.scales.y.ticks,
                      maxTicksLimit: 6,
                      callback: (v: any) => `${Number(v).toFixed(2)}%`,
                    },
                  },
                },
              }}
            />
          </ChartCard>
            );
          })()}

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

          {/* 4. Per-Trade Risk vs Monthly Return */}
          <ChartCard
            title="Per-Trade Risk vs Monthly Return"
            subtitle="Loss capped at 1% per trade · Return capped at 10% per month"
            icon={Target}
            iconColor="#34d399"
            loading={perfLoading || invLoading}
            delay={0.25}
          >
            {(() => {
              // Per-Trade Risk vs Monthly Return chart. Reframed around
              // the platform's actual safety policy (loss ≤ 1 % per
              // trade, return ≤ 10 % per month) rather than abstract
              // industry-benchmark Sharpe ratios:
              //   1. A safe-zone background (rrSafeZone plugin) tints
              //      the (0,0)→(1%,10%) policy box emerald with dashed
              //      red cap lines on the boundaries — the user can
              //      see at a glance where the platform's hard limits
              //      sit and that every tier lives inside them.
              //   2. A faint dashed line connects the three preset
              //      tiers (Conservative / Balanced / Aggressive),
              //      which all sit on the platform's 10:1 reward-to-
              //      risk diagonal.
              //   3. Each bubble carries a translucent halo matched to
              //      its tier; "Your Profile" is a green diamond so it
              //      stays visually distinct from preset circles even
              //      when overlapping.
              //   4. Axes are FIXED at x:0–1.4, y:0–12 (not data-
              //      driven) so the safe zone and cap lines render at
              //      stable pixel positions regardless of what the
              //      user's 30D return looks like.
              const profile3 = riskProfiles.slice(0, 3);
              const yourProfile = riskProfiles[3]!;
              // Fixed axis frame anchored to the platform safety policy
              // rather than the data. The chart's *job* is to show the
              // user where the platform's hard caps sit (1 % per-trade
              // loss, 10 % monthly return) and that every tier — and
              // their own marker — lives inside that safe zone. Letting
              // bounds float with the data would defeat that.
              const xMin = 0;
              const xMax = 1.4;   // 40 % headroom past the 1 % cap
              const yMin = 0;
              const yMax = 12;    // 20 % headroom past the 10 % cap

              const profileColors = [
                "rgba(96,165,250,1)",   // Conservative — sky blue
                "rgba(167,139,250,1)",  // Balanced — violet
                "rgba(251,146,60,1)",   // Aggressive — orange
              ];
              const profileFills = [
                "rgba(96,165,250,0.85)",
                "rgba(167,139,250,0.85)",
                "rgba(251,146,60,0.85)",
              ];
              const profileHalos = [
                "rgba(96,165,250,0.28)",
                "rgba(167,139,250,0.28)",
                "rgba(251,146,60,0.28)",
              ];

              return (
                <Scatter
                  data={{
                    datasets: [
                      // 0 — Efficient frontier curve (faint dashed connector
                      // through the three preset profiles). showLine on a
                      // scatter dataset gives us a tension'd polyline
                      // without needing a mixed Chart component.
                      {
                        type: "line" as const,
                        label: "Efficient Frontier",
                        data: profile3.map((p) => ({ x: p.perTradeLoss, y: p.monthlyReturn })),
                        borderColor: "rgba(148,163,184,0.35)",
                        borderDash: [5, 5],
                        borderWidth: 1.25,
                        backgroundColor: "transparent",
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        tension: 0.4,
                        fill: false,
                        order: 3,
                      },
                      // 1 — Risk profile bubbles. Per-point colours +
                      // matching translucent halo rings.
                      {
                        label: "Risk Profiles",
                        data: profile3.map((p) => ({ x: p.perTradeLoss, y: p.monthlyReturn })),
                        backgroundColor: profileFills,
                        pointBackgroundColor: profileFills,
                        pointBorderColor: profileHalos,
                        // Tightened bubble + halo so neighbouring presets
                        // (e.g. Conservative at 3% and a user marker at
                        // 5%) don't visually engulf each other or the
                        // Your-Profile diamond they sit beside.
                        pointBorderWidth: 4,
                        pointRadius: 8,
                        pointHoverRadius: 11,
                        order: 2,
                      } as any,
                      // 2 — "Your Profile" hero, drawn as a rotated-square
                      // (diamond) so it stays visually distinct from the
                      // round preset benchmarks even when its drawdown
                      // matches a preset (e.g. user limit 5 % overlapping
                      // the Balanced 5 % marker — the core overlap the
                      // user complained about). Smaller halo than before
                      // so the green glow no longer extends up into the
                      // Balanced bubble area.
                      {
                        label: "Your Profile",
                        data: [{ x: yourProfile.perTradeLoss, y: yourProfile.monthlyReturn }],
                        backgroundColor: "rgba(52,211,153,0.95)",
                        pointBackgroundColor: "rgba(52,211,153,1)",
                        pointBorderColor: "rgba(52,211,153,0.35)",
                        pointStyle: "rectRot" as const,
                        pointBorderWidth: 4,
                        pointRadius: 9,
                        pointHoverRadius: 12,
                        order: 1,
                      } as any,
                    ],
                  }}
                  plugins={[
                    {
                      // Safe-Zone background — visualises the platform's
                      // hard policy: per-trade loss ≤ 1 %, monthly return
                      // ≤ 10 %. We tint the (0,0)→(cap,cap) rectangle
                      // emerald, the right-of-cap strip amber (high-loss
                      // territory), and the above-cap strip grey (above
                      // typical risk-budget). Dashed red cap lines sit
                      // on the boundaries. Drawn in beforeDatasetsDraw
                      // so the bubbles, frontier line and labels render
                      // on top.
                      id: "rrSafeZone",
                      beforeDatasetsDraw(chart: any) {
                        const ctx = chart.ctx as CanvasRenderingContext2D;
                        const xScale = chart.scales.x;
                        const yScale = chart.scales.y;
                        if (!xScale || !yScale) return;
                        const x0 = xScale.getPixelForValue(0);
                        const xCap = xScale.getPixelForValue(PLATFORM_LOSS_CAP);
                        const xRight = xScale.getPixelForValue(xMax);
                        const y0 = yScale.getPixelForValue(0);
                        const yCap = yScale.getPixelForValue(PLATFORM_RETURN_CAP);
                        const yTop = yScale.getPixelForValue(yMax);
                        ctx.save();

                        // Safe zone — emerald wash inside the policy box.
                        ctx.fillStyle = "rgba(52,211,153,0.06)";
                        ctx.fillRect(x0, yCap, xCap - x0, y0 - yCap);

                        // Above-cap strip (return > 10 %) — neutral wash.
                        ctx.fillStyle = "rgba(148,163,184,0.05)";
                        ctx.fillRect(x0, yTop, xCap - x0, yCap - yTop);

                        // High-risk strip (loss > 1 %) — amber wash.
                        ctx.fillStyle = "rgba(251,146,60,0.07)";
                        ctx.fillRect(xCap, yTop, xRight - xCap, y0 - yTop);

                        // Vertical loss-cap line at x=1%.
                        ctx.strokeStyle = "rgba(248,113,113,0.55)";
                        ctx.lineWidth = 1.25;
                        ctx.setLineDash([5, 4]);
                        ctx.beginPath();
                        ctx.moveTo(xCap, yTop);
                        ctx.lineTo(xCap, y0);
                        ctx.stroke();

                        // Horizontal return-cap line at y=10%.
                        ctx.beginPath();
                        ctx.moveTo(x0, yCap);
                        ctx.lineTo(xRight, yCap);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        // Cap labels — small, anchored to top-right of
                        // each cap line so they read like axis annotations
                        // without competing with the bubbles.
                        ctx.fillStyle = "rgba(248,113,113,0.85)";
                        ctx.font =
                          '600 9.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
                        ctx.textAlign = "right";
                        ctx.textBaseline = "bottom";
                        ctx.fillText("1% loss cap", xCap - 4, y0 - 4);
                        ctx.textAlign = "left";
                        ctx.fillText("10% return cap", x0 + 4, yCap - 4);

                        // "Safe Zone" badge in the bottom-left corner of
                        // the green rectangle.
                        ctx.fillStyle = "rgba(52,211,153,0.7)";
                        ctx.font =
                          '700 10px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
                        ctx.textAlign = "left";
                        ctx.textBaseline = "bottom";
                        ctx.fillText("SAFE ZONE", x0 + 6, y0 - 6);

                        ctx.restore();
                      },
                    },
                    {
                      // Inline plugin that draws point labels with
                      // collision-aware vertical placement. Without this
                      // pass, "Your Profile" and a preset bubble that
                      // share the same drawdown (the most common case —
                      // the platform's default drawdownLimit is 5 %, the
                      // Balanced preset is also 5 %) print their labels
                      // ("Balanced" and "You") on top of each other,
                      // producing the "ConserBalantced" / "You over
                      // Balanced" smear we saw in the bug report.
                      //
                      // Algorithm:
                      //   1. Build a label-info list for all 4 points.
                      //   2. Estimate each label's pixel-width via
                      //      ctx.measureText (font has been set to the
                      //      same metrics we'll draw with).
                      //   3. Sweep pairs; if two labels' x-extents
                      //      overlap and they sit at similar y, push the
                      //      lower-priority one (the user marker > a
                      //      preset > others) to the *opposite* side of
                      //      its bubble. We give "You" priority for
                      //      below-bubble placement so the user's marker
                      //      always sits on the underside, leaving the
                      //      benchmark name above where eyes scan first.
                      id: "rrPointLabels",
                      afterDatasetsDraw(chart: any) {
                        const ctx = chart.ctx as CanvasRenderingContext2D;
                        const profilesMeta = chart.getDatasetMeta(1);
                        const yourMeta = chart.getDatasetMeta(2);
                        const presetLabels = ["Conservative", "Balanced", "Aggressive"];
                        type LabelInfo = {
                          text: string;
                          color: string;
                          font: string;
                          cx: number;
                          cy: number;
                          bubbleY: number;
                          aboveOffset: number;
                          belowOffset: number;
                          width: number;
                          isUser: boolean;
                          placedBelow: boolean;
                        };
                        const items: LabelInfo[] = [];
                        const presetFont =
                          '600 10.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
                        const userFont =
                          '700 11.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
                        ctx.save();
                        profilesMeta.data.forEach((pt: any, i: number) => {
                          if (!pt) return;
                          ctx.font = presetFont;
                          items.push({
                            text: presetLabels[i] ?? "",
                            color: profileColors[i] ?? "rgba(148,163,184,0.9)",
                            font: presetFont,
                            cx: pt.x,
                            cy: pt.y - 20,
                            bubbleY: pt.y,
                            aboveOffset: -20,
                            belowOffset: 26,
                            width: ctx.measureText(presetLabels[i] ?? "").width,
                            isUser: false,
                            placedBelow: false,
                          });
                        });
                        const you = yourMeta.data[0];
                        if (you) {
                          ctx.font = userFont;
                          items.push({
                            text: "You",
                            color: "rgba(52,211,153,1)",
                            font: userFont,
                            cx: you.x,
                            cy: you.y - 24,
                            bubbleY: you.y,
                            aboveOffset: -24,
                            belowOffset: 30,
                            width: ctx.measureText("You").width,
                            isUser: true,
                            placedBelow: false,
                          });
                        }

                        // Pairwise collision sweep. We push "You" below
                        // first whenever it collides with a preset, then
                        // re-check the remaining preset pairs.
                        const padPx = 4;
                        const overlaps = (a: LabelInfo, b: LabelInfo) => {
                          if (Math.abs(a.cy - b.cy) > 12) return false;
                          const aL = a.cx - a.width / 2 - padPx;
                          const aR = a.cx + a.width / 2 + padPx;
                          const bL = b.cx - b.width / 2 - padPx;
                          const bR = b.cx + b.width / 2 + padPx;
                          return !(aR < bL || bR < aL);
                        };
                        for (let pass = 0; pass < 3; pass++) {
                          let moved = false;
                          for (let i = 0; i < items.length; i++) {
                            for (let j = i + 1; j < items.length; j++) {
                              const a = items[i]!;
                              const b = items[j]!;
                              if (!overlaps(a, b)) continue;
                              // Prefer to push the user label below; else
                              // push whichever is currently above its
                              // bubble (so we don't keep ping-ponging).
                              const target =
                                a.isUser && !a.placedBelow
                                  ? a
                                  : b.isUser && !b.placedBelow
                                    ? b
                                    : !a.placedBelow
                                      ? a
                                      : !b.placedBelow
                                        ? b
                                        : null;
                              if (!target) continue;
                              target.cy = target.bubbleY + target.belowOffset;
                              target.placedBelow = true;
                              moved = true;
                            }
                          }
                          if (!moved) break;
                        }

                        // Leader lines: thin connector from each label
                        // back to its bubble centre. Helps the reader
                        // disambiguate which label belongs to which
                        // bubble when several markers cluster around the
                        // same x (e.g. user limit 5 % overlapping the
                        // Balanced 5 % preset). Drawn first so the label
                        // text overlays the line endpoint cleanly.
                        items.forEach((l) => {
                          ctx.beginPath();
                          ctx.strokeStyle = l.isUser
                            ? "rgba(52,211,153,0.45)"
                            : "rgba(148,163,184,0.35)";
                          ctx.lineWidth = 1;
                          ctx.setLineDash([]);
                          // Start ~6 px short of the bubble centre so the
                          // line emerges from the bubble's edge, not its
                          // middle. Stop ~6 px short of the label centre
                          // for the same reason on the text side.
                          const dy = l.cy - l.bubbleY;
                          const startY = l.bubbleY + Math.sign(dy) * 9;
                          const endY = l.cy - Math.sign(dy) * 6;
                          ctx.moveTo(l.cx, startY);
                          ctx.lineTo(l.cx, endY);
                          ctx.stroke();
                        });

                        items.forEach((l) => {
                          ctx.font = l.font;
                          ctx.fillStyle = l.color;
                          ctx.textAlign = "center";
                          ctx.textBaseline = "middle";
                          ctx.fillText(l.text, l.cx, l.cy);
                        });
                        ctx.restore();
                      },
                    },
                  ]}
                  options={{
                    ...CHART_DEFAULTS,
                    layout: {
                      // Extra top + bottom padding so collision-pushed
                      // labels (above or below the bubble) don't clip
                      // into the legend or the x-axis title.
                      padding: { top: 18, right: 18, bottom: 14, left: 6 },
                    },
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      legend: {
                        display: true,
                        // Bottom legend keeps the chart's title and
                        // bubbles from competing for the same vertical
                        // strip and gives label-collision below-bubble
                        // placements room to breathe.
                        position: "bottom" as const,
                        align: "center" as const,
                        labels: {
                          color: "#94a3b8",
                          boxWidth: 8,
                          boxHeight: 8,
                          borderRadius: 4,
                          font: { size: 11, weight: 600 as const },
                          padding: 14,
                          usePointStyle: true,
                          // Hide the "Efficient Frontier" entry from the
                          // legend; the dashed line is self-explanatory.
                          filter: (item: any) => item.text !== "Efficient Frontier",
                        },
                      },
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        // Suppress hover-on-line tooltip so only bubbles
                        // are interactive.
                        filter: (ctx: any) =>
                          ctx.dataset.label !== "Efficient Frontier",
                        callbacks: {
                          title: (items: any) => {
                            const dsIdx = items[0]?.datasetIndex;
                            const idx = items[0]?.dataIndex;
                            if (dsIdx === 2) return "Your Profile · Live";
                            const lbl = riskProfiles[idx ?? 0]?.label ?? "";
                            return `${lbl} · Platform Tier`;
                          },
                          label: (ctx: any) => {
                            const dsIdx = ctx.datasetIndex;
                            const x = Number(ctx.parsed.x);
                            // For "Your Profile" we display the *true*
                            // monthly return (riskProfiles[3].actualReturn)
                            // even though the bubble is visually clamped
                            // to the 0–11.5 % chart band.
                            const y =
                              dsIdx === 2
                                ? Number(yourProfile.actualReturn)
                                : Number(ctx.parsed.y);
                            const lossOk = x <= PLATFORM_LOSS_CAP + 0.001;
                            const returnOk = y <= PLATFORM_RETURN_CAP + 0.001;
                            return [
                              ` Per-Trade Loss: ${x.toFixed(2)}%  ${lossOk ? "✓ within cap" : "⚠ above 1% cap"}`,
                              ` Monthly Return: ${y >= 0 ? "+" : ""}${y.toFixed(2)}%  ${returnOk ? "✓ within cap" : "⚠ above 10% cap"}`,
                              ` Annualised: ${y >= 0 ? "+" : ""}${(y * 12).toFixed(1)}%`,
                            ];
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        ...CHART_DEFAULTS.scales.x,
                        type: "linear" as const,
                        // Hard bounds (not suggested) so the safe-zone
                        // rectangle and cap lines render at predictable
                        // pixel positions regardless of the user's data.
                        min: xMin,
                        max: xMax,
                        title: {
                          display: true,
                          text: "Per-Trade Loss (%)  ·  cap = 1%",
                          color: "#94a3b8",
                          font: { size: 11, weight: 600 as const },
                          padding: { top: 8 },
                        },
                        ticks: {
                          ...CHART_DEFAULTS.scales.x.ticks,
                          maxTicksLimit: 8,
                          stepSize: 0.2,
                          callback: (v: any) => `${Number(v).toFixed(1)}%`,
                        },
                      },
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        min: yMin,
                        max: yMax,
                        title: {
                          display: true,
                          text: "Monthly Return (%)  ·  cap = 10%",
                          color: "#94a3b8",
                          font: { size: 11, weight: 600 as const },
                          padding: { bottom: 8 },
                        },
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          maxTicksLimit: 7,
                          stepSize: 2,
                          callback: (v: any) => `${Number(v).toFixed(0)}%`,
                        },
                      },
                    },
                  }}
                />
              );
            })()}
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
            // Apply equityScale so the cumulative $ figure matches the dashboard's
            // fund-scaled totals. No baseline added here — baseline is a one-time
            // floor on the lifetime card, not a monthly accumulation.
            const totalProfit =
              monthlyData.reduce((a, m) => a + m.totalProfit, 0) * equityScale;
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
                              {m.totalProfit >= 0 ? "+" : ""}${Math.abs(m.totalProfit * equityScale).toFixed(2)}
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
