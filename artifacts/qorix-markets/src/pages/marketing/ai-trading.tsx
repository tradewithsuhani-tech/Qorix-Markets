import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { FeatureGrid, FaqSection, StatsSection, TestimonialsSection, CtaBand } from "@/components/marketing/marketing-blocks";
import { useSeo, SITE_URL } from "@/lib/seo";
import { Brain, Zap, ShieldCheck, Activity, LineChart, Target } from "lucide-react";

export default function AiTradingPage() {
  useSeo({
    title: "AI Trading Platform — Automated USDT Trading by Qorix",
    description:
      "Qorix Markets is an AI trading platform that scans forex, gold, indices, and crypto in real time and executes risk-managed trades for you. Start from $10.",
    canonical: "/ai-trading-platform",
    keywords: "ai trading platform, automated trading, ai trading bot, algo trading",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Qorix AI Trading Platform",
      description: "AI-managed multi-asset trading platform with zero commissions.",
      brand: { "@type": "Brand", name: "Qorix Markets" },
      url: `${SITE_URL}/ai-trading-platform`,
      offers: { "@type": "Offer", price: "10", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "1240" },
    },
  });

  return (
    <MarketingShell>
      <MarketingHero
        badge="AI Trading Platform"
        title={
          <>
            Let AI <span className="text-emerald-300">trade for you</span> 24/7
          </>
        }
        subtitle="Our AI engine analyzes thousands of cross-asset signals every minute and executes risk-managed orders on your behalf — across forex, gold, indices, and crypto majors."
        secondaryHref="/blog/how-ai-trading-works"
        secondaryLabel="How it works"
      />

      <FeatureGrid
        title="Engineered for consistent monthly returns"
        subtitle="Six pillars that turn raw market data into compounding capital."
        items={[
          { icon: <Brain size={18} className="text-emerald-300" />, title: "Real-time signal engine", description: "Tick-level ingestion across major exchanges, normalized into model-ready features in milliseconds." },
          { icon: <Zap size={18} className="text-emerald-300" />, title: "Sub-second execution", description: "Direct routing to liquidity venues. Slippage is measured, logged, and optimized continuously." },
          { icon: <ShieldCheck size={18} className="text-emerald-300" />, title: "Hard risk caps", description: "Per-trade stop-losses and per-tier daily drawdown limits. Strategies auto-pause if breached." },
          { icon: <Activity size={18} className="text-emerald-300" />, title: "Multi-asset desks", description: "Forex majors, gold, indices, and crypto majors — diversified and rebalanced daily." },
          { icon: <LineChart size={18} className="text-emerald-300" />, title: "Live transparency", description: "Every trade, P/L, and equity tick posted to your dashboard in real time." },
          { icon: <Target size={18} className="text-emerald-300" />, title: "Tier-based targeting", description: "Conservative 4%, Balanced 6%, Aggressive 8% per month — you pick the profile." },
        ]}
      />

      <StatsSection />
      <TestimonialsSection />

      <FaqSection
        items={[
          { q: "What markets does the AI trade?", a: "Forex majors (EURUSD, GBPUSD, USDJPY, etc.), gold (XAU), major equity indices (US500, NAS100), and crypto majors (BTC, ETH)." },
          { q: "How is this different from a regular trading bot?", a: "Most bots run a single strategy on a single asset. Qorix orchestrates multiple desks across uncorrelated markets and dynamically allocates capital based on conditions." },
          { q: "Do I need any trading knowledge?", a: "No. You only pick a risk tier. The AI handles markets, sizing, execution, and risk." },
          { q: "Can I pause or stop?", a: "Yes. Stop or pause from your dashboard at any time. Your capital and any earned profits remain yours." },
        ]}
      />

      <CtaBand title="Activate your AI portfolio" subtitle="Start with $10 and watch the engine work." />
    </MarketingShell>
  );
}
