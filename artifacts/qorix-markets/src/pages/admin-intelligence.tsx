import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  ShieldAlert,
  Clock,
  Brain,
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { format, parseISO } from "date-fns";

type IntelligenceData = {
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    netPlatformProfit: number;
    riskExposure: {
      low: { amount: number; investors: number };
      medium: { amount: number; investors: number };
      high: { amount: number; investors: number };
    };
    pendingPayouts: { count: number; amount: number };
  };
  flowSeries: { date: string; deposits: number; withdrawals: number; net: number }[];
  profitSeries: { date: string; profitPercent: number; distributed: number; aum: number }[];
  topInvestors: { email: string; fullName: string; amount: number; riskLevel: string; totalProfit: number }[];
};

function useIntelligence() {
  return useQuery<IntelligenceData>({
    queryKey: ["admin-intelligence"],
    queryFn: async () => {
      const token = localStorage.getItem("qorix_token");
      const res = await fetch("/api/admin/intelligence", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch intelligence data");
      return res.json();
    },
    refetchInterval: 60000,
  });
}

const RISK_COLORS = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const RISK_LABELS = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtDate(str: string) {
  try {
    return format(parseISO(str), "MMM d");
  } catch {
    return str;
  }
}

const tooltipStyle = {
  contentStyle: {
    background: "#0d1525",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 12,
  },
  itemStyle: { color: "#e2e8f0" },
  cursor: { fill: "rgba(255,255,255,0.03)" },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function AdminIntelligencePage() {
  const { data, isLoading, refetch, isFetching } = useIntelligence();

  const riskChartData = data
    ? [
        { name: "Low", amount: data.summary.riskExposure.low.amount, investors: data.summary.riskExposure.low.investors, fill: RISK_COLORS.low },
        { name: "Medium", amount: data.summary.riskExposure.medium.amount, investors: data.summary.riskExposure.medium.investors, fill: RISK_COLORS.medium },
        { name: "High", amount: data.summary.riskExposure.high.amount, investors: data.summary.riskExposure.high.investors, fill: RISK_COLORS.high },
      ]
    : [];

  const totalRisk = riskChartData.reduce((s, r) => s + r.amount, 0);

  const pieData = riskChartData
    .filter((r) => r.amount > 0)
    .map((r) => ({ name: r.name, value: r.amount, fill: r.fill }));

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-6 h-6 text-blue-400" />
              <h1 className="text-3xl font-bold tracking-tight text-primary">Intelligence Dashboard</h1>
            </div>
            <p className="text-muted-foreground">Platform-wide financial insights and risk analytics.</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="glass-card p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Deposits</span>
            </div>
            {isLoading ? (
              <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-emerald-400">
                <AnimatedCounter value={data?.summary.totalDeposits ?? 0} prefix="$" />
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Withdrawals</span>
            </div>
            {isLoading ? (
              <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-amber-400">
                <AnimatedCounter value={data?.summary.totalWithdrawals ?? 0} prefix="$" />
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Net Platform Profit</span>
            </div>
            {isLoading ? (
              <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-blue-400">
                <AnimatedCounter value={data?.summary.netPlatformProfit ?? 0} prefix="$" />
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl border border-violet-500/20 bg-violet-500/5 col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <ShieldAlert className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Risk Exposure</span>
            </div>
            {isLoading ? (
              <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-violet-400">
                <AnimatedCounter value={totalRisk} prefix="$" />
              </div>
            )}
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                {riskChartData.reduce((s, r) => s + r.investors, 0)} active investors
              </p>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Pending Payouts</span>
            </div>
            {isLoading ? (
              <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
            ) : (
              <div className="text-xl font-bold text-rose-400">
                <AnimatedCounter value={data?.summary.pendingPayouts.amount ?? 0} prefix="$" />
              </div>
            )}
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.pendingPayouts.count} pending requests
              </p>
            )}
          </div>
        </motion.div>

        {/* Flow Chart + Risk Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div variants={item} className="lg:col-span-2 glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-white">Capital Flow — Last 30 Days</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Deposits vs withdrawals over time</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Deposits</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Withdrawals</span>
              </div>
            </div>
            {isLoading ? (
              <div className="h-56 bg-white/3 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.flowSeries ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradDeposit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradWithdrawal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => fmt(v)}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: number, name: string) => [fmt(v), name === "deposits" ? "Deposits" : "Withdrawals"]}
                    labelFormatter={fmtDate}
                  />
                  <Area type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} fill="url(#gradDeposit)" dot={false} />
                  <Area type="monotone" dataKey="withdrawals" stroke="#f59e0b" strokeWidth={2} fill="url(#gradWithdrawal)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div variants={item} className="glass-card rounded-xl p-6">
            <div className="mb-5">
              <h2 className="font-bold text-white">Risk Exposure</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Active AUM by risk level</p>
            </div>
            {isLoading ? (
              <div className="h-56 bg-white/3 rounded-xl animate-pulse" />
            ) : totalRisk === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <BarChart3 className="w-8 h-8 opacity-30" />
                <span className="text-sm">No active investments</span>
              </div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [fmt(v), "AUM"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {riskChartData.map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.fill }} />
                        <span className="text-muted-foreground">{r.name} Risk</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white text-xs">{fmt(r.amount)}</div>
                        <div className="text-[10px] text-muted-foreground">{r.investors} investors</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Profit Distribution Chart + Top Investors */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <motion.div variants={item} className="lg:col-span-3 glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-white">Profit Distribution History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Daily profit % and amount distributed</p>
              </div>
            </div>
            {isLoading ? (
              <div className="h-48 bg-white/3 rounded-xl animate-pulse" />
            ) : !data?.profitSeries.length ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-30" />
                <span className="text-sm">No profit distributions yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.profitSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => fmt(v)}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: number, name: string) =>
                      name === "distributed" ? [fmt(v), "Distributed"] : [`${v.toFixed(2)}%`, "Profit %"]
                    }
                    labelFormatter={fmtDate}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 11, color: "#94a3b8" }}>{value === "distributed" ? "Amount Distributed" : "Profit %"}</span>}
                  />
                  <Bar yAxisId="left" dataKey="distributed" fill="#3b82f6" fillOpacity={0.85} radius={[3, 3, 0, 0]} name="distributed" />
                  <Line yAxisId="right" type="monotone" dataKey="profitPercent" stroke="#818cf8" strokeWidth={2} dot={false} name="profitPercent" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div variants={item} className="lg:col-span-2 glass-card rounded-xl p-6">
            <div className="mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="font-bold text-white">Top Investors</h2>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-white/3 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !data?.topInvestors.length ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Users className="w-8 h-8 opacity-30" />
                <span className="text-sm">No active investors</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.topInvestors.map((inv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors border border-white/5"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{inv.fullName || inv.email}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${RISK_COLORS[inv.riskLevel as keyof typeof RISK_COLORS]}20`,
                            color: RISK_COLORS[inv.riskLevel as keyof typeof RISK_COLORS],
                          }}
                        >
                          {RISK_LABELS[inv.riskLevel as keyof typeof RISK_LABELS] ?? inv.riskLevel}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          +{fmt(inv.totalProfit)} earned
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">{fmt(inv.amount)}</div>
                      <div className="text-[10px] text-muted-foreground">invested</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Net Flow Chart */}
        <motion.div variants={item} className="glass-card rounded-xl p-6">
          <div className="mb-5">
            <h2 className="font-bold text-white">Net Capital Flow</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Net deposits minus withdrawals by day (positive = net inflow)</p>
          </div>
          {isLoading ? (
            <div className="h-40 bg-white/3 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.flowSeries ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => fmt(v)}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => [fmt(v), "Net Flow"]}
                  labelFormatter={fmtDate}
                />
                <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                  {(data?.flowSeries ?? []).map((entry, index) => (
                    <Cell key={index} fill={entry.net >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
}
