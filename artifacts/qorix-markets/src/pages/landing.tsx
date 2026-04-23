import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle2,
  XCircle,
  Lock,
  Activity,
  Eye,
  BarChart3,
  Sparkles,
  Clock,
  Target,
  PlayCircle,
  ChevronRight,
} from "lucide-react";
import { useGetMarketIndicators } from "@workspace/api-client-react";
import { QorixLogo } from "@/components/qorix-logo";
import { QorixAssistant } from "@/components/qorix-assistant";

/* ───────────────────────── Helpers ───────────────────────── */

function FadeIn({
  children,
  className = "",
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1600,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ───────────────────────── Static content ───────────────────────── */

const HOW_STEPS = [
  {
    n: "01",
    icon: Wallet,
    title: "Deposit USDT (TRC20)",
    desc: "Fund your account from $10. Instant crediting once the network confirms.",
    color: "from-blue-500/20 to-blue-600/5",
    accent: "text-blue-400",
    border: "border-blue-500/30",
  },
  {
    n: "02",
    icon: Target,
    title: "Pick a risk profile",
    desc: "Choose Conservative, Balanced, or Growth. Drawdown limits are hard-enforced.",
    color: "from-violet-500/20 to-violet-600/5",
    accent: "text-violet-400",
    border: "border-violet-500/30",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "Earn while you sleep",
    desc: "Our 24/7 trading desk runs the strategies. You watch profits land in your wallet.",
    color: "from-emerald-500/20 to-emerald-600/5",
    accent: "text-emerald-400",
    border: "border-emerald-500/30",
  },
];

const PROBLEM_VS = [
  {
    label: "Time spent",
    manual: "8+ hrs daily glued to charts",
    auto: "Zero — runs 24/7 in the background",
  },
  {
    label: "Emotional control",
    manual: "Fear & greed wreck your edge",
    auto: "Rule-based execution, no emotions",
  },
  {
    label: "Risk management",
    manual: "Manual stops you forget to set",
    auto: "Hard drawdown ceiling enforced by system",
  },
  {
    label: "Market coverage",
    manual: "You sleep — you miss moves",
    auto: "3 desks across global sessions",
  },
  {
    label: "Skill required",
    manual: "Years of trading experience",
    auto: "None — start with $10 in 2 minutes",
  },
];

const SAFETY_PILLARS = [
  {
    icon: ShieldCheck,
    title: "Drawdown-protected capital",
    desc: "Your max loss ceiling is locked before any trade — system-enforced, not trust-based.",
  },
  {
    icon: Lock,
    title: "3-tier wallet architecture",
    desc: "Main, trading, and profit balances kept separate. Withdraw any time, no lock-in.",
  },
  {
    icon: Eye,
    title: "Real-time transparency",
    desc: "Every trade, allocation, and payout logged in your dashboard. Nothing hidden.",
  },
  {
    icon: BarChart3,
    title: "USD-native settlement",
    desc: "All returns in USD. No volatile conversion games — what you see is what you keep.",
  },
];

const FAKE_NAMES = [
  "Rakesh S.", "Priya M.", "Amit K.", "Sunita P.", "Vijay M.",
  "Anjali G.", "Rahul V.", "Neha J.", "Suresh Y.", "Pooja M.",
  "Arjun N.", "Deepa R.", "Kiran R.", "Meena I.", "Rohan K.",
  "Aisha K.", "Dev M.", "Ritu S.", "Manish T.", "Kavita P.",
];

function generateLiveFeed(seedTime: number) {
  const rng = (i: number) => {
    const x = Math.sin(seedTime / 60000 + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return Array.from({ length: 6 }).map((_, i) => {
    const isWithdraw = rng(i) > 0.55;
    const amt = Math.floor(50 + rng(i + 100) * 4500);
    const minsAgo = Math.floor(1 + rng(i + 200) * 58);
    return {
      id: `${seedTime}-${i}`,
      name: FAKE_NAMES[Math.floor(rng(i + 300) * FAKE_NAMES.length)],
      action: isWithdraw ? "withdrew" : "deposited",
      amount: amt,
      time: `${minsAgo}m ago`,
      isWithdraw,
    };
  });
}

/* ───────────────────────── Sub-components ───────────────────────── */

function StickyNav({ navigate }: { navigate: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl border-b border-white/[0.06] bg-[#05070f]/80"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <QorixLogo size={28} />
          <span className="font-bold text-lg tracking-tight">Qorix Markets</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/login")}
            className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 shadow-lg shadow-blue-500/25 transition-all"
          >
            Start with $10
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroDashboardMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full"
    >
      {/* Glow */}
      <div className="absolute -inset-8 -z-10 rounded-[3rem] opacity-60 blur-3xl pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.35) 0%, rgba(139,92,246,0.18) 40%, transparent 70%)",
      }} />

      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0a1024] via-[#070b1c] to-[#05070f] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="ml-3 text-[11px] text-slate-500 font-mono">qorix.markets / dashboard</div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            LIVE
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Balance */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Total Balance</div>
              <div className="text-3xl sm:text-4xl font-black text-white">
                $<CountUp value={12847.32} decimals={2} />
              </div>
              <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp size={12} /> +$102.78 today (+0.8%)
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Today</div>
              <div className="text-lg font-bold text-emerald-400">+0.8%</div>
            </div>
          </div>

          {/* Mini chart */}
          <div className="h-24 relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.04] p-2">
            <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="heroChart" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,60 L25,50 L50,55 L75,42 L100,38 L125,30 L150,35 L175,25 L200,20 L225,15 L250,18 L275,10 L300,8 L300,80 L0,80 Z"
                fill="url(#heroChart)"
              />
              <path
                d="M0,60 L25,50 L50,55 L75,42 L100,38 L125,30 L150,35 L175,25 L200,20 L225,15 L250,18 L275,10 L300,8"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-slate-500">Equity curve · 30d</div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Active Trades", value: "7", color: "text-blue-400" },
              { label: "Win Rate", value: "73%", color: "text-emerald-400" },
              { label: "Risk", value: "Low", color: "text-violet-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Live trade strip */}
          <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Activity size={13} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">BTC/USDT · LONG · Managed by Qorix system</div>
              <div className="text-[10px] text-slate-400">Entry $94,212 · running</div>
            </div>
            <div className="text-emerald-400 text-sm font-bold shrink-0">+$8.42</div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-4 -top-4 hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 shadow-2xl"
      >
        <ShieldCheck size={14} className="text-blue-400" />
        <div className="text-xs">
          <div className="font-semibold text-white">Drawdown</div>
          <div className="text-[10px] text-slate-400">2.4% of 5% limit</div>
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -right-4 -bottom-4 hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 shadow-2xl"
      >
        <Sparkles size={14} className="text-violet-400" />
        <div className="text-xs">
          <div className="font-semibold text-white">Auto-compound</div>
          <div className="text-[10px] text-slate-400">+0.8% / day avg</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LiveActivityFeed() {
  const [feed, setFeed] = useState(() => generateLiveFeed(Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      setFeed(generateLiveFeed(Date.now()));
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {feed.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
          >
            <div
              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                item.isWithdraw ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
              }`}
            >
              {item.isWithdraw ? <Wallet size={15} /> : <TrendingUp size={15} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">
                <span className="font-semibold">{item.name}</span>{" "}
                <span className="text-slate-400">{item.action}</span>
              </div>
              <div className="text-[11px] text-slate-500">{item.time}</div>
            </div>
            <div
              className={`text-sm font-bold tabular-nums shrink-0 ${
                item.isWithdraw ? "text-emerald-400" : "text-blue-400"
              }`}
            >
              ${item.amount.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Main page ───────────────────────── */

export default function Landing() {
  const [, navigate] = useLocation();
  const { data: indicators } = useGetMarketIndicators();

  const investors = indicators?.activeInvestors || 124;
  const aum = 500000 + investors * 1200;
  const monthlyReturn = indicators?.avgMonthlyReturn || 6.2;
  const withdrawals24h = indicators?.withdrawals24h || 12840;

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#05070f" }}>
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(139,92,246,0.12) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at top, black 0%, transparent 70%)",
          }}
        />
      </div>

      <StickyNav navigate={navigate} />

      {/* ════════════════ 1. HERO ════════════════ */}
      <section className="pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: text */}
          <div>
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] mb-6">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Live · Trusted by {investors.toLocaleString()}+ investors
                </span>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5">
                Automated Trading.{" "}
                <span
                  className="inline-block"
                  style={{
                    background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Real Results.
                </span>
                <br />
                Zero Manual Effort.
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-8 max-w-xl">
                Let our 24/7 trading desk grow your portfolio with hard risk limits, transparent execution, and monthly payouts. Start with just <span className="text-white font-semibold">$10</span> — no experience needed.
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <button
                  onClick={() => navigate("/register")}
                  className="group inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all"
                >
                  Start with $10
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
                >
                  <PlayCircle size={18} />
                  See how it works
                </button>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                {[
                  "No lock-in",
                  "Withdraw anytime",
                  "USDT (TRC20)",
                  "Drawdown protected",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    {t}
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* Right: dashboard mock */}
          <div className="lg:pl-4">
            <HeroDashboardMock />
          </div>
        </div>
      </section>

      {/* ════════════════ 2. TRUST METRICS ════════════════ */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 border-y border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-2">
              Real numbers · Updated live
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Trusted with real capital
            </h2>
          </FadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                icon: Wallet,
                label: "Assets under management",
                value: aum,
                prefix: "$",
                color: "text-blue-400",
                bg: "from-blue-500/10 to-transparent",
              },
              {
                icon: Users,
                label: "Active investors",
                value: investors,
                color: "text-violet-400",
                bg: "from-violet-500/10 to-transparent",
              },
              {
                icon: TrendingUp,
                label: "Avg monthly return",
                value: monthlyReturn,
                suffix: "%",
                decimals: 1,
                color: "text-emerald-400",
                bg: "from-emerald-500/10 to-transparent",
              },
              {
                icon: Activity,
                label: "Withdrawals (24h)",
                value: withdrawals24h,
                prefix: "$",
                color: "text-amber-400",
                bg: "from-amber-500/10 to-transparent",
              },
            ].map((m, i) => (
              <FadeIn key={m.label} delay={i * 0.05}>
                <div
                  className={`relative h-full rounded-2xl border border-white/[0.08] bg-gradient-to-br ${m.bg} p-4 sm:p-5 overflow-hidden`}
                >
                  <m.icon size={16} className={`${m.color} mb-3`} />
                  <div className={`text-2xl sm:text-3xl font-black ${m.color} mb-1`}>
                    <CountUp
                      value={m.value}
                      prefix={m.prefix ?? ""}
                      suffix={m.suffix ?? ""}
                      decimals={m.decimals ?? 0}
                    />
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 leading-tight">
                    {m.label}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ 3. HOW IT WORKS ════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-3">
              How it works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              From zero to earning in 3 steps
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              No charts to read. No strategies to learn. Just deposit and let the system work.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
            {/* Connector line for desktop */}
            <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {HOW_STEPS.map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div
                  className={`relative h-full rounded-2xl border ${step.border} bg-gradient-to-br ${step.color} p-6 sm:p-7 hover:border-white/25 transition-all`}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${step.accent}`}
                    >
                      <step.icon size={20} />
                    </div>
                    <div className={`text-3xl font-black ${step.accent} opacity-40`}>
                      {step.n}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-white">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3} className="text-center mt-12">
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 transition-all"
            >
              Open a free account
              <ChevronRight size={16} />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════ 4. DEMO DASHBOARD PREVIEW ════════════════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400 mb-3">
              Your command center
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Total transparency on every dollar
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              Live P&L, every trade logged, drawdown tracked in real time. Your dashboard never lies.
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="relative max-w-5xl mx-auto">
              {/* Glow */}
              <div className="absolute -inset-12 -z-10 rounded-[3rem] opacity-50 blur-3xl pointer-events-none" style={{
                background: "radial-gradient(ellipse at center, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)",
              }} />

              <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0a1024] via-[#070b1c] to-[#05070f] shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-black/30">
                  <span className="w-3 h-3 rounded-full bg-red-500/70" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <div className="ml-3 flex-1 max-w-md mx-auto px-3 py-1 rounded-md bg-white/[0.04] text-[11px] text-slate-500 font-mono text-center">
                    qorix.markets/dashboard
                  </div>
                </div>

                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Main: balance + chart */}
                  <div className="lg:col-span-2 space-y-5">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                      <div className="flex items-end justify-between mb-1">
                        <div className="text-xs uppercase tracking-wider text-slate-500">Portfolio Value</div>
                        <div className="text-xs text-emerald-400 font-bold">+18.4% this month</div>
                      </div>
                      <div className="text-3xl sm:text-4xl font-black mb-3">
                        $<CountUp value={28453.71} decimals={2} />
                      </div>
                      <div className="h-32 relative">
                        <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="dashChart" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
                              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M0,80 L40,72 L80,75 L120,60 L160,55 L200,45 L240,50 L280,35 L320,30 L360,20 L400,12 L400,100 L0,100 Z"
                            fill="url(#dashChart)"
                          />
                          <path
                            d="M0,80 L40,72 L80,75 L120,60 L160,55 L200,45 L240,50 L280,35 L320,30 L360,20 L400,12"
                            fill="none"
                            stroke="#a78bfa"
                            strokeWidth="2.5"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { l: "Today", v: "+$284", c: "text-emerald-400" },
                        { l: "This Week", v: "+$1,248", c: "text-emerald-400" },
                        { l: "This Month", v: "+$4,421", c: "text-emerald-400" },
                      ].map((s) => (
                        <div key={s.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                          <div className="text-[10px] uppercase text-slate-500 mb-1 tracking-wider">{s.l}</div>
                          <div className={`text-base font-bold ${s.c}`}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Side: trades + risk */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wider text-slate-500 px-1">Live Desk</div>
                    {[
                      { p: "BTC/USDT", side: "LONG", pnl: "+$84.20", c: "text-emerald-400" },
                      { p: "ETH/USDT", side: "LONG", pnl: "+$32.10", c: "text-emerald-400" },
                      { p: "SOL/USDT", side: "SHORT", pnl: "+$18.40", c: "text-emerald-400" },
                      { p: "BNB/USDT", side: "LONG", pnl: "-$6.20", c: "text-red-400" },
                    ].map((t) => (
                      <div key={t.p} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{t.p}</div>
                          <div className={`text-[10px] font-bold ${t.side === "LONG" ? "text-blue-400" : "text-orange-400"}`}>{t.side}</div>
                        </div>
                        <div className={`text-sm font-bold tabular-nums ${t.c}`}>{t.pnl}</div>
                      </div>
                    ))}
                    <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-blue-300">Risk · Drawdown</div>
                        <div className="text-xs font-bold text-blue-400">2.4% / 5%</div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400" style={{ width: "48%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════ 5. PROBLEM vs SOLUTION ════════════════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-white/[0.01] border-y border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400 mb-3">
              The honest comparison
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Manual trading vs Qorix
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              Why pros automate — and why you should too.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
            {/* Manual */}
            <FadeIn>
              <div className="h-full rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                    <XCircle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-red-300/70 font-bold">Old way</div>
                    <div className="text-lg font-bold">Manual trading</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {PROBLEM_VS.map((row) => (
                    <div key={row.label} className="flex items-start gap-3">
                      <XCircle size={14} className="text-red-400/70 shrink-0 mt-1" />
                      <div>
                        <div className="text-[11px] uppercase text-slate-500 tracking-wider">{row.label}</div>
                        <div className="text-sm text-slate-300">{row.manual}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Qorix */}
            <FadeIn delay={0.1}>
              <div className="relative h-full rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-6 sm:p-7 shadow-[0_0_60px_rgba(16,185,129,0.08)]">
                <div className="absolute -top-2 right-5 px-2.5 py-1 rounded-full bg-emerald-500 text-[10px] font-black uppercase tracking-wider text-white">
                  Recommended
                </div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-bold">New way</div>
                    <div className="text-lg font-bold">Qorix automated</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {PROBLEM_VS.map((row) => (
                    <div key={row.label} className="flex items-start gap-3">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-1" />
                      <div>
                        <div className="text-[11px] uppercase text-slate-500 tracking-wider">{row.label}</div>
                        <div className="text-sm text-white font-medium">{row.auto}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ════════════════ 6. LIVE ACTIVITY (FOMO) ════════════════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Happening right now
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Real investors. Real payouts. Live.
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-7">
              Withdrawals process in minutes, not days. Watch real money flow on the platform — every minute of every day.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="text-2xl font-black text-emerald-400">
                  <CountUp value={withdrawals24h} prefix="$" />
                </div>
                <div className="text-xs text-slate-400 mt-1">withdrawn in 24h</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="text-2xl font-black text-blue-400">
                  &lt;<CountUp value={5} suffix=" min" />
                </div>
                <div className="text-xs text-slate-400 mt-1">avg payout time</div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl opacity-40 blur-2xl pointer-events-none" style={{
                background: "radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, transparent 70%)",
              }} />
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold">Live Activity Feed</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    LIVE
                  </div>
                </div>
                <LiveActivityFeed />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════ 7. RISK & SAFETY ════════════════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-white/[0.01] border-y border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-3">
              Built for safety
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Your capital is protected by design
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              We use institutional-grade risk controls so a bad day stays a bad day — never a disaster.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-5xl mx-auto">
            {SAFETY_PILLARS.map((pillar, i) => (
              <FadeIn key={pillar.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all p-6 sm:p-7 flex gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/25 flex items-center justify-center">
                    <pillar.icon size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1.5 text-white">{pillar.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{pillar.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3} className="text-center mt-10">
            <p className="text-xs text-slate-500 max-w-2xl mx-auto">
              All trading involves risk. Returns are not guaranteed. Read our{" "}
              <Link href="/legal/risk-disclosure" className="text-blue-400 hover:underline">
                Risk Disclosure
              </Link>{" "}
              before depositing.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════ 8. FINAL CTA ════════════════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-12 lg:p-16 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.18) 50%, rgba(244,114,182,0.12) 100%)",
              }}
            >
              {/* Floating glow */}
              <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none" style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
                filter: "blur(40px)",
              }} />
              <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full pointer-events-none" style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)",
                filter: "blur(40px)",
              }} />

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
                  <Zap size={12} className="text-amber-300" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                    Limited investor seats — fill fast
                  </span>
                </div>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.05]">
                  Your money should work
                  <br />
                  <span style={{
                    background: "linear-gradient(135deg, #60a5fa 0%, #f472b6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    while you sleep.
                  </span>
                </h2>
                <p className="text-base sm:text-lg text-slate-300 mb-8 max-w-xl mx-auto">
                  Join {investors.toLocaleString()}+ investors already earning. Start with $10 — withdraw anytime.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  <button
                    onClick={() => navigate("/register")}
                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-white/10 hover:bg-white/15 border border-white/30 backdrop-blur-sm shadow-2xl transition-all"
                  >
                    Start with $10
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate("/register")}
                    className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold text-white border border-white/20 hover:bg-white/5 hover:border-white/30 transition-all"
                  >
                    Open a free account
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-300">
                  {[
                    { i: Clock, t: "Setup in 2 minutes" },
                    { i: ShieldCheck, t: "Bank-grade security" },
                    { i: Wallet, t: "USDT (TRC20) deposits" },
                  ].map((b) => (
                    <div key={b.t} className="flex items-center gap-1.5">
                      <b.i size={13} className="text-emerald-400" />
                      {b.t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="border-t border-white/[0.06] py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QorixLogo size={22} />
            <span className="font-bold text-sm">Qorix Markets</span>
            <span className="text-xs text-slate-500 ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            {[
              ["Terms", "/legal/terms"],
              ["Privacy", "/legal/privacy"],
              ["Risk Disclosure", "/legal/risk-disclosure"],
              ["AML / KYC", "/legal/aml-kyc"],
            ].map(([label, href]) => (
              <Link key={label} href={href as string} className="hover:text-white transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <QorixAssistant />
    </div>
  );
}
