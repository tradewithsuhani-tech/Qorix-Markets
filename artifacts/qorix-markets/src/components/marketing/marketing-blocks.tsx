import { ReactNode, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Quote,
  Star,
  Users,
  TrendingUp,
  Wallet,
  Globe2,
  Sparkles,
} from "lucide-react";
import { faqJsonLd, reviewJsonLd } from "@/lib/seo";
import { trackCta } from "@/lib/analytics";
import { withRef } from "@/lib/referral";

function StatSpark({ points, up = true }: { points: number[]; up?: boolean }) {
  const w = 80;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = up ? "#10b981" : "#ef4444";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatsSection() {
  const stats = [
    {
      icon: Users,
      label: "Active investors",
      value: "12,400+",
      delta: "+248 this week",
      trend: [10, 12, 11, 14, 16, 15, 18, 20, 22, 24, 26, 28],
      code: "USR.LIVE",
    },
    {
      icon: Wallet,
      label: "Total payouts",
      value: "$8.4M+",
      delta: "+$184K · 30D",
      trend: [4, 5, 5.4, 6, 6.3, 6.8, 7.1, 7.4, 7.8, 8.0, 8.2, 8.4],
      code: "PAY.30D",
    },
    {
      icon: TrendingUp,
      label: "Avg monthly return",
      value: "6.0%",
      delta: "+0.4% vs Q1",
      trend: [4.8, 5.1, 5.0, 5.3, 5.5, 5.4, 5.7, 5.9, 5.8, 6.0, 6.1, 6.0],
      code: "ROI.MTD",
    },
    {
      icon: Globe2,
      label: "Countries served",
      value: "60+",
      delta: "3 new regions",
      trend: [42, 44, 46, 48, 50, 52, 54, 55, 57, 58, 59, 60],
      code: "GEO.ALL",
    },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative rounded-2xl p-4 md:p-5 overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(16,185,129,0.04), rgba(8,12,24,0.6))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* corner glow */}
            <div
              aria-hidden
              className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl opacity-40"
              style={{ background: "rgba(16,185,129,0.45)" }}
            />

            {/* top row: icon + code + live pulse */}
            <div className="relative flex items-center justify-between mb-3">
              <div
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <s.icon size={16} className="text-emerald-300" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500 tracking-wider">
                  {s.code}
                </span>
              </div>
            </div>

            {/* main value */}
            <div className="relative text-2xl md:text-3xl font-black text-white tabular-nums leading-tight">
              {s.value}
            </div>
            <div className="relative text-[11px] uppercase tracking-wider text-slate-500 mt-1">
              {s.label}
            </div>

            {/* footer: delta + sparkline */}
            <div className="relative mt-3 pt-3 flex items-end justify-between gap-2 border-t border-white/5">
              <span className="text-[10px] font-bold text-emerald-400 tabular-nums leading-tight">
                ↑ {s.delta}
              </span>
              <StatSpark points={s.trend} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PartnersSection() {
  const partners = [
    {
      name: "WinProFX",
      tagline: "Trade. Win. Prosper.",
      description:
        "A globally recognised forex & CFD broker providing advanced trading infrastructure, liquidity, and professional execution — powering Qorix Markets' trading desk.",
      tags: ["Advanced Execution", "Global Liquidity", "Professional Desk"],
      icon: TrendingUp,
      accent: { border: "rgba(16,185,129,0.2)", bg: "rgba(16,185,129,0.05)", iconBg: "rgba(16,185,129,0.12)", iconBorder: "rgba(16,185,129,0.25)", tagBg: "rgba(16,185,129,0.1)", tagBorder: "rgba(16,185,129,0.2)", iconColor: "text-emerald-400", tagColor: "text-emerald-300", labelColor: "text-emerald-400", glow: "rgba(16,185,129,0.35)" },
    },
    {
      name: "Star Trader",
      tagline: "Elite Trading Solutions",
      description:
        "An elite proprietary trading firm bringing institutional strategies, signal expertise, and market intelligence that directly benefits Qorix Markets investors.",
      tags: ["Institutional Signals", "Market Intelligence", "Elite Strategies"],
      icon: Sparkles,
      accent: { border: "rgba(245,158,11,0.2)", bg: "rgba(245,158,11,0.05)", iconBg: "rgba(245,158,11,0.12)", iconBorder: "rgba(245,158,11,0.25)", tagBg: "rgba(245,158,11,0.1)", tagBorder: "rgba(245,158,11,0.2)", iconColor: "text-amber-400", tagColor: "text-amber-300", labelColor: "text-amber-400", glow: "rgba(245,158,11,0.3)" },
    },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="text-center mb-10">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
          Trusted Partnerships
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Stronger Together</h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Qorix Markets collaborates with industry-leading trading firms to deliver deeper liquidity and stronger results for every investor.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {partners.map((p) => (
          <div
            key={p.name}
            className="relative rounded-2xl p-6 flex flex-col gap-4 overflow-hidden"
            style={{ background: p.accent.bg, border: `1px solid ${p.accent.border}` }}
          >
            <div
              aria-hidden
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-40"
              style={{ background: p.accent.glow }}
            />
            <div className="relative flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: p.accent.iconBg, border: `1px solid ${p.accent.iconBorder}` }}
              >
                <p.icon size={18} className={p.accent.iconColor} />
              </div>
              <div>
                <div className="font-bold text-white text-base leading-tight">{p.name}</div>
                <div className={`text-[11px] font-semibold uppercase tracking-wider ${p.accent.labelColor}`}>{p.tagline}</div>
              </div>
            </div>
            <p className="relative text-sm text-slate-400 leading-relaxed flex-1">{p.description}</p>
            <div className="relative flex flex-wrap gap-2">
              {p.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${p.accent.tagColor}`}
                  style={{ background: p.accent.tagBg, border: `1px solid ${p.accent.tagBorder}` }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <p className="text-xs text-slate-500 text-center sm:text-left max-w-sm">
          These partnerships enable consistent results, deeper liquidity, and a stronger trading edge for every investor.
        </p>
        <Link
          href="/partners"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shrink-0"
          style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}
        >
          Become a Partner
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

export function FeatureGrid({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: { icon?: ReactNode; title: string; description: string }[];
}) {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-3">{title}</h2>
        {subtitle && <p className="text-slate-400">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-2xl p-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
              {it.icon ?? <CheckCircle2 size={18} className="text-emerald-300" />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{it.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{it.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export const TESTIMONIALS = [
  {
    name: "Karan C.",
    title: "Software engineer, India",
    quote:
      "I started with $10 just to test it. Six weeks later my portfolio is consistently green and the daily updates feel real, not hyped.",
    rating: 5,
  },
  {
    name: "Aisha R.",
    title: "Product designer, UAE",
    quote:
      "Zero fees actually means zero. I have used three brokers before and Qorix is the first one that does not nickel-and-dime me.",
    rating: 5,
  },
  {
    name: "Marco D.",
    title: "Small business owner, Italy",
    quote:
      "I wanted exposure to forex without the screen time. The AI desk handles it. I just check my dashboard once a week.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  // Inject Review schema so individual reviews + aggregate rating show up
  // as rich snippets in Google search results.
  const schema = useMemo(() => reviewJsonLd(TESTIMONIALS), []);
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-3">
          Loved by investors worldwide
        </h2>
        <p className="text-slate-400">
          Real reviews from real Qorix Markets users.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="rounded-2xl p-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <Quote size={18} className="text-emerald-400/70 mb-3" />
            <blockquote className="text-slate-200 leading-relaxed text-sm">
              {t.quote}
            </blockquote>
            <figcaption className="mt-5 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">{t.title}</div>
              </div>
              <div className="flex items-center gap-0.5 text-emerald-400">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={12} fill="currentColor" stroke="none" />
                ))}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function FaqSection({
  items,
  title = "Frequently asked questions",
}: {
  items: { q: string; a: string }[];
  title?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  // FAQPage schema → rich snippets with expandable Q/A directly on Google.
  const schema = useMemo(() => faqJsonLd(items), [items]);
  return (
    <section className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-4xl font-black text-white mb-3">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div
              key={it.q}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 p-5 text-left"
                aria-expanded={isOpen}
              >
                <h3 className="text-sm md:text-base font-semibold text-white">{it.q}</h3>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">
                  {it.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CtaBand({
  title = "Ready to start trading?",
  subtitle = "Join thousands of investors growing capital on autopilot.",
  ctaHref = "/signup",
  ctaLabel = "Create your free account",
  trackLocation = "cta_band",
}: {
  title?: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  trackLocation?: string;
}) {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 pb-16">
      <div
        className="rounded-3xl px-6 md:px-10 py-10 md:py-14 text-center relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(34,197,94,0.10))",
          border: "1px solid rgba(16,185,129,0.30)",
        }}
      >
        <h2 className="text-2xl md:text-4xl font-black text-white mb-3">{title}</h2>
        <p className="text-slate-300 max-w-xl mx-auto mb-6">{subtitle}</p>
        <Link
          href={withRef(ctaHref)}
          onClick={() => trackCta(ctaLabel, trackLocation)}
          className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
          style={{
            background: "linear-gradient(90deg,#10b981,#22c55e)",
            boxShadow: "0 14px 40px -12px rgba(16,185,129,0.55)",
          }}
        >
          {ctaLabel} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
