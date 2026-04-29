/**
 * preview-email.ts — Dev-only utility to send a test render of any email
 * template to a fixed reviewer address (default: looxprem@gmail.com).
 *
 * Each redesigned template is registered in TEMPLATES below. Pass the key as
 * a CLI arg to send that one. No DB writes happen — we render the template
 * with a clearly-fake OTP / sample data and call sendEmail() directly.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/preview-email.ts verify-otp
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/preview-email.ts verify-otp other@email.com
 */
import { sendEmail, renderVerifyEmailOtpHtml } from "../lib/email-service";

const DEFAULT_TO = "looxprem@gmail.com";
const FAKE_OTP = "012345"; // Visually obvious it's a preview, not a real code.

type Preview = { subject: string; text: string; html: string };

const TEMPLATES: Record<string, () => Preview> = {
  "verify-otp": () => {
    const intro =
      "Welcome to Qorix Markets. Use the code below to verify your email and finish creating your account.";
    return {
      subject: "[PREVIEW] Qorix Markets — Email Verification (new design)",
      text:
        `[DESIGN PREVIEW — not a real code]\n\n` +
        `Your Email Verification code is: ${FAKE_OTP}\n\n` +
        `This is a test render of the new welcome / cyan-teal template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderVerifyEmailOtpHtml({
        preheader: `[PREVIEW] Email verification code: ${FAKE_OTP} (design test)`,
        intro,
        otp: FAKE_OTP,
      }),
    };
  },
  // Future templates go here:
  //   "withdraw-otp": () => ({ ... }),
  //   "device-otp":   () => ({ ... }),
  //   "deposit-confirm": () => ({ ... }),
  //   ...
};

async function main() {
  const key = process.argv[2];
  const to = process.argv[3] || DEFAULT_TO;

  if (!key || !TEMPLATES[key]) {
    const known = Object.keys(TEMPLATES).join(", ");
    console.error(
      `Usage: tsx src/scripts/preview-email.ts <template> [to]\n` +
        `  template: one of [${known}]\n` +
        `  to:       reviewer email (default: ${DEFAULT_TO})`,
    );
    process.exit(1);
  }

  const { subject, text, html } = TEMPLATES[key]!();
  console.log(`[preview-email] sending "${key}" → ${to} ...`);
  await sendEmail(to, subject, text, html);
  console.log(`[preview-email] done.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[preview-email] failed:", err);
  process.exit(1);
});
