import { useRef } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Award,
  Banknote,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Eye,
  Globe,
  Lock,
  Shield,
  Star,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { useGetMarketIndicators } from "@workspace/api-client-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
    label: "Scalping Desk",
    desc: "High-frequency USDT entries designed to capture small market inefficiencies with strict stop rules.",
    traders: 18,
    winRate: 71,
    avgHold: "< 5 min",
    experience: "6.4 yrs",
    allocation: "34%",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "swing",
    label: "Swing Desk",
    desc: "Multi-day trend positions with defined risk bands, manual oversight, and daily exposure reviews.",
    traders: 14,
    winRate: 65,
    avgHold: "1–3 days",
    experience: "8.1 yrs",
    allocation: "41%",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "hybrid",
    label: "Hybrid / Arbitrage",
    desc: "Algorithmic pattern recognition plus cross-market spread capture for smoother return distribution.",
    traders: 11,
    winRate: 68,
    avgHold: "Mixed",
    experience: "7.6 yrs",
    allocation: "25%",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

const TRUST_POINTS = [
  { icon: Shield, title: "Risk-first mandate", desc: "Every allocation starts with a defined drawdown ceiling before capital is exposed." },
  { icon: Lock, title: "Segregated wallet logic", desc: "Main, trading, and profit balances make capital movement clear and auditable." },
  { icon: Eye, title: "Investor-grade reporting", desc: "Live P&L, allocation, trade activity, and withdrawal status stay visible." },
  { icon: Globe, title: "USDT treasury base", desc: "Capital, returns, and payouts are tracked in stablecoin-denominated balances." },
];

const WITHDRAWALS = [
  { user: "A. Mensah", amount: "$2,480", time: "8 min ago", status: "Paid" },
  { user: "N. Patel", amount: "$940", time: "21 min ago", status: "Paid" },
  { user: "K. Alvarez", amount: "$5,120", time: "46 min ago", status: "Paid" },
  { user: "D. Wright", amount: "$1,760", time: "1 hr ago", status: "Paid" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Open investor access", desc: "Create your account and prepare the USDT amount you want assigned to the desk." },
  { step: "02", title: "Choose your mandate", desc: "Select low, medium, or high risk. Your drawdown ceiling is locked into the system." },
  { step: "03", title: "Monitor the fund OS", desc: "Track allocation, profit, risk status, transfers, and withdrawals from one dashboard." },
];

const INVESTOR_SYSTEM = [
  { icon: Target, title: "Capital allocation engine", desc: "Funds are routed across scalping, swing, and hybrid strategies based on risk capacity and desk load." },
  { icon: Shield, title: "Risk committee layer", desc: "Drawdown caps, exposure monitoring, and auto-pause rules keep the product built around capital survival." },
  { icon: BarChart2, title: "Performance intelligence", desc: "Return, drawdown, trader activity, and investor balances are presented as decision-grade reporting." },
  { icon: Clock, title: "24/7 execution cycle", desc: "The desk remains active across market sessions while investors can monitor performance without manual trading." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut", delay: i * 0.08 } }),
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

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <FadeIn className="text-center max-w-2xl mx-auto mb-12">
      <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{eyebrow}</div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{title}</h2>
      <p className="text-muted-foreground text-lg leading-relaxed">{desc}</p>
    </FadeIn>
  );
}

function PremiumHeroVisual({
  activeInvestors,
  earningNow,
  withdrawals24h,
  slotsRemaining,
  slotsFilled,
  slotsTotal,
}: {
  activeInvestors: number;
  earningNow: number;
  withdrawals24h: number;
  slotsRemaining: number;
  slotsFilled: number;
  slotsTotal: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, rotateX: 8, y: 24 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 0.8, delay: 0.18, ease: "easeOut" }}
      className="premium-3d-stage w-full max-w-[580px] mx-auto xl:max-w-none"
    >
      <div className="premium-3d-card relative overflow-hidden rounded-[2rem] p-5 md:p-6">
        <div className="absolute inset-0 premium-grid-mask" />
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-emerald-500/12 blur-3xl" />

        <div className="relative flex items-center justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Qorix Capital OS</div>
            <div className="text-sm text-muted-foreground mt-1">Allocation · Risk · Reporting</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <div className="live-dot" /> Desk live
          </div>
        </div>

        <div className="relative h-[300px] sm:h-[340px] md:h-[380px]">
          <div className="absolute inset-x-4 top-8 h-64 premium-orbit-wrap">
            <div className="premium-orbit premium-orbit-a" />
            <div className="premium-orbit premium-orbit-b" />
            <div className="premium-orbit premium-orbit-c" />
            <div className="premium-core">
              <div className="premium-core-inner">
                <div className="text-[10px] uppercase tracking-[0.22em] text-blue-200/70">AUM Engine</div>
                <div className="text-3xl font-bold text-white mt-1">$4.2M</div>
                <div className="text-[11px] text-emerald-300 mt-1">capital active</div>
              </div>
            </div>
            <div className="premium-node premium-node-1">
              <BarChart2 style={{ width: 15, height: 15 }} />
              <span>Returns</span>
            </div>
            <div className="premium-node premium-node-2">
              <Shield style={{ width: 15, height: 15 }} />
              <span>Risk</span>
            </div>
            <div className="premium-node premium-node-3">
              <Users style={{ width: 15, height: 15 }} />
              <span>Desk</span>
            </div>
          </div>

          <motion.div
            className="hidden xl:block absolute left-0 top-6 w-40 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl shadow-2xl"
            animate={{ y: [0, -10, 0], rotate: [-1, 1, -1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Mandate</span>
              <Shield style={{ width: 14, height: 14 }} className="text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white">3–10%</div>
            <div className="text-[11px] text-muted-foreground">drawdown bands</div>
          </motion.div>

          <motion.div
            className="hidden xl:block absolute right-0 top-20 w-44 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-4 backdrop-blur-xl shadow-2xl"
            animate={{ y: [0, 12, 0], rotate: [1, -1, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-emerald-200/70">Earning now</span>
              <UserCheck style={{ width: 14, height: 14 }} className="text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-300">{earningNow.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-100/60">investors active</div>
          </motion.div>

          <motion.div
            className="hidden xl:block absolute left-7 bottom-14 w-44 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-4 backdrop-blur-xl shadow-2xl"
            animate={{ y: [0, 10, 0], rotate: [1, -0.5, 1] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-amber-200/70">Payout queue</span>
              <Banknote style={{ width: 14, height: 14 }} className="text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-300">{withdrawals24h}</div>
            <div className="text-[11px] text-amber-100/60">processed today</div>
          </motion.div>

          <motion.div
            className="hidden xl:block absolute right-6 bottom-8 w-44 rounded-2xl border border-violet-400/20 bg-violet-500/[0.08] p-4 backdrop-blur-xl shadow-2xl"
            animate={{ y: [0, -8, 0], rotate: [-1, 0.8, -1] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-violet-200/70">Investors</span>
              <Users style={{ width: 14, height: 14 }} className="text-violet-400" />
            </div>
            <div className="text-lg font-bold text-violet-200">{activeInvestors.toLocaleString()}</div>
            <div className="text-[11px] text-violet-100/60">currently onboarded</div>
          </motion.div>
        </div>

        <div className="relative rounded-2xl bg-black/25 border border-white/[0.08] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Private allocation capacity</div>
              <div className="text-xs text-muted-foreground">New deposits are capped to protect execution quality.</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-amber-400">{slotsRemaining}</div>
              <div className="text-[10px] text-muted-foreground">seats left</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full premium-capacity-bar" initial={{ width: 0 }} animate={{ width: `${slotsFilled}%` }} transition={{ duration: 1, delay: 0.35 }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
            <span>{slotsFilled}% allocated</span>
            <span>{slotsTotal} total capacity</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const perfRef = useRef<HTMLElement>(null);

  const { data: indicators } = useGetMarketIndicators({
    query: { refetchInterval: 30_000 },
  });

  const scrollToPerf = () => perfRef.current?.scrollIntoView({ behavior: "smooth" });
  const activeInvestors = indicators?.activeInvestors && indicators.activeInvestors > 0 ? indicators.activeInvestors : 184;
  const earningNow = indicators?.usersEarningNow && indicators.usersEarningNow > 0 ? indicators.usersEarningNow : 136;
  const withdrawals24h = indicators?.withdrawals24h && indicators.withdrawals24h > 0 ? indicators.withdrawals24h : 27;
  const avgReturn = indicators?.avgMonthlyReturn && indicators.avgMonthlyReturn > 0 ? indicators.avgMonthlyReturn.toFixed(1) : (MONTHLY_RETURNS.reduce((s, d) => s + d.return, 0) / MONTHLY_RETURNS.length).toFixed(1);
  const avgDrawdown = (MONTHLY_RETURNS.reduce((s, d) => s + d.drawdown, 0) / MONTHLY_RETURNS.length).toFixed(1);
  const bestMonth = Math.max(...MONTHLY_RETURNS.map((d) => d.return)).toFixed(1);
  const winMonths = MONTHLY_RETURNS.filter((d) => d.return > 0).length;
  const winRate = Math.round((winMonths / MONTHLY_RETURNS.length) * 100);
  const slotsTotal = 250;
  const slotsRemaining = Math.max(12, slotsTotal - activeInvestors);
  const slotsFilled = Math.min(95, Math.round(((slotsTotal - slotsRemaining) / slotsTotal) * 100));

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-50 glass-nav border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.35)]">
              <TrendingUp style={{ width: 14, height: 14 }} className="text-white" />
            </div>
            <span className="font-bold tracking-tight">Qorix<span className="text-primary font-light">Markets</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {[
              ["Performance", "performance"],
              ["Trading Desk", "trading-desk"],
              ["Risk", "risk"],
              ["How it works", "how-it-works"],
            ].map(([label, id]) => (
              <button key={id} className="hover:text-white transition-colors" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/login")} className="btn btn-ghost text-sm px-4 py-2">Sign In</button>
            <button onClick={() => setLocation("/login")} className="btn btn-primary text-sm px-4 py-2">Reserve Slot</button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[920px] h-[620px] bg-primary/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[520px] h-[520px] bg-indigo-600/6 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 grid xl:grid-cols-[1.05fr_0.95fr] gap-10 xl:gap-14 items-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="max-w-4xl mx-auto xl:mx-0 text-center xl:text-left">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/8 text-xs font-semibold text-primary mb-7">
              <div className="live-dot w-1.5 h-1.5 shrink-0" />
              Private allocation window open · {slotsRemaining} investor seats left
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
              A hedge-fund style USDT trading system
              <span className="gradient-text"> built for disciplined investors.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto xl:mx-0 leading-relaxed mb-8">
              Qorix Markets combines professional traders, automated execution, capital allocation logic, and drawdown protection into one investor operating system.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center xl:justify-start gap-3 mb-7">
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-7 py-3.5 gap-2">
                Apply for Access <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
              <button onClick={scrollToPerf} className="btn btn-ghost text-base px-7 py-3.5 gap-2">
                Review Track Record <ChevronDown style={{ width: 16, height: 16 }} />
              </button>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 max-w-2xl mx-auto xl:mx-0">
              {[
                { label: "Managed AUM", value: "$4.2M+" },
                { label: "Desk traders", value: "43" },
                { label: "Avg monthly", value: `${avgReturn}%` },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-4">
                  <div className="text-xl md:text-2xl font-bold gradient-text tabular-nums">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <div className="w-full min-w-0">
            <PremiumHeroVisual
              activeInvestors={activeInvestors}
              earningNow={earningNow}
              withdrawals24h={withdrawals24h}
              slotsRemaining={slotsRemaining}
              slotsFilled={slotsFilled}
              slotsTotal={slotsTotal}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRUST_POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <Icon style={{ width: 17, height: 17 }} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed mt-1">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 md:py-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.045),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="Hedge fund system" title="Not a signal group. Not a basic bot. A capital operating system." desc="Qorix is structured like an allocation platform: strategy desk, risk layer, investor reporting, and controlled capacity all working together." />

          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-4 items-stretch">
            <FadeIn>
              <div className="glass-card-glow rounded-3xl p-6 md:p-8 h-full relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -left-12 bottom-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-primary font-semibold">Investor mandate</div>
                      <h3 className="text-2xl font-bold mt-2">Capital preservation first. Returns second.</h3>
                    </div>
                    <Star style={{ width: 24, height: 24 }} className="text-amber-400" />
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: "Allocation style", value: "Multi-strategy USDT desk" },
                      { label: "Core priority", value: "Drawdown-controlled growth" },
                      { label: "Investor visibility", value: "Live reporting dashboard" },
                      { label: "Capacity policy", value: "Limited onboarding rounds" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-2xl bg-white/[0.045] border border-white/[0.08] p-4">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm font-semibold text-white text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 style={{ width: 18, height: 18 }} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-emerald-100/80 leading-relaxed">
                        Built to attract serious investors who care about process, transparency, and controlled exposure instead of unrealistic profit promises.
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 premium-mini-terminal rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Capital route</div>
                      <div className="text-[10px] text-emerald-400">Live simulation</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {["Treasury", "Risk Layer", "Trading Desk"].map((label, index) => (
                        <div key={label} className="relative rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center">
                          <div className="mx-auto mb-2 w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            {[DollarSign, Shield, Activity].map((Icon, i) => i === index ? <Icon key={label} style={{ width: 15, height: 15 }} className="text-blue-300" /> : null)}
                          </div>
                          <div className="text-[11px] font-semibold">{label}</div>
                          {index < 2 && <div className="hidden sm:block absolute top-1/2 -right-4 h-px w-5 bg-gradient-to-r from-blue-400 to-transparent" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            <div className="grid sm:grid-cols-2 gap-4">
              {INVESTOR_SYSTEM.map(({ icon: Icon, title, desc }, i) => (
                <FadeIn key={title} delay={i * 0.08}>
                  <div className="premium-lift-card glass-card rounded-3xl p-6 h-full">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
                      <Icon style={{ width: 19, height: 19 }} className="text-blue-400" />
                    </div>
                    <h3 className="font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="performance" ref={perfRef as any} className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="Performance desk" title="Institutional-style performance without hiding the risk." desc="Investors see the return profile and the drawdown profile together, because a serious capital product must sell control as much as upside." />

          <FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Avg Monthly Return", value: `${avgReturn}%`, icon: TrendingUp, color: "text-emerald-400" },
                { label: "Best Month", value: `${bestMonth}%`, icon: Zap, color: "text-amber-400" },
                { label: "Avg Drawdown", value: `${avgDrawdown}%`, icon: Shield, color: "text-blue-400" },
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
            <FadeIn delay={0.05}>
              <div className="glass-card rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-semibold">Cumulative Equity Growth</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Starting from 100 USDT</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">{CUMULATIVE[CUMULATIVE.length - 1]?.equity?.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground">equity index</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={230}>
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

            <FadeIn delay={0.1}>
              <div className="glass-card rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-semibold">Returns vs Drawdown</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Return bars with drawdown line overlay</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={MONTHLY_RETURNS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} />
                    <Bar dataKey="return" fill="#22c55e" fillOpacity={0.72} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="drawdown" fill="#ef4444" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <FadeIn>
            <div className="glass-card-glow rounded-3xl p-6 md:p-8 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Limited access</div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Reserve one of {slotsRemaining} private allocation seats.</h2>
                <p className="text-muted-foreground max-w-2xl">Qorix limits new capital by desk capacity, strategy liquidity, and risk mandate so investor growth does not dilute execution quality.</p>
              </div>
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-8 py-3.5 gap-2 w-full sm:w-auto">
                Apply for Allocation <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="trading-desk" className="py-20 md:py-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.04),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="Trading desk" title="43 traders. 3 mandates. One controlled portfolio." desc="Capital is distributed by strategy type, trader experience, risk limits, and active desk conditions instead of a one-size-fits-all return promise." />

          <FadeIn>
            <div className="glass-card rounded-2xl p-6 md:p-8 mb-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { icon: Users, label: "Total Traders", value: "43", color: "text-blue-400" },
                { icon: Award, label: "Avg Experience", value: "7.4 yrs", color: "text-amber-400" },
                { icon: Target, label: "Avg Win Rate", value: `${Math.round((71 + 65 + 68) / 3)}%`, color: "text-emerald-400" },
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STRATEGIES.map((s, i) => (
              <FadeIn key={s.id} delay={i * 0.1}>
                <div className={`glass-card rounded-2xl p-5 border ${s.bg} h-full`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider ${s.color}`}>{s.label}</span>
                    <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-1 rounded-full">{s.traders} traders</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-5">{s.desc}</p>
                  <div className="space-y-3">
                    {[
                      { label: "Win Rate", value: `${s.winRate}%` },
                      { label: "Avg Experience", value: s.experience },
                      { label: "Capital Allocation", value: s.allocation },
                      { label: "Avg Hold Time", value: s.avgHold },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className={`font-semibold ${s.color}`}>{r.value}</span>
                      </div>
                    ))}
                    <div className="h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: s.id === "scalping" ? "#3b82f6" : s.id === "swing" ? "#6366f1" : "#22c55e" }} initial={{ width: 0 }} whileInView={{ width: `${s.winRate}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} />
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="Investor confidence" title="Show movement. Show payouts. Show momentum." desc="Serious investors need proof that capital is active, payout requests are moving, and the platform has real participation." />

          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
            <FadeIn>
              <div className="glass-card rounded-3xl p-6 h-full">
                <div className="text-sm font-semibold mb-5">Active user snapshot</div>
                <div className="space-y-4">
                  {[
                    { label: "Active investors", value: activeInvestors.toLocaleString(), icon: Users, color: "text-blue-400" },
                    { label: "Currently earning", value: earningNow.toLocaleString(), icon: UserCheck, color: "text-emerald-400" },
                    { label: "Withdrawals processed today", value: withdrawals24h.toString(), icon: Banknote, color: "text-amber-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
                      <div className="flex items-center gap-3">
                        <Icon style={{ width: 18, height: 18 }} className={color} />
                        <span className="text-sm text-muted-foreground">{label}</span>
                      </div>
                      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="glass-card rounded-3xl p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-sm font-semibold">Recent withdrawal proof</div>
                  <div className="text-xs text-emerald-400 font-semibold flex items-center gap-2"><div className="live-dot" /> Live queue</div>
                </div>
                <div className="space-y-3">
                  {WITHDRAWALS.map((item) => (
                    <div key={`${item.user}-${item.time}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
                      <div>
                        <div className="text-sm font-semibold">{item.user}</div>
                        <div className="text-[11px] text-muted-foreground">{item.time}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-400">{item.amount}</div>
                        <div className="text-[11px] text-muted-foreground">{item.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section id="risk" className="py-20 md:py-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.035),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="Risk system" title="The product sells controlled exposure, not blind upside." desc="Qorix does not just display risk after the fact. It uses risk bands, balance separation, and auto-pause logic to manage exposure before losses compound." />

          <div className="grid lg:grid-cols-[1fr_0.9fr] gap-4 items-stretch">
            <FadeIn>
              <div className="glass-card rounded-3xl p-6 md:p-8 h-full">
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: "Low risk", limit: "3%", desc: "Conservative cap" },
                    { label: "Medium risk", limit: "5%", desc: "Balanced cap" },
                    { label: "High risk", limit: "10%", desc: "Growth cap" },
                  ].map((r) => (
                    <div key={r.label} className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 text-center">
                      <div className="text-xs text-muted-foreground">{r.label}</div>
                      <div className="text-3xl font-bold text-blue-400 my-2">{r.limit}</div>
                      <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={MONTHLY_RETURNS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} />
                    <Line type="monotone" dataKey="drawdown" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: "#60a5fa" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="glass-card rounded-3xl p-6 md:p-8 h-full">
                <div className="text-sm font-semibold mb-5">Protection flow</div>
                <div className="space-y-4">
                  {[
                    { icon: Target, title: "Choose risk before investing", desc: "Each investment starts with a defined drawdown rule." },
                    { icon: Activity, title: "Monitor equity continuously", desc: "The system tracks active trading balance and realized P&L." },
                    { icon: Shield, title: "Auto-pause on breach", desc: "If the threshold is hit, exposure is paused and capital is protected." },
                    { icon: Banknote, title: "Profits stay separated", desc: "Profit balances can be transferred or withdrawn on your terms." },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Icon style={{ width: 18, height: 18 }} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed mt-1">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader eyebrow="How it works" title="From investor access to live allocation in three steps" desc="The journey feels premium but stays simple: open access, choose your risk mandate, then monitor the capital operating system." />
          <div className="grid md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.08}>
                <div className="glass-card rounded-3xl p-6 h-full relative overflow-hidden">
                  <div className="absolute -right-4 -top-6 text-7xl font-bold text-white/[0.03]">{item.step}</div>
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold mb-5">{item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

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

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Ready to request private investor access?</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-xl mx-auto">
                Join this onboarding round before capacity closes. Reserve a slot, select your risk band, and track every USDT from your dashboard.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-8 py-3.5 gap-2">
                  Apply for Access <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
                <button onClick={scrollToPerf} className="btn btn-ghost text-base px-8 py-3.5 gap-2">
                  <BarChart2 style={{ width: 16, height: 16 }} /> View Performance
                </button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
                {[
                  { icon: Shield, text: "Drawdown Protection" },
                  { icon: Lock, text: "Segmented Balances" },
                  { icon: CheckCircle2, text: `${slotsRemaining} Slots Left` },
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
