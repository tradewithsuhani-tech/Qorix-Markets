import { useRef, useEffect, useState } from "react";
import { EconomicNewsLandingWidget } from "@/components/economic-news-widget";
import { QorixAssistant } from "@/components/qorix-assistant";
import { QorixLogo } from "@/components/qorix-logo";
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
    desc: "High-frequency USD positions capturing intraday price inefficiencies. Every entry has a defined stop — no exceptions, no discretion.",
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
    desc: "Multi-day trend positions built on technical analysis with defined risk bands, daily exposure reviews, and senior trader oversight on every open position.",
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
    desc: "Algorithm-assisted pattern recognition combined with cross-market spread capture. Designed to smooth the return distribution across volatile and flat market conditions.",
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
  { step: "01", title: "Register as an investor", desc: "Verify your identity and fund your account with the USD amount you want placed under professional management." },
  { step: "02", title: "Lock in your risk mandate", desc: "Choose conservative, balanced, or growth exposure. Your drawdown ceiling is enforced by the system — not willpower." },
  { step: "03", title: "Watch your capital work", desc: "Monitor real-time P&L, active desk positions, and profit accumulation from your personal investor dashboard." },
];

const INVESTOR_SYSTEM = [
  { icon: Target, title: "Smart capital routing", desc: "Your USD is distributed across desks based on real-time capacity, risk headroom, and live desk performance — automatically." },
  { icon: Shield, title: "Institutional risk oversight", desc: "Hard drawdown limits, real-time exposure tracking, and auto-pause rules prevent small losses from compounding into large ones." },
  { icon: BarChart2, title: "Decision-grade reporting", desc: "Every trade, allocation shift, and profit event is logged and surfaced in your personal investor dashboard — nothing is hidden." },
  { icon: Clock, title: "Round-the-clock execution", desc: "Three active trading desks operate across global market sessions — your capital never sits idle waiting for one market to open." },
];

const TRUST_POINTS = [
  { icon: Shield, title: "Drawdown-protected capital", desc: "Your risk ceiling is locked before a single dollar moves — enforced by the system, not by trader discretion.", color: "sky" },
  { icon: Lock, title: "3-tier wallet architecture", desc: "Main, trading, and profit balances give you complete, auditable visibility into exactly where your money sits at all times.", color: "violet" },
  { icon: Eye, title: "Real-time investor dashboard", desc: "Track live P&L, capital allocation, desk trades, and withdrawal status — available 24 hours a day, 7 days a week.", color: "emerald" },
  { icon: Globe, title: "USD-native settlement", desc: "All returns, payouts, and balances are denominated in USD — giving you a stable, predictable view of your earnings at all times.", color: "amber" },
];

const WITHDRAWALS = [
  { user: "A. Mensah", amount: "$2,480", time: "8 min ago" },
  { user: "N. Patel", amount: "$940", time: "21 min ago" },
  { user: "K. Alvarez", amount: "$5,120", time: "46 min ago" },
  { user: "D. Wright", amount: "$1,760", time: "1 hr ago" },
];

const TICKER_ITEMS = [
  "USD/EUR 1.0812", "BTC/USD 94,212", "ETH/USD 3,481", "Active desks: 3", "Payout queue: live", "Avg monthly return: 9.3%", "Capital protection: enabled", "AUM: $4.2M+", "Investor seats: limited",
  "USD/EUR 1.0812", "BTC/USD 94,212", "ETH/USD 3,481", "Active desks: 3", "Payout queue: live", "Avg monthly return: 9.3%", "Capital protection: enabled", "AUM: $4.2M+", "Investor seats: limited",
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

const NAMES = [
  "Rakesh Sharma", "Priya Singh", "Amit Kumar", "Sunita Patel", "Vijay Mehta",
  "Anjali Gupta", "Rahul Verma", "Neha Joshi", "Suresh Yadav", "Pooja Mishra",
  "Arjun Nair", "Deepa Reddy", "Kiran Rao", "Meena Iyer", "Rohan Kapoor",
  "Aisha Khan", "Dev Malhotra", "Ritu Saxena", "Manish Tiwari", "Kavita Pillai",
  "Sanjay Bhatia", "Nisha Choudhary", "Rajesh Pandey", "Divya Srivastava", "Vivek Aggarwal",
  "Shreya Banerjee", "Anil Desai", "Rekha Nair", "Tushar Shah", "Swati Agarwal",
];

const TX_TYPES = ["withdrawal", "deposit", "transfer"] as const;
type TxType = typeof TX_TYPES[number];

function maskName(full: string): string {
  const parts = full.split(" ");
  return parts.map((p) => {
    if (p.length <= 3) return p;
    const keep = Math.max(1, Math.ceil(p.length / 3));
    const stars = Math.max(1, p.length - keep * 2);
    return p.slice(0, keep) + "*".repeat(stars) + p.slice(-keep);
  }).join(" ");
}

function maskId(id: string): string {
  return id.slice(0, 4) + "*".repeat(5) + id.slice(-2);
}

const TRC20_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function genTRC20Address(): string {
  let addr = "T";
  for (let i = 0; i < 33; i++) addr += TRC20_CHARS[Math.floor(Math.random() * TRC20_CHARS.length)];
  return addr;
}

function maskTRC20(addr: string): string {
  return addr.slice(0, 6) + "**********" + addr.slice(-8);
}

function genInternalRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TXF-${ts}-${rand}`;
}

function genUserId(): string {
  const num = Math.floor(10000000 + Math.random() * 89999999);
  return `QO${num}`;
}

function genAmount(type: TxType): number {
  if (type === "deposit") return Math.floor(500 + Math.random() * 9500);
  if (type === "withdrawal") return Math.floor(200 + Math.random() * 7800);
  return Math.floor(100 + Math.random() * 4900);
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  });
}

type ActivityEntry = {
  id: string;
  name: string;
  maskedName: string;
  userId: string;
  maskedUserId: string;
  type: TxType;
  amount: number;
  time: Date;
  reference: string;
  network?: string;
};

function makeEntry(): ActivityEntry {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)]!;
  const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)]!;
  const userId = genUserId();
  const trc20 = genTRC20Address();
  return {
    id: Math.random().toString(36).slice(2),
    name,
    maskedName: maskName(name),
    userId,
    maskedUserId: maskId(userId),
    type,
    amount: genAmount(type),
    time: new Date(),
    reference: type === "transfer" ? genInternalRef() : maskTRC20(trc20),
    network: type !== "transfer" ? "USD · Secure Transfer" : undefined,
  };
}

const TYPE_META: Record<TxType, { label: string; color: string; bg: string; border: string }> = {
  withdrawal: { label: "Withdrawal", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.18)" },
  deposit:    { label: "Deposit",    color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.18)"  },
  transfer:   { label: "Transfer",   color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.18)" },
};

function LiveActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>(() =>
    Array.from({ length: 8 }, makeEntry).map((e, i) => ({
      ...e,
      time: new Date(Date.now() - i * 7000),
    }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setEntries((prev) => [makeEntry(), ...prev.slice(0, 9)]);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-white">Platform Activity</div>
          <div className="flex gap-2">
            {(["deposit", "withdrawal", "transfer"] as TxType[]).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: TYPE_META[t].color, background: TYPE_META[t].bg, border: `1px solid ${TYPE_META[t].border}` }}>
                {TYPE_META[t].label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Live
        </div>
      </div>

      <div style={{ height: "560px", overflow: "hidden" }}>
        <AnimatePresence initial={false}>
          {entries.map((e) => {
            const meta = TYPE_META[e.type];
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: -28, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}
              >
                <div className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
                      {e.type === "deposit" ? "↓" : e.type === "withdrawal" ? "↑" : "⇄"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{e.maskedName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)" }}>{e.maskedUserId}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{formatDateTime(e.time)}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[10px] tracking-wide truncate max-w-[220px]" style={{ color: e.network ? "rgba(52,211,153,0.65)" : "rgba(129,140,248,0.65)" }}>{e.reference}</span>
                        {e.network && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "rgba(52,211,153,0.08)", color: "rgba(52,211,153,0.6)", border: "1px solid rgba(52,211,153,0.15)" }}>{e.network}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-base font-black tabular-nums" style={{ color: meta.color }}>
                      {e.type === "withdrawal" ? "-" : "+"}${e.amount.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5" style={{ color: meta.color, opacity: 0.7 }}>{meta.label}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
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
    <>
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#050814", color: "#e2e8f0" }}>

      <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(5,8,20,0.88)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              <QorixLogo size={32} />
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
            <button onClick={() => setLocation("/login")} className="btn btn-primary text-sm px-4 py-2">Claim Your Seat</button>
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
              Private capital round open · {slotsRemaining} investor seats remaining
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-5xl sm:text-6xl xl:text-[4.25rem] font-black tracking-[-0.03em] leading-[1.0] mb-6 text-white"
            >
              Stop Guessing<br />the Markets.<br />Start{" "}
              <span style={{ background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #e879f9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Compounding.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto xl:mx-0 leading-relaxed mb-10"
            >
              Qorix runs disciplined forex strategies — scalping, swing, and arbitrage — across professional trading desks, delivering steady returns with built-in drawdown protection, live reporting, and zero emotional trading or manual effort required on your end.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="flex flex-col sm:flex-row justify-center xl:justify-start gap-3 mb-12"
            >
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-7 py-3.5 gap-2">
                Claim Your Allocation <ArrowRight size={16} />
              </button>
              <button onClick={() => perfRef.current?.scrollIntoView({ behavior: "smooth" })} className="btn btn-ghost text-base px-7 py-3.5 gap-2">
                View Track Record <ChevronDown size={16} />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="grid grid-cols-3 gap-3 max-w-xl mx-auto xl:mx-0"
            >
              {[
                { label: "Capital Under Management", value: "$4.2M+", color: "#38bdf8" },
                { label: "Professional Traders", value: "43", color: "#a78bfa" },
                { label: "Avg Monthly Return", value: `${avgReturn}%`, color: "#34d399" },
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

      <section id="market-insights" className="py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Market Insights"
            title="Today's high-impact economic events"
            desc="Monitor the events that move markets. High-impact releases create volatility windows that our trading desks actively position around."
          />
          <FadeIn><EconomicNewsLandingWidget /></FadeIn>
        </div>
      </section>

      <section className="py-24 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top, rgba(79,70,229,0.04) 0%, transparent 65%)" }} />
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="The Qorix Edge"
            title="Not a signal group. A fully-managed capital desk."
            desc="Qorix operates like a private investment platform — professional execution, institutional risk controls, live investor reporting, and capacity discipline all under one roof."
          />

          <div className="grid lg:grid-cols-2 gap-4 items-stretch">
            <FadeIn>
              <div className="rounded-3xl p-6 md:p-8 h-full relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(99,102,241,0.06) 100%)", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 0 60px rgba(59,130,246,0.06)" }}>
                <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: "#818cf8" }}>Investor mandate</div>
                      <h3 className="text-2xl font-black text-white">Your capital preserved first. Returns compound second.</h3>
                    </div>
                    <Star size={22} className="text-amber-400 shrink-0" />
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Strategy type", value: "Multi-desk USD allocation" },
                      { label: "Primary mandate", value: "Drawdown-controlled compounding" },
                      { label: "Investor visibility", value: "Live dashboard, 24/7" },
                      { label: "Capacity policy", value: "Round-based — limited seats per window" },
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
                      <p className="text-sm leading-relaxed" style={{ color: "rgba(167,243,208,0.85)" }}>Built for serious investors who demand process over promises — where every allocation begins with risk definition, not return targets.</p>
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
            eyebrow="Track Record"
            title="10 consecutive months of positive returns."
            desc="We show you both the upside and the drawdown profile together — because a credible capital product earns trust with transparency, not selectively edited numbers."
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
                    <div className="text-xs text-slate-500 mt-0.5">Starting from 100 USD</div>
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
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix=" USD" />} />
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
                    <Tooltip content={(props) => <ChartTooltip {...props} suffix="%" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
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
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "#818cf8" }}>Limited capacity — act now</div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2 text-white">Secure one of {slotsRemaining} remaining private allocation seats.</h2>
                <p className="text-slate-400 max-w-2xl">New capital is capped each round by desk capacity and risk mandate. When seats are filled, onboarding closes until the next allocation window opens.</p>
              </div>
              <button onClick={() => setLocation("/login")} className="btn btn-primary text-base px-8 py-3.5 gap-2 w-full lg:w-auto relative z-10">
                Claim Your Seat <ArrowRight size={16} />
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="trading-desk" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="The Desk"
            title="43 traders. 3 mandates. One disciplined portfolio."
            desc="Capital is distributed by strategy type, trader experience, and real-time risk limits — not a blanket return promise that ignores market conditions."
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
            eyebrow="Platform Activity"
            title="Real investors. Real capital. Moving right now."
            desc="Every deposit, withdrawal, and transfer on the platform — updating live. Transparency isn't a feature here. It's the foundation."
          />
          <FadeIn>
            <LiveActivityFeed />
          </FadeIn>
        </div>
      </section>

      <section id="risk" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <SectionHeader
            eyebrow="Risk Architecture"
            title="Capital protection is the product. Returns are the result."
            desc="Most platforms sell the upside and bury the risk. Qorix shows you both — then lets you define your own ceiling before a single trade is placed."
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
                    { icon: Target, title: "You define the risk ceiling first", desc: "Before a single dollar is deployed, your maximum drawdown is locked into the system. It cannot be overridden.", color: "#38bdf8" },
                    { icon: Activity, title: "Live equity surveillance", desc: "The system tracks your active trading balance and realized P&L in real time — no delayed end-of-day snapshots.", color: "#a78bfa" },
                    { icon: Shield, title: "Automatic pause on breach", desc: "If your drawdown threshold is reached, exposure halts immediately. Your remaining capital is protected — not gambled back.", color: "#34d399" },
                    { icon: Banknote, title: "Profits sit in a separate balance", desc: "Earnings are held in a dedicated profit wallet. Transfer them to your main balance or withdraw on your own schedule.", color: "#fbbf24" },
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
            eyebrow="Getting Started"
            title="From application to earning in under 24 hours."
            desc="The onboarding is designed for investors who value clarity: no unnecessary steps, no hidden fees, no waiting weeks to get your capital working."
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

      <footer className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
                <QorixLogo size={28} />
              </div>
              <div>
                <div className="font-black text-sm text-white">Qorix<span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Markets</span></div>
                <div className="text-[10px] text-slate-600">USD Capital Desk · All rights reserved</div>
              </div>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              {[
                ["Terms & Conditions", "/legal/terms"],
                ["Privacy Policy", "/legal/privacy"],
                ["Risk Disclosure", "/legal/risk-disclosure"],
                ["AML / KYC Policy", "/legal/aml-kyc"],
              ].map(([label, path]) => (
                <button key={path} onClick={() => setLocation(path)} className="text-slate-500 hover:text-slate-300 transition-colors font-medium">
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            <p className="text-[11px] text-slate-600 leading-relaxed max-w-3xl">
              <strong className="text-slate-500">Performance Note:</strong> QorixMarkets has delivered consistent monthly returns across 10 consecutive periods through disciplined risk management and professional desk execution. All investments include built-in drawdown protection, dedicated profit wallets, and live investor reporting — giving you clarity and confidence at every stage of your capital's journey.
            </p>
          </div>
        </div>
      </footer>
    </div>
    <QorixAssistant guestMode />
    </>
  );
}
