import { LegalLayout } from "@/components/legal-layout";
import { useSeo, SITE_URL } from "@/lib/seo";

export default function RegulationPage() {
  useSeo({
    title: "Regulatory Disclosure & Company Information — Qorix Markets",
    description:
      "Qorix Markets regulatory disclosure: company information, the nature of the service, jurisdiction, dispute resolution and customer protection measures for our automated AI trading platform.",
    canonical: "/legal/regulation",
    keywords:
      "qorix markets regulation, qorix markets license, qorix markets company info, automated ai trading platform compliance",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: `${SITE_URL}/legal/regulation`,
      name: "Regulatory Disclosure & Company Information",
      isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Qorix Markets" },
    },
  });

  return (
    <LegalLayout
      title="Regulatory Disclosure & Company Information"
      subtitle="Full transparency about who operates Qorix Markets, the nature of the service, and the protections in place for every user."
      effectiveDate="May 09, 2026"
      sections={[
        {
          title: "What Qorix Markets Is",
          content: (
            <>
              <p>
                Qorix Markets is an <strong className="text-white">automated AI trading
                technology platform</strong>. We provide software that executes
                rules-based trading strategies across Forex majors, Gold (XAU/USD),
                global indices and major Crypto pairs, with hard risk caps,
                transparent execution and on-chain USDT settlements.
              </p>
              <p>
                We are <strong className="text-white">not a licensed broker-dealer,
                investment adviser, or money manager</strong>. Users self-direct their
                participation in the automated strategies they choose. The platform
                does not provide personal investment advice, portfolio recommendations
                or guaranteed returns of any kind.
              </p>
            </>
          ),
        },
        {
          title: "Company Information",
          content: (
            <>
              <p>
                Qorix Markets operates as an automated trading software service.
                For all formal correspondence, support, complaints, or compliance
                queries, please reach us at:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong className="text-white">Support email:</strong>{" "}
                  support@qorixmarkets.com
                </li>
                <li>
                  <strong className="text-white">Compliance email:</strong>{" "}
                  compliance@qorixmarkets.com
                </li>
                <li>
                  <strong className="text-white">Website:</strong>{" "}
                  https://qorixmarkets.com
                </li>
              </ul>
              <p>
                Detailed entity and registration information is provided to users
                during onboarding (KYC) and on direct request to compliance.
              </p>
            </>
          ),
        },
        {
          title: "Regulatory Status",
          content: (
            <>
              <p>
                Qorix Markets is a <strong className="text-white">software platform</strong>{" "}
                and does not currently hold a financial services licence in any
                jurisdiction. We do not custody traditional fiat client funds, do
                not offer leverage, and do not act as a counterparty to user
                positions. All settlements are on-chain in USDT (TRC-20) directly
                to user-controlled wallets.
              </p>
              <p>
                The service is not directed at, and is not available to, residents
                of jurisdictions where the use of automated trading software or
                cryptocurrency-settled platforms is restricted or prohibited. It
                is the user's responsibility to ensure that their participation
                complies with the laws of their country of residence.
              </p>
              <p>
                Qorix Markets <strong className="text-white">does not service residents
                of</strong> the United States, Canada, the United Kingdom, the
                European Union member states, China, North Korea, Iran, Syria,
                Cuba, or any sanctioned jurisdiction listed by OFAC, the EU or
                the UN Security Council.
              </p>
            </>
          ),
        },
        {
          title: "AML, KYC and Sanctions Compliance",
          content: (
            <>
              <p>
                Qorix Markets enforces a tiered Know-Your-Customer (KYC) policy.
                Users may be required to verify their identity, source of funds
                and proof of address before withdrawing above platform thresholds.
                We screen all users against international sanctions lists and
                politically exposed persons (PEP) databases.
              </p>
              <p>
                Suspicious activity, including but not limited to multi-account
                abuse, structured deposits, and behaviour consistent with money
                laundering or terrorist financing, results in account suspension
                and reporting to the appropriate authorities.
              </p>
              <p>
                For our complete AML/KYC framework, see the{" "}
                <a href="/legal/aml-kyc" className="text-emerald-400 hover:underline">
                  AML / KYC policy
                </a>
                .
              </p>
            </>
          ),
        },
        {
          title: "Risk Warning",
          content: (
            <>
              <p>
                <strong className="text-white">Trading involves substantial risk
                and is not suitable for every investor.</strong> Past performance
                is not indicative of future results. Automated strategies can and
                do experience drawdowns, and full or partial loss of deposited
                capital is possible.
              </p>
              <p>
                Qorix Markets enforces hard, user-selected drawdown caps on every
                strategy as a structural safeguard, but no risk-management system
                eliminates loss entirely. Users should only participate with capital
                they can afford to lose, and should review the full{" "}
                <a href="/legal/risk-disclosure" className="text-emerald-400 hover:underline">
                  Risk Disclosure
                </a>{" "}
                before depositing.
              </p>
            </>
          ),
        },
        {
          title: "User Funds and Settlement",
          content: (
            <>
              <p>
                User deposits are held on-chain as USDT (TRC-20). Withdrawals are
                processed back to the user's nominated TRON wallet address. Qorix
                Markets does not commingle user balances with operating capital,
                and platform reserves are maintained in segregated wallets that can
                be audited on-chain.
              </p>
              <p>
                Withdrawals are processed automatically up to platform-published
                limits. Larger withdrawals may be subject to manual compliance
                review consistent with our AML policy.
              </p>
            </>
          ),
        },
        {
          title: "Complaints and Dispute Resolution",
          content: (
            <>
              <p>
                Users with a complaint should contact{" "}
                <strong className="text-white">support@qorixmarkets.com</strong> in
                the first instance. Complaints not resolved within 7 working days
                may be escalated to{" "}
                <strong className="text-white">compliance@qorixmarkets.com</strong>,
                which will provide a written response within 30 days.
              </p>
              <p>
                Where a dispute cannot be resolved through internal complaints
                handling, users may pursue independent legal remedies under the
                governing law set out in our{" "}
                <a href="/legal/terms" className="text-emerald-400 hover:underline">
                  Terms of Service
                </a>
                .
              </p>
            </>
          ),
        },
        {
          title: "Brand Disambiguation",
          content: (
            <>
              <p>
                Qorix Markets (qorixmarkets.com) is{" "}
                <strong className="text-white">an independent fintech platform</strong>{" "}
                and is not affiliated with, sponsored by, or endorsed by any
                similarly-named company in the automotive software industry
                (including but not limited to QORIX GmbH, the automotive
                middleware joint venture between KPIT Technologies and ZF
                Friedrichshafen). Any similarity in names is coincidental.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
