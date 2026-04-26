import { useGetTradingDeskStats, useGetTradingDeskTraders, useGetDashboardSummary, useGetInvestment } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { motion, type Variants } from "framer-motion";
import { Link } from "wouter";
import {
  Users, Award, TrendingUp, Target, Activity, Zap,
  BarChart2, ArrowUpRight, Lock, Crown, Sparkles, CheckCheck,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

/* ── Strategy configuration ─────────────────────────────────────── */
const STRATEGY_CFG: Record<string, {
  color: string; bg: string; border: string; icon: React.ElementType; desc: string; tags: string[];
}> = {
  scalping: {
    color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/25",
    icon: Zap,
    desc: "High-frequency micro-trades capturing small price movements across USD pairs. Runs continuously 24/7.",
    tags: ["< 5 min holds", "High frequency", "Low risk per trade"],
  },
  swing: {
    color: "#6366f1", bg: "bg-indigo-500/10", border: "border-indigo-500/25",
    icon: TrendingUp,
    desc: "Multi-day positions riding established trend momentum with tight stop-loss and trailing take-profit logic.",
    tags: ["1–3 day holds", "Trend-following", "Macro analysis"],
  },
  hybrid: {
    color: "#22c55e", bg: "bg-emerald-500/10", border: "border-emerald-500/25",
    icon: BarChart2,
    desc: "Combines algorithmic pattern recognition with cross-exchange arbitrage opportunities for enhanced returns.",
    tags: ["Mixed holds", "Arbitrage logic", "ML signal integration"],
  },
};

const PIE_ROUNDING = 4;

/* ── Custom Tooltip ──────────────────────────────────────────────── */
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass-card px-3 py-2 rounded-xl text-xs border border-white/10 shadow-xl">
      <div className="font-semibold">{d.name}</div>
      <div className="text-muted-foreground mt-0.5">{d.value} traders ({d.payload.percentage}%)</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 rounded-xl text-xs border border-white/10 shadow-xl">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="font-semibold" style={{ color: p.fill }}>{p.value}% win rate</div>
      ))}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────── */
function StatCardSkeleton() {
  return (
    <div className="glass-card p-5 rounded-2xl animate-pulse space-y-2">
      <div className="skeleton-shimmer h-3 w-20 rounded" />
      <div className="skeleton-shimmer h-9 w-28 rounded" />
      <div className="skeleton-shimmer h-2.5 w-32 rounded" />
    </div>
  );
}

/* ── Trader initials avatar ──────────────────────────────────────── */
function TraderAvatar({ name, color }: { name: string; color: string }) {
  const parts = name.split(" ");
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: `${color}30`, border: `1px solid ${color}40` }}
    >
      {initials.toUpperCase()}
    </div>
  );
}

/* ── Animation variants ──────────────────────────────────────────── */
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

/* ── Main Page ───────────────────────────────────────────────────── */
export default function TradingDeskPage() {
  // Premium gate — Trading Desk is for large fund investors only
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: investment } = useGetInvestment({ query: { refetchInterval: 30000 } });
  const TRADING_DESK_MIN_FUND = 10000;
  const investorFund = Math.max(
    Number(summary?.totalBalance ?? 0),
    Number(summary?.activeInvestment ?? 0),
    Number(investment?.amount ?? 0),
  );
  const hasAccess = investorFund >= TRADING_DESK_MIN_FUND;
  const progressPct = Math.min(100, (investorFund / TRADING_DESK_MIN_FUND) * 100);

  const { data: stats, isLoading: statsLoading } = useGetTradingDeskStats({ query: { enabled: hasAccess } });
  const { data: tradersData, isLoading: tradersLoading } = useGetTradingDeskTraders({ query: { enabled: hasAccess } });
  const traders = tradersData?.data ?? [];

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
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-8 md:p-10 text-center">
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
                Institutional Trading Desk
              </h1>
              <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Direct access to our professional trader network, strategy allocations, win-rate breakdowns, and live desk activity — reserved for qualified investors.
              </p>
              <p className="mt-4 text-amber-200/90 text-sm font-semibold">
                Exclusively available for investors with a fund of{" "}
                <span className="text-amber-300 font-bold">${TRADING_DESK_MIN_FUND.toLocaleString()}+</span>
              </p>

              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-md mx-auto">
                {[
                  "Professional trader profiles & stats",
                  "Strategy allocation breakdown",
                  "Live desk performance metrics",
                  "Win-rate & risk analytics",
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

              <div className="mt-7 max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Your fund</span>
                  <span className="font-bold text-white tabular-nums">
                    ${investorFund.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="text-muted-foreground"> / ${TRADING_DESK_MIN_FUND.toLocaleString()}</span>
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
                    ${Math.max(0, TRADING_DESK_MIN_FUND - investorFund).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>{" "}
                  more to unlock
                </p>
              </div>

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

  const pieData = (stats?.strategies ?? []).map((s) => ({
    name: s.label,
    value: s.count,
    percentage: s.percentage,
    color: STRATEGY_CFG[s.type]?.color ?? "#888",
  }));

  const winRateData = (stats?.strategies ?? []).map((s) => ({
    name: s.label.replace(" Trading", "").replace(" / Arbitrage", ""),
    winRate: s.avgWinRate,
    fill: STRATEGY_CFG[s.type]?.color ?? "#888",
  }));

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Trading Desk</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Professional trader roster — live statistics and strategy breakdown.
            </p>
          </div>
          {!statsLoading && stats && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-400 shrink-0">
              <div className="live-dot w-1.5 h-1.5" />
              {stats.totalTraders} traders active
            </div>
          )}
        </motion.div>

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : stats ? (
            [
              {
                icon: Users, label: "Total Traders", value: `${stats.totalTraders}`,
                sub: "active on the desk", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20",
                top: "from-blue-500 to-blue-400",
                tooltip: `${stats.totalTraders} professional traders are actively monitoring and executing trades on the Qorix desk 24/7.`,
              },
              {
                icon: Award, label: "Combined Experience", value: `${stats.combinedExperience} yrs`,
                sub: `avg ${stats.avgExperience} yrs per trader`, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20",
                top: "from-amber-500 to-yellow-400",
                tooltip: `Across all ${stats.totalTraders} traders the desk has ${stats.combinedExperience} years of combined market experience — averaging ${stats.avgExperience} years per trader.`,
              },
              {
                icon: Target, label: "Avg Win Rate", value: `${stats.overallAvgWinRate}%`,
                sub: "across all strategies", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",
                top: "from-emerald-500 to-green-400",
                tooltip: `${stats.overallAvgWinRate}% of trades close profitably — measured across every active strategy on the desk.`,
              },
              {
                icon: Activity, label: "Strategies", value: `${stats.strategies.length}`,
                sub: "scalping · swing · hybrid", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20",
                top: "from-violet-500 to-indigo-400",
                tooltip: "Three independent strategies run in parallel — scalping (high-frequency micro-trades), swing (multi-day trend positions) and hybrid (algorithmic + arbitrage).",
              },
            ].map(({ icon: Icon, label, value, sub, color, bg, top, tooltip }: any) => (
              <div key={label} className={`glass-card rounded-2xl p-5 border ${bg} relative overflow-hidden`} title={tooltip || undefined}>
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${top} rounded-t-2xl`} />
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    {label}
                    {tooltip && <span className="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full bg-white/8 text-[8px] text-white/50 cursor-help" aria-label={tooltip}>i</span>}
                  </span>
                  <Icon style={{ width: 13, height: 13 }} className={color} />
                </div>
                <div className={`text-2xl md:text-3xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{sub}</div>
              </div>
            ))
          ) : null}
        </motion.div>

        {/* ── Charts Row ─────────────────────────────────────── */}
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Pie / Donut — strategy distribution */}
          <div className="glass-card rounded-2xl p-5 md:p-6">
            <div className="mb-4">
              <div className="text-sm font-semibold">Strategy Distribution</div>
              <div className="text-xs text-muted-foreground mt-0.5">Trader allocation across strategies</div>
            </div>
            {statsLoading ? (
              <div className="skeleton-shimmer h-48 rounded-xl" />
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.85} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex-1 space-y-3">
                  {pieData.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="font-medium">{d.name}</span>
                        </span>
                        <span className="font-bold tabular-nums" style={{ color: d.color }}>{d.value}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: d.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${d.percentage}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Win Rate Bar Chart */}
          <div className="glass-card rounded-2xl p-5 md:p-6">
            <div className="mb-4">
              <div className="text-sm font-semibold">Average Win Rate by Strategy</div>
              <div className="text-xs text-muted-foreground mt-0.5">% of profitable trades per strategy</div>
            </div>
            {statsLoading ? (
              <div className="skeleton-shimmer h-48 rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={winRateData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[55, 80]} tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                    {winRateData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* ── Strategy Cards ─────────────────────────────────── */}
        <motion.div variants={item}>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <BarChart2 style={{ width: 15, height: 15 }} className="text-primary" />
            Strategy Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card p-5 rounded-2xl animate-pulse space-y-3">
                  <div className="skeleton-shimmer h-4 w-24 rounded" />
                  <div className="skeleton-shimmer h-3 w-full rounded" />
                  <div className="skeleton-shimmer h-3 w-3/4 rounded" />
                </div>
              ))
            ) : (stats?.strategies ?? []).map((strategy) => {
              const cfg = STRATEGY_CFG[strategy.type] ?? STRATEGY_CFG.scalping!;
              const Icon = cfg.icon;
              return (
                <div key={strategy.type} className={`glass-card rounded-2xl p-5 border ${cfg.border} space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                        <Icon style={{ width: 15, height: 15, color: cfg.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold">{strategy.label}</div>
                        <div className="text-[11px] text-muted-foreground">{strategy.count} traders</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: cfg.color }}>{strategy.avgWinRate}%</div>
                      <div className="text-[10px] text-muted-foreground">win rate</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{cfg.desc}</p>

                  <div className="space-y-1.5">
                    {cfg.tags.map((tag) => (
                      <div key={tag} className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-white/5 border border-white/8 text-muted-foreground mr-1.5">
                        <ArrowUpRight style={{ width: 9, height: 9 }} />
                        {tag}
                      </div>
                    ))}
                  </div>

                  {/* Win rate bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Win rate</span>
                      <span className="font-semibold">{strategy.percentage}% of desk</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: cfg.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${strategy.avgWinRate}%` }}
                        transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Trader Roster ───────────────────────────────────── */}
        <motion.div variants={item}>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Users style={{ width: 15, height: 15 }} className="text-primary" />
            Trader Roster
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            {tradersLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                    <div className="skeleton-shimmer w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton-shimmer h-3 w-32 rounded" />
                      <div className="skeleton-shimmer h-2.5 w-20 rounded" />
                    </div>
                    <div className="skeleton-shimmer h-3 w-12 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {/* Group by strategy */}
                {["scalping", "swing", "hybrid"].map((stratType) => {
                  const cfg = STRATEGY_CFG[stratType]!;
                  const Icon = cfg.icon;
                  const stratTraders = traders.filter((t) => t.strategyType === stratType);
                  if (stratTraders.length === 0) return null;
                  const stratLabel = stats?.strategies.find((s) => s.type === stratType)?.label ?? stratType;
                  return (
                    <div key={stratType}>
                      {/* Group header */}
                      <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg} border-b border-white/[0.05]`}>
                        <Icon style={{ width: 12, height: 12, color: cfg.color }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{stratLabel}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">· {stratTraders.length} traders</span>
                      </div>
                      {/* Trader rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                        {stratTraders.map((trader) => (
                          <div key={trader.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors border-r border-b border-white/[0.03]">
                            <TraderAvatar name={trader.name} color={cfg.color} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{trader.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{trader.experienceYears} yrs exp</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{trader.winRatePercent}%</div>
                              <div className="text-[9px] text-muted-foreground">win rate</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

      </motion.div>
    </Layout>
  );
}
