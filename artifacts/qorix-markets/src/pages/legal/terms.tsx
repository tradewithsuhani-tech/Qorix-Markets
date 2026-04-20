import { LegalLayout } from "@/components/legal-layout";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      subtitle="By accessing or using the QorixMarkets platform, you agree to be bound by these Terms and Conditions. Please read them carefully before registering an account or depositing funds."
      effectiveDate="April 20, 2025"
      sections={[
        {
          title: "Platform Usage",
          content: (
            <>
              <p>QorixMarkets ("the Platform") provides investors with access to a professionally managed USDT trading desk. By creating an account, you confirm that you are at least 18 years of age, have the legal capacity to enter into a binding agreement, and are accessing the Platform in a jurisdiction where doing so is lawful.</p>
              <p>The Platform is provided on an "as-is" basis. We reserve the right to modify, suspend, or discontinue any feature or service at any time without prior notice. Continued use of the Platform following any modification constitutes acceptance of the updated Terms.</p>
              <p>You agree not to misuse the Platform, including but not limited to: attempting to gain unauthorized access to any part of the system, interfering with the integrity of the Platform's operations, or using automated tools to extract data without written consent.</p>
            </>
          ),
        },
        {
          title: "Investment Disclaimer",
          content: (
            <>
              <p>All capital placed through QorixMarkets is deployed into active USDT trading strategies managed by professional traders. QorixMarkets does not guarantee any specific level of return on investment. All stated performance figures — including historical monthly returns, win rates, and AUM — reflect past performance only and are not indicative of future results.</p>
              <p>You acknowledge and accept that the value of your investment may decrease as well as increase. You must not invest capital that you cannot afford to lose. QorixMarkets strongly recommends consulting an independent financial advisor before committing funds.</p>
              <p>The Platform is not a bank, broker-dealer, investment adviser, or regulated financial institution under any jurisdiction unless explicitly stated. Nothing on the Platform constitutes personalized investment advice.</p>
            </>
          ),
        },
        {
          title: "Withdrawal Rules",
          content: (
            <>
              <p>Withdrawal requests are processed in accordance with the Platform's payout schedule. Standard withdrawal processing takes between 1–5 business days depending on network conditions and internal compliance checks. Expedited withdrawals may be subject to applicable fees.</p>
              <p>Withdrawals are settled in USDT via the TRC20 network to the wallet address registered on your account. QorixMarkets is not liable for losses arising from incorrect wallet addresses provided by users. All submitted withdrawal addresses are treated as final and irreversible.</p>
              <p>The Platform reserves the right to place a temporary hold on withdrawals where suspicious activity is detected, an account verification is pending, or the request triggers an AML/KYC review. You will be notified of any such hold within 48 hours.</p>
            </>
          ),
        },
        {
          title: "Risk Clause",
          content: (
            <>
              <p>Trading in cryptocurrency markets involves substantial risk of loss. Market volatility, technical failures, liquidity constraints, and geopolitical events can all adversely affect trading outcomes. By investing through the Platform, you explicitly accept these risks.</p>
              <p>QorixMarkets employs drawdown protection mechanisms, including risk tier selection and auto-pause logic. However, these mechanisms do not eliminate the risk of loss — they are designed to limit exposure, not to guarantee capital preservation. In extreme market conditions, actual drawdown may exceed defined thresholds before protective measures can be activated.</p>
              <p>The Platform, its directors, employees, and affiliates shall not be held liable for any direct, indirect, incidental, or consequential loss arising from use of the Platform or reliance on any information provided therein.</p>
            </>
          ),
        },
        {
          title: "Account Suspension",
          content: (
            <>
              <p>QorixMarkets reserves the right to suspend, restrict, or permanently close any account at its discretion, including but not limited to cases involving: suspected fraudulent activity, violation of these Terms, failure to complete identity verification, provision of false or misleading information, or conduct that poses a risk to the Platform or other investors.</p>
              <p>In the event of account suspension, funds held in your main wallet will be made available for withdrawal following the resolution of any outstanding compliance review. During a suspension period, trading and deposit functions will be disabled.</p>
              <p>Users who believe their account has been suspended in error may submit a formal review request via the Platform's support channel. QorixMarkets will respond within 5 business days of receipt.</p>
            </>
          ),
        },
        {
          title: "Governing Law & Disputes",
          content: (
            <>
              <p>These Terms are governed by and construed in accordance with applicable international commercial law. Any dispute arising from or in connection with these Terms shall first be submitted to good-faith mediation. If mediation fails, disputes shall be resolved by binding arbitration.</p>
              <p>By using the Platform, you waive the right to participate in a class action lawsuit or class-wide arbitration against QorixMarkets or any of its affiliates. These Terms constitute the entire agreement between you and QorixMarkets with respect to the Platform.</p>
            </>
          ),
        },
      ]}
    />
  );
}
