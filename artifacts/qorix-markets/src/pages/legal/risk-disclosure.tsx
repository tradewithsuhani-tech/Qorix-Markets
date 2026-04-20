import { LegalLayout } from "@/components/legal-layout";

export default function RiskDisclosurePage() {
  return (
    <LegalLayout
      title="Risk Disclosure"
      subtitle="This document sets out the material risks associated with using the QorixMarkets platform. It is important that you read and understand this disclosure fully before investing any capital."
      effectiveDate="April 20, 2025"
      sections={[
        {
          title: "Market Risk",
          content: (
            <>
              <p>Cryptocurrency markets — including USDT-paired instruments — are subject to significant and unpredictable price volatility. Market conditions can change rapidly and without warning due to factors including macroeconomic announcements, regulatory developments, exchange liquidity shifts, and large-scale participant behavior.</p>
              <p>QorixMarkets deploys capital across three active trading strategies: scalping, swing trading, and hybrid/arbitrage. Each strategy carries its own exposure to intraday price movements, trend reversals, and liquidity gaps. While professional risk management practices are applied across all desks, no strategy is immune to adverse market conditions.</p>
              <p>Investors should be aware that open positions may experience rapid mark-to-market losses before any protective mechanism can be triggered. Short-term volatility may temporarily reduce your account balance even if the strategy is performing within acceptable long-term parameters.</p>
            </>
          ),
        },
        {
          title: "No Guaranteed Returns",
          content: (
            <>
              <p>QorixMarkets does not guarantee any specific return on investment, whether monthly, annual, or over any other period. All historical performance data — including average monthly returns, win rates, and equity curves displayed on the Platform — is presented for informational purposes only and reflects past results.</p>
              <p>Past performance is not a reliable indicator of future results. The trading strategies employed on the Platform may perform materially differently in future market environments compared to historical periods. No forward-looking return projection should be construed as a promise or commitment.</p>
              <p>Any verbal or written statements by Platform representatives that suggest guaranteed returns are not authorised and should not be relied upon. If you have received such a statement, please report it immediately to <strong className="text-white">compliance@qorixmarkets.com</strong>.</p>
            </>
          ),
        },
        {
          title: "Drawdown and Capital Loss",
          content: (
            <>
              <p>A <strong className="text-white">drawdown</strong> refers to a decline in the value of your invested capital from a peak to a subsequent trough. Drawdowns are a normal and expected component of any active trading strategy. The magnitude and duration of any drawdown depends on market conditions, strategy type, and position sizing.</p>
              <p>QorixMarkets provides investors with the ability to select a risk tier — conservative (3%), balanced (5%), or growth (10%) — which defines the maximum permitted drawdown threshold for their allocation. When this threshold is reached, the system pauses active trading exposure to protect remaining capital.</p>
              <p>However, investors must understand that:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>The drawdown protection mechanism is a risk mitigation tool, not a capital guarantee</li>
                <li>In fast-moving or illiquid markets, the actual drawdown at the time of pause execution may exceed the selected threshold due to price slippage or execution gaps</li>
                <li>Repeated drawdown events across multiple investment cycles can result in cumulative capital reduction</li>
                <li>A paused allocation does not earn returns during the inactive period</li>
              </ul>
            </>
          ),
        },
        {
          title: "Liquidity Risk",
          content: (
            <>
              <p>Liquidity risk refers to the possibility that an asset cannot be bought or sold quickly enough to prevent a loss, or that the market depth is insufficient to execute trades at expected prices. In cryptocurrency markets, liquidity can deteriorate rapidly — particularly during high-volatility events — leading to wider spreads and increased slippage.</p>
              <p>During periods of low liquidity, the trading desk may be unable to execute strategies as intended, which could result in delayed entries, larger drawdowns, or temporary suspension of trading activity. Investors should not assume that trading activity will be continuous at all times.</p>
            </>
          ),
        },
        {
          title: "Technology and Operational Risk",
          content: (
            <>
              <p>The Platform relies on software systems, third-party infrastructure, and network connectivity that may be subject to outages, bugs, cyberattacks, or other technical failures. Such events could temporarily prevent access to your account, delay transaction processing, or result in data inconsistencies.</p>
              <p>QorixMarkets maintains backup systems and disaster recovery protocols to minimise downtime. However, we cannot guarantee uninterrupted service. Investors should not rely on the Platform as their sole record of transactions — we recommend regularly reviewing and saving your transaction history.</p>
            </>
          ),
        },
        {
          title: "Regulatory Risk",
          content: (
            <>
              <p>The regulatory environment for cryptocurrency trading and investment platforms continues to evolve globally. Changes in laws or regulations in any relevant jurisdiction could affect the Platform's ability to operate, restrict access for users in certain countries, or require changes to the services offered.</p>
              <p>It is your responsibility to ensure that using QorixMarkets is lawful in your country of residence. QorixMarkets does not provide legal or tax advice. You should consult qualified local advisers regarding the regulatory and tax treatment of your investments.</p>
            </>
          ),
        },
        {
          title: "Investor Acknowledgement",
          content: (
            <>
              <p>By depositing funds and activating an investment on the QorixMarkets platform, you confirm that:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>You have read and understood this Risk Disclosure in full</li>
                <li>You accept all risks described herein as a condition of using the Platform</li>
                <li>You are investing with capital you can afford to lose without material impact to your financial situation</li>
                <li>You have not relied on any guaranteed return representations in making your investment decision</li>
                <li>You understand that drawdown protection mechanisms limit but do not eliminate the risk of loss</li>
              </ul>
            </>
          ),
        },
      ]}
    />
  );
}
