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
  renderIdentityRejectedHtml,
  renderAddressVerifiedHtml,
  renderAddressRejectedHtml,
  renderIdentitySubmittedHtml,
  renderAddressSubmittedHtml,
  renderPersonalVerifiedHtml,
  renderPasswordChangedHtml,
  renderTwoFactorEnabledHtml,
  renderTwoFactorDisabledHtml,
  renderContactChangedAlertHtml,
  renderAccountLockedHtml,
  renderUsdtWithdrawalRequestedHtml,
  renderInrWithdrawalSentHtml,
  renderKycPersonalVerifiedHtml,
  renderKycSubmittedHtml,
  renderKycVerifiedHtml,
  renderKycRejectedHtml,
  renderUsdtWithdrawalSentHtml,
  renderUsdtWithdrawalRejectedHtml,
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

  "identity-rejected": () => {
    const name = "Prem Kumar";
    const documentType = "passport";
    const reason =
      "Document image is blurry — please resubmit a clear, well-lit photo with all four corners visible.";
    const rejectedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity Rejected (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.2 Identity (${documentType}) rejected for ${name}.\n` +
        `Reason: ${reason}\n\n` +
        `Test render of the new dusty-plum "Let's Try Again" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderIdentityRejectedHtml({
        preheader: `[PREVIEW] Lv.2 identity (Passport) needs to be resubmitted — ${reason.slice(0, 60)}`,
        name,
        documentType,
        reason,
        rejectedAt,
      }),
    };
  },

  "address-verified": () => {
    const name = "Prem Kumar";
    const addressCity = "Mumbai";
    const addressState = "Maharashtra";
    const addressCountry = "India";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Address Verified 🏆 Fully Verified (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.3 Address verified for ${name} — ${addressCity}, ${addressState}, ${addressCountry}.\n` +
        `Account is now FULLY VERIFIED (all 3 KYC levels).\n\n` +
        `Test render of the new deep-teal + mint "Fully Verified" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderAddressVerifiedHtml({
        preheader: `[PREVIEW] Lv.3 address (${addressCity}, ${addressState}, ${addressCountry}) verified — account is now fully verified across all 3 KYC levels`,
        name,
        addressCity,
        addressState,
        addressCountry,
        verifiedAt,
      }),
    };
  },

  "address-rejected": () => {
    const name = "Prem Kumar";
    const reason =
      "The address on the document does not match the address on file in your profile. Please resubmit a recent proof showing the correct address.";
    const rejectedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Address Rejected (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.3 Address rejected for ${name}.\n` +
        `Reason: ${reason}\n\n` +
        `Test render of the new mocha/sepia "One More Look" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderAddressRejectedHtml({
        preheader: `[PREVIEW] Lv.3 address proof needs to be resubmitted — ${reason.slice(0, 60)}`,
        name,
        reason,
        rejectedAt,
      }),
    };
  },

  "identity-submitted": () => {
    const name = "Prem Kumar";
    const documentType = "passport";
    const submittedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity in Review (Lv.2 pending) (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.2 Identity submitted by ${name} — ${documentType}.\n\n` +
        `Test render of the new misty-sage "In Review" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderIdentitySubmittedHtml({
        preheader: `[PREVIEW] Your Passport is with our compliance team — we'll have an answer within 24 hours`,
        name,
        documentType,
        submittedAt,
      }),
    };
  },

  "address-submitted": () => {
    const name = "Prem Kumar";
    const addressCity = "Mumbai";
    const addressState = "Maharashtra";
    const addressCountry = "India";
    const submittedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Address Logged for Review (Lv.3 pending) (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.3 Address submitted by ${name} — ${addressCity}, ${addressState}, ${addressCountry}.\n\n` +
        `Test render of the new pewter "Logged for Review" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderAddressSubmittedHtml({
        preheader: `[PREVIEW] Your Lv.3 address proof (${addressCity}, ${addressState}, ${addressCountry}) is in the compliance queue — decision usually within 24 hours`,
        name,
        addressCity,
        addressState,
        addressCountry,
        submittedAt,
      }),
    };
  },

  "personal-verified": () => {
    const name = "Prem Kumar";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Personal Verified 🌅 (Lv.1) (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Lv.1 Personal verified for ${name} (auto-approved).\n\n` +
        `Test render of the new warm-coral "First Step Done" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderPersonalVerifiedHtml({
        preheader: `[PREVIEW] Your basic profile is verified — continue to Lv.2 to unlock USDT & INR withdrawals`,
        name,
        verifiedAt,
      }),
    };
  },

  "password-changed": () => {
    const name = "Prem Kumar";
    const changedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Password Updated 🔒 (new design)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Password change confirmation for ${name}.\n\n` +
        `Test render of the new carbon-lime "Locked Down" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderPasswordChangedHtml({
        preheader: `[PREVIEW] Your password was just changed — only your password, nothing else. If this wasn't you, secure your account now.`,
        name,
        changedAt,
        ip: "203.0.113.42",
        browser: "Chrome",
        os: "macOS",
      }),
    };
  },

  "two-factor-enabled": () => {
    const name = "Prem Kumar";
    const enabledAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — 2FA Armed 🛡 (vault theme)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `2FA enabled confirmation for ${name}.\n\n` +
        `Test render of the new midnight-indigo + violet "Vault Armed" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderTwoFactorEnabledHtml({
        preheader: `[PREVIEW] Two-factor authentication is now active. Save your one-time recovery codes right now — they won't be shown again.`,
        name,
        enabledAt,
        method: "TOTP",
        ip: "203.0.113.42",
        browser: "Chrome",
        os: "macOS",
      }),
    };
  },

  "two-factor-disabled": () => {
    const name = "Prem Kumar";
    const disabledAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — 2FA Disabled ⚠️ (oxblood-ember alert)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `2FA disabled security alert for ${name}.\n\n` +
        `Test render of the new oxblood-burgundy + ember-red "A Lock Just Came Off" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderTwoFactorDisabledHtml({
        preheader: `[PREVIEW] Two-factor authentication was just removed from your account. If this wasn't you, reset your password immediately.`,
        name,
        disabledAt,
        ip: "203.0.113.42",
        browser: "Chrome",
        os: "macOS",
      }),
    };
  },

  "email-changed-alert": () => {
    const name = "Prem Kumar";
    const changedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Email Changed ⚠️ (twilight-chrome alert)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Email changed alert for ${name}.\n\n` +
        `Test render of the new twilight-navy + chrome-yellow "Your Email Just Moved" template.\n` +
        `Reroute diagram shows previous → new email (masked).\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderContactChangedAlertHtml({
        preheader: `[PREVIEW] Your account email was just changed. This address is no longer linked. If this wasn't you, contact support immediately.`,
        name,
        attribute: "email",
        oldDisplay: "p••••••@gmail.com",
        newDisplay: "n••••••@yahoo.com",
        changedAt,
        ip: "203.0.113.42",
        browser: "Chrome",
        os: "macOS",
      }),
    };
  },

  "phone-changed-alert": () => {
    const name = "Prem Kumar";
    const changedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Phone Number Changed ⚠️ (twilight-chrome alert)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Phone changed alert for ${name}.\n\n` +
        `Test render of the new twilight-navy + chrome-yellow "Your Number Just Moved" template.\n` +
        `Reroute diagram shows previous → new phone (masked).\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderContactChangedAlertHtml({
        preheader: `[PREVIEW] Your account phone number was just changed. The previous number can no longer receive your account messages.`,
        name,
        attribute: "phone",
        oldDisplay: "+91 •••• ••3210",
        newDisplay: "+91 •••• ••5678",
        changedAt,
        ip: "203.0.113.42",
        browser: "Chrome",
        os: "macOS",
      }),
    };
  },

  "account-locked": () => {
    const name = "Prem Kumar";
    const lockedAt = new Date();
    const autoUnlockAt = new Date(lockedAt.getTime() + 30 * 60 * 1000);
    return {
      subject: "[PREVIEW] Qorix Markets — Account Locked 🔐 (steel-vault, password-reset)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Account locked alert for ${name}.\n\n` +
        `Test render of the new steel-vault + pale-silver "Vault Sealed" template.\n` +
        `Lock seal centerpiece + dynamic unlock-method messaging.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderAccountLockedHtml({
        preheader: `[PREVIEW] We paused sign-ins after detecting unusual activity. Your account is protected — nothing was moved or changed.`,
        name,
        lockedAt,
        reason: "Multiple failed sign-in attempts",
        trigger: "5 failed password attempts in the last 10 minutes",
        unlockMethod: "password-reset",
        autoUnlockAt,
        ip: "198.51.100.7",
        browser: "Unknown browser",
        os: "Unknown device",
      }),
    };
  },

  "account-locked-auto": () => {
    const name = "Prem Kumar";
    const lockedAt = new Date();
    const autoUnlockAt = new Date(lockedAt.getTime() + 30 * 60 * 1000);
    return {
      subject: "[PREVIEW] Qorix Markets — Account Locked 🔐 (steel-vault, auto-unlock)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `Account locked alert for ${name} — auto-unlock variant.\n\n` +
        `— Qorix Markets`,
      html: renderAccountLockedHtml({
        preheader: `[PREVIEW] Account paused for 30 minutes after multiple failed sign-in attempts.`,
        name,
        lockedAt,
        reason: "Multiple failed sign-in attempts",
        trigger: "5 failed password attempts in the last 10 minutes",
        unlockMethod: "auto",
        autoUnlockAt,
        ip: "198.51.100.7",
        browser: "Chrome",
        os: "Windows",
      }),
    };
  },

  "usdt-withdrawal-requested": () => {
    const name = "Prem Kumar";
    const requestedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Withdrawal request #48217 received ⏳ (magenta-pipeline)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `USDT withdrawal requested for ${name}.\n\n` +
        `Test render of the new deep-magenta + electric-pink "In the Pipeline" template.\n` +
        `3-step journey centerpiece (Submitted ✓ → Review ⏳ → Broadcast ◯).\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderUsdtWithdrawalRequestedHtml({
        preheader: `[PREVIEW] We received your $98.50 USDT withdrawal request. It's in the queue for review and broadcast.`,
        name,
        netAmount: "98.50",
        walletAddress: "TYPVjtQyUv9pCQvAbXKD1mGq8YFJg7XnKM",
        requestId: 48217,
        requestedAt,
      }),
    };
  },

  "inr-withdrawal-sent": () => {
    const name = "Prem Kumar";
    const paidAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — ₹50,000.00 paid out to your bank ✓ (forest-honey)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `INR withdrawal sent for ${name}.\n\n` +
        `Test render of the new deep-forest + honey-gold "Money's in Your Bank" template.\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderInrWithdrawalSentHtml({
        preheader: `[PREVIEW] Your INR withdrawal of ₹50,000.00 via UPI has been paid out. Funds typically reflect within 30 minutes.`,
        name,
        amountInr: 50000,
        payoutMethod: "upi",
        payoutReference: "ICIC0001234567890",
        withdrawalId: 9821,
        paidAt,
      }),
    };
  },

  "inr-withdrawal-sent-no-ref": () => {
    const name = "Prem Kumar";
    const paidAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — ₹1,25,000.00 paid out to your bank ✓ (no reference)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `INR withdrawal sent for ${name} — no reference variant + lakhs comma test.\n\n` +
        `— Qorix Markets`,
      html: renderInrWithdrawalSentHtml({
        preheader: `[PREVIEW] Your INR withdrawal of ₹1,25,000.00 via IMPS has been paid out.`,
        name,
        amountInr: 125000,
        payoutMethod: "imps",
        payoutReference: null,
        withdrawalId: 9822,
        paidAt,
      }),
    };
  },

  "kyc-personal-verified": () => {
    const name = "Prem Kumar";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Step 1 of 3 complete · personal details verified ✓ (prussian-pearl)",
      text:
        `[DESIGN PREVIEW]\n\n` +
        `KYC Lv.1 verified for ${name}.\n\n` +
        `Test render of the new prussian-navy + pearl "First Checkpoint Cleared" template.\n` +
        `3-tier KYC ladder centerpiece (Lv.1 ✓ · Lv.2 up next · Lv.3 final).\n` +
        `Reply with feedback.\n\n` +
        `— Qorix Markets`,
      html: renderKycPersonalVerifiedHtml({
        preheader: `[PREVIEW] Your personal details (Lv.1) are verified. Two short steps left to unlock full account capabilities.`,
        name,
        verifiedAt,
      }),
    };
  },

  "kyc-submitted-identity": () => {
    const name = "Prem Kumar";
    const submittedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity Verification received · under review (Lv.2) (graphite-teal)",
      text: `[DESIGN PREVIEW]\n\nKYC #25 — Lv.2 Identity Submitted (under-review).\nGraphite + electric-teal palette. Scan-bar centerpiece.\n— Qorix Markets`,
      html: renderKycSubmittedHtml({
        preheader: `[PREVIEW] We received your identity document. Decision typically arrives within 24 hours.`,
        name,
        kind: "identity",
        submittedAt,
      }),
    };
  },

  "kyc-submitted-address": () => {
    const name = "Prem Kumar";
    const submittedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Address Verification received · under review (Lv.3) (graphite-teal)",
      text: `[DESIGN PREVIEW]\n\nKYC #25 — Lv.3 Address Submitted (parameterization variant).\n— Qorix Markets`,
      html: renderKycSubmittedHtml({
        preheader: `[PREVIEW] We received your address proof. Decision typically arrives within 24 hours.`,
        name,
        kind: "address",
        submittedAt,
      }),
    };
  },

  "kyc-verified-identity": () => {
    const name = "Prem Kumar";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity verified ✓ · withdrawals unlocked (Lv.2) (imperial-plum-gold)",
      text: `[DESIGN PREVIEW]\n\nKYC #26 — Lv.2 Identity Verified.\nImperial-plum + gold-leaf. VERIFIED stamp + capability-unlock card.\n— Qorix Markets`,
      html: renderKycVerifiedHtml({
        preheader: `[PREVIEW] Identity verified. Withdrawals are now enabled on your account.`,
        name,
        kind: "identity",
        verifiedAt,
      }),
    };
  },

  "kyc-verified-address": () => {
    const name = "Prem Kumar";
    const verifiedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Address verified ✓ · account fully verified (Lv.3) (imperial-plum-gold)",
      text: `[DESIGN PREVIEW]\n\nKYC #26 — Lv.3 Address Verified (parameterization variant — account fully verified path).\n— Qorix Markets`,
      html: renderKycVerifiedHtml({
        preheader: `[PREVIEW] Address verified. Your account is now fully verified across all three tiers.`,
        name,
        kind: "address",
        verifiedAt,
      }),
    };
  },

  "kyc-rejected-identity": () => {
    const name = "Prem Kumar";
    const rejectedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — Identity Verification needs re-submit (Lv.2) (burnt-sienna)",
      text: `[DESIGN PREVIEW]\n\nKYC #27 — Lv.2 Identity Rejected with reason.\nBurnt-sienna + warm-sand palette. Reason highlight + re-submit CTA.\n— Qorix Markets`,
      html: renderKycRejectedHtml({
        preheader: `[PREVIEW] Your identity document didn't pass review. The fix is usually small — re-submit when ready.`,
        name,
        kind: "identity",
        reason: "Photo is blurry — three of the four corners of the ID are not clearly visible. Please re-take in good lighting with the entire document inside the frame.",
        rejectedAt,
      }),
    };
  },

  "usdt-withdrawal-sent": () => {
    const name = "Prem Kumar";
    const sentAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — $250.00 USDT broadcast on-chain ⛓ (holographic)",
      text: `[DESIGN PREVIEW]\n\nAdmin email #28 — USDT Withdrawal SENT on-chain.\nHolographic midnight + iridescent violet-cyan. TX hash centerpiece + Tronscan CTA.\n— Qorix Markets`,
      html: renderUsdtWithdrawalSentHtml({
        preheader: `[PREVIEW] Your USDT withdrawal of $250.00 has been signed and broadcast to Tron. Funds typically arrive in 1–3 minutes.`,
        name,
        netAmount: 250,
        destinationAddress: "TQrZ8sV3kMwKtZ1n9dXvBeYpFqJ4yNxL2A",
        txHash: "a7f3c9d1e2b8456789abcdef0123456789fedcba9876543210abcdef01234567",
        requestId: 4821,
        sentAt,
      }),
    };
  },

  "usdt-withdrawal-rejected": () => {
    const name = "Prem Kumar";
    const rejectedAt = new Date();
    return {
      subject: "[PREVIEW] Qorix Markets — $250.00 USDT refunded to your main balance ↩ (dusty-lavender)",
      text: `[DESIGN PREVIEW]\n\nAdmin email #29 — USDT Withdrawal REJECTED · Funds REFUNDED.\nDusty-lavender + warm-ivory. Refunded-balance card showing destination (Main/Profit).\n— Qorix Markets`,
      html: renderUsdtWithdrawalRejectedHtml({
        preheader: `[PREVIEW] Your withdrawal couldn't be processed — the full amount has been returned to your main balance.`,
        name,
        refundedAmount: 250,
        refundSource: "main",
        requestId: 4821,
        rejectedAt,
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
