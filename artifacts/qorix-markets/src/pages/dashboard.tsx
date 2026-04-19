import {
  useGetDashboardSummary,
  useGetEquityChart,
  useGetTrades,
  useGetDashboardPerformance,
  useGetDashboardFundStats,
  useGetInvestment,
  useUpdateProtection,
  useGetMarketIndicators,
  getGetInvestmentQueryKey,
  type VipInfo,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { GrowthPanel } from "@/components/growth-panel";
import { VipBadge, VipCard } from "@/components/vip-badge";
import { AnimatedCounter, BigBalanceCounter } from "@/components/animated-counter";
import { useAuth } from "@/hooks/use-auth";
import { generateMonthlyReport } from "@/lib/report-generator";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity, Clock, TrendingUp,
  TrendingDown, Zap, Target, ShieldCheck, BarChart2, Layers,
  RefreshCw, Globe, PieChart, Award, Shield, AlertTriangle, CheckCircle, FileDown,
  Users, UserCheck, Banknote
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid
} from "recharts";

const TIME_FILTERS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

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
                onClick={() => onSave(pendingLimit!)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle style={{ width: 13, height: 13 }} /> Apply {pendingLimit}% Limit</>
                )}
              </motion.button>
            )}
          </AnimatePresence>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-muted-foreground leading-relaxed">
            When your drawdown reaches <span className="text-white font-medium">{selectedLimit}%</span> of invested capital,
            trading is automatically stopped and your remaining funds are secured.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [chartDays, setChartDays] = useState(30);
  const [pendingLimit, setPendingLimit] = useState<number | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const prevProfitRef = useRef(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { refetchInterval: 5000 }
  });
  const { data: equity, isLoading: equityLoading } = useGetEquityChart(
    { days: chartDays },
    { query: { refetchInterval: 15000 } }
  );
  const { data: tradesData, isLoading: tradesLoading } = useGetTrades(
    { limit: 8 },
    { query: { refetchInterval: 5000 } }
  );
  const { data: perf, isLoading: perfLoading } = useGetDashboardPerformance({
    query: { refetchInterval: 30000 }
  });
  const { data: fundStats, isLoading: fundLoading } = useGetDashboardFundStats({
    query: { refetchInterval: 30000 }
  });
  const { data: investment, isLoading: investLoading } = useGetInvestment({
    query: { refetchInterval: 10000 }
  });
  const { data: marketIndicators } = useGetMarketIndicators({
    query: { refetchInterval: 30000 }
  });
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

  const trades = Array.isArray(tradesData) ? tradesData : [];
  const equityArr = Array.isArray(equity) ? equity : [];

  const dailyPL = summary?.dailyProfitLoss || 0;
  const dailyPct = summary?.dailyProfitPercent || 0;
  const isPositive = dailyPL >= 0;

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
      value: <BigBalanceCounter value={summary?.totalBalance || 0} className="text-2xl md:text-3xl" />,
      sub: (
        <span className="text-xs text-muted-foreground">
          Profit: <span className="text-green-400 font-medium">${(summary?.profitBalance || 0).toFixed(2)}</span>
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
      label: "Active Investment",
      icon: <Zap style={{ width: 16, height: 16 }} className="text-indigo-400" />,
      value: <BigBalanceCounter value={summary?.activeInvestment || 0} className="text-2xl md:text-3xl" />,
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
      icon: <Activity style={{ width: 16, height: 16 }} className="text-emerald-400" />,
      value: (
        <span className="text-2xl md:text-3xl font-bold profit-text">
          +<AnimatedCounter value={summary?.totalProfit || 0} prefix="$" />
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
            <button
              onClick={handleDownloadReport}
              disabled={isGeneratingReport || summaryLoading || perfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown style={{ width: 12, height: 12 }} />
              {isGeneratingReport ? "Generating…" : "Download Report"}
            </button>
            <div className="flex items-center gap-2 text-sm bg-green-500/5 border border-green-500/15 rounded-full px-3 py-1.5">
              <span className="live-dot" />
              <span className="text-green-400 font-medium text-xs">Live · 5s</span>
            </div>
          </div>
        </div>

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
                display: marketIndicators != null ? String(marketIndicators.activeInvestors) : "—",
                sub: undefined as string | undefined,
                color: "text-blue-400",
                bg: "bg-blue-500/5 border-blue-500/15",
              },
              {
                icon: UserCheck,
                label: "Earning Now",
                display: marketIndicators != null ? `${marketIndicators.usersEarningNow}` : "—",
                sub: "users",
                color: "text-emerald-400",
                bg: "bg-emerald-500/5 border-emerald-500/15",
              },
              {
                icon: Banknote,
                label: "Withdrawals (24h)",
                display: marketIndicators != null ? `${marketIndicators.withdrawals24h}` : "—",
                sub: "processed",
                color: "text-amber-400",
                bg: "bg-amber-500/5 border-amber-500/15",
              },
              {
                icon: TrendingUp,
                label: "Avg Monthly Return",
                display:
                  marketIndicators != null
                    ? marketIndicators.avgMonthlyReturn > 0
                      ? `${marketIndicators.avgMonthlyReturn.toFixed(1)}%`
                      : "7–12%"
                    : "—",
                sub: "last 30 days",
                color: "text-violet-400",
                bg: "bg-violet-500/5 border-violet-500/15",
              },
          ]).map(({ icon: Icon, label, display, sub, color, bg }) => (
            <div key={label} className={`glass-card rounded-xl px-4 py-3 border ${bg} flex items-center gap-3`}>
              <div className={`shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center`}>
                <Icon style={{ width: 14, height: 14 }} className={color} />
              </div>
              <div className="min-w-0">
                <div className={`text-base font-bold ${color} tabular-nums leading-tight`}>{display}{sub ? <span className="text-xs font-normal text-muted-foreground ml-1">{sub}</span> : null}</div>
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Equity Curve</h3>
                <p className="text-xs text-muted-foreground">Portfolio value over time</p>
              </div>
              <div className="flex items-center gap-1">
                {TIME_FILTERS.map(f => (
                  <button
                    key={f.label}
                    onClick={() => setChartDays(f.days)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150 ${
                      chartDays === f.days
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
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
                    <Tooltip content={<CustomTooltip />} />
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
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <Clock style={{ width: 28, height: 28 }} className="mb-2 opacity-30" />
                  <p className="text-sm">No trades yet</p>
                  <p className="text-xs opacity-50 mt-0.5">Start investing to see activity</p>
                </div>
              ) : (
                trades.map((trade, i) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/20 hover:bg-white/[0.05] transition-all duration-150"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1 h-9 rounded-full ${trade.direction === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {trade.symbol}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${trade.direction === 'LONG' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                            {trade.direction}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(trade.executedAt), "MMM dd, HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm ${trade.profit >= 0 ? 'profit-text' : 'loss-text'} flex items-center justify-end gap-0.5`}>
                        {trade.profit >= 0 ? <ArrowUpRight style={{ width: 13, height: 13 }} /> : <ArrowDownRight style={{ width: 13, height: 13 }} />}
                        ${Math.abs(trade.profit).toFixed(2)}
                      </div>
                      <div className={`text-[11px] ${trade.profitPercent >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {trade.profitPercent > 0 ? '+' : ''}{trade.profitPercent}%
                      </div>
                    </div>
                  </motion.div>
                ))
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
                {TIME_FILTERS.find(f => f.days === chartDays)?.label}
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
                    <Tooltip content={<DrawdownTooltip />} />
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

          {/* Rolling Returns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Rolling Returns</h3>
                <p className="text-xs text-muted-foreground">Period performance comparison</p>
              </div>
            </div>
            <div className="space-y-4 mt-2">
              {perfLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
              ) : (
                (perf?.rollingReturns ?? [{ period: "7D", return: 0 }, { period: "30D", return: 0 }, { period: "90D", return: 0 }]).map((r, i) => {
                  const isPos = r.return >= 0;
                  const pct = Math.min(Math.abs(r.return), 100);
                  return (
                    <motion.div
                      key={r.period}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.05 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium w-8">{r.period}</span>
                          <span className={`text-sm font-bold tabular-nums ${isPos ? "profit-text" : "loss-text"}`}>
                            {isPos ? "+" : ""}{r.return.toFixed(2)}%
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isPos ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {isPos ? "▲" : "▼"} {Math.abs(r.return).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: isPos ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)" }}
                        />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Live Profit Ticker */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Profit</span>
                <div className="flex items-center gap-2">
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  <ProfitTicker value={summary?.totalProfit || 0} prev={prevProfit} />
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

        {/* Fund Transparency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Fund Transparency</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            <span className="text-[10px] text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full">Public</span>
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
