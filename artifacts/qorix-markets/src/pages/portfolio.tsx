import { Layout } from "@/components/layout";
import { Link } from "wouter";
import {
  useGetInvestment,
  useGetDashboardSummary,
  useGetEquityChart,
  useGetTrades,
} from "@workspace/api-client-react";
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
import {
  AreaChart,
  Area,
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

      {/* Equity sparkline + Investment meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d1525] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-white">Equity Curve · 30D</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Mark-to-market portfolio value</p>
            </div>
            {summary?.dailyProfitLoss !== undefined && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Today</div>
                <div className="text-sm font-bold text-emerald-400">
                  +${fmtMoney(summary.dailyProfitLoss ?? 0)}
                </div>
              </div>
            )}
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equity?.points ?? []}>
                <defs>
                  <linearGradient id="portEqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
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
                  fill="url(#portEqGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0d1525] p-5 space-y-4">
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

      {/* Recent trade attribution */}
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
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Layout>
      <PortfolioInner />
    </Layout>
  );
}
