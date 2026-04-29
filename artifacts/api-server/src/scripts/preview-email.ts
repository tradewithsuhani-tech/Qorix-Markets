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
import {
  sendEmail,
  renderVerifyEmailOtpHtml,
  renderWithdrawalOtpHtml,
  renderDeviceLoginOtpHtml,
  renderWelcomeEmailHtml,
  renderNewDeviceLoginAlertHtml,
  renderDepositConfirmedHtml,
  renderInrDepositApprovedHtml,
  renderWithdrawalSentHtml,
  renderWithdrawalRejectedHtml,
  renderIdentityVerifiedHtml,
} from "../lib/email-service";

const DEFAULT_TO = "safepayu@gmail.com";
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
  "withdraw-otp": () => {
    const intro =
      "You're confirming a withdrawal request. Use the code below to authorize and complete this transaction.";
    return {
      subject: "[PREVIEW] Qorix Markets — Withdrawal Confirmation (new design)",
      text:
        `[DESIGN PREVIEW — not a real code]\n\n` +
        `Your Withdrawal Confirmation code is: ${FAKE_OTP}\n\n` +
        `This is a test render of the new amber-gold "vault" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderWithdrawalOtpHtml({
        preheader: `[PREVIEW] Withdrawal confirmation code: ${FAKE_OTP} (design test)`,
        intro,
        otp: FAKE_OTP,
      }),
    };
  },

  "device-otp": () => {
    const intro =
      "A new device is trying to sign in to your Qorix Markets account. If this was you, use the code below to approve the login. If not, ignore this email and change your password immediately.";
    return {
      subject: "[PREVIEW] Qorix Markets — New Device Login (new design)",
      text:
        `[DESIGN PREVIEW — not a real code]\n\n` +
        `Your New Device Login code is: ${FAKE_OTP}\n\n` +
        `This is a test render of the new sapphire-blue "shield" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderDeviceLoginOtpHtml({
        preheader: `[PREVIEW] New device sign-in code: ${FAKE_OTP} (design test)`,
        intro,
        otp: FAKE_OTP,
      }),
    };
  },

  "welcome": () => {
    const firstName = "Prem";
    const fakeReferral = "QXMKT-PREM01";
    return {
      subject: "[PREVIEW] Welcome to Qorix Markets, Prem ✨ (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Welcome to Qorix Markets, ${firstName}!\n\n` +
        `Test render of the new brand-themed (navy→indigo→violet) "You're In" welcome template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderWelcomeEmailHtml({
        firstName,
        email: DEFAULT_TO,
        referralCode: fakeReferral,
      }),
    };
  },

  "device-alert": () => {
    const name = "Prem";
    const whenUtc = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — New device signed in (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `New device signed in to your Qorix Markets account.\n\n` +
        `Test render of the new crimson "shield" security alert template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderNewDeviceLoginAlertHtml({
        preheader: "[PREVIEW] Sign-in from Mumbai, India · Chrome on macOS — was this you?",
        name,
        ip: "203.0.113.42",
        city: "Mumbai",
        country: "India",
        browser: "Chrome 138",
        os: "macOS 15.2",
        whenUtc,
      }),
    };
  },

  "deposit-usdt": () => {
    const name = "Prem";
    const amount = 1250.0;
    const newMainBalance = 3475.5;
    const network = "TRC20";
    const txHash = "f3b8c2a1d9e7c4b6a8f2d1e9c7b3a5f4e2d1c8b7a6f5e4d3c2b1a9f8e7d6c5b4";
    const whenUtc = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — USDT Deposit Confirmed (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Deposit confirmed: $${amount.toFixed(2)} USDT credited.\n\n` +
        `Test render of the new emerald "Funds Landed" deposit confirmed template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderDepositConfirmedHtml({
        preheader: `[PREVIEW] $${amount.toFixed(2)} USDT (TRC20) credited to your main balance — new balance $${newMainBalance.toFixed(2)}`,
        name,
        amount,
        newMainBalance,
        network,
        txHash,
        whenUtc,
      }),
    };
  },

  "deposit-inr": () => {
    const name = "Prem";
    const amountInr = 25000.0;
    const amountUsdt = 295.0;
    const utr = "ICIC1234567890ABCDEF";
    const newMainBalance = 850.5;
    const whenUtc = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — INR Deposit Approved (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `INR deposit approved: ₹${amountInr.toFixed(2)} → $${amountUsdt.toFixed(2)} USDT credited.\n\n` +
        `Test render of the new rose/magenta + gold ₹ "Bank Cleared" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderInrDepositApprovedHtml({
        preheader: `[PREVIEW] ₹${amountInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} approved — $${amountUsdt.toFixed(2)} USDT credited to your main balance`,
        name,
        amountInr,
        amountUsdt,
        utr,
        newMainBalance,
        whenUtc,
      }),
    };
  },

  "withdrawal-sent": () => {
    const name = "Prem";
    const netAmount = 500.0;
    const toAddress = "TXYZabc1234567890DEFghi9876543210JKLm";
    const txHash = "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
    const network = "TRC20";
    const requestId = 12345;
    const whenUtc = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Withdrawal Sent (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Withdrawal of $${netAmount.toFixed(2)} USDT broadcast on-chain.\n\n` +
        `Test render of the new orange "Funds Dispatched 🚀" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderWithdrawalSentHtml({
        preheader: `[PREVIEW] $${netAmount.toFixed(2)} USDT (TRC20) broadcast on-chain — typically lands in 1–3 minutes`,
        name,
        netAmount,
        toAddress,
        txHash,
        network,
        requestId,
        whenUtc,
      }),
    };
  },

  "withdrawal-rejected": () => {
    const name = "Prem";
    const refundedAmount = 500.0;
    const refundedTo = "Main Balance";
    const requestId = 12345;
    const whenUtc = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Withdrawal Rejected & Refunded (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Withdrawal of $${refundedAmount.toFixed(2)} USDT couldn't be processed — refunded to ${refundedTo}.\n\n` +
        `Test render of the new refined-slate "Refund Credited" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderWithdrawalRejectedHtml({
        preheader: `[PREVIEW] $${refundedAmount.toFixed(2)} USDT refunded to your ${refundedTo} — request #${requestId} couldn't be processed`,
        name,
        refundedAmount,
        refundedTo,
        requestId,
        whenUtc,
      }),
    };
  },

  "identity-verified": () => {
    const name = "Prem Kumar";
    const documentType = "passport";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity Verified ✅ (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.2 Identity verified for ${name} (${documentType}).\n` +
        `USDT & INR withdrawals unlocked.\n\n` +
        `Test render of the new bronze/copper "Verified Member" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderIdentityVerifiedHtml({
        preheader: `[PREVIEW] Lv.2 identity (Passport) verified — USDT & INR withdrawals now enabled`,
        name,
        documentType,
        verifiedAt,
      }),
    };
  },

  // Future templates go here:
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
