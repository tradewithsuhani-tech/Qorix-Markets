import { useRef, useEffect, useState } from "react";
import { EconomicNewsLandingWidget } from "@/components/economic-news-widget";
import { useLocation } from "wouter";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Lock,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
  Eye,
  Globe,
  Target,
  Clock,
  Banknote,
  UserCheck,
  Award,
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
    desc: "High-frequency USDT entries capturing small market inefficiencies with strict stop rules.",
    traders: 18,
    winRate: 71,
    avgHold: "< 5 min",
    experience: "6.4 yrs",
    allocation: "34%",
    color: "text-sky-400",
    accent: "#38bdf8",
    bg: "from-sky-500/10 to-sky-600/5 border-sky-500/20",
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
    color: "text-violet-400",
    accent: "#a78bfa",
    bg: "from-violet-500/10 to-violet-600/5 border-violet-500/20",
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
    accent: "#34d399",
    bg: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
  },
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
  { icon: Clock, title: "24/7 execution cycle", desc: "The desk remains active across market sessions while investors monitor performance without manual trading." },
];

const TRUST_POINTS = [
  { icon: Shield, title: "Risk-first mandate", desc: "Every allocation starts with a defined drawdown ceiling before capital is exposed.", color: "sky" },
  { icon: Lock, title: "Segregated wallet logic", desc: "Main, trading, and profit balances make capital movement clear and auditable.", color: "violet" },
  { icon: Eye, title: "Investor-grade reporting", desc: "Live P&L, allocation, trade activity, and withdrawal status stay visible.", color: "emerald" },
  { icon: Globe, title: "USDT treasury base", desc: "Capital, returns, and payouts are tracked in stablecoin-denominated balances.", color: "amber" },
];

const WITHDRAWALS = [
  { user: "A. Mensah", amount: "$2,480", time: "8 min ago" },
  { user: "N. Patel", amount: "$940", time: "21 min ago" },
  { user: "K. Alvarez", amount: "$5,120", time: "46 min ago" },
  { user: "D. Wright", amount: "$1,760", time: "1 hr ago" },
];

const TICKER_ITEMS = [
  "USDT/USD +0.02%", "BTC/USDT 94,212", "ETH/USDT 3,481", "Active desks: 3", "Payout queue: live",
  "USDT/USD +0.02%", "BTC/USDT 94,212", "ETH/USDT 3,481", "Active desks: 3", "Payout queue: live",
];

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }} className={className}>
      {children}
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label, suffix = "%" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs border border-white/10 shadow-2xl" style={{ background: "rgba(5,8,22,0.95)", backdropFilter: "blur(20px)" }}>
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-mono font-semibold" style={{ color: p.color }}>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <FadeIn className="text-center max-w-2xl mx-auto mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-5">{eyebrow}</div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 leading-tight text-white">{title}</h2>
      <p className="text-slate-400 text-lg leading-relaxed">{desc}</p>
    </FadeIn>
  );
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = value / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(id); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, value, duration]);
  return <span ref={ref}>{display.toLocaleString()}</span>;
}

function LiveDashboard({ earningNow, withdrawals24h, activeInvestors, slotsRemaining, slotsFilled, slotsTotal }: {
  earningNow: number; withdrawals24h: number; activeInvestors: number; slotsRemaining: number; slotsFilled: number; slotsTotal: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
      style={{ perspective: "1000px" }}
    >
      <div className="relative rounded-[1.75rem] overflow-hidden border border-white/10" style={{
        background: "linear-gradient(135deg, rgba(14,20,40,0.98) 0%, rgba(8,12,28,0.98) 100%)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
        }} />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)", filter: "blur(20px)" }} />

        <div className="relative p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Qorix Capital OS</div>
              <div className="text-xs text-slate-500 mt-0.5">Allocation · Risk · Reporting</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Desk live
            </div>
          </div>

          <div className="relative h-52 mb-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "600px" }}>
              <div className="relative w-40 h-40 flex-shrink-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border"
                    style={{
                      borderColor: ["rgba(59,130,246,0.25)", "rgba(139,92,246,0.2)", "rgba(34,197,94,0.18)"][i],
                      transform: `rotateX(${64 + i * 8}deg) rotateY(${i * 25}deg)`,
                    }}
                    animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                    transition={{ duration: [14, 18, 22][i], repeat: Infinity, ease: "linear" }}
                  />
                ))}
                <div className="absolute inset-3 rounded-full flex flex-col items-center justify-center text-center" style={{
                  background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.12) 0%, rgba(5,8,22,0.95) 65%)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 0 60px rgba(59,130,246,0.2), inset 0 0 40px rgba(59,130,246,0.05)",
                }}>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-blue-300/70 mb-1">AUM Engine</div>
                  <div className="text-2xl font-black text-white leading-none">$4.2M</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-semibold">capital active</div>
                </div>
              </div>
            </div>

            {[
              { label: "Returns", icon: BarChart2, color: "#86efac", pos: "left-0 top-[38%]" },
              { label: "Risk", icon: Shield, color: "#93c5fd", pos: "right-0 top-[24%]" },
              { label: "Desk", icon: Users, color: "#c4b5fd", pos: "left-[36%] bottom-0" },
            ].map(({ label, icon: Icon, color, pos }) => (
              <motion.div
                key={label}
                className={`absolute ${pos} flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold`}
                style={{ background: "rgba(10,14,32,0.85)", border: "1px solid rgba(255,255,255,0.1)", color, backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
              >
                <Icon size={12} />
                {label}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Earning now", value: earningNow, suffix: "", color: "#34d399" },
              { label: "Payout queue", value: withdrawals24h, suffix: "", color: "#fbbf24" },
              { label: "Onboarded", value: activeInvestors, suffix: "", color: "#818cf8" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xl font-black" style={{ color }}><AnimatedNumber value={value} /></div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Private allocation capacity</span>
              <span className="text-lg font-black text-amber-400">{slotsRemaining} <span className="text-[10px] text-slate-500 font-normal">seats</span></span>
            </div>
            <div className="text-[10px] text-slate-500 mb-3">New deposits are capped to protect execution quality.</div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #f59e0b, #3b82f6, #22c55e)", backgroundSize: "200% 100%" }} initial={{ width: 0 }} animate={{ width: `${slotsFilled}%` }} transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
              <span>{slotsFilled}% allocated</span>
              <span>{slotsTotal} total</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Ticker() {
  return (
    <div className="overflow-hidden py-3 border-y" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.018)" }}>
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const perfRef = useRef<HTMLElement>(null);

  const { data: indicators } = useGetMarketIndicators({ query: { refetchInterval: 30_000 } });

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
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#050814", color: "#e2e8f0" }}>

      <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(5,8,20,0.88)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              <TrendingUp size={14} className="text-white" />
            </div>
            <span className="font-black tracking-tight text-[15px] text-white">Qorix<span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Markets</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            {[["Performance", "performance"], ["Trading Desk", "trading-desk"], ["Risk", "risk"], ["How it works", "how-it-works"]].map(([label, id]) => (
              <button key={id} className="hover:text-white transition-colors font-medium" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}>{label}</button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/login")} className="btn btn-ghost text-sm px-4 py-2">Sign In</button>
            <button onClick={() => setLocation("/login")} className="btn btn-primary text-sm px-4 py-2">Reserve Slot</button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[800px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.09) 0%, transparent 65%)", filter: "blur(40px)" }} />
          <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 65%)", filter: "blur(40px)" }} />
          <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 65%)", filter: "blur(60px)" }} />
          <div className="absolute inset-0" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 80%)",
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 grid xl:grid-cols-2 gap-12 xl:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-center xl:text-left">

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8"
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.1))",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                boxShadow: "0 0 24px rgba(99,102,241,0.12)",
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Private allocation window open · {slotsRemaining} seats left
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-5xl sm:text-6xl xl:text-[4.25rem] font-black tracking-[-0.03em] leading-[1.0] mb-6 text-white"
            >
              A hedge-fund<br />style USDT<br />trading system{" "}
              <span style={{ background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #e879f9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                built for you.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto xl:mx-0 leading-relaxed mb-10"
            >
              Qorix combines professional traders, automated execution, capital allocation logic, and drawdown protection into one investor operating system.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="flex flex-col sm:flex-row justify-center xl:justify-start gap-3 mb-12"
            >
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-7 py-3.5 gap-2">
                Apply for Access <ArrowRight size={16} />
              </button>
              <button onClick={() => perfRef.current?.scrollIntoView({ behavior: "smooth" })} className="btn btn-ghost text-base px-7 py-3.5 gap-2">
                Review Track Record <ChevronDown size={16} />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="grid grid-cols-3 gap-3 max-w-xl mx-auto xl:mx-0"
            >
              {[
                { label: "Managed AUM", value: "$4.2M+", color: "#38bdf8" },
                { label: "Desk traders", value: "43", color: "#a78bfa" },
                { label: "Avg monthly", value: `${avgReturn}%`, color: "#34d399" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
                  <div className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <div className="w-full min-w-0">
            <LiveDashboard
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

      <Ticker />

      <section className="py-6">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TRUST_POINTS.map(({ icon: Icon, title, desc, color }, i) => {
            const colors: Record<string, { icon: string; border: string; bg: string; glow: string }> = {
              sky: { icon: "#38bdf8", border: "rgba(56,189,248,0.18)", bg: "rgba(56,189,248,0.06)", glow: "rgba(56,189,248,0.08)" },
              violet: { icon: "#a78bfa", border: "rgba(167,139,250,0.18)", bg: "rgba(167,139,250,0.06)", glow: "rgba(167,139,250,0.08)" },
              emerald: { icon: "#34d399", border: "rgba(52,211,153,0.18)", bg: "rgba(52,211,153,0.06)", glow: "rgba(52,211,153,0.08)" },
              amber: { icon: "#fbbf24", border: "rgba(251,191,36,0.18)", bg: "rgba(251,191,36,0.06)", glow: "rgba(251,191,36,0.08)" },
            };
            const c = colors[color]!;
            return (
              <div key={title} className="rounded-2xl p-4 flex items-start gap-3" style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 4px 24px ${c.glow}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${c.border}` }}>
                  <Icon size={14} style={{ color: c.icon }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed mt-1">{desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-24 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top, rgba(79,70,229,0.04) 0%, transparent 65%)" }} />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Capital Operating System"
            title="Not a signal group. Not a basic bot. A capital OS."
            desc="Qorix is structured like an allocation platform: strategy desk, risk layer, investor reporting, and controlled capacity all working together."
          />

          <div className="grid lg:grid-cols-2 gap-4 items-stretch">
            <FadeIn>
              <div className="rounded-3xl p-6 md:p-8 h-full relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(99,102,241,0.06) 100%)", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 0 60px rgba(59,130,246,0.06)" }}>
                <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: "#818cf8" }}>Investor mandate</div>
                      <h3 className="text-2xl font-black text-white">Capital preservation first. Returns second.</h3>
                    </div>
                    <Star size={22} className="text-amber-400 shrink-0" />
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Allocation style", value: "Multi-strategy USDT desk" },
                      { label: "Core priority", value: "Drawdown-controlled growth" },
                      { label: "Investor visibility", value: "Live reporting dashboard" },
                      { label: "Capacity policy", value: "Limited onboarding rounds" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span className="text-sm text-slate-400">{row.label}</span>
                        <span className="text-sm font-bold text-white">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl p-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed" style={{ color: "rgba(167,243,208,0.85)" }}>Built to attract serious investors who care about process, transparency, and controlled exposure instead of unrealistic profit promises.</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            <div className="grid sm:grid-cols-2 gap-4">
              {INVESTOR_SYSTEM.map(({ icon: Icon, title, desc }, i) => (
                <FadeIn key={title} delay={i * 0.07}>
                  <div className="rounded-3xl p-6 h-full transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/30" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
                      <Icon size={19} className="text-blue-400" />
                    </div>
                    <h3 className="font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="performance" ref={perfRef as any} className="py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Performance Desk"
            title="Institutional-style performance without hiding the risk."
            desc="Investors see the return profile and the drawdown profile together, because a serious capital product must sell control as much as upside."
          />

          <FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Avg Monthly Return", value: `${avgReturn}%`, color: "#34d399", glow: "rgba(52,211,153,0.3)", icon: TrendingUp },
                { label: "Best Month", value: `${bestMonth}%`, color: "#fbbf24", glow: "rgba(251,191,36,0.3)", icon: Zap },
                { label: "Avg Drawdown", value: `${avgDrawdown}%`, color: "#38bdf8", glow: "rgba(56,189,248,0.3)", icon: Shield },
                { label: "Positive Months", value: `${winRate}%`, color: "#a78bfa", glow: "rgba(167,139,250,0.3)", icon: BarChart2 },
              ].map(({ label, value, color, glow, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-5 text-center relative overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                  <Icon size={16} className="mx-auto mb-3" style={{ color }} />
                  <div className="text-3xl font-black mb-1" style={{ color, filter: `drop-shadow(0 0 14px ${glow})` }}>{value}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-4">
            <FadeIn delay={0.05}>
              <div className="rounded-2xl p-5 md:p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-sm font-bold text-white">Cumulative Equity Growth</div>
                    <div className="text-xs text-slate-500 mt-0.5">Starting from 100 USDT</div>
                  </div>
                  <div className="text-lg font-black text-emerald-400">{CUMULATIVE[CUMULATIVE.length - 1]?.equity?.toFixed(1)}</div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={CUMULATIVE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix=" USDT" />} />
                    <Area type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2.5} fill="url(#equityGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="rounded-2xl p-5 md:p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-sm font-bold text-white mb-1">Returns vs Drawdown</div>
                <div className="text-xs text-slate-500 mb-5">Return bars with drawdown line overlay</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={MONTHLY_RETURNS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} />
                    <Bar dataKey="return" fill="#22c55e" fillOpacity={0.75} radius={[4, 4, 0, 0]} />
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
            <div className="rounded-3xl p-6 md:p-10 grid lg:grid-cols-[1fr_auto] gap-6 items-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.08) 100%)", border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 0 80px rgba(59,130,246,0.08)" }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 80% 80% at 0% 50%, black 0%, transparent 70%)" }} />
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "#818cf8" }}>Limited access</div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2 text-white">Reserve one of {slotsRemaining} private allocation seats.</h2>
                <p className="text-slate-400 max-w-2xl">Qorix limits new capital by desk capacity, strategy liquidity, and risk mandate so investor growth does not dilute execution quality.</p>
              </div>
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-8 py-3.5 gap-2 w-full lg:w-auto relative z-10">
                Apply for Allocation <ArrowRight size={16} />
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="trading-desk" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Trading Desk"
            title="43 traders. 3 mandates. One controlled portfolio."
            desc="Capital is distributed by strategy type, trader experience, risk limits, and active desk conditions instead of a one-size-fits-all return promise."
          />

          <FadeIn>
            <div className="rounded-2xl p-6 md:p-8 mb-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { icon: Users, label: "Total Traders", value: "43", color: "#38bdf8" },
                { icon: Award, label: "Avg Experience", value: "7.4 yrs", color: "#fbbf24" },
                { icon: Target, label: "Avg Win Rate", value: `${Math.round((71 + 65 + 68) / 3)}%`, color: "#34d399" },
                { icon: Activity, label: "Trades / Day", value: "200+", color: "#a78bfa" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label}>
                  <Icon size={20} className="mx-auto mb-2" style={{ color, opacity: 0.8 }} />
                  <div className="text-2xl font-black text-white">{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-4">
            {STRATEGIES.map((s, i) => (
              <FadeIn key={s.id} delay={i * 0.1}>
                <div className={`rounded-2xl p-5 h-full bg-gradient-to-br border ${s.bg} transition-all duration-300 hover:-translate-y-1.5`} style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.2)` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-black uppercase tracking-wider ${s.color}`}>{s.label}</span>
                    <span className="text-[11px] text-slate-500 px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>{s.traders} traders</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-5">{s.desc}</p>
                  <div className="space-y-3">
                    {[
                      { label: "Win Rate", value: `${s.winRate}%` },
                      { label: "Avg Experience", value: s.experience },
                      { label: "Capital Allocation", value: s.allocation },
                      { label: "Avg Hold Time", value: s.avgHold },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{r.label}</span>
                        <span className={`font-black ${s.color}`}>{r.value}</span>
                      </div>
                    ))}
                    <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: s.accent }} initial={{ width: 0 }} whileInView={{ width: `${s.winRate}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }} />
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Investor Confidence"
            title="Show movement. Show payouts. Show momentum."
            desc="Serious investors need proof that capital is active, payout requests are moving, and the platform has real participation."
          />

          <div className="grid lg:grid-cols-2 gap-4">
            <FadeIn>
              <div className="rounded-3xl p-6 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-sm font-bold text-white mb-5">Active user snapshot</div>
                <div className="space-y-4">
                  {[
                    { label: "Active investors", value: activeInvestors.toLocaleString(), icon: Users, color: "#38bdf8" },
                    { label: "Currently earning", value: earningNow.toLocaleString(), icon: UserCheck, color: "#34d399" },
                    { label: "Withdrawals today", value: withdrawals24h.toString(), icon: Banknote, color: "#fbbf24" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} style={{ color }} />
                        <span className="text-sm text-slate-400">{label}</span>
                      </div>
                      <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="rounded-3xl p-6 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div className="text-sm font-bold text-white">Recent withdrawal proof</div>
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" /></span>
                    Live queue
                  </div>
                </div>
                <div className="space-y-3">
                  {WITHDRAWALS.map((item) => (
                    <div key={`${item.user}-${item.time}`} className="flex items-center justify-between rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div className="text-sm font-bold text-white">{item.user}</div>
                        <div className="text-[11px] text-slate-500">{item.time}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-400">{item.amount}</div>
                        <div className="text-[11px] text-emerald-600">Paid</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section id="risk" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Risk System"
            title="The product sells controlled exposure, not blind upside."
            desc="Qorix uses risk bands, balance separation, and auto-pause logic to manage exposure before losses compound."
          />

          <div className="grid lg:grid-cols-2 gap-4 items-stretch">
            <FadeIn>
              <div className="rounded-3xl p-6 md:p-8 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: "Low risk", limit: "3%", desc: "Conservative cap", color: "#34d399" },
                    { label: "Medium risk", limit: "5%", desc: "Balanced cap", color: "#fbbf24" },
                    { label: "High risk", limit: "10%", desc: "Growth cap", color: "#f87171" },
                  ].map((r) => (
                    <div key={r.label} className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="text-xs text-slate-500">{r.label}</div>
                      <div className="text-3xl font-black my-2" style={{ color: r.color }}>{r.limit}</div>
                      <div className="text-[11px] text-slate-500">{r.desc}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={MONTHLY_RETURNS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} />
                    <Line type="monotone" dataKey="drawdown" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: "#38bdf8" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="rounded-3xl p-6 md:p-8 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-sm font-bold text-white mb-6">Protection flow</div>
                <div className="space-y-5">
                  {[
                    { icon: Target, title: "Choose risk before investing", desc: "Each investment starts with a defined drawdown rule.", color: "#38bdf8" },
                    { icon: Activity, title: "Monitor equity continuously", desc: "The system tracks active trading balance and realized P&L.", color: "#a78bfa" },
                    { icon: Shield, title: "Auto-pause on breach", desc: "If the threshold is hit, exposure is paused and capital is protected.", color: "#34d399" },
                    { icon: Banknote, title: "Profits stay separated", desc: "Profit balances can be transferred or withdrawn on your terms.", color: "#fbbf24" },
                  ].map(({ icon: Icon, title, desc, color }, i) => (
                    <div key={title} className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{title}</div>
                        <div className="text-xs text-slate-400 leading-relaxed mt-1">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="How It Works"
            title="From investor access to live allocation in three steps"
            desc="The journey feels premium but stays simple: open access, choose your risk mandate, then monitor the capital operating system."
          />
          <div className="grid md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.1}>
                <div className="rounded-3xl p-6 h-full relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="absolute -right-4 -top-6 text-8xl font-black" style={{ color: "rgba(255,255,255,0.025)" }}>{item.step}</div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black text-white mb-5" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 8px 24px rgba(99,102,241,0.3)" }}>{item.step}</div>
                  <h3 className="text-lg font-black text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="market-insights" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Market Insights"
            title="Today's high-impact economic events"
            desc="Monitor the events that move markets. High-impact releases create volatility windows that our trading desks actively position around."
          />
          <FadeIn><EconomicNewsLandingWidget /></FadeIn>
        </div>
      </section>

      <footer className="border-t py-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
              <TrendingUp size={9} className="text-white" />
            </div>
            <span className="font-bold text-slate-400">QorixMarkets</span>
            <span>· USDT Capital Desk · All rights reserved</span>
          </div>
          <div>Past performance does not guarantee future results. Capital is at risk.</div>
        </div>
      </footer>
    </div>
  );
}
