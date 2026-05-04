import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { FeatureGrid, FaqSection, StatsSection, TestimonialsSection, CtaBand } from "@/components/marketing/marketing-blocks";
import { useSeo } from "@/lib/seo";
import { Sparkles, Wallet, Zap, ShieldCheck, TrendingUp, Smartphone } from "lucide-react";

export default function LowInvestmentPage() {
  useSeo({
    title: "Low Investment Trading — Start From $10 on Qorix Markets",
    description:
      "Start a real managed trading portfolio with as little as $10 of USDT. No fees, no minimums beyond $10, and your capital is in trading within minutes.",
    canonical: "/low-investment-trading",
    keywords: "low investment trading, start with 10 dollars, micro investing, small budget trading",
  });

  return (
    <MarketingShell>
      <MarketingHero
        badge="Start Small"
        title={
          <>
            Start trading with just <span className="text-emerald-300">$10</span>
          </>
        }
        subtitle="No more $500 minimums. Activate a real AI-managed portfolio with $10 of USDT and grow at your own pace."
        secondaryHref="/blog/start-trading-with-10-dollars"
        secondaryLabel="Read the step-by-step"
      />

      <FeatureGrid
        title="Why low minimums matter"
        subtitle="A platform built for everyone, not just whales."
        items={[
          { icon: <Wallet size={18} className="text-emerald-300" />, title: "$10 minimum", description: "The lowest barrier to real, managed trading anywhere." },
          { icon: <Zap size={18} className="text-emerald-300" />, title: "Live in minutes", description: "Sign up, deposit USDT, pick a tier, activate. No waiting on bank wires." },
          { icon: <Smartphone size={18} className="text-emerald-300" />, title: "Mobile-first", description: "Manage your portfolio from your phone — install Qorix as a PWA in one tap." },
          { icon: <ShieldCheck size={18} className="text-emerald-300" />, title: "Same risk controls", description: "$10 portfolios get the same drawdown caps and risk management as $10,000 ones." },
          { icon: <TrendingUp size={18} className="text-emerald-300" />, title: "Compound your way up", description: "Auto-Compound turns daily profits into capital, growing your base over time." },
          { icon: <Sparkles size={18} className="text-emerald-300" />, title: "Add anytime", description: "Top up whenever you are ready. No tiers, no lock-ins." },
        ]}
      />

      <StatsSection />
      <TestimonialsSection />

      <FaqSection
        items={[
          { q: "Is $10 really enough to make money?", a: "Returns are proportional to capital. $10 grows slowly in absolute terms, but it lets you experience the platform with skin in the game and add capital as your confidence grows." },
          { q: "What can I expect monthly on $10?", a: "Roughly $0.40 to $0.80 per month depending on the risk tier. Modest, but real and yours." },
          { q: "Can I add more later?", a: "Absolutely. You can top up your portfolio at any time and the AI will manage the new capital from the next trading day." },
          { q: "Are there any fees on a $10 deposit?", a: "Zero platform fees. You will pay only the small USDT network fee on the deposit (typically under $1 on TRC20)." },
        ]}
      />

      <CtaBand title="Activate your $10 portfolio" subtitle="No fees. No minimums beyond $10. No catch." />
    </MarketingShell>
  );
}
