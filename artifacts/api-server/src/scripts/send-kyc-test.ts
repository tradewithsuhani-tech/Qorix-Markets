// One-off test send for the new KYC email template (B18).
// Sends the KYC template's subject + body to a fixed test address,
// rendered through the EXACT same buildBrandedEmailHtml + sendEmail
// pipeline that /admin/users/:id/send-email uses in production, so
// the inbox preview is byte-identical to what real users will receive
// once the KYC template is live in the picker.
//
// Usage (from repo root):
//   pnpm --filter @workspace/api-server exec tsx src/scripts/send-kyc-test.ts
//
// Required env: SES_FROM_EMAIL + SMTP_PASS (inherited from Replit secrets).
// Optional env: KYC_TEST_TO (defaults to looxprem@gmail.com)
//
// This file is dev-only. It is NOT registered in any route or workflow,
// is never imported by the running server, and ships zero runtime cost.
// Safe to delete after the live deploy is verified.

import { sendEmail } from "../lib/email-service";
import { buildBrandedEmailHtml } from "../lib/email-template";

const TO = process.env.KYC_TEST_TO || "looxprem@gmail.com";

const SUBJECT = "🛡 Action Needed — Verify Your KYC to Continue Trading";

const BODY =
  "Dear Investor,\n\n" +
  "To keep your Qorix Markets account secure and unlock the full trading experience, we need to verify your identity (KYC).\n\n" +
  "🛡  Why KYC is required\n" +
  "   • Protects your funds from unauthorized access\n" +
  "   • Required by global financial compliance standards\n" +
  "   • Unlocks higher withdrawal limits and faster processing\n\n" +
  "📋  What you'll need (takes under 3 minutes)\n" +
  "   • A government-issued photo ID (Passport / Driving Licence / Aadhaar / National ID)\n" +
  "   • A clear selfie holding the same ID\n" +
  "   • A recent address proof (utility bill / bank statement)\n\n" +
  "⚡  How to complete it\n" +
  "   1. Open the Qorix Markets app or website\n" +
  "   2. Go to Profile → KYC Verification\n" +
  "   3. Upload the documents above\n" +
  "   4. Submit — most reviews complete within 24 hours\n\n" +
  "🔒  Your data is end-to-end encrypted and used ONLY for identity verification. We never share it with third parties.\n\n" +
  "Once verified, you'll receive the official ✅ Verified badge on your profile and instant access to:\n" +
  "   • Higher daily withdrawal limits\n" +
  "   • Priority support\n" +
  "   • Exclusive verified-only promotions\n\n" +
  "Need help? Reply to this email and our compliance team will guide you personally.\n\n" +
  "Qorix Markets\n" +
  "AI-Powered Trading System";

async function main() {
  if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
    console.error("[kyc-test] SES_FROM_EMAIL or SMTP_PASS missing — cannot send.");
    process.exit(1);
  }
  console.log(`[kyc-test] sending KYC template preview to ${TO}…`);
  const html = buildBrandedEmailHtml(SUBJECT, BODY);
  await sendEmail(TO, SUBJECT, BODY, html);
  console.log(`[kyc-test] done — check the inbox at ${TO}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[kyc-test] FAILED:", err);
  process.exit(1);
});
