import { useRef } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  TrendingUp, Shield, BarChart2, Zap, Users, Award, CheckCircle2,
  ArrowRight, ChevronDown, Lock, Eye, Clock, Globe, Star,
  Target, Activity, DollarSign
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

/* ── Static data ────────────────────────────────────────────────── */
const MONTHLY_RETURNS = [
  { month: "Jul", return: 7.2, drawdown: 2.1 },
  { month: "Aug", return: 9.8, drawdown: 3.4 },
  { month: "Sep", return: 6.4, drawdown: 1.8 },
  { month: "Oct", return: 11.2, drawdown: 4.1 },
  { month: "Nov", return: 8.5, drawdown: 2.6 },
  { month: "Dec", return: 10.1, drawdown: 3.2 },
  { month: "Jan", return: 7.9, drawdown: 2.4 },
  { month: "Feb", return: 12.3, drawdown: 4.7 },
  { month: "Mar", return: 9.1, drawdown: 3.0 },
  { month: "Apr", return: 10.6, drawdown: 3.8 },
];

const CUMULATIVE = MONTHLY_RETURNS.reduce<{ month: string; equity: number }[]>((acc, d) => {
  const prev = acc.length ? acc[acc.length - 1]!.equity : 100;
  acc.push({ month: d.month, equity: +(prev * (1 + d.return / 100)).toFixed(2) });
  return acc;
}, []);

const STRATEGIES = [
  {
    id: "scalping",
    label: "Scalping",
    desc: "High-frequency micro-trades capturing 0.1–0.3% per entry across USDT pairs.",
    traders: 18,
    winRate: 71,
    avgHold: "< 5 min",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "swing",
    label: "Swing Trading",
    desc: "Multi-day positions riding trend momentum with tight stop-loss controls.",
    traders: 14,
    winRate: 65,
    avgHold: "1–3 days",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "hybrid",
    label: "Hybrid / Arbitrage",
    desc: "Combines algorithmic pattern recognition with cross-exchange arbitrage.",
    traders: 11,
    winRate: 68,
    avgHold: "Mixed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

const TRUST_POINTS = [
  {
    icon: Shield,
    title: "Risk-Managed Trading",
    desc: "Every strategy operates under strict per-trader drawdown limits. When a limit is hit, capital is automatically secured and positions closed.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/18",
  },
  {
    icon: Lock,
    title: "Capital Protection System",
    desc: "Client funds are segmented into main, trading, and profit balances. You control when to allocate, transfer, or withdraw.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/18",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    desc: "Real-time P&L dashboard, transaction history, and monthly performance reports — always available and downloadable.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/18",
  },
  {
    icon: Clock,
    title: "24 / 7 Automated Execution",
    desc: "Our trading desk never sleeps. Algorithms monitor markets across all sessions with zero manual intervention required.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/18",
  },
  {
    icon: Globe,
    title: "USDT / Stablecoin Only",
    desc: "All positions and returns are denominated in USDT, eliminating crypto volatility risk from your investment.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/18",
  },
  {
    icon: Star,
    title: "VIP Tier Rewards",
    desc: "Scale your investment to unlock Silver, Gold, and Platinum tiers — reducing fees and boosting your profit bonus by up to 15%.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/18",
  },
];

const STATS = [
  { label: "Total AUM", value: "$4.2M+", sub: "assets under management" },
  { label: "Active Traders", value: "43", sub: "professional desk members" },
  { label: "Strategies Running", value: "3", sub: "scalping · swing · hybrid" },
  { label: "Avg Monthly Return", value: "7–12%", sub: "across all strategies" },
];

/* ── Animation helpers ───────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut", delay: i * 0.09 } }),
};

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Custom Tooltip ──────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, suffix = "%" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 rounded-xl text-xs border border-white/10 shadow-xl">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function Landing() {
  const [, setLocation] = useLocation();
  const perfRef = useRef<HTMLElement>(null);

  const scrollToPerf = () => perfRef.current?.scrollIntoView({ behavior: "smooth" });

  const avgReturn = (MONTHLY_RETURNS.reduce((s, d) => s + d.return, 0) / MONTHLY_RETURNS.length).toFixed(1);
  const avgDrawdown = (MONTHLY_RETURNS.reduce((s, d) => s + d.drawdown, 0) / MONTHLY_RETURNS.length).toFixed(1);
  const bestMonth = Math.max(...MONTHLY_RETURNS.map((d) => d.return)).toFixed(1);
  const winMonths = MONTHLY_RETURNS.filter((d) => d.return > 0).length;
  const winRate = Math.round((winMonths / MONTHLY_RETURNS.length) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-nav border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.35)]">
              <TrendingUp style={{ width: 14, height: 14 }} className="text-white" />
            </div>
            <span className="font-bold tracking-tight">Qorix<span className="text-primary font-light">Markets</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {["Why Qorix", "Trading Desk", "Performance"].map((label) => (
              <button
                key={label}
                className="hover:text-white transition-colors"
                onClick={() => {
                  const id = label.toLowerCase().replace(/\s/g, "-");
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/login")}
              className="btn btn-ghost text-sm px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="btn btn-primary text-sm px-4 py-2"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
        {/* Radial glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-indigo-600/6 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="max-w-4xl"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-xs font-semibold text-primary mb-7">
              <div className="live-dot w-1.5 h-1.5 shrink-0" />
              43 Professional Traders · Live Now
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Institutional Trading Access<br className="hidden sm:block" />
              <span className="gradient-text"> for Retail Investors</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10">
              Access a professional trading desk executing automated USDT strategies 24 hours a day.
              Strict drawdown controls, real-time reporting, and fully transparent performance — all managed for you.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setLocation("/login")}
                className="btn btn-primary text-base px-7 py-3.5 gap-2"
              >
                Start Investing <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={scrollToPerf}
                className="btn btn-ghost text-base px-7 py-3.5 gap-2"
              >
                View Performance <ChevronDown style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-14 md:mt-16"
          >
            {STATS.map((s, i) => (
              <div key={s.label} className="glass-card p-4 md:p-5 rounded-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="text-2xl md:text-3xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs font-semibold mt-1">{s.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Why Qorix ──────────────────────────────────────────────── */}
      <section id="why-qorix" className="py-20 md:py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Why Qorix Markets</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for serious investors
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Every feature in Qorix was designed with one goal: give retail investors access to institutional-grade risk management and returns.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRUST_POINTS.map((pt, i) => {
              const Icon = pt.icon;
              return (
                <FadeIn key={pt.title} delay={i * 0.07}>
                  <div className={`glass-card rounded-2xl p-5 h-full border ${pt.bg} hover:scale-[1.01] transition-transform duration-200`}>
                    <div className={`inline-flex p-2.5 rounded-xl bg-white/5 mb-4 ${pt.color}`}>
                      <Icon style={{ width: 18, height: 18 }} />
                    </div>
                    <h3 className="font-semibold text-sm mb-2">{pt.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{pt.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trading Desk ───────────────────────────────────────────── */}
      <section id="trading-desk" className="py-20 md:py-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.04),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Trading Desk</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              43 Professional Traders
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Our trading desk operates three distinct strategy types, each with its own risk profile, capital allocation rules, and performance targets.
            </p>
          </FadeIn>

          {/* Desk stats */}
          <FadeIn>
            <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { icon: Users, label: "Total Traders", value: "43", color: "text-blue-400" },
                { icon: Award, label: "Avg Experience", value: "7+ yrs", color: "text-amber-400" },
                { icon: Target, label: "Win Rate (avg)", value: `${Math.round((71 + 65 + 68) / 3)}%`, color: "text-emerald-400" },
                { icon: Activity, label: "Trades / Day", value: "200+", color: "text-violet-400" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label}>
                  <Icon style={{ width: 20, height: 20 }} className={`${color} mx-auto mb-2 opacity-80`} />
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Strategy cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STRATEGIES.map((s, i) => (
              <FadeIn key={s.id} delay={i * 0.1}>
                <div className={`glass-card rounded-2xl p-5 border ${s.bg} h-full`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider ${s.color}`}>{s.label}</span>
                    <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-1 rounded-full">{s.traders} traders</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                  <div className="space-y-2">
                    {[
                      { label: "Win Rate", value: `${s.winRate}%` },
                      { label: "Avg Hold Time", value: s.avgHold },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className={`font-semibold ${s.color}`}>{r.value}</span>
                      </div>
                    ))}
                    {/* Win rate bar */}
                    <div className="h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full`}
                        style={{ background: s.id === "scalping" ? "#3b82f6" : s.id === "swing" ? "#6366f1" : "#22c55e" }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${s.winRate}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Performance ────────────────────────────────────────────── */}
      <section id="performance" ref={perfRef as any} className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Performance</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              10-Month Track Record
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Consistent monthly returns with disciplined drawdown control across all market conditions.
            </p>
          </FadeIn>

          {/* KPI Row */}
          <FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Avg Monthly Return", value: `${avgReturn}%`, icon: TrendingUp, color: "text-emerald-400" },
                { label: "Best Month", value: `${bestMonth}%`, icon: Zap, color: "text-amber-400" },
                { label: "Avg Max Drawdown", value: `${avgDrawdown}%`, icon: Shield, color: "text-blue-400" },
                { label: "Positive Months", value: `${winRate}%`, icon: BarChart2, color: "text-violet-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="glass-card rounded-2xl p-4 md:p-5 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Icon style={{ width: 16, height: 16 }} className={`${color} mx-auto mb-2`} />
                  <div className={`text-2xl md:text-3xl font-bold ${color}`}>{value}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Equity curve */}
            <FadeIn delay={0.05}>
              <div className="glass-card rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-semibold">Cumulative Equity Growth</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Starting from 100 USDT</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">{CUMULATIVE[CUMULATIVE.length - 1]?.equity?.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground">total return</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={CUMULATIVE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix=" USDT" />} />
                    <Area type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            {/* Monthly returns + drawdown */}
            <FadeIn delay={0.1}>
              <div className="glass-card rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-semibold">Monthly Return vs Drawdown</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Return (green) · Max drawdown (red)</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={MONTHLY_RETURNS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} />
                    <Bar dataKey="return" fill="#22c55e" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="drawdown" fill="#ef4444" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            {/* Win rate gauge-style bar */}
            <FadeIn delay={0.15} className="lg:col-span-2">
              <div className="glass-card rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-semibold">Strategy Win Rates</div>
                    <div className="text-xs text-muted-foreground mt-0.5">% of profitable trades per strategy</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {STRATEGIES.map((s) => (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                        <span className="text-sm font-bold">{s.winRate}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: s.id === "scalping" ? "#3b82f6" : s.id === "swing" ? "#6366f1" : "#22c55e" }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${s.winRate}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1.5">{s.traders} traders · Avg hold {s.avgHold}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Disclaimer */}
          <FadeIn>
            <p className="text-[11px] text-muted-foreground/60 text-center mt-5 max-w-2xl mx-auto leading-relaxed">
              Past performance is not indicative of future results. Trading involves risk and you may lose capital. All figures are based on historical strategy performance and are provided for informational purposes only.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.07),transparent_65%)] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
          <FadeIn>
            <div className="glass-card-glow rounded-3xl p-10 md:p-14 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                <DollarSign style={{ width: 24, height: 24 }} className="text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ready to start investing?
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-xl mx-auto">
                Join over 43 professional traders and start generating consistent USDT returns today. No experience required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setLocation("/login")}
                  className="btn btn-primary text-base px-8 py-3.5 gap-2"
                >
                  Start Investing <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
                <button
                  onClick={scrollToPerf}
                  className="btn btn-ghost text-base px-8 py-3.5 gap-2"
                >
                  <BarChart2 style={{ width: 16, height: 16 }} />
                  View Performance Report
                </button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
                {[
                  { icon: Shield, text: "Capital Protection" },
                  { icon: Lock, text: "Secure Platform" },
                  { icon: CheckCircle2, text: "USDT Only" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon style={{ width: 12, height: 12 }} className="text-primary" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <TrendingUp style={{ width: 10, height: 10 }} className="text-white" />
            </div>
            <span className="font-semibold text-white/60">QorixMarkets</span>
          </div>
          <span>© {new Date().getFullYear()} Qorix Markets. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>Not financial advice</span>
            <span>·</span>
            <span>Trading involves risk</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
