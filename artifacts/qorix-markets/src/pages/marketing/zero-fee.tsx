import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { FeatureGrid, FaqSection, StatsSection, CtaBand } from "@/components/marketing/marketing-blocks";
import { useSeo } from "@/lib/seo";
import { CircleDollarSign, ShieldCheck, Wallet, Repeat, Eye, Handshake } from "lucide-react";

export default function ZeroFeePage() {
  useSeo({
    title: "Zero Trading Fees — Qorix Markets",
    description:
      "Trade with zero commissions, zero deposit fees, and zero account fees on Qorix Markets. See exactly how we make money so you can keep more of yours.",
    canonical: "/zero-trading-fee",
    keywords: "zero trading fee, no commission trading, no deposit fee, qorix fees",
  });

  return (
    <MarketingShell>
      <MarketingHero
        badge="Zero Fees"
        title={<>0% commission. <span className="text-emerald-300">Always.</span></>}
        subtitle="No deposit fees. No commission per trade. No monthly account fees. No inactivity penalties. Keep every dollar your capital earns."
        secondaryHref="/blog/zero-fee-trading-explained"
        secondaryLabel="How we make money"
      />

      <FeatureGrid
        title="The Qorix fee promise"
        subtitle="Other brokers nickel-and-dime users. We chose differently."
        items={[
          { icon: <CircleDollarSign size={18} className="text-emerald-300" />, title: "0% commission", description: "Every order is executed without per-trade commissions, ever." },
          { icon: <Wallet size={18} className="text-emerald-300" />, title: "Free USDT deposits", description: "Deposit any amount of USDT on TRC20 or BEP20 for free." },
          { icon: <Repeat size={18} className="text-emerald-300" />, title: "No swap fees", description: "Hold positions overnight without rollover or swap charges." },
          { icon: <ShieldCheck size={18} className="text-emerald-300" />, title: "No account fees", description: "Free to open. Free to keep. Free to close." },
          { icon: <Eye size={18} className="text-emerald-300" />, title: "Total transparency", description: "Every fee that does apply (network gas on withdrawals) is shown upfront." },
          { icon: <Handshake size={18} className="text-emerald-300" />, title: "Aligned incentives", description: "We earn only when your portfolio earns — never on your activity." },
        ]}
      />

      <StatsSection />

      <FaqSection
        items={[
          { q: "How does Qorix make money if there are no fees?", a: "Qorix earns a small share of profits on profitable months. If your portfolio does not earn, we do not earn either. This aligns our success with yours." },
          { q: "Are there any hidden costs?", a: "No. The only cost outside of the platform is the blockchain network fee charged by TRC20 or BEP20 when you withdraw — which goes to network validators, not to Qorix." },
          { q: "Is there a minimum deposit?", a: "Yes — $10 of USDT to activate a managed portfolio." },
          { q: "Are withdrawals free?", a: "Withdrawals on USDT are charged only the underlying network fee (typically under $1 on TRC20)." },
        ]}
      />

      <CtaBand title="Stop paying fees" subtitle="Move to a broker that charges you nothing per trade." />
    </MarketingShell>
  );
}
