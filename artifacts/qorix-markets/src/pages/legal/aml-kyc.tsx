import { LegalLayout } from "@/components/legal-layout";

export default function AmlKycPage() {
  return (
    <LegalLayout
      title="AML / KYC Policy"
      subtitle="QorixMarkets maintains a zero-tolerance stance against money laundering, terrorist financing, and financial fraud. This policy outlines our obligations and the requirements placed on all platform users."
      effectiveDate="April 20, 2025"
      sections={[
        {
          title: "Policy Overview",
          content: (
            <>
              <p>QorixMarkets is committed to full compliance with applicable Anti-Money Laundering (AML) and Counter-Terrorism Financing (CTF) obligations. This policy applies to all users, transactions, and activities conducted through the Platform, regardless of jurisdiction.</p>
              <p>Our AML/KYC program is designed to: prevent the Platform from being used as a vehicle for financial crime; verify the identity of all investors before funds are accepted; monitor transactional activity for unusual or suspicious patterns; and report suspicious activity to the appropriate authorities where legally required.</p>
              <p>All Platform staff with access to user accounts and financial data undergo mandatory AML training. Our compliance framework is reviewed and updated annually or whenever material regulatory changes occur.</p>
            </>
          ),
        },
        {
          title: "Know Your Customer (KYC) — Identity Verification",
          content: (
            <>
              <p>All users are required to complete identity verification before deposits are accepted or investments are activated. The KYC process requires submission of the following documentation:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Proof of Identity</strong> — a valid government-issued photo ID (passport, national identity card, or driver's licence). The document must be current, undamaged, and clearly legible.</li>
                <li><strong className="text-white">Proof of Address</strong> — a utility bill, bank statement, or official government correspondence dated within the last 3 months, showing your full name and residential address.</li>
                <li><strong className="text-white">Selfie Verification</strong> — a live photograph of the account holder holding their identity document, used to confirm that the submitted ID matches the account registrant.</li>
              </ul>
              <p>Enhanced due diligence (EDD) may be required for high-value accounts, Politically Exposed Persons (PEPs), or users identified through risk screening. EDD may include source-of-funds documentation, wealth declarations, or additional identity confirmation steps.</p>
              <p>KYC verification is typically processed within 24–48 hours of document submission. Users will be notified of approval or rejection via email. Incomplete or fraudulent submissions will result in immediate account suspension.</p>
            </>
          ),
        },
        {
          title: "Ongoing Transaction Monitoring",
          content: (
            <>
              <p>QorixMarkets employs automated and manual transaction monitoring systems to identify activity that may indicate money laundering, fraud, or other financial crime. Indicators that may trigger a review include, but are not limited to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Deposits or withdrawals that are unusually large relative to the user's stated financial profile</li>
                <li>Frequent small deposits structured to avoid reporting thresholds (structuring)</li>
                <li>Rapid deposit and withdrawal cycles with little or no intervening trading activity</li>
                <li>Transactions originating from or destined for high-risk jurisdictions or sanctioned addresses</li>
                <li>Use of multiple wallet addresses across a single account without clear explanation</li>
                <li>Account activity that is inconsistent with the user's declared purpose or investment objectives</li>
              </ul>
              <p>Where suspicious activity is detected, the relevant transactions will be placed on hold pending review. The user will be notified where legally permitted to do so. QorixMarkets may file a Suspicious Activity Report (SAR) with the relevant financial intelligence authority without informing the user (tipping-off prohibition).</p>
            </>
          ),
        },
        {
          title: "Fraud Prevention",
          content: (
            <>
              <p>QorixMarkets takes proactive steps to detect and prevent account fraud, identity fraud, and financial misrepresentation. Specific fraud prevention measures include:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Device fingerprinting and IP geolocation checks at login and during high-value transactions</li>
                <li>Automated alerts for login attempts from new devices or locations</li>
                <li>Withdrawal address change requests subject to a mandatory 24-hour security hold</li>
                <li>Pattern-of-life analysis to detect anomalous account behaviour relative to historical activity</li>
                <li>Cross-referencing of user details against global watchlists, PEP databases, and adverse media sources</li>
              </ul>
              <p>Any user who suspects their account has been compromised or subjected to fraudulent activity must contact <strong className="text-white">security@qorixmarkets.com</strong> immediately. We will initiate an emergency account review and apply a temporary withdrawal hold as a protective measure.</p>
            </>
          ),
        },
        {
          title: "Sanctions Compliance",
          content: (
            <>
              <p>QorixMarkets screens all users, transactions, and wallet addresses against applicable international sanctions lists, including those maintained by the UN Security Council, OFAC (US Treasury), HM Treasury (UK), and the EU. Access to the Platform is denied to individuals or entities that appear on any applicable sanctions list.</p>
              <p>The use of the Platform by sanctioned individuals, entities, or for transactions that would breach applicable sanctions law is strictly prohibited and will result in immediate account termination and mandatory reporting to the relevant authorities.</p>
            </>
          ),
        },
        {
          title: "Compliance Checks & User Obligations",
          content: (
            <>
              <p>As a condition of using QorixMarkets, all users agree to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Provide accurate, complete, and current personal and financial information at registration and upon request</li>
                <li>Cooperate fully with any KYC or AML review, including promptly supplying additional documentation when requested</li>
                <li>Notify QorixMarkets immediately of any change in their identity, residence, tax status, or source of funds</li>
                <li>Not use the Platform to process funds derived from or intended for criminal activity of any kind</li>
                <li>Not attempt to circumvent AML/KYC controls through the use of nominee accounts, false identities, or third-party wallets</li>
              </ul>
              <p>Failure to comply with these obligations will result in account suspension, forfeiture of pending transactions, and potential reporting to law enforcement. QorixMarkets reserves the right to refuse service to any user at its sole discretion where compliance concerns cannot be resolved.</p>
            </>
          ),
        },
        {
          title: "Record Keeping",
          content: (
            <>
              <p>QorixMarkets retains all KYC documentation and transaction records for a minimum of 5 years from the date of account closure, in accordance with standard financial compliance requirements. Records may be retained for longer periods where ongoing legal proceedings, regulatory investigations, or dispute resolution processes require it.</p>
              <p>All records are stored securely with restricted internal access. Retention and destruction of records is governed by our internal data management policy, which aligns with this AML/KYC framework.</p>
            </>
          ),
        },
      ]}
    />
  );
}
