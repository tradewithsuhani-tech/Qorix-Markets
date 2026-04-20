import { LegalLayout } from "@/components/legal-layout";

export default function RiskDisclosurePage() {
  return (
    <LegalLayout
      title="Investment Protection"
      subtitle="QorixMarkets is built around a single principle: protect capital first, then grow it. This document explains the protections in place for every investor on the platform."
      effectiveDate="April 20, 2025"
      sections={[
        {
          title: "How Your Capital Is Protected",
          content: (
            <>
              <p>Every investment on QorixMarkets begins with a protection mandate, not a return target. Before any capital is deployed to the trading desk, the investor selects a risk tier that defines the absolute maximum permitted drawdown. The system enforces this ceiling automatically — no manual intervention is required.</p>
              <p>QorixMarkets deploys capital across three diversified strategies — scalping, swing trading, and hybrid/arbitrage — to reduce dependence on any single market condition. This multi-strategy approach is designed to smooth return distribution and reduce exposure to isolated market events.</p>
              <p>Professional traders on each desk apply entry discipline, position sizing rules, and stop management on every trade. Strategy performance is reviewed daily by the risk committee, and desks can be paused or rebalanced based on market conditions.</p>
            </>
          ),
        },
        {
          title: "Consistent Performance Record",
          content: (
            <>
              <p>QorixMarkets has maintained positive monthly returns across 10 consecutive trading periods. The platform's average monthly return reflects disciplined execution across three active desks, with drawdown episodes remaining well within the investor-defined parameters throughout all periods.</p>
              <p>Performance data available on the Platform — including equity curves, monthly return charts, and drawdown overlays — reflects real trading results from the managed desk system. Investors are encouraged to review the full performance history available in the Track Record section of the Platform.</p>
              <p>While past results reflect the quality of the platform's trading and risk management approach, investors can reference the full historical record to make informed allocation decisions.</p>
            </>
          ),
        },
        {
          title: "Drawdown Protection System",
          content: (
            <>
              <p>A <strong className="text-white">drawdown</strong> is a temporary decline in the value of an active allocation relative to a recent high. QorixMarkets has engineered a three-tier protection system specifically to manage and contain drawdown events:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Conservative tier (3% ceiling)</strong> — designed for capital-preservation-first investors seeking stable, low-volatility growth</li>
                <li><strong className="text-white">Balanced tier (5% ceiling)</strong> — designed for investors seeking optimised risk-adjusted returns with moderate exposure</li>
                <li><strong className="text-white">Growth tier (10% ceiling)</strong> — designed for investors with a higher return appetite and longer time horizon</li>
              </ul>
              <p>When a drawdown threshold is approached, the platform's monitoring system automatically reduces or pauses active trading exposure. This mechanism is continuously active during all trading sessions — your protection does not depend on you watching the markets.</p>
            </>
          ),
        },
        {
          title: "Profit Separation & Wallet Architecture",
          content: (
            <>
              <p>QorixMarkets uses a three-wallet architecture that keeps your trading capital, earned profits, and available balance cleanly separated at all times. This structure ensures that realised profits are never re-exposed to trading activity unless the investor explicitly chooses to compound them.</p>
              <p>The dedicated profit wallet accumulates returns as they are generated. Investors can transfer profits to their main wallet or request withdrawal at any time — on their own schedule, without requiring approval from the trading desk.</p>
              <p>This separation means that a drawdown event in an active allocation does not impact previously realised profits sitting in the profit wallet. Your earnings are protected independently of ongoing trading activity.</p>
            </>
          ),
        },
        {
          title: "Liquidity & Payout Reliability",
          content: (
            <>
              <p>QorixMarkets maintains a dedicated payout reserve to ensure that withdrawal requests are fulfilled promptly and do not interfere with desk trading operations. Investor liquidity is treated as a platform priority — not a secondary consideration.</p>
              <p>Standard withdrawal requests are processed within 1–5 business days. The payout queue is visible on the Platform's live activity feed, providing full transparency into the withdrawal pipeline. Investors can track the status of their request from submission to confirmation.</p>
            </>
          ),
        },
        {
          title: "Platform Security & Fund Safety",
          content: (
            <>
              <p>All funds managed through QorixMarkets are held in segregated wallets, ensuring that investor capital is never commingled with operational or corporate funds. This segregation provides a clear and auditable boundary between investor assets and platform operations.</p>
              <p>The Platform applies end-to-end TLS encryption, multi-factor authentication, device verification, and regular security audits to protect both investor accounts and deposited funds. All platform staff with access to financial systems operate under strict access controls and AML/KYC compliance obligations.</p>
            </>
          ),
        },
        {
          title: "Investor Commitment",
          content: (
            <>
              <p>QorixMarkets is committed to the long-term success of every investor on the Platform. By joining, investors become part of a carefully managed capital system where their interests — consistent returns, capital protection, and full transparency — are the primary design objectives.</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>You have reviewed and understood the platform's protection mechanisms</li>
                <li>You have selected a risk tier aligned with your investment goals</li>
                <li>You understand that the drawdown protection system actively monitors and limits exposure on your behalf</li>
                <li>You have access to real-time reporting, profit tracking, and withdrawal management at all times</li>
              </ul>
            </>
          ),
        },
      ]}
    />
  );
}
