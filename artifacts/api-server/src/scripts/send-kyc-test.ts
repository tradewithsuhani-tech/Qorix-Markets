// One-off test send for the KYC VERIFICATION REQUESTED email template (B18).
// Renders the email through the EXACT same renderKycVerificationRequestedHtml
// + sendEmail pipeline that /admin/users/:id/send-email uses in production
// when templateId === "kyc", so the inbox preview is byte-identical to what
// real users will receive once the KYC template is live in the picker.
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

import { sendEmail, renderKycVerificationRequestedHtml } from "../lib/email-service";
import { messageToBodyHtml } from "../lib/email-template";

const TO = process.env.KYC_TEST_TO || "looxprem@gmail.com";

const SUBJECT = "🛡 Action Needed — Verify Your KYC to Continue Trading";

const BODY =
  "Dear Investor,\n\n" +
  "To keep your Qorix Markets account secure and unlock the full trading experience, we need to verify your identity (KYC).\n\n" +
  "KYC verification is required by global financial compliance standards and protects your funds from unauthorised access. Once complete, you'll instantly unlock higher daily withdrawal limits, priority support and the official ✅ Verified badge on your profile.\n\n" +
  "It only takes 3 minutes — most reviews complete within 24 hours.\n\n" +
  "Need help at any step? Reply to this email and our compliance team will guide you personally.";

async function main() {
  if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
    console.error("[kyc-test] SES_FROM_EMAIL or SMTP_PASS missing — cannot send.");
    process.exit(1);
  }
  console.log(`[kyc-test] sending KYC template preview to ${TO}…`);
  const html = renderKycVerificationRequestedHtml({
    preheader: BODY.replace(/\s+/g, " ").slice(0, 110),
    title: SUBJECT,
    bodyHtml: messageToBodyHtml(BODY),
    ctaUrl: "https://qorixmarkets.com/kyc",
  });
  await sendEmail(TO, SUBJECT, BODY, html);
  console.log(`[kyc-test] done — check the inbox at ${TO}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[kyc-test] FAILED:", err);
  process.exit(1);
});
