import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  ShieldCheck,
  Zap,
  LineChart,
  Activity,
  Target,
  Bitcoin,
  DollarSign,
  Coins,
  BarChart3,
  CheckCircle2,
  Lock,
  Globe2,
  Sparkles,
  Wallet,
  PlayCircle,
} from "lucide-react";
import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import {
  FeatureGrid,
  StatsSection,
  TestimonialsSection,
  FaqSection,
  CtaBand,
} from "@/components/marketing/marketing-blocks";
import { useSeo, SITE_URL } from "@/lib/seo";
import { withRef } from "@/lib/referral";
import { trackCta } from "@/lib/analytics";

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

const DESKS = [
  {
    icon: Bitcoin,
    name: "Crypto Desk",
    pairs: "BTC · ETH · SOL · USDT pairs",
    blurb:
      "24/7 momentum + mean-reversion blends on the deepest crypto majors.",
    accent: "rgba(245,158,11,0.30)",
    glow: "rgba(245,158,11,0.18)",
  },
  {
    icon: DollarSign,
    name: "Forex Desk",
    pairs: "EURUSD · GBPUSD · USDJPY",
    blurb:
      "Session-aware execution across London, New York and Tokyo overlaps.",
    accent: "rgba(59,130,246,0.30)",
    glow: "rgba(59,130,246,0.18)",
  },
  {
    icon: Coins,
    name: "Gold Desk",
    pairs: "XAU/USD spot",
    blurb:
      "Macro hedge on the world's most-watched safe-haven asset.",
    accent: "rgba(234,179,8,0.30)",
    glow: "rgba(234,179,8,0.18)",
  },
  {
    icon: BarChart3,
    name: "Indices Desk",
    pairs: "US500 · NAS100 · GER40",
    blurb:
      "Trend-following on global equity benchmarks with strict drawdown caps.",
    accent: "rgba(16,185,129,0.30)",
    glow: "rgba(16,185,129,0.18)",
  },
];

const STEPS = [
  {
    icon: Wallet,
    title: "Deposit USDT",
    body: "Send any amount — minimum $10 — to your unique TRC20 address. Funds reflect within minutes.",
  },
  {
    icon: Target,
    title: "Pick a tier",
    body: "Conservative 4% / Balanced 6% / Aggressive 8% per month — match the risk to your goals.",
  },
  {
    icon: Sparkles,
    title: "Let AI work",
    body: "Our engine trades across desks, posts every fill to your dashboard, and compounds daily.",
  },
];

const TIERS = [
  {
    name: "Starter",
    range: "$10 — $499",
    target: "4% / mo",
    perks: ["AI auto-trading", "Daily payouts", "Community support"],
    accent: "rgba(148,163,184,0.30)",
  },
  {
    name: "Balanced",
    range: "$500 — $4,999",
    target: "6% / mo",
    perks: ["Everything in Starter", "Priority withdrawals", "Tier badge"],
    accent: "rgba(16,185,129,0.45)",
    popular: true,
  },
  {
    name: "Aggressive",
    range: "$5,000+",
    target: "8% / mo",
    perks: ["Everything in Balanced", "Dedicated account manager", "Lower withdrawal fees"],
    accent: "rgba(59,130,246,0.40)",
  },
];

export default function HomePage() {
  useSeo({
    title: "Qorix Markets — AI-Managed USDT Trading. Zero Fees. Start at $10",
    description:
      "Premium AI trading platform for forex, gold, indices and crypto. Zero commissions. Start with just $10 USDT and let our engine compound your capital 24/7.",
    canonical: "/",
    keywords:
      "qorix markets, ai trading, automated trading, usdt trading, zero fee broker, ai trading platform",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Qorix Markets",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      sameAs: [],
    },
  });

  return (
    <MarketingShell>
      {/* HERO */}
      <MarketingHero
        badge="AI Trading Platform"
        title={
          <>
            Let AI <span className="text-emerald-300">trade for you</span> 24/7
          </>
        }
        subtitle="Our AI engine analyzes thousands of cross-asset signals every minute and executes risk-managed orders on your behalf — across forex, gold, indices and crypto majors."
        secondaryHref="/ai-trading-platform"
        secondaryLabel="How it works"
      />

      {/* LIVE TICKER STRIP */}
      <section className="relative -mt-4 md:-mt-6">
        <div
          className="max-w-7xl mx-auto mx-3 md:mx-auto rounded-2xl overflow-hidden"
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
            <span className="text-[11px] text-slate-500 ml-auto">
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
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      t.up ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {t.chg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          .animate-marquee { animation: marquee 38s linear infinite; }
        `}</style>
      </section>

      {/* TRUST STRIP */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShieldCheck, label: "Bank-grade encryption" },
            { icon: Lock, label: "Cold-storage custody" },
            { icon: Globe2, label: "Available in 60+ countries" },
            { icon: CheckCircle2, label: "KYC / AML compliant" },
          ].map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <b.icon size={16} className="text-emerald-300 shrink-0" />
              <span className="text-xs md:text-sm text-slate-300 font-medium">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SIX PILLARS */}
      <FeatureGrid
        title="Engineered for consistent monthly returns"
        subtitle="Six pillars that turn raw market data into compounding capital."
        items={[
          { icon: <Brain size={18} className="text-emerald-300" />, title: "Real-time signal engine", description: "Tick-level ingestion across major venues, normalized into model-ready features in milliseconds." },
          { icon: <Zap size={18} className="text-emerald-300" />, title: "Sub-second execution", description: "Direct routing to liquidity providers. Slippage is measured, logged and continuously optimized." },
          { icon: <ShieldCheck size={18} className="text-emerald-300" />, title: "Hard risk caps", description: "Per-trade stop-losses and per-tier daily drawdown limits. Strategies auto-pause if breached." },
          { icon: <Activity size={18} className="text-emerald-300" />, title: "Multi-asset desks", description: "Forex majors, gold, indices and crypto majors — diversified and rebalanced daily." },
          { icon: <LineChart size={18} className="text-emerald-300" />, title: "Live transparency", description: "Every trade, P/L and equity tick posted to your dashboard in real time." },
          { icon: <Target size={18} className="text-emerald-300" />, title: "Tier-based targeting", description: "Conservative 4%, Balanced 6%, Aggressive 8% per month — you pick the profile." },
        ]}
      />

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
                border: `1px solid ${d.accent}`,
                boxShadow: `0 30px 60px -30px ${d.glow}`,
              }}
            >
              <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-50"
                style={{ background: `radial-gradient(circle, ${d.glow}, transparent 70%)` }}
              />
              <div
                className="relative w-10 h-10 rounded-xl mb-3 flex items-center justify-center"
                style={{ background: d.glow, border: `1px solid ${d.accent}` }}
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

      {/* HOW IT WORKS — 3 STEPS */}
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
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(16,185,129,0.40), transparent)",
            }}
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
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.20), rgba(59,130,246,0.10))",
                  border: "1px solid rgba(16,185,129,0.35)",
                }}
              >
                <s.icon size={22} className="text-emerald-300" />
                <span
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center text-slate-900"
                  style={{ background: "linear-gradient(135deg,#10b981,#22c55e)" }}
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

      {/* PRICING TIERS */}
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
          {TIERS.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl p-6"
              style={{
                background: t.popular
                  ? "linear-gradient(180deg, rgba(16,185,129,0.10), rgba(255,255,255,0.02))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                border: `1px solid ${t.accent}`,
                boxShadow: t.popular
                  ? "0 30px 60px -30px rgba(16,185,129,0.45)"
                  : undefined,
              }}
            >
              {t.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-900"
                  style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-white font-bold text-lg">{t.name}</h3>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">
                {t.range}
              </p>
              <div className="mt-4 mb-5">
                <span className="text-3xl font-black text-white tabular-nums">
                  {t.target}
                </span>
                <span className="text-xs text-slate-500 ml-1">target</span>
              </div>
              <ul className="space-y-2 mb-6">
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
                    ? {
                        background: "linear-gradient(90deg,#10b981,#22c55e)",
                        color: "#fff",
                        boxShadow: "0 14px 40px -12px rgba(16,185,129,0.55)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "#e2e8f0",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }
                }
              >
                Start {t.name} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          Targets are historical averages. Trading involves risk. Past performance is not a guarantee of future results.
        </p>
      </section>

      {/* DASHBOARD PREVIEW BAND */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div
          className="rounded-3xl p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(59,130,246,0.06))",
            border: "1px solid rgba(16,185,129,0.25)",
          }}
        >
          <div>
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#cbd5e1",
              }}
            >
              <PlayCircle size={12} className="text-emerald-300" /> Investor dashboard
            </span>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-3 leading-tight">
              See every fill, P/L and equity tick — live.
            </h2>
            <p className="text-slate-300 leading-relaxed">
              No black box. Open your dashboard any time to inspect every trade the AI has placed on your behalf, today and historically. Withdraw, pause, or switch tier in one tap.
            </p>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <Link
                href={withRef("/signup")}
                onClick={() => trackCta("Start Trading Free", "dashboard_band")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg"
                style={{
                  background: "linear-gradient(90deg,#10b981,#22c55e)",
                  boxShadow: "0 14px 40px -12px rgba(16,185,129,0.55)",
                }}
              >
                Start Trading Free <ArrowRight size={14} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 border border-white/10 hover:border-white/30 hover:bg-white/[0.04] transition-colors"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Faux dashboard card */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(5,8,20,0.85)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  Portfolio value
                </p>
                <p className="text-2xl font-black text-white tabular-nums">$12,486.42</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  Today
                </p>
                <p className="text-base font-bold text-emerald-300 tabular-nums">
                  +$184.21
                </p>
              </div>
            </div>
            {/* tiny equity bars */}
            <div className="flex items-end gap-1 h-16 mb-4">
              {[40, 55, 48, 62, 58, 70, 66, 75, 72, 84, 80, 92].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background:
                      "linear-gradient(180deg, #10b981, rgba(16,185,129,0.20))",
                  }}
                />
              ))}
            </div>
            <div className="space-y-2">
              {[
                { sym: "BTC/USDT", side: "LONG", pnl: "+$42.18" },
                { sym: "XAU/USD", side: "LONG", pnl: "+$28.40" },
                { sym: "EUR/USD", side: "SHORT", pnl: "+$11.05" },
              ].map((r) => (
                <div
                  key={r.sym}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span className="text-slate-300 font-semibold">{r.sym}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      background:
                        r.side === "LONG"
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(244,63,94,0.15)",
                      color: r.side === "LONG" ? "#6ee7b7" : "#fda4af",
                    }}
                  >
                    {r.side}
                  </span>
                  <span className="text-emerald-300 font-bold tabular-nums">
                    {r.pnl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <StatsSection />

      {/* TESTIMONIALS */}
      <TestimonialsSection />

      {/* FAQ */}
      <FaqSection
        items={[
          { q: "How much do I need to start?", a: "Just $10 USDT. Deposit any amount above the minimum and the AI engine begins allocating immediately." },
          { q: "Are there any fees?", a: "Zero trading commissions. The platform earns only a small share of profits — never on losses." },
          { q: "How fast can I withdraw?", a: "USDT withdrawals are processed within minutes during business hours, subject to standard security checks." },
          { q: "Is my capital safe?", a: "Funds sit in segregated wallets with multi-sig cold-storage custody. The AI cannot move or withdraw your principal." },
          { q: "Do I need any trading experience?", a: "None. You only choose a risk tier — the AI handles markets, sizing, execution and risk." },
        ]}
      />

      {/* FINAL CTA */}
      <CtaBand
        title="Activate your AI portfolio"
        subtitle="Start with $10 and watch the engine work."
      />
    </MarketingShell>
  );
}
