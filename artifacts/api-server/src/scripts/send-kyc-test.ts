// One-off test send for ALL 8 ADMIN-EMAIL TEMPLATES (B19 batch).
//
// Renders each templateId through the EXACT same renderers + sendEmail
// pipeline that /admin/users/:id/send-email uses in production after the
// new buildDirectEmailHtml dispatch (admin.ts), so the inbox preview is
// byte-identical to what real users will receive once live.
//
// Sends 8 separate, clearly-labelled emails so you can preview each
// unique design side-by-side in your inbox:
//
//   1. KYC Verification Requested  → royal-plum + gold-leaf
//   2. Announcement                → steel + silver (publishedAt chip)
//   3. Promotion                   → magenta + gold (offer highlight)
//   4. Alert / Warning             → amber-hazard (recommended action)
//   5. Info Update                 → cool-blue
//   6. Maintenance                 → slate-orange (window times)
//   7. Trade Alert (FOMO)          → emerald (profit + pair hero)
//   8. Next Trade FOMO             → cyan (countdown)
//
// Usage (from repo root):
//   pnpm --filter @workspace/api-server exec tsx src/scripts/send-kyc-test.ts
//
// Required env: SES_FROM_EMAIL + SMTP_PASS (inherited from Replit secrets).
// Optional env: KYC_TEST_TO (defaults to looxprem@gmail.com)
//
// This file is dev-only. NOT registered in any route or workflow, never
// imported by the running server, ships zero runtime cost. Safe to delete
// after the live deploy is verified.

import {
  sendEmail,
  renderKycVerificationRequestedHtml,
  renderAnnouncementBroadcastHtml,
  renderPromotionBroadcastHtml,
  renderAlertBroadcastHtml,
  renderInfoUpdateBroadcastHtml,
  renderMaintenanceBroadcastHtml,
  renderTradeAlertFomoBroadcastHtml,
  renderNextTradeFomoBroadcastHtml,
} from "../lib/email-service";
import { messageToBodyHtml, escapeHtml } from "../lib/email-template";

const TO = process.env.KYC_TEST_TO || "looxprem@gmail.com";
const dashboardUrl = "https://qorixmarkets.com/dashboard";

function subjectHeading(subject: string): string {
  return (
    `<div style="font-size:18px;font-weight:800;color:#FFFFFF;margin:0 0 14px;line-height:1.3;letter-spacing:-0.2px;">` +
    escapeHtml(subject) +
    `</div>`
  );
}

type Sample = {
  label: string;
  templateId: string;
  subject: string;
  message: string;
  buildHtml: (subject: string, message: string) => string;
};

const SAMPLES: Sample[] = [
  {
    label: "1. KYC Verification",
    templateId: "kyc",
    subject: "🛡 [TEST 1/8 · KYC] Action Needed — Verify Your KYC to Continue Trading",
    message:
      "Dear Investor,\n\n" +
      "To keep your Qorix Markets account secure and unlock the full trading experience, we need to verify your identity (KYC).\n\n" +
      "KYC verification is required by global financial compliance standards and protects your funds from unauthorised access. Once complete, you'll instantly unlock higher daily withdrawal limits, priority support and the official ✅ Verified badge on your profile.\n\n" +
      "It only takes 3 minutes — most reviews complete within 24 hours.\n\n" +
      "Need help at any step? Reply to this email and our compliance team will guide you personally.",
    buildHtml: (subject, message) =>
      renderKycVerificationRequestedHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        bodyHtml: messageToBodyHtml(message),
        ctaUrl: "https://qorixmarkets.com/kyc",
      }),
  },
  {
    label: "2. Announcement",
    templateId: "announcement",
    subject: "📣 [TEST 2/8 · ANNOUNCEMENT] Qorix Markets — May Platform Update Goes Live Tomorrow",
    message:
      "Hello Trader,\n\n" +
      "We're excited to roll out our biggest platform update of the quarter, going live tomorrow at 14:00 UTC.\n\n" +
      "Key highlights you'll notice immediately:\n" +
      "• A redesigned, lightning-fast dashboard with live PnL widgets\n" +
      "• 4 new trading pairs added to the Pro plan\n" +
      "• Enhanced 2FA with biometric login on mobile\n" +
      "• Faster USDT withdrawals (now under 10 minutes typical)\n\n" +
      "No action is required from your side — the upgrade rolls out automatically. Thank you for trading with us.",
    buildHtml: (subject, message) =>
      renderAnnouncementBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        bodyHtml: messageToBodyHtml(message),
        publishedAt: new Date(),
        ctaLabel: "Open Dashboard",
        ctaUrl: dashboardUrl,
      }),
  },
  {
    label: "3. Promotion",
    templateId: "promotion",
    subject: "🎁 [TEST 3/8 · PROMOTION] Double Profit Weekend — 2x Returns on Every Trade",
    message:
      "Dear Investor,\n\n" +
      "For this weekend only, every trade booked between Saturday 00:00 UTC and Sunday 23:59 UTC will earn you 2x the standard profit — automatically credited to your wallet.\n\n" +
      "Why are we doing this? To celebrate crossing $50M in lifetime trading volume on the platform. You made it happen — this is our way of saying thank you.\n\n" +
      "No promo code needed. No minimum trade size. Just trade as usual and watch your profits double.\n\n" +
      "Limited to existing verified accounts. Offer expires Sunday at 23:59 UTC.",
    buildHtml: (subject, message) =>
      renderPromotionBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        offerHighlight: "Limited-Time Offer · Don't Miss Out",
        bodyHtml: messageToBodyHtml(message),
        ctaLabel: "Claim Offer",
        ctaUrl: dashboardUrl,
      }),
  },
  {
    label: "4. Alert / Warning",
    templateId: "alert",
    subject: "⚠ [TEST 4/8 · ALERT] Unusual Login Detected — Please Review Your Account",
    message:
      "Hello,\n\n" +
      "We detected a sign-in attempt to your Qorix Markets account from a new device or location that we don't recognise.\n\n" +
      "If this was you, no action is required — you can safely ignore this email.\n\n" +
      "If this was NOT you, please act immediately:\n" +
      "• Change your password from your account settings\n" +
      "• Enable two-factor authentication if not already on\n" +
      "• Review your recent withdrawal history for any unauthorised activity\n" +
      "• Contact support@qorixmarkets.com for further assistance",
    buildHtml: (subject, message) =>
      renderAlertBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        bodyHtml: messageToBodyHtml(message),
        recommendedAction:
          "Log in to your dashboard and review your account for any required action.",
        ctaLabel: "Open Dashboard",
        ctaUrl: dashboardUrl,
      }),
  },
  {
    label: "5. Info Update",
    templateId: "info",
    subject: "ℹ [TEST 5/8 · INFO] Updated Terms of Service — Effective May 15, 2026",
    message:
      "Dear Customer,\n\n" +
      "We're updating our Terms of Service and Privacy Policy effective May 15, 2026, to better reflect our current product features and to comply with new regulatory requirements in our operating regions.\n\n" +
      "Key changes you should be aware of:\n" +
      "• Clarified data retention policy for closed accounts\n" +
      "• Expanded section on copy-trading rules and risk disclosures\n" +
      "• New cooling-off period for high-value withdrawals (over $50,000)\n\n" +
      "By continuing to use Qorix Markets after May 15, you agree to the updated terms. The full revised documents are available on our website.",
    buildHtml: (subject, message) =>
      renderInfoUpdateBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        bodyHtml: messageToBodyHtml(message),
        ctaLabel: "Open Dashboard",
        ctaUrl: dashboardUrl,
      }),
  },
  {
    label: "6. Maintenance",
    templateId: "maintenance",
    subject: "🛠 [TEST 6/8 · MAINTENANCE] Scheduled Maintenance Window — Brief Service Pause",
    message:
      "Hello,\n\n" +
      "We have a scheduled maintenance window coming up to roll out infrastructure improvements that will make the platform faster and more reliable for everyone.\n\n" +
      "What to expect during the window:\n" +
      "• Trading and order placement will be paused\n" +
      "• Withdrawals will be queued (processed automatically once we're back)\n" +
      "• Account login and balance viewing will remain available throughout\n\n" +
      "We've timed this for the lowest-traffic period and expect total downtime well under one hour. Thank you for your patience.",
    buildHtml: (subject, message) => {
      const now = Date.now();
      return renderMaintenanceBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        title: subject,
        windowStart: new Date(now + 60 * 60 * 1000),
        windowEnd: new Date(now + 2 * 60 * 60 * 1000),
        impactedServices: "Trading platform · Withdrawals · API",
        bodyHtml: messageToBodyHtml(message),
        statusUrl: dashboardUrl,
      });
    },
  },
  {
    label: "7. Trade Alert (FOMO)",
    templateId: "trade_alert",
    subject: "📈 [TEST 7/8 · TRADE ALERT] Profit Booked — BTC/USDT Just Closed +$847",
    message:
      "Hello Trader,\n\n" +
      "Our AI just closed a winning BTC/USDT trade and booked a profit of $847.32 to the platform pool — every active investor on the Pro plan will see their share credited within the next few minutes.\n\n" +
      "Today's running total: 7 winning trades · 0 losses · +$5,210 booked.\n\n" +
      "Want to scale up? Upgrade to a higher plan and your profit share scales linearly. The next trade window opens in approximately 1 hour.",
    buildHtml: (subject, message) =>
      renderTradeAlertFomoBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        profitAmount: "Live",
        pair: "BTC/USDT",
        bodyHtml: subjectHeading(subject) + messageToBodyHtml(message),
        ctaLabel: "View Live Trades",
        ctaUrl: dashboardUrl,
      }),
  },
  {
    label: "8. Next Trade FOMO",
    templateId: "next_trade",
    subject: "⏱ [TEST 8/8 · NEXT TRADE] Next Trade Opens In ~1 Hour — Get Positioned",
    message:
      "Hello Trader,\n\n" +
      "Heads up — our AI engine has identified a high-conviction BTC/USDT setup forming on the 4-hour chart. The next live trade window opens in approximately one hour.\n\n" +
      "If you've been thinking of topping up your trading balance, now is the time. Deposits typically confirm in under 10 minutes, so you'll be fully positioned when the window opens.\n\n" +
      "Don't miss out on this one — historical setups of this profile have averaged 1.8% per trade.",
    buildHtml: (subject, message) =>
      renderNextTradeFomoBroadcastHtml({
        preheader: message.replace(/\s+/g, " ").slice(0, 110),
        nextTradeAt: new Date(Date.now() + 60 * 60 * 1000),
        pair: "BTC/USDT",
        bodyHtml: subjectHeading(subject) + messageToBodyHtml(message),
        ctaLabel: "Open Dashboard",
        ctaUrl: dashboardUrl,
      }),
  },
];

async function main() {
  if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
    console.error("[templates-test] SES_FROM_EMAIL or SMTP_PASS missing — cannot send.");
    process.exit(1);
  }
  console.log(`[templates-test] sending ${SAMPLES.length} template previews to ${TO}…`);
  for (const s of SAMPLES) {
    try {
      console.log(`[templates-test]  → ${s.label} (${s.templateId})`);
      const html = s.buildHtml(s.subject, s.message);
      await sendEmail(TO, s.subject, s.message, html);
      // small spacing between sends to avoid burst-rate throttles
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[templates-test]    FAILED ${s.label}:`, err);
    }
  }
  console.log(`[templates-test] done — check the inbox at ${TO}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[templates-test] FAILED:", err);
  process.exit(1);
});
