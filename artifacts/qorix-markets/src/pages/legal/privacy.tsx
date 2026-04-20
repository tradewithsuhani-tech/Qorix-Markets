import { LegalLayout } from "@/components/legal-layout";

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="QorixMarkets is committed to protecting the personal information of its users. This Privacy Policy explains what data we collect, how we use it, and the rights you have over your information."
      effectiveDate="April 20, 2025"
      sections={[
        {
          title: "Data We Collect",
          content: (
            <>
              <p>When you create an account on QorixMarkets, we collect the following categories of personal information:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Identity data</strong> — full name, date of birth, government-issued ID (for KYC verification)</li>
                <li><strong className="text-white">Contact data</strong> — email address, phone number, country of residence</li>
                <li><strong className="text-white">Financial data</strong> — USDT wallet addresses, deposit amounts, withdrawal history, and transaction records</li>
                <li><strong className="text-white">Technical data</strong> — IP address, browser type, device identifier, session timestamps, and access logs</li>
                <li><strong className="text-white">Usage data</strong> — pages visited, features accessed, referral codes used, and in-platform activity patterns</li>
              </ul>
              <p>We collect this data when you register, deposit funds, initiate withdrawals, contact support, or interact with the Platform in any capacity.</p>
            </>
          ),
        },
        {
          title: "How We Use Your Data",
          content: (
            <>
              <p>QorixMarkets uses collected data exclusively for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Verifying your identity and maintaining your investor account</li>
                <li>Processing deposits, withdrawals, profit distributions, and internal transfers</li>
                <li>Detecting, investigating, and preventing fraudulent activity, money laundering, and account abuse</li>
                <li>Sending operational communications — such as transaction confirmations, security alerts, and account notices</li>
                <li>Complying with applicable legal obligations and regulatory requests</li>
                <li>Improving Platform performance, stability, and user experience through aggregated analytics</li>
              </ul>
              <p>We do not use your data for unsolicited marketing communications without your explicit consent. You may opt out of marketing emails at any time through your account settings.</p>
            </>
          ),
        },
        {
          title: "Data Retention",
          content: (
            <>
              <p>We retain your personal data for as long as your account is active and for a minimum of 5 years following account closure. This retention period is required to comply with financial recordkeeping obligations, support fraud investigations, and respond to legal or regulatory inquiries.</p>
              <p>Transaction records are retained for a minimum of 7 years in accordance with standard financial compliance requirements. After the applicable retention period, your data will be securely deleted or anonymized.</p>
            </>
          ),
        },
        {
          title: "Data Security",
          content: (
            <>
              <p>QorixMarkets applies industry-standard security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>End-to-end TLS encryption for all data transmitted between your device and our servers</li>
                <li>Bcrypt hashing for all stored passwords — plaintext passwords are never retained</li>
                <li>JWT-based session authentication with configurable expiry and automatic invalidation</li>
                <li>Role-based access controls limiting internal staff access to personal data on a strict need-to-know basis</li>
                <li>Regular security audits and penetration testing of Platform infrastructure</li>
              </ul>
              <p>Despite these measures, no digital system is entirely immune to security threats. In the event of a data breach that materially affects your personal information, we will notify you within 72 hours of becoming aware of the incident.</p>
            </>
          ),
        },
        {
          title: "No Sale of Personal Data",
          content: (
            <>
              <p>QorixMarkets does not sell, rent, lease, or trade your personal information to any third party for commercial purposes. We are unequivocal on this point: your data is never monetized outside of the operational scope described in this Policy.</p>
              <p>We may share data with carefully selected third-party service providers — such as identity verification partners, fraud detection systems, and cloud hosting providers — solely to enable Platform functionality. All such parties are contractually bound to process your data only as instructed, maintain adequate security standards, and never use your data for their own commercial purposes.</p>
              <p>We may also disclose data to law enforcement, regulatory authorities, or courts where legally required to do so, or where disclosure is necessary to protect the rights, safety, or property of QorixMarkets or its users.</p>
            </>
          ),
        },
        {
          title: "Your Rights",
          content: (
            <>
              <p>You have the following rights regarding your personal data held by QorixMarkets:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
                <li><strong className="text-white">Correction</strong> — request that inaccurate or incomplete data be corrected</li>
                <li><strong className="text-white">Deletion</strong> — request erasure of your data, subject to our legal retention obligations</li>
                <li><strong className="text-white">Portability</strong> — request your data in a structured, machine-readable format</li>
                <li><strong className="text-white">Objection</strong> — object to processing of your data for marketing purposes at any time</li>
              </ul>
              <p>To exercise any of these rights, contact us at <strong className="text-white">privacy@qorixmarkets.com</strong>. We will respond within 30 days.</p>
            </>
          ),
        },
      ]}
    />
  );
}
