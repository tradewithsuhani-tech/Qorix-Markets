import { useState } from "react";
import { Link } from "wouter";
import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { CtaBand } from "@/components/marketing/marketing-blocks";
import { useSeo, SITE_URL } from "@/lib/seo";
import {
  TrendingUp,
  Sparkles,
  DollarSign,
  Users,
  ShieldCheck,
  Zap,
  BarChart3,
  Headphones,
  Globe2,
  CheckCircle2,
  ArrowRight,
  Send,
  FileText,
  UserCheck,
  Rocket,
  Star,
} from "lucide-react";

export default function PartnersPage() {
  useSeo({
    title: "Become a Merchant Partner — Qorix Markets",
    description:
      "Join Qorix Markets as a Merchant Partner. Earn revenue sharing, get dedicated support, co-branding assets, and access to 12,400+ active investors. Apply today.",
    canonical: "/partners",
    keywords: "qorix markets merchant partner, become partner, trading affiliate, revenue sharing",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: `${SITE_URL}/partners`,
      name: "Become a Merchant Partner — Qorix Markets",
      isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Qorix Markets" },
    },
  });

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    partnerType: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Merchant Partner Application — ${form.company || form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nCompany: ${form.company}\nEmail: ${form.email}\nPhone: ${form.phone}\nWebsite: ${form.website}\nPartner Type: ${form.partnerType}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:partners@qorixmarkets.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <MarketingShell>
      <MarketingHero
        badge="Merchant Partner Program"
        title={
          <>
            Grow together with{" "}
            <span className="text-emerald-300">Qorix Markets</span>
          </>
        }
        subtitle="Join our exclusive Merchant Partner network — earn industry-leading revenue share, get dedicated support, and co-brand with a platform trusted by 12,400+ investors."
      />

      {/* ── PARTNER TYPES ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center mb-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
            Who can apply
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Partnership types
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Whether you are a broker, IB, influencer, or payment facilitator — there is a partnership model built for you.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: TrendingUp,
              title: "Introducing Broker (IB)",
              desc: "Refer traders and investors to Qorix Markets and earn a commission on every deposit they make. No cap on earnings.",
              color: "emerald",
            },
            {
              icon: Globe2,
              title: "Payment Merchant",
              desc: "Facilitate INR deposits and withdrawals for our investor base. Earn a spread on every transaction processed through your gateway.",
              color: "blue",
            },
            {
              icon: Sparkles,
              title: "Brand & Media Partner",
              desc: "Creators, influencers, and media houses. Promote Qorix Markets to your audience and earn performance-based revenue share.",
              color: "amber",
            },
            {
              icon: BarChart3,
              title: "Institutional / Fund",
              desc: "Manage capital for a group of investors? Partner with us for white-label solutions, API access, and bulk account management.",
              color: "purple",
            },
            {
              icon: Users,
              title: "Community Manager",
              desc: "Run a trading group or investment community? Get exclusive bonuses and tools to manage and reward your members.",
              color: "pink",
            },
            {
              icon: Zap,
              title: "Technology Partner",
              desc: "Fintech platforms, payment aggregators, and software providers — integrate with our API to offer automated trading to your users.",
              color: "cyan",
            },
          ].map((pt) => (
            <PartnerTypeCard key={pt.title} {...pt} />
          ))}
        </div>
      </section>

      {/* ── BENEFITS ─────────────────────────────────────────── */}
      <section
        className="py-12 md:py-16"
        style={{ background: "linear-gradient(180deg, transparent, rgba(16,185,129,0.04), transparent)" }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
              What you get
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
              Partner benefits
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: DollarSign,
                title: "Competitive Revenue Share",
                desc: "Earn up to 15% revenue share on every investor you bring. Commission is credited daily, automatically — no invoices, no delays.",
              },
              {
                icon: BarChart3,
                title: "Real-Time Partner Dashboard",
                desc: "Track your referrals, clicks, conversions, and earnings in a dedicated live dashboard with full transparency.",
              },
              {
                icon: ShieldCheck,
                title: "Co-Branding Assets",
                desc: "Access professionally designed banners, landing pages, social media creatives, and email templates — all co-branded with your identity.",
              },
              {
                icon: Headphones,
                title: "Dedicated Partner Manager",
                desc: "Every merchant partner gets a named account manager available via WhatsApp, email, and video call for onboarding and ongoing support.",
              },
              {
                icon: Zap,
                title: "Priority Processing",
                desc: "Your referred investors get priority KYC, faster onboarding, and dedicated support — making conversion and retention easy for you.",
              },
              {
                icon: Star,
                title: "Performance Bonuses",
                desc: "Hit monthly milestones and unlock cash bonuses, higher commission tiers, and exclusive co-marketing budgets.",
              },
              {
                icon: Globe2,
                title: "Multi-Currency Payouts",
                desc: "Receive your earnings in USDT (TRC20) directly to your wallet — instant, borderless, and fee-free.",
              },
              {
                icon: Users,
                title: "Sub-IB Network",
                desc: "Build your own network. Recruit sub-partners under your code and earn an additional tier of commissions from their activity.",
              },
            ].map((b) => (
              <BenefitRow key={b.title} {...b} />
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="text-center mb-10">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
            How it works
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Partner onboarding process
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            From application to first commission — typically 3–5 business days.
          </p>
        </div>
        <div className="relative">
          <div className="hidden md:block absolute left-[27px] top-8 bottom-8 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent" />
          <div className="space-y-6">
            {[
              {
                step: "01",
                icon: FileText,
                title: "Submit your application",
                desc: "Fill in the application form below with your details, business type, and partner goals. Takes less than 3 minutes.",
                time: "Day 1",
              },
              {
                step: "02",
                icon: UserCheck,
                title: "Review & verification",
                desc: "Our partnerships team reviews your application, verifies your identity and business, and assesses the best partnership model for you.",
                time: "Day 1–2",
              },
              {
                step: "03",
                icon: Headphones,
                title: "Onboarding call",
                desc: "Your dedicated partner manager schedules a 30-minute onboarding call to walk you through tools, links, dashboard, and commission structure.",
                time: "Day 2–3",
              },
              {
                step: "04",
                icon: ShieldCheck,
                title: "Agreement & credentials",
                desc: "Sign the digital partnership agreement. Receive your unique referral code, tracking links, and access to the partner dashboard.",
                time: "Day 3–4",
              },
              {
                step: "05",
                icon: Rocket,
                title: "Go live & start earning",
                desc: "You are active! Share your links, deploy co-branded assets, and watch your commission grow in real time on your dashboard.",
                time: "Day 4–5",
              },
            ].map((s, i) => (
              <ProcessStep key={s.step} {...s} isLast={i === 4} />
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMISSION TABLE ─────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-12 md:pb-16">
        <div className="text-center mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
            Earn more, refer more
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Commission tiers
          </h2>
        </div>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <th className="text-left px-5 py-3 text-slate-300 font-semibold">Tier</th>
                <th className="text-left px-5 py-3 text-slate-300 font-semibold">Monthly Referrals</th>
                <th className="text-left px-5 py-3 text-slate-300 font-semibold">Commission Rate</th>
                <th className="text-left px-5 py-3 text-slate-300 font-semibold hidden sm:table-cell">Bonus</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Starter", referrals: "1 – 5", rate: "5%", bonus: "—", highlight: false },
                { tier: "Silver", referrals: "6 – 15", rate: "8%", bonus: "$50 / month", highlight: false },
                { tier: "Gold", referrals: "16 – 30", rate: "10%", bonus: "$150 / month", highlight: false },
                { tier: "Platinum", referrals: "31 – 60", rate: "12%", bonus: "$400 / month", highlight: false },
                { tier: "Elite", referrals: "60+", rate: "15%", bonus: "Custom deal", highlight: true },
              ].map((row) => (
                <tr
                  key={row.tier}
                  style={{
                    background: row.highlight ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.01)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <td className="px-5 py-3.5 font-bold" style={{ color: row.highlight ? "#10b981" : "#fff" }}>
                    {row.highlight && <Star size={12} className="inline mr-1.5 text-emerald-400" />}
                    {row.tier}
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">{row.referrals}</td>
                  <td className="px-5 py-3.5 font-bold text-emerald-400">{row.rate}</td>
                  <td className="px-5 py-3.5 text-slate-400 hidden sm:table-cell">{row.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3 text-center">
          Commission is paid daily in USDT. Tiers reset monthly based on active referred investors.
        </p>
      </section>

      {/* ── APPLICATION FORM ─────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-16" id="apply">
        <div className="text-center mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
            Ready to join?
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Apply now
          </h2>
          <p className="text-slate-400 text-sm">
            Fill in the form and our partnerships team will reach out within 24 hours.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 md:p-8 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Full name" required>
              <input
                required
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />
            </Field>
            <Field label="Company / Brand name">
              <input
                placeholder="Optional"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />
            </Field>
            <Field label="Email address" required>
              <input
                required
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />
            </Field>
            <Field label="WhatsApp / Phone" required>
              <input
                required
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />
            </Field>
            <Field label="Website / Social profile">
              <input
                placeholder="https://yoursite.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />
            </Field>
            <Field label="Partnership type" required>
              <select
                required
                value={form.partnerType}
                onChange={(e) => setForm({ ...form, partnerType: e.target.value })}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="" disabled>Select type...</option>
                <option value="Introducing Broker (IB)">Introducing Broker (IB)</option>
                <option value="Payment Merchant">Payment Merchant</option>
                <option value="Brand & Media Partner">Brand & Media Partner</option>
                <option value="Institutional / Fund">Institutional / Fund</option>
                <option value="Community Manager">Community Manager</option>
                <option value="Technology Partner">Technology Partner</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Tell us about yourself & your goals" required>
            <textarea
              required
              rows={4}
              placeholder="Describe your audience, current business, and what you hope to achieve as a Qorix Markets partner..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40 resize-none"
            />
          </Field>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <p className="text-xs text-slate-500">
              By submitting you agree to our{" "}
              <Link href="/terms" className="text-emerald-400 hover:underline">Terms</Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>.
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shrink-0"
              style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}
            >
              <Send size={14} />
              {sent ? "Opening your email client..." : "Submit application"}
            </button>
          </div>

          {sent && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-emerald-300"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <CheckCircle2 size={16} className="shrink-0" />
              Application prepared! Your email client should open shortly. If not, email us directly at{" "}
              <a href="mailto:partners@qorixmarkets.com" className="underline">
                partners@qorixmarkets.com
              </a>
            </div>
          )}
        </form>
      </section>

      <CtaBand />
    </MarketingShell>
  );
}

function PartnerTypeCard({
  icon: Icon,
  title,
  desc,
  color,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
}) {
  const palette: Record<string, { bg: string; border: string; iconBg: string; iconBorder: string; text: string }> = {
    emerald: { bg: "rgba(16,185,129,0.05)", border: "rgba(16,185,129,0.18)", iconBg: "rgba(16,185,129,0.12)", iconBorder: "rgba(16,185,129,0.25)", text: "text-emerald-400" },
    blue:    { bg: "rgba(59,130,246,0.05)",  border: "rgba(59,130,246,0.18)",  iconBg: "rgba(59,130,246,0.12)",  iconBorder: "rgba(59,130,246,0.25)",  text: "text-blue-400" },
    amber:   { bg: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.18)",  iconBg: "rgba(245,158,11,0.12)",  iconBorder: "rgba(245,158,11,0.25)",  text: "text-amber-400" },
    purple:  { bg: "rgba(168,85,247,0.05)",  border: "rgba(168,85,247,0.18)",  iconBg: "rgba(168,85,247,0.12)",  iconBorder: "rgba(168,85,247,0.25)",  text: "text-purple-400" },
    pink:    { bg: "rgba(236,72,153,0.05)",  border: "rgba(236,72,153,0.18)",  iconBg: "rgba(236,72,153,0.12)",  iconBorder: "rgba(236,72,153,0.25)",  text: "text-pink-400" },
    cyan:    { bg: "rgba(6,182,212,0.05)",   border: "rgba(6,182,212,0.18)",   iconBg: "rgba(6,182,212,0.12)",   iconBorder: "rgba(6,182,212,0.25)",   text: "text-cyan-400" },
  };
  const p = palette[color] ?? palette.emerald;
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: p.bg, border: `1px solid ${p.border}` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: p.iconBg, border: `1px solid ${p.iconBorder}` }}
      >
        <Icon size={18} className={p.text} />
      </div>
      <h3 className="font-bold text-white text-sm">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="flex gap-4 rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
      >
        <Icon size={16} className="text-emerald-400" />
      </div>
      <div>
        <h3 className="font-bold text-white text-sm mb-1">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProcessStep({
  step,
  icon: Icon,
  title,
  desc,
  time,
  isLast,
}: {
  step: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  time: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
        >
          <Icon size={20} className="text-emerald-400" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-2 md:hidden" style={{ background: "rgba(16,185,129,0.2)" }} />
        )}
      </div>
      <div className="pb-8 flex-1">
        <div className="flex items-center gap-3 mb-1.5">
          <span
            className="text-[10px] font-black font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
          >
            {step}
          </span>
          <span className="text-xs text-slate-500 font-medium">{time}</span>
        </div>
        <h3 className="font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
        {label}
        {required && <span className="text-emerald-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
