import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { StatsSection, FeatureGrid, CtaBand } from "@/components/marketing/marketing-blocks";
import { useSeo, SITE_URL } from "@/lib/seo";
import { ShieldCheck, Brain, Rocket, Heart } from "lucide-react";

export default function AboutPage() {
  useSeo({
    title: "About Qorix Markets — Our Mission and Team",
    description:
      "Qorix Markets is a global automated AI trading platform for Forex, Gold and Crypto, built for everyday investors. Learn about our mission, team, and approach to risk.",
    canonical: "/about",
    keywords: "about qorix markets, ai trading company, qorix team",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      url: `${SITE_URL}/about`,
      name: "About Qorix Markets",
      isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Qorix Markets" },
    },
  });

  return (
    <MarketingShell>
      <MarketingHero
        badge="About us"
        title={
          <>
            Building the worlds most <span className="text-emerald-300">trusted</span> AI trading desk
          </>
        }
        subtitle="We are a team of traders, engineers, and risk managers on a mission to bring institutional-quality trading to everyday investors — at zero fees, starting from $10."
      />

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-10 text-slate-300 leading-relaxed space-y-5">
        <h2 className="text-2xl md:text-3xl font-black text-white">Our story</h2>
        <p>
          Qorix Markets was founded in 2024 by a small group of trading
          professionals who watched too many friends and family members lose
          money to predatory brokers, hidden fees, and impossible learning
          curves. We believed there was a better way.
        </p>
        <p>
          Today, our AI engine and managed desks operate around the clock
          across forex, gold, indices, and crypto majors. Every order is
          risk-checked, every position is sized, and every dollar of profit is
          posted to our investors in real time on a transparent dashboard.
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-white pt-4">What we believe</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Investors deserve transparent fees — and zero is the right number for trades.</li>
          <li>You should not need a finance degree to grow your money.</li>
          <li>Risk management is more important than upside.</li>
          <li>Every claim should be backed by data on a live dashboard.</li>
        </ul>
      </section>

      <StatsSection />

      <FeatureGrid
        title="What makes us different"
        items={[
          { icon: <Brain size={18} className="text-emerald-300" />, title: "AI-first execution", description: "Models trained on years of cross-asset tick data drive every trade decision." },
          { icon: <ShieldCheck size={18} className="text-emerald-300" />, title: "Hard risk caps", description: "Drawdown limits auto-pause strategies. Your capital is protected first." },
          { icon: <Rocket size={18} className="text-emerald-300" />, title: "Built for compounding", description: "Auto-Compound reinvests profits daily so your capital grows on autopilot." },
          { icon: <Heart size={18} className="text-emerald-300" />, title: "Investor-first design", description: "No hidden fees. No lock-ins. Withdraw anytime in USDT." },
        ]}
      />

      <CtaBand />
    </MarketingShell>
  );
}
