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
} from "lucide-react";
import { faqJsonLd, reviewJsonLd } from "@/lib/seo";
import { trackCta } from "@/lib/analytics";
import { withRef } from "@/lib/referral";

export function StatsSection() {
  const stats = [
    { icon: Users, label: "Active investors", value: "12,400+" },
    { icon: Wallet, label: "Total payouts", value: "$8.4M+" },
    { icon: TrendingUp, label: "Avg monthly return", value: "6.0%" },
    { icon: Globe2, label: "Countries served", value: "60+" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5 text-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <s.icon size={16} className="text-emerald-300" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-white tabular-nums">
              {s.value}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">
              {s.label}
            </div>
          </div>
        ))}
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
              <div className="flex items-center gap-0.5 text-amber-400">
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
            "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(59,130,246,0.10))",
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
