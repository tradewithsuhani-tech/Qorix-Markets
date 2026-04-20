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
              <p>QorixMarkets ("the Platform") provides investors with access to a professionally managed USD trading desk. By creating an account, you confirm that you are at least 18 years of age, have the legal capacity to enter into a binding agreement, and are accessing the Platform in a jurisdiction where doing so is lawful.</p>
              <p>The Platform is provided on an "as-is" basis. We reserve the right to modify, suspend, or discontinue any feature or service at any time without prior notice. Continued use of the Platform following any modification constitutes acceptance of the updated Terms.</p>
              <p>You agree not to misuse the Platform, including but not limited to: attempting to gain unauthorized access to any part of the system, interfering with the integrity of the Platform's operations, or using automated tools to extract data without written consent.</p>
            </>
          ),
        },
        {
          title: "Investment Disclaimer",
          content: (
            <>
              <p>All capital placed through QorixMarkets is deployed into professionally managed USD trading strategies across three active desks: scalping, swing, and hybrid arbitrage. Each allocation is managed by experienced traders operating under strict risk parameters and systematic capital allocation logic.</p>
              <p>QorixMarkets maintains a strong track record of consistent monthly returns, delivered through disciplined execution, drawdown protection, and diversified strategy management. Performance data presented on the Platform reflects the results of real trading activity conducted through the managed desk system.</p>
              <p>All investors receive access to a live reporting dashboard showing their allocation, profit balance, desk performance, and withdrawal history in real time.</p>
            </>
          ),
        },
        {
          title: "Withdrawal Rules",
          content: (
            <>
              <p>Withdrawal requests are processed in accordance with the Platform's payout schedule. Standard withdrawal processing takes between 1–5 business days depending on network conditions and internal compliance checks. Expedited withdrawals may be subject to applicable fees.</p>
              <p>Withdrawals are settled in USD to the wallet address registered on your account. QorixMarkets is not liable for losses arising from incorrect wallet addresses provided by users. All submitted withdrawal addresses are treated as final and irreversible. Investors are encouraged to double-check their withdrawal address before submitting a request.</p>
              <p>The Platform reserves the right to place a temporary hold on withdrawals where suspicious activity is detected, an account verification is pending, or the request triggers an AML/KYC review. You will be notified of any such hold within 48 hours.</p>
            </>
          ),
        },
        {
          title: "Capital Protection Clause",
          content: (
            <>
              <p>QorixMarkets operates with a risk-first mandate, meaning every investor allocation begins with a defined protection ceiling before any capital is deployed. Investors select from three risk tiers — Conservative (3%), Balanced (5%), or Growth (10%) — each of which defines the maximum permitted drawdown before the system automatically pauses trading activity.</p>
              <p>The Platform's capital protection mechanisms include: real-time equity monitoring across all active positions, automated pause logic that activates if the drawdown threshold is approached, dedicated profit wallets that hold earnings separately from trading capital, and daily reporting to keep investors fully informed at all times.</p>
              <p>All investments are managed with the explicit objective of preserving capital while generating consistent monthly returns. The Platform, its management, and its trading desk operate in the interests of investor success.</p>
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
