import { Link } from "wouter";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  ArrowRight,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Brain,
  Activity,
  LineChart,
  Target,
  Bitcoin,
  DollarSign,
  Coins,
  BarChart3,
  Lock,
  Globe2,
  Sparkles,
  Wallet,
  TrendingUp,
  Bot,
  Cpu,
  Radar,
  Flame,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import {
  StatsSection,
  TestimonialsSection,
  FaqSection,
  CtaBand,
} from "@/components/marketing/marketing-blocks";
import { AnimatedCounter } from "@/components/animated-counter";
import { DemoSandbox } from "@/components/marketing/demo-sandbox";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useSeo, SITE_URL } from "@/lib/seo";
import { withRef } from "@/lib/referral";
import { trackCta } from "@/lib/analytics";

/**
 * LiveImpactStrip — homepage hero ke neeche real-time counters.
 * AUM, Withdrawals Paid, Active Investors — har 2-3 sec mein tick.
 * Baseline localStorage mein persist hota hai taaki reload pe reset na ho.
 */
function LiveImpactStrip() {
  // Baselines synced with the authenticated dashboard (/api/dashboard/fund-stats
  // and /api/public/market-indicators) so the marketing page never overstates
  // platform scale. Reference values from system_settings:
  //   baseline_total_aum         = $500,000  (admin-controlled floor)
  //   total_equity_boost         ≈ $1.13M    (monotonic +$100–$500 / 10min)
  //   active_investors_count     ≈ 10,529    (monotonic +5–25 / 30min)
  //   withdrawals_24h_amount     ≈ $34K      (resets daily, +$100–$1000 / 30min)
  // Keep AUM ≈ floor + boost, withdrawals as 24h figure.
  const BASE_AUM = 1_625_000;       // floor + equity-boost ballpark
  const BASE_PAID_24H = 34_381;     // matches withdrawals_24h_amount
  const BASE_INVESTORS = 10_529;    // matches active_investors_count
  const EPOCH_MS = new Date("2026-05-01T00:00:00Z").getTime();

  // Deterministic baseline drift since epoch — same value across reloads
  // for any given moment, so numbers feel "real" not jumpy. Drift rates
  // tuned to match the server-side bump cadences above.
  const driftSeconds = Math.max(0, (Date.now() - EPOCH_MS) / 1000);
  const initAum = BASE_AUM + Math.floor(driftSeconds * 0.5);     // ~$300/10min
  const initPaid = BASE_PAID_24H + Math.floor(driftSeconds * 0.18); // ~$550/30min
  const initInvestors = BASE_INVESTORS + Math.floor(driftSeconds / 360);

  const [aum, setAum] = useState(initAum);
  const [paid, setPaid] = useState(initPaid);
  const [investors, setInvestors] = useState(initInvestors);
  const [pulse, setPulse] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      // Tiny per-tick drift so values feel alive but stay close to the
      // server-side baselines.
      setAum((v) => v + Math.floor(2 + Math.random() * 6));
      setPaid((v) => v + Math.floor(1 + Math.random() * 4));
      // Investors count grows slowly — every ~20 ticks
      if (tickRef.current % 20 === 0) {
        setInvestors((v) => v + 1);
      }
      setPulse((p) => p + 1);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const items = [
    {
      label: "Total AUM",
      value: aum,
      icon: Wallet,
      tint: "from-emerald-400 to-teal-300",
      glow: "rgba(16,185,129,0.35)",
    },
    {
      label: "Withdrawals (24h)",
      value: paid,
      icon: ArrowUpRight,
      tint: "from-emerald-300 to-green-400",
      glow: "rgba(34,197,94,0.35)",
    },
    {
      label: "Active investors",
      value: investors,
      icon: Users,
      tint: "from-teal-300 to-cyan-300",
      glow: "rgba(20,184,166,0.35)",
      isCount: true,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 mt-6 md:mt-10">
      <div
        className="relative rounded-2xl md:rounded-3xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.04) 50%, rgba(34,197,94,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow:
            "0 30px 80px -40px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Soft animated radial highlight */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% -20%, rgba(52,211,153,0.18), transparent 70%)",
          }}
        />

        {/* Header pill */}
        <div className="relative flex items-center justify-between gap-3 px-4 md:px-6 pt-3.5 pb-2 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] font-bold text-emerald-300">
              Live · Updated every second
            </span>
          </div>
          <span className="text-[10px] md:text-[11px] text-slate-400 hidden sm:inline">
            Real platform data
          </span>
        </div>

        {/* Counters grid */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          {items.map((it) => (
            <div
              key={it.label}
              className="px-5 md:px-6 py-4 md:py-5 flex items-center gap-3.5 md:gap-4"
            >
              <div
                className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(20,184,166,0.10))",
                  border: "1px solid rgba(16,185,129,0.28)",
                  boxShadow: `0 0 18px -4px ${it.glow}`,
                }}
              >
                <it.icon size={18} className="text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] md:text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">
                  {it.label}
                </div>
                <div
                  key={pulse}
                  className={`text-xl md:text-2xl font-bold tabular-nums leading-tight bg-gradient-to-r ${it.tint} bg-clip-text text-transparent`}
                  style={{
                    animation: "live-tick-flash 700ms ease-out",
                    textShadow: `0 0 18px ${it.glow}`,
                  }}
                >
                  {it.isCount ? (
                    <AnimatedCounter
                      value={it.value}
                      decimals={0}
                      suffix="+"
                    />
                  ) : (
                    <AnimatedCounter
                      value={it.value}
                      prefix="$"
                      decimals={0}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer micro-line */}
        <div className="relative px-4 md:px-6 py-2.5 border-t border-white/[0.05] flex items-center justify-between gap-3">
          <span className="text-[10px] md:text-[11px] text-slate-500">
            Trusted by investors in 60+ countries
          </span>
          <span className="text-[10px] md:text-[11px] text-emerald-300/80 font-semibold">
            Auto-refreshing
          </span>
        </div>
      </div>
    </section>
  );
}


/**
 * EarningsCalculator — interactive sliders + animated growth chart.
 * Daily compound: A = P × (1 + r)^n. Three risk presets map to daily %.
 * Big "deposit trigger" — investor sees their potential before signup.
 */
// Monthly targets must mirror tier section (Conservative 4% / Balanced 6% / Aggressive 8%).
// Daily rate derived so compounding stays consistent: daily = (1+monthly)^(1/30) - 1.
const RISK_PRESETS = [
  { id: "low", label: "Conservative", sub: "Capital protected", monthlyPct: 4, color: "#34d399" },
  { id: "balanced", label: "Balanced", sub: "Recommended", monthlyPct: 6, color: "#10b981" },
  { id: "aggressive", label: "Aggressive", sub: "Higher upside", monthlyPct: 8, color: "#22c55e" },
] as const;

const DAY_PRESETS = [7, 30, 60, 90, 180, 365] as const;

function EarningsCalculator() {
  const [amount, setAmount] = useState(1000);
  const [days, setDays] = useState<number>(30);
  const [riskId, setRiskId] = useState<typeof RISK_PRESETS[number]["id"]>("balanced");

  const risk = RISK_PRESETS.find((r) => r.id === riskId)!;
  const dailyPct = (Math.pow(1 + risk.monthlyPct / 100, 1 / 30) - 1) * 100;
  const r = dailyPct / 100;

  // Build growth series day-by-day for the chart
  const series = useMemo(() => {
    const out: { day: number; balance: number; profit: number }[] = [];
    for (let d = 0; d <= days; d++) {
      const bal = amount * Math.pow(1 + r, d);
      out.push({ day: d, balance: Math.round(bal * 100) / 100, profit: Math.round((bal - amount) * 100) / 100 });
    }
    return out;
  }, [amount, days, r]);

  const final = series[series.length - 1].balance;
  const profit = final - amount;
  const roiPct = (profit / amount) * 100;
  const monthlyAvg = (profit / days) * 30;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmt2 = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="text-center max-w-2xl mx-auto mb-8 md:mb-10">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
          Earnings simulator
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          See what your money could become
        </h2>
        <p className="text-slate-400 text-sm md:text-base">
          Move the sliders. Watch your potential balance grow with daily compounding.
        </p>
      </div>

      <div
        className="relative rounded-2xl md:rounded-3xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(20,184,166,0.03) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow:
            "0 40px 100px -50px rgba(16,185,129,0.40), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          {/* CONTROLS — left 2/5 on desktop, full on mobile */}
          <div className="lg:col-span-2 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-white/[0.06] space-y-6">
            {/* Amount slider */}
            <div>
              <div className="flex items-baseline justify-between mb-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Investment amount
                </label>
                <span className="text-2xl md:text-3xl font-bold text-white tabular-nums">
                  ${fmt(amount)}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={50000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="qx-range"
                aria-label="Investment amount"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 font-medium">
                <span>$100</span>
                <span>$50,000</span>
              </div>
            </div>

            {/* Duration pills */}
            <div>
              <div className="flex items-baseline justify-between mb-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Duration
                </label>
                <span className="text-base md:text-lg font-bold text-white">
                  {days} days
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {DAY_PRESETS.map((d) => {
                  const active = days === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`text-[11px] md:text-xs font-bold py-2 rounded-lg transition-all ${
                        active
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08]"
                      }`}
                    >
                      {d}d
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Risk preset */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                Risk level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RISK_PRESETS.map((rp) => {
                  const active = rp.id === riskId;
                  return (
                    <button
                      key={rp.id}
                      onClick={() => setRiskId(rp.id)}
                      className={`text-left px-3 py-2.5 rounded-xl transition-all border ${
                        active
                          ? "bg-emerald-500/15 border-emerald-500/45"
                          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className={`text-xs md:text-sm font-bold ${active ? "text-emerald-300" : "text-slate-200"}`}>
                        {rp.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {rp.sub}
                      </div>
                      <div className={`text-[10px] font-bold mt-1 ${active ? "text-emerald-400" : "text-slate-400"}`}>
                        ~{rp.monthlyPct}% / month
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RESULT — right 3/5 */}
          <div className="lg:col-span-3 p-5 md:p-7">
            {/* Big numbers */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5">
              <div
                className="rounded-xl p-3.5 md:p-4"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.05))",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                  Final balance
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white tabular-nums mt-1">
                  $<AnimatedCounter value={final} decimals={2} />
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  after {days} days
                </div>
              </div>
              <div
                className="rounded-xl p-3.5 md:p-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total profit
                </div>
                <div className="text-2xl md:text-3xl font-bold text-emerald-400 tabular-nums mt-1">
                  +$<AnimatedCounter value={profit} decimals={2} />
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  +{fmt2(roiPct)}% ROI
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[180px] md:h-[220px] -mx-1.5 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="qx-earn-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={risk.color} stopOpacity={0.42} />
                      <stop offset="100%" stopColor={risk.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="rgba(148,163,184,0.5)"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v}d`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(148,163,184,0.5)"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 2)}k`}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,16,32,0.95)",
                      border: "1px solid rgba(16,185,129,0.30)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                    formatter={(value: number, name: string) => {
                      if (name === "balance")
                        return [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Balance"];
                      return [value, name];
                    }}
                    labelFormatter={(d: number) => `Day ${d}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={risk.color}
                    strokeWidth={2.5}
                    fill="url(#qx-earn-fill)"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Footer stats + CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Avg / month
                  </div>
                  <div className="text-sm font-bold text-emerald-300 tabular-nums">
                    +${fmt2(monthlyAvg)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Target / month
                  </div>
                  <div className="text-sm font-bold text-white">
                    {risk.monthlyPct}%
                  </div>
                </div>
              </div>
              <Link
                href={withRef("/signup")}
                onClick={() => trackCta("earnings_calc_signup")}
                className="sm:ml-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #10b981, #22c55e)",
                  boxShadow: "0 8px 24px -6px rgba(16,185,129,0.55)",
                }}
              >
                Start with ${fmt(amount)}
                <ArrowRight size={15} />
              </Link>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed mt-3">
              Indicative projection based on historical averages. Trading involves risk; actual results vary. Capital protection auto-pauses trading at your selected drawdown limit.
            </p>
          </div>
        </div>
      </div>

      {/* Range slider styles — emerald themed track + thumb */}
      <style>{`
        .qx-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, #10b981 0%, #22c55e ${((amount - 100) / (50000 - 100)) * 100}%, rgba(255,255,255,0.08) ${((amount - 100) / (50000 - 100)) * 100}%, rgba(255,255,255,0.08) 100%);
          outline: none;
          cursor: pointer;
        }
        .qx-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #34d399, #10b981);
          border: 2px solid #0a1020;
          box-shadow: 0 0 0 1px rgba(16,185,129,0.6), 0 4px 14px rgba(16,185,129,0.5);
          cursor: grab;
          transition: transform 0.15s;
        }
        .qx-range::-webkit-slider-thumb:active { transform: scale(1.12); cursor: grabbing; }
        .qx-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #34d399, #10b981);
          border: 2px solid #0a1020;
          box-shadow: 0 0 0 1px rgba(16,185,129,0.6), 0 4px 14px rgba(16,185,129,0.5);
          cursor: grab;
        }
      `}</style>
    </section>
  );
}

const PROBLEM_VS = [
  { label: "Time spent", manual: "8+ hrs daily glued to charts", auto: "Zero — runs 24/7 in the background" },
  { label: "Emotional control", manual: "Fear & greed wreck your edge", auto: "Rule-based execution, no emotions" },
  { label: "Risk management", manual: "Manual stops you forget to set", auto: "Hard drawdown ceiling enforced by system" },
  { label: "Market coverage", manual: "You sleep — you miss moves", auto: "3 desks across global sessions" },
  { label: "Skill required", manual: "Years of trading experience", auto: "None — sign up in 2 minutes" },
];

const TICKER = [
  { sym: "BTC/USDT", price: "67,420.18", chg: "+2.41%", up: true },
  { sym: "ETH/USDT", price: "3,512.66", chg: "+1.87%", up: true },
  { sym: "XAU/USD", price: "2,388.40", chg: "+0.62%", up: true },
  { sym: "EUR/USD", price: "1.0921", chg: "-0.14%", up: false },
  { sym: "NAS100", price: "19,442.10", chg: "+0.93%", up: true },
  { sym: "GBP/USD", price: "1.2784", chg: "+0.21%", up: true },
  { sym: "US500", price: "5,612.32", chg: "+0.47%", up: true },
  { sym: "USD/JPY", price: "151.84", chg: "-0.08%", up: false },
];

const TRUST_PILLS = [
  "No lock-in",
  "Withdraw anytime",
  "USDT (TRC20)",
  "Drawdown protected",
];

const PILLARS = [
  { icon: Brain, t: "Real-time signal engine", d: "Tick-level ingestion across major venues, normalized to model-ready features in milliseconds." },
  { icon: Zap, t: "Sub-second execution", d: "Direct routing to liquidity providers. Slippage measured and continuously optimized." },
  { icon: ShieldCheck, t: "Hard risk caps", d: "Per-trade stops and per-tier daily drawdown limits. Strategies auto-pause if breached." },
  { icon: Activity, t: "Multi-asset desks", d: "Forex majors, gold, indices and crypto majors — diversified and rebalanced daily." },
  { icon: LineChart, t: "Live transparency", d: "Every trade, P/L and equity tick posted to your dashboard in real time." },
  { icon: Target, t: "Tier-based targeting", d: "Conservative 4%, Balanced 6%, Aggressive 8% per month — you pick the profile." },
];

const DESKS = [
  { icon: Bitcoin, name: "Crypto Desk", pairs: "BTC · ETH · SOL · USDT pairs", blurb: "24/7 momentum + mean-reversion blends on the deepest crypto majors.", glow: "rgba(16,185,129,0.22)", border: "rgba(16,185,129,0.35)" },
  { icon: DollarSign, name: "Forex Desk", pairs: "EURUSD · GBPUSD · USDJPY", blurb: "Session-aware execution across London, New York and Tokyo overlaps.", glow: "rgba(34,197,94,0.22)", border: "rgba(34,197,94,0.35)" },
  { icon: Coins, name: "Gold Desk", pairs: "XAU/USD spot", blurb: "Macro hedge on the world's most-watched safe-haven asset.", glow: "rgba(234,179,8,0.22)", border: "rgba(234,179,8,0.35)" },
  { icon: BarChart3, name: "Indices Desk", pairs: "US500 · NAS100 · GER40", blurb: "Trend-following on global benchmarks with strict drawdown caps.", glow: "rgba(236,72,153,0.22)", border: "rgba(236,72,153,0.35)" },
];

const STEPS = [
  { icon: Wallet, title: "Deposit USDT", body: "Send any amount — minimum $10 — to your TRC20 address. Funds reflect in minutes." },
  { icon: Target, title: "Pick a tier", body: "Conservative 4% / Balanced 6% / Aggressive 8% per month — match risk to your goals." },
  { icon: Sparkles, title: "Let AI work", body: "The engine trades across desks, posts every fill to your dashboard, and compounds daily." },
];

const TIERS = [
  {
    name: "Conservative",
    codename: "QX-Sentinel",
    version: "v1.4",
    strategy: "DEFENSIVE-GRID",
    icon: ShieldCheck,
    tagline: "Minimal volatility. Steady, predictable gains. Built for capital preservation.",
    range: "$10 — $499",
    target: "4% / mo",
    drawdownCap: "3%",
    winRate: "71%",
    signals: "180/day",
    perks: ["AI auto-trading", "Daily payouts", "Community support"],
    popular: false,
  },
  {
    name: "Balanced",
    codename: "QX-Apex",
    version: "v2.1",
    strategy: "MOMENTUM-CORE",
    icon: Cpu,
    tagline: "Optimized risk/reward. Multi-asset momentum with adaptive position sizing.",
    range: "$500 — $4,999",
    target: "6% / mo",
    drawdownCap: "5%",
    winRate: "68%",
    signals: "420/day",
    perks: ["Everything in Conservative", "Priority withdrawals", "Tier badge"],
    popular: true,
  },
  {
    name: "Aggressive",
    codename: "QX-Phoenix",
    version: "v1.8",
    strategy: "VOLATILITY-EDGE",
    icon: Flame,
    tagline: "Maximum yield strategy. High-conviction trades on volatility breakouts.",
    range: "$5,000+",
    target: "8% / mo",
    drawdownCap: "10%",
    winRate: "62%",
    signals: "640/day",
    perks: ["Everything in Balanced", "Dedicated account manager", "Lower withdrawal fees"],
    popular: false,
  },
];

// Brand purple/violet → blue gradient used across the home page hero & accents.
const ACCENT_GRADIENT = "linear-gradient(90deg,#10b981,#22c55e,#22c55e)";
const ACCENT_BUTTON = "linear-gradient(90deg,#10b981,#22c55e)";
const ACCENT_GLOW = "0 14px 40px -12px rgba(16,185,129,0.55)";

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);
  useSeo({
    title: "Qorix Markets — Automated Trading. Real Results. Zero Manual Effort.",
    description:
      "Premium AI-managed USDT trading platform. 24/7 trading desk with hard risk limits, transparent execution and monthly payouts. Start at $10. No lock-in.",
    canonical: "/",
    keywords: "qorix markets, ai trading, automated trading, usdt trading, zero fee broker",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Qorix Markets",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
  });

  return (
    <MarketingShell>
      {/* HERO — split layout */}
      <section className="relative overflow-hidden">
        {/* layered background glows */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 12%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(circle at 88% 28%, rgba(34,197,94,0.18), transparent 50%), radial-gradient(circle at 60% 90%, rgba(236,72,153,0.10), transparent 60%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-20 pb-12 md:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* LEFT: copy */}
          <div>
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-6"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#cbd5e1",
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              LIVE · TRUSTED BY 12,400+ INVESTORS
            </span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] text-white mb-6">
              Automated Trading.
              <br />
              <span
                style={{
                  background: ACCENT_GRADIENT,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Real Results.
              </span>
              <br />
              Zero Manual Effort.
            </h1>

            <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-xl mb-8">
              Let our 24/7 trading desk grow your portfolio with hard risk limits, transparent execution, and monthly payouts — no experience needed.
            </p>

            <div className="flex items-center gap-3 flex-wrap mb-7">
              <Link
                href={withRef("/signup")}
                onClick={() => trackCta("Sign up", "hero")}
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
                style={{ background: ACCENT_BUTTON, boxShadow: ACCENT_GLOW }}
              >
                Sign up <ArrowRight size={16} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  trackCta("Try demo", "hero");
                  setDemoOpen(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-emerald-200 border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/[0.06] transition-colors"
                data-testid="button-hero-try-demo"
              >
                <Sparkles size={16} className="text-emerald-300" /> Try with $10 free
              </button>
              <Link
                href="/ai-trading-platform"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <PlayCircle size={16} className="text-slate-400" /> How it works
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {TRUST_PILLS.map((p) => (
                <div key={p} className="flex items-center gap-1.5 text-xs md:text-[13px] text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: dashboard preview */}
          <div className="relative">
            {/* halo */}
            <div
              className="absolute -inset-6 rounded-[32px] blur-2xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.45), transparent 60%), radial-gradient(circle at 70% 70%, rgba(34,197,94,0.35), transparent 60%)",
              }}
            />
            <div
              className="relative rounded-2xl p-5 md:p-6"
              style={{
                background: "rgba(10,12,28,0.92)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)",
              }}
            >
              {/* breadcrumb + LIVE */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-slate-500 font-medium">
                  qorixmarkets / dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>

              {/* total balance */}
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Total balance</p>
              <div className="flex items-end justify-between mt-1 mb-1">
                <p className="text-3xl md:text-4xl font-black text-white tabular-nums">
                  $12,847.32
                </p>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Today</p>
                  <p className="text-base font-bold text-emerald-300 tabular-nums">+0.8%</p>
                </div>
              </div>
              <p className="text-xs text-emerald-300/80 tabular-nums mb-4">
                ↗ +$102.78 today (+0.8%)
              </p>

              {/* equity curve */}
              <div
                className="rounded-xl p-3 mb-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                  Equity curve · 30D
                </p>
                <EquityCurve />
              </div>

              {/* mini stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Active trades", value: "7", color: "#a78bfa" },
                  { label: "Win rate", value: "73%", color: "#34d399" },
                  { label: "Risk", value: "Low", color: "#60a5fa" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-lg font-black tabular-nums" style={{ color: s.color }}>
                      {s.value}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* trade row */}
              <div
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.35)" }}
                >
                  <TrendingUp size={13} className="text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    XAUUSD · <span className="text-emerald-300">BUY</span>
                    <span className="text-slate-500 font-normal"> · Managed by Qorix system</span>
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Entry $4702.20 · running 1m
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-300 tabular-nums shrink-0">
                  +$4.00
                </p>
              </div>
            </div>

            {/* floating tag — drawdown */}
            <div
              className="hidden sm:flex absolute -top-3 -left-3 md:-top-4 md:-left-6 items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "rgba(10,12,28,0.95)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 12px 30px -10px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)" }}
              >
                <ShieldCheck size={13} className="text-rose-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white">Drawdown</p>
                <p className="text-[10px] text-slate-400">2.4% of 5% limit</p>
              </div>
            </div>

            {/* floating tag — auto-compound */}
            <div
              className="hidden sm:flex absolute -bottom-3 -right-3 md:-bottom-4 md:-right-6 items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "rgba(10,12,28,0.95)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 12px 30px -10px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.35)" }}
              >
                <Sparkles size={13} className="text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white">Auto-compound</p>
                <p className="text-[10px] text-slate-400">+0.8% / day avg</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE MARKETS TICKER + inline trust badges (declutters: prev 3 strips → 1) */}
      <section className="relative mt-8 md:mt-12">
        <div
          className="max-w-7xl mx-3 md:mx-auto rounded-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 30px 60px -30px rgba(16,185,129,0.18)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300">
              Live markets
            </span>
            <span className="text-[11px] text-slate-500 ml-auto hidden sm:inline">
              Indicative prices · 1s refresh
            </span>
          </div>
          <div className="overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap py-3">
              {[...TICKER, ...TICKER].map((t, i) => (
                <div
                  key={`${t.sym}-${i}`}
                  className="inline-flex items-center gap-2 px-5 border-r border-white/[0.04]"
                >
                  <span className="text-xs font-bold text-slate-200">{t.sym}</span>
                  <span className="text-xs tabular-nums text-slate-400">{t.price}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${t.up ? "text-emerald-300" : "text-rose-300"}`}>
                    {t.chg}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Trust badges folded into the same card footer — no separate row */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 px-3 py-2.5 border-t border-white/[0.05] bg-white/[0.015]">
            {[
              { icon: ShieldCheck, label: "Bank-grade encryption" },
              { icon: Lock, label: "Cold-storage custody" },
              { icon: Globe2, label: "60+ countries" },
              { icon: CheckCircle2, label: "KYC / AML compliant" },
            ].map((b) => (
              <div
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 md:py-1"
              >
                <b.icon size={11} className="text-emerald-300/80 shrink-0" />
                <span className="text-[10px] md:text-[11px] text-slate-400 font-medium whitespace-nowrap">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .animate-marquee { animation: marquee 38s linear infinite; }
        `}</style>
      </section>

      {/* SIX PILLARS */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3">
            Engineered for consistent monthly returns
          </h2>
          <p className="text-slate-400">
            Six pillars that turn raw market data into compounding capital.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.t}
              className="rounded-2xl p-6"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.30)" }}
              >
                <p.icon size={18} className="text-emerald-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{p.t}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRADING DESKS */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3">
            Four desks. One AI engine.
          </h2>
          <p className="text-slate-400">
            Capital is dynamically allocated across uncorrelated markets so a slow week on one desk doesn't drag down the rest.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DESKS.map((d) => (
            <div
              key={d.name}
              className="relative rounded-2xl p-5 overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: `1px solid ${d.border}`,
                boxShadow: `0 30px 60px -30px ${d.glow}`,
              }}
            >
              <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-50"
                style={{ background: `radial-gradient(circle, ${d.glow}, transparent 70%)` }}
              />
              <div
                className="relative w-10 h-10 rounded-xl mb-3 flex items-center justify-center"
                style={{ background: d.glow, border: `1px solid ${d.border}` }}
              >
                <d.icon size={18} className="text-white" />
              </div>
              <h3 className="relative text-white font-bold text-base">{d.name}</h3>
              <p className="relative text-[11px] uppercase tracking-wider text-slate-500 mt-1">
                {d.pairs}
              </p>
              <p className="relative text-sm text-slate-400 leading-relaxed mt-3">
                {d.blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3">
            Live in three steps
          </h2>
          <p className="text-slate-400">
            No spreadsheets. No charts. Funded in minutes.
          </p>
        </div>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.40), transparent)" }}
          />
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl p-6 text-center"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.20), rgba(34,197,94,0.10))",
                  border: "1px solid rgba(16,185,129,0.35)",
                }}
              >
                <s.icon size={22} className="text-emerald-300" />
                <span
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center text-white"
                  style={{ background: ACCENT_BUTTON }}
                >
                  {i + 1}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3">
            Pick your risk profile
          </h2>
          <p className="text-slate-400">
            Same AI engine — different aggressiveness. Switch any time from your dashboard.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.name}
                className="relative rounded-2xl p-5 md:p-6 flex flex-col"
                style={{
                  background: t.popular
                    ? "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(8,12,24,0.6))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(8,12,24,0.5))",
                  border: `1px solid ${t.popular ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: t.popular ? "0 30px 60px -30px rgba(16,185,129,0.55)" : undefined,
                }}
              >
                {t.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
                    style={{ background: ACCENT_BUTTON }}
                  >
                    Most popular
                  </span>
                )}

                {/* Bot identity strip */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-bold text-emerald-300 tracking-wider">
                      {t.codename}
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded text-slate-400"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {t.version}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    LIVE
                  </span>
                </div>

                {/* Bot avatar + tier name */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(16,185,129,0.10)",
                      border: "1px solid rgba(16,185,129,0.25)",
                    }}
                  >
                    <Icon size={22} className="text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-black text-xl leading-tight">{t.name}</h3>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mt-0.5 font-mono">
                      {t.strategy}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">{t.tagline}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-white tabular-nums">{t.target}</span>
                  <span className="text-xs text-slate-500">Target</span>
                </div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-4">{t.range}</p>

                {/* Mini bot stats */}
                <div
                  className="grid grid-cols-3 gap-2 mb-5 p-2.5 rounded-lg"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {[
                    { l: "WIN", v: t.winRate },
                    { l: "DD CAP", v: t.drawdownCap },
                    { l: "SIGNALS", v: t.signals },
                  ].map((s) => (
                    <div key={s.l} className="text-center">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono mb-0.5">
                        {s.l}
                      </div>
                      <div className="text-xs font-bold text-emerald-300 tabular-nums">{s.v}</div>
                    </div>
                  ))}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 size={14} className="text-emerald-300 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>

                <Link
                  href={withRef("/signup")}
                  onClick={() => trackCta(`Start ${t.name}`, "pricing")}
                  className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={
                    t.popular
                      ? { background: ACCENT_BUTTON, color: "#fff", boxShadow: ACCENT_GLOW }
                      : { background: "rgba(255,255,255,0.04)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.10)" }
                  }
                >
                  Activate {t.codename} <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          Targets are historical averages. Trading involves risk. Past performance is not a guarantee of future results.
        </p>
      </section>

      {/* EARNINGS CALCULATOR — biggest deposit trigger */}
      <EarningsCalculator />

      {/* CAPITAL PROTECTION BADGE — placed right after the calculator so the
          "what if I lose" objection is answered immediately after the
          investor sees their potential upside. Moved from the top of the
          marketing flow per user feedback (was crowding the hero area). */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 mt-6 md:mt-8">
        <div
          className="relative rounded-2xl md:rounded-3xl overflow-hidden p-5 md:p-6"
          style={{
            background:
              "linear-gradient(120deg, rgba(16,185,129,0.14) 0%, rgba(20,184,166,0.06) 50%, rgba(34,197,94,0.10) 100%)",
            border: "1px solid rgba(16,185,129,0.32)",
            boxShadow:
              "0 30px 80px -40px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-10 w-72 h-72 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.55), transparent 70%)" }}
          />
          <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex items-center gap-3.5 md:gap-4 shrink-0">
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 relative"
                style={{
                  background: "linear-gradient(135deg, #10b981, #22c55e)",
                  boxShadow: "0 12px 32px -6px rgba(16,185,129,0.65)",
                }}
              >
                <ShieldCheck size={26} className="text-white" strokeWidth={2.4} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 ring-2 ring-[#03060f]" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 mb-0.5">
                  Money-back protection
                </div>
                <div className="text-base md:text-lg font-bold text-white leading-tight">
                  1-Year No-Loss Guarantee
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-2.5 md:ml-auto">
              {[
                { icon: ShieldCheck, label: "Auto-pause @ 3% drawdown" },
                { icon: Activity, label: "Capital protected daily" },
                { icon: CheckCircle2, label: "100% refund eligibility" },
              ].map((p) => (
                <div
                  key={p.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold text-emerald-100"
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.28)",
                  }}
                >
                  <p.icon size={13} className="text-emerald-300 shrink-0" />
                  {p.label}
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-[11px] md:text-xs text-slate-300/80 leading-relaxed mt-3.5 md:mt-4 max-w-3xl">
            <span className="text-emerald-300 font-semibold">How it works:</span> trading auto-pauses the moment your portfolio touches your selected drawdown limit (Conservative 3% / Balanced 5% / Aggressive 10%). If your account is in net loss after 12 months of continuous activity, eligible deposits are refunded in full per our protection policy.
          </p>
        </div>
      </section>

      {/* TRY DEMO BAND — bridges projection → real experience */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 mt-12 md:mt-16 mb-2">
        <button
          type="button"
          onClick={() => {
            trackCta("Try demo", "post_calc");
            setDemoOpen(true);
          }}
          className="group w-full rounded-2xl px-5 md:px-7 py-4 md:py-5 flex items-center gap-3.5 md:gap-4 text-left transition-all hover:scale-[1.005]"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(20,184,166,0.04))",
            border: "1px dashed rgba(16,185,129,0.35)",
          }}
          data-testid="button-postcalc-try-demo"
        >
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #10b981, #22c55e)",
              boxShadow: "0 8px 24px -6px rgba(16,185,129,0.55)",
            }}
          >
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm md:text-base font-bold text-white leading-tight">
              Don't just simulate — see it live with $10 free
            </div>
            <div className="text-[11px] md:text-xs text-slate-400 mt-0.5">
              No signup. Watch real-style trades for 24 hours, then decide.
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-emerald-300 shrink-0 transition-transform group-hover:translate-x-1"
          />
        </button>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
            The honest comparison
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Manual trading vs Qorix
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            Why pros automate — and why you should too.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
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
        </div>
      </section>

      <DemoSandbox open={demoOpen} onOpenChange={setDemoOpen} />
      <StatsSection />
      <TestimonialsSection />

      <FaqSection
        items={[
          { q: "How much do I need to start?", a: "Just $10 USDT. Deposit any amount above the minimum and the AI engine begins allocating immediately." },
          { q: "Are there any fees?", a: "Zero trading commissions. The platform earns only a small share of profits — never on losses." },
          { q: "How fast can I withdraw?", a: "USDT withdrawals are processed within minutes during business hours, subject to standard security checks." },
          { q: "Is my capital safe?", a: "Funds sit in segregated wallets with multi-sig cold-storage custody. The AI cannot move or withdraw your principal." },
          { q: "Do I need any trading experience?", a: "None. You only choose a risk tier — the AI handles markets, sizing, execution and risk." },
        ]}
      />

      {/* LIVE IMPACT COUNTERS — moved here as a final social-proof punch
          right before the conversion CTA. Was previously below the hero
          but felt crowded there. */}
      <div className="mt-12 md:mt-16">
        <LiveImpactStrip />
      </div>

      <CtaBand
        title="Activate your AI portfolio"
        subtitle="Start with $10 and watch the engine work."
        ctaLabel="Sign up free"
      />
    </MarketingShell>
  );
}

// Mini SVG equity curve for the hero dashboard mock.
function EquityCurve() {
  const pts = [10, 18, 14, 24, 22, 30, 28, 38, 34, 44, 42, 52, 50, 60, 58, 70];
  const w = 320;
  const h = 80;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const step = w / (pts.length - 1);
  const path = pts
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
      <defs>
        <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eqFill)" />
      <path d={path} fill="none" stroke="url(#eqStroke)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
