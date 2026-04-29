import { db, emailOtpsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "./logger";
import { buildBrandedEmailHtml, BRAND_LOGO_CID, escapeHtml } from "./email-template";
import crypto from "crypto";
import nodemailer, { type Transporter } from "nodemailer";
// Premium 3D Q brand logo, embedded as a CID inline attachment so the
// image renders in EVERY email client without depending on a public URL
// (qorixmarkets.com/qorix-email-logo.png is not always served — historic
// 403/SPA-fallback). The PNG is base64-bundled into the build by esbuild
// (see build.mjs `loader: { ".png": "base64" }`) so there's no runtime
// disk read.
import logoBase64 from "../assets/qorix-email-logo.base64";
const LOGO_BUFFER = Buffer.from(logoBase64, "base64");

// ---------------------------------------------------------------------------
// SMTP transport (Google Workspace) — lazy-initialized
// Required env: SES_FROM_EMAIL (sender / SMTP user), SMTP_PASS (App Password)
// Optional env: SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465),
//               SMTP_USER (defaults to SES_FROM_EMAIL)
// ---------------------------------------------------------------------------
let smtpTransporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (smtpTransporter) return smtpTransporter;
  const from = process.env.SES_FROM_EMAIL;
  const pass = process.env.SMTP_PASS;
  if (!from || !pass) return null;
  const user = process.env.SMTP_USER || from;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = port === 465;
  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return smtpTransporter;
}

function generateOtp(length = 6): string {
  const digits = "0123456789";
  let otp = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i]! % 10];
  }
  return otp;
}

// ---------------------------------------------------------------------------
// Send an email via Amazon SES. Falls back to a dev log when AWS creds or
// SES_FROM_EMAIL are not configured (so local/dev flow works without setup).
// ---------------------------------------------------------------------------
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SES_FROM_EMAIL;

  if (!transporter || !from) {
    if (process.env.NODE_ENV !== "production") {
      if (process.env.EMAIL_DEBUG_OTP === "1") {
        logger.warn({ to, subject, body: text }, "[email-service] DEV OTP debug (EMAIL_DEBUG_OTP=1)");
      } else {
        logger.info({ to, subject }, "[email-service] DEV — email would be sent (SMTP not configured)");
      }
    } else {
      logger.warn({ to, subject }, "[email-service] SMTP not configured — email NOT sent");
    }
    return;
  }

  // When an HTML body is supplied, ALWAYS attach the brand logo as a
  // CID inline part so any <img src="cid:qorix-logo@brand"> in the
  // template resolves. Content-Disposition: inline keeps Gmail's
  // attachment chip from showing.
  const attachments = html
    ? [
        {
          filename: "qorix-logo.png",
          content: LOGO_BUFFER,
          cid: BRAND_LOGO_CID,
          contentType: "image/png",
          contentDisposition: "inline" as const,
        },
      ]
    : undefined;

  try {
    const info = await transporter.sendMail({
      from: `"Qorix Markets" <${from}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });
    logger.info({ to, subject, messageId: info.messageId }, "[email-service] email sent via SMTP");
  } catch (err) {
    logger.error({ err: (err as Error).message, to, subject }, "[email-service] SMTP send failed");
    // Don't throw — keep OTP saved in DB so user can retry
  }
}

// ---------------------------------------------------------------------------
// Email-Verification OTP — UNIQUE cyan/teal "welcome aboard" design.
// Used only for purpose === "verify_email". Different vibe from the
// security-focused OTP template below (renderOtpHtml) so signup feels
// inviting, not transactional.
//
// Visual differentiators vs renderOtpHtml:
//   • cyan/teal palette (not blue/purple)
//   • "Welcome aboard" hero pill with sparkle
//   • SEGMENTED OTP boxes (6 individually-bordered glowing cells)
//   • "What's next" 3-step onboarding strip (Verify → Fund → Trade)
//   • friendly "Glad to have you, trader" footer sign-off
//
// Email-client safe: table layout, inline CSS, web-safe fonts, mobile @media.
// ---------------------------------------------------------------------------
export function renderVerifyEmailOtpHtml(opts: {
  preheader: string;
  intro: string;
  otp: string;
}): string {
  const { preheader, intro, otp } = opts;
  const year = new Date().getFullYear();

  const safeIntro = escapeHtml(intro);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Welcome — Verify your Qorix Markets email</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:23px !important; line-height:1.25 !important; }
    .qx-cell { width:38px !important; height:48px !important; line-height:48px !important; font-size:20px !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:14px !important; }
    .qx-step-pad { padding:24px 8px 4px !important; }
    .qx-step-cell { padding:0 4px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#04080F;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#04080F;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#04080F;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#06111E;border:1px solid rgba(34,211,238,0.22);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — cyan/teal gradient (unique to verify-email) -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#0A1F2E 45%,#0E3343 80%,#134E4A 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — welcome pill + headline + thin gradient divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#0A1F2E 45%,#0E3343 80%,#134E4A 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(20,184,166,0.14);border:1px solid rgba(20,184,166,0.42);font-size:10.5px;letter-spacing:2.4px;color:#5EEAD4;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ✨ Welcome aboard
            </div>
            <div class="qx-hero-h" style="font-size:28px;line-height:1.22;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;max-width:420px;margin:0 auto;">
              Verify your email to begin
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#22D3EE 0%,#14B8A6 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- INTRO COPY -->
        <tr>
          <td class="qx-intro" align="center" style="padding:30px 36px 8px;color:#94A3B8;font-size:14.5px;line-height:1.7;">
            ${safeIntro}
          </td>
        </tr>

        <!-- OTP — single copyable code block (selectable, premium, no duplicate visual) -->
        <tr>
          <td align="center" style="padding:24px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-otp-cell" align="center" style="padding:18px 36px;background:#0A1726;background-image:linear-gradient(180deg,#0A1726 0%,#06111E 100%);border:1.5px solid rgba(34,211,238,0.42);border-radius:14px;box-shadow:0 0 28px rgba(34,211,238,0.22),inset 0 1px 0 rgba(255,255,255,0.05);">
                  <span class="qx-otp-text" style="font-family:'SF Mono','Menlo','Consolas','Courier New',monospace;font-size:34px;letter-spacing:10px;color:#67E8F9;font-weight:800;-webkit-user-select:all;-moz-user-select:all;user-select:all;line-height:1.1;text-shadow:0 0 14px rgba(34,211,238,0.45);">${escapeHtml(otp)}</span>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#64748B;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Expires in 10 minutes &nbsp;·&nbsp; Single use
            </div>
          </td>
        </tr>

        <!-- YOUR JOURNEY — premium numbered stepper with gradient connector lines -->
        <tr>
          <td class="qx-step-pad" style="padding:36px 28px 8px;">
            <div style="text-align:center;font-size:11px;letter-spacing:2.4px;color:#5EEAD4;text-transform:uppercase;font-weight:700;margin-bottom:20px;">
              Your journey
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;margin:0 auto;">
              <!-- Row 1: numbered circles + gradient connector lines -->
              <tr>
                <td width="20%" align="center" valign="middle">
                  <div class="qx-step-num qx-step-active" style="width:42px;height:42px;line-height:38px;border-radius:999px;background-image:linear-gradient(135deg,#22D3EE 0%,#14B8A6 100%);background-color:#22D3EE;color:#04080F;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(103,232,249,0.45);box-shadow:0 0 22px rgba(34,211,238,0.55),inset 0 1px 0 rgba(255,255,255,0.35);">1</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(34,211,238,0.55) 0%,rgba(34,211,238,0.20) 100%);background-color:rgba(34,211,238,0.32);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div class="qx-step-num" style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1726;color:#67E8F9;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(34,211,238,0.42);box-shadow:0 0 12px rgba(34,211,238,0.18);">2</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(34,211,238,0.20) 0%,rgba(34,211,238,0.12) 100%);background-color:rgba(34,211,238,0.16);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div class="qx-step-num" style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1726;color:#67E8F9;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(34,211,238,0.42);box-shadow:0 0 12px rgba(34,211,238,0.18);">3</div>
                </td>
              </tr>
              <!-- Row 2: title + sub under each circle -->
              <tr>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Verify</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;white-space:nowrap;">Your Email</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Fund</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;white-space:nowrap;">From $10</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Trade</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;white-space:nowrap;">AI Runs 24/7</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SECURITY NOTE — soft teal accent (not alarming) -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <div style="background:rgba(94,234,212,0.04);border-left:2px solid rgba(94,234,212,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#5EEAD4;">Heads up — </strong>
              Qorix staff will <strong style="color:#FFFFFF;">never</strong> ask for this code. If you didn't sign up, you can safely ignore this email.
            </div>
          </td>
        </tr>

        <!-- FOOTER — friendly sign-off -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#040810;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Glad to have you, trader 🤝
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#67E8F9;text-decoration:none;">support@qorixmarkets.com</a>
            </div>
          </td>
        </tr>
      </table>

      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Withdrawal-Confirm OTP — UNIQUE amber/gold "vault" security design.
// Used only for purpose === "withdrawal_confirm". Warm amber palette
// signals value + caution (different from welcome cyan / device sapphire).
//
// Visual differentiators:
//   • amber/gold palette + warm glow
//   • "Secure withdrawal" hero pill with vault emoji
//   • Premium copyable OTP code block with amber gradient border
//   • 3-checkpoint verification strip (Identity ✓ / Device ✓ / Final code →)
//   • AMBER (not teal) security warning — more serious than welcome flow
//   • "Stay safe, trader 🔒" footer sign-off
// ---------------------------------------------------------------------------
export function renderWithdrawalOtpHtml(opts: {
  preheader: string;
  intro: string;
  otp: string;
}): string {
  const { preheader, intro, otp } = opts;
  const year = new Date().getFullYear();
  const safeIntro = escapeHtml(intro);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Confirm your Qorix Markets withdrawal</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:23px !important; line-height:1.25 !important; }
    .qx-otp-text { font-size:28px !important; letter-spacing:8px !important; }
    .qx-otp-cell { padding:16px 22px !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:14px !important; }
    .qx-step-pad { padding:24px 8px 4px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#04080F;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#04080F;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#04080F;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#0E0A06;border:1px solid rgba(245,158,11,0.28);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — amber/gold gradient (unique to withdrawal) -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#1A0F02 45%,#3A1F02 80%,#5C2D02 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — secure pill + headline + thin amber divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#1A0F02 45%,#3A1F02 80%,#5C2D02 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.45);font-size:10.5px;letter-spacing:2.4px;color:#FCD34D;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🔐 Secure withdrawal
            </div>
            <div class="qx-hero-h" style="font-size:28px;line-height:1.22;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;max-width:420px;margin:0 auto;">
              Confirm your withdrawal
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#F59E0B 0%,#D97706 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- INTRO COPY -->
        <tr>
          <td class="qx-intro" align="center" style="padding:30px 36px 8px;color:#94A3B8;font-size:14.5px;line-height:1.7;">
            ${safeIntro}
          </td>
        </tr>

        <!-- OTP — amber-gold premium code block -->
        <tr>
          <td align="center" style="padding:24px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-otp-cell" align="center" style="padding:18px 36px;background:#1A0F02;background-image:linear-gradient(180deg,#1A0F02 0%,#0E0A06 100%);border:1.5px solid rgba(245,158,11,0.5);border-radius:14px;box-shadow:0 0 28px rgba(245,158,11,0.25),inset 0 1px 0 rgba(255,255,255,0.05);">
                  <span class="qx-otp-text" style="font-family:'SF Mono','Menlo','Consolas','Courier New',monospace;font-size:34px;letter-spacing:10px;color:#FCD34D;font-weight:800;-webkit-user-select:all;-moz-user-select:all;user-select:all;line-height:1.1;text-shadow:0 0 14px rgba(245,158,11,0.5);">${escapeHtml(otp)}</span>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#78716C;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Expires in 10 minutes &nbsp;·&nbsp; Single use
            </div>
          </td>
        </tr>

        <!-- VERIFICATION CHECKPOINTS — Identity ✓ / Device ✓ / Code (active) -->
        <tr>
          <td class="qx-step-pad" style="padding:36px 28px 8px;">
            <div style="text-align:center;font-size:11px;letter-spacing:2.4px;color:#FCD34D;text-transform:uppercase;font-weight:700;margin-bottom:20px;">
              Verification checkpoints
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;margin:0 auto;">
              <tr>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0E0A06;color:#34D399;font-size:18px;font-weight:800;text-align:center;border:2px solid rgba(52,211,153,0.55);box-shadow:0 0 14px rgba(52,211,153,0.30);">&#10003;</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(52,211,153,0.45) 0%,rgba(52,211,153,0.30) 100%);background-color:rgba(52,211,153,0.30);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0E0A06;color:#34D399;font-size:18px;font-weight:800;text-align:center;border:2px solid rgba(52,211,153,0.55);box-shadow:0 0 14px rgba(52,211,153,0.30);">&#10003;</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(52,211,153,0.30) 0%,rgba(245,158,11,0.55) 100%);background-color:rgba(245,158,11,0.32);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background-image:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);background-color:#F59E0B;color:#1A0F02;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(252,211,77,0.5);box-shadow:0 0 22px rgba(245,158,11,0.6),inset 0 1px 0 rgba(255,255,255,0.35);">3</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Identity</div>
                  <div style="font-size:10.5px;color:#78716C;line-height:1.5;margin-top:2px;white-space:nowrap;">Verified</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Device</div>
                  <div style="font-size:10.5px;color:#78716C;line-height:1.5;margin-top:2px;white-space:nowrap;">Trusted</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Final Code</div>
                  <div style="font-size:10.5px;color:#FCD34D;line-height:1.5;margin-top:2px;white-space:nowrap;">Enter Above</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SECURITY WARNING — amber-bordered (more serious than welcome flow) -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <div style="background:rgba(245,158,11,0.06);border-left:3px solid rgba(245,158,11,0.7);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#FCD34D;">Didn't request this withdrawal?</strong><br/>
              Do <strong style="color:#FFFFFF;">not</strong> share this code. Lock your account immediately and contact <a href="mailto:support@qorixmarkets.com" style="color:#FCD34D;text-decoration:none;">support@qorixmarkets.com</a>. Qorix staff will <strong style="color:#FFFFFF;">never</strong> ask for this code.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#040810;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Stay safe, trader 🔒
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FCD34D;text-decoration:none;">support@qorixmarkets.com</a>
            </div>
          </td>
        </tr>

      </table>

      <!-- Outer spacing -->
      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Device-Login-Approval OTP — UNIQUE sapphire/electric-blue "shield" design.
// Used only for purpose === "device_login_approval". Cool-blue palette
// signals identity / security / device-trust (different from amber vault).
//
// Visual differentiators:
//   • sapphire/electric-blue palette + cool glow
//   • "New sign-in detected" hero pill with shield emoji
//   • Premium copyable OTP code block with sapphire gradient border
//   • 3-step approval timeline (Detected → Verify → Approve)
//   • RED-tinted "not you?" reject CTA — strongest warning of all OTP types
//   • "Account safety matters 🛡️" footer
// ---------------------------------------------------------------------------
export function renderDeviceLoginOtpHtml(opts: {
  preheader: string;
  intro: string;
  otp: string;
}): string {
  const { preheader, intro, otp } = opts;
  const year = new Date().getFullYear();
  const safeIntro = escapeHtml(intro);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Approve new device sign-in — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:23px !important; line-height:1.25 !important; }
    .qx-otp-text { font-size:28px !important; letter-spacing:8px !important; }
    .qx-otp-cell { padding:16px 22px !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:14px !important; }
    .qx-step-pad { padding:24px 8px 4px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#04080F;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#04080F;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#04080F;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#070C1A;border:1px solid rgba(59,130,246,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — sapphire/electric-blue gradient (unique to device-login) -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#0A1228 45%,#102045 80%,#1E3A8A 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — shield pill + headline + sapphire divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#04080F;background-image:linear-gradient(135deg,#04080F 0%,#0A1228 45%,#102045 80%,#1E3A8A 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(59,130,246,0.16);border:1px solid rgba(59,130,246,0.5);font-size:10.5px;letter-spacing:2.4px;color:#93C5FD;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🛡️ New sign-in detected
            </div>
            <div class="qx-hero-h" style="font-size:28px;line-height:1.22;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;max-width:420px;margin:0 auto;">
              Approve this device
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#3B82F6 0%,#1D4ED8 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- INTRO COPY -->
        <tr>
          <td class="qx-intro" align="center" style="padding:30px 36px 8px;color:#94A3B8;font-size:14.5px;line-height:1.7;">
            ${safeIntro}
          </td>
        </tr>

        <!-- OTP — sapphire premium code block -->
        <tr>
          <td align="center" style="padding:24px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-otp-cell" align="center" style="padding:18px 36px;background:#0A1228;background-image:linear-gradient(180deg,#0A1228 0%,#070C1A 100%);border:1.5px solid rgba(59,130,246,0.5);border-radius:14px;box-shadow:0 0 28px rgba(59,130,246,0.28),inset 0 1px 0 rgba(255,255,255,0.05);">
                  <span class="qx-otp-text" style="font-family:'SF Mono','Menlo','Consolas','Courier New',monospace;font-size:34px;letter-spacing:10px;color:#93C5FD;font-weight:800;-webkit-user-select:all;-moz-user-select:all;user-select:all;line-height:1.1;text-shadow:0 0 14px rgba(59,130,246,0.55);">${escapeHtml(otp)}</span>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#64748B;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Expires in 10 minutes &nbsp;·&nbsp; Single use
            </div>
          </td>
        </tr>

        <!-- APPROVAL TIMELINE — Detected → Verify → Approve -->
        <tr>
          <td class="qx-step-pad" style="padding:36px 28px 8px;">
            <div style="text-align:center;font-size:11px;letter-spacing:2.4px;color:#93C5FD;text-transform:uppercase;font-weight:700;margin-bottom:20px;">
              Approval flow
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;margin:0 auto;">
              <tr>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1228;color:#93C5FD;font-size:18px;font-weight:800;text-align:center;border:2px solid rgba(59,130,246,0.55);box-shadow:0 0 14px rgba(59,130,246,0.28);">&#128269;</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(59,130,246,0.30) 0%,rgba(59,130,246,0.55) 100%);background-color:rgba(59,130,246,0.40);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background-image:linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%);background-color:#3B82F6;color:#04080F;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(147,197,253,0.5);box-shadow:0 0 22px rgba(59,130,246,0.6),inset 0 1px 0 rgba(255,255,255,0.35);">2</div>
                </td>
                <td width="20%" valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(59,130,246,0.30) 0%,rgba(59,130,246,0.18) 100%);background-color:rgba(59,130,246,0.20);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="20%" align="center" valign="middle">
                  <div style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1228;color:#93C5FD;font-size:18px;font-weight:800;text-align:center;border:2px solid rgba(59,130,246,0.45);box-shadow:0 0 12px rgba(59,130,246,0.18);">&#10003;</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Detected</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;white-space:nowrap;">New Device</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Verify</div>
                  <div style="font-size:10.5px;color:#93C5FD;line-height:1.5;margin-top:2px;white-space:nowrap;">Enter Code</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Approve</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;white-space:nowrap;">Sign In</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- RED-tinted reject warning — strongest of all OTPs -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <div style="background:rgba(239,68,68,0.06);border-left:3px solid rgba(239,68,68,0.7);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#FCA5A5;">Wasn't you?</strong><br/>
              Ignore this email — the sign-in won't be approved without this code. Then change your password and contact <a href="mailto:support@qorixmarkets.com" style="color:#FCA5A5;text-decoration:none;">support@qorixmarkets.com</a> immediately.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#040810;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Account safety matters 🛡️
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#93C5FD;text-decoration:none;">support@qorixmarkets.com</a>
            </div>
          </td>
        </tr>

      </table>

      <!-- Outer spacing -->
      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Welcome Email — BRAND-THEMED (navy → indigo → violet) "You're In" onboarding design.
// Sent post-signup (both password + Google OAuth flows). Celebrates the new
// account, presents trust/value card with stat tiles, and shows 3 next-step
// action cards (Fund · Activate AI · Refer & Earn) with a big dashboard CTA.
//
// Visual differentiators (vs OTPs):
//   • brand navy → indigo → violet palette (matches logo Q gradient — first impression on-brand)
//   • "✨ Account Active" hero pill + "You're In, {firstName}" headline
//   • Trust / Value card (institutional positioning + 24/7 · <1s · USDT stat tiles)
//   • 3 vertical action cards (Fund · Activate AI · Refer & Earn)
//   • Big gradient CTA button → dashboard
//   • Trust micro-pills (24/7 AI · Risk-Managed · Instant Withdraw)
//   • "Welcome to the future" footer with first-name personalization
// ---------------------------------------------------------------------------
export function renderWelcomeEmailHtml(opts: {
  firstName: string;
  email: string;
  referralCode: string;
}): string {
  const { firstName } = opts;
  // `email` and `referralCode` are accepted for API stability + plain-text
  // fallback (in sendWelcomeEmail) but intentionally NOT shown in the HTML body:
  //   • email is redundant — the message itself was delivered to it
  //   • referral code is already featured in the "Refer & Earn 10%" card below;
  //     showing it twice would feel pushy / MLM-ish.
  const year = new Date().getFullYear();
  const safeFirstName = escapeHtml(firstName || "Trader");
  const preheader = `You're in, ${firstName || "Trader"} — your Qorix Markets account is active. Here's what to do next.`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Welcome to Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:25px !important; line-height:1.2 !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:14px !important; }
    .qx-trust-pad { padding:18px 14px 4px !important; }
    .qx-trust-copy { font-size:13px !important; }
    .qx-stat-num { font-size:19px !important; }
    .qx-stat-label { font-size:9.5px !important; letter-spacing:0.5px !important; }
    .qx-step-pad { padding:24px 18px 4px !important; }
    .qx-step-icon { width:42px !important; height:42px !important; line-height:40px !important; font-size:19px !important; }
    .qx-step-title { font-size:14px !important; }
    .qx-step-desc { font-size:12.5px !important; }
    .qx-cta-pad { padding:24px 22px 4px !important; }
    .qx-cta { padding:14px 28px !important; font-size:14px !important; }
    .qx-pill { font-size:10.5px !important; padding:5px 10px !important; }
    .qx-pill-cell { padding:0 4px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#050818;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#050818;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#050818;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#0A0F26;border:1px solid rgba(99,102,241,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — brand navy→indigo→violet gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#050818;background-image:linear-gradient(135deg,#050818 0%,#0F1A4A 45%,#1E1B5E 80%,#312E81 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — account active pill + headline + brand-gradient divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#050818;background-image:linear-gradient(135deg,#050818 0%,#0F1A4A 45%,#1E1B5E 80%,#312E81 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.5);font-size:10.5px;letter-spacing:2.4px;color:#A5B4FC;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ✨ Account Active
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              You're In, ${safeFirstName}
            </div>
            <div style="font-size:13.5px;color:#94A3B8;margin-top:10px;font-weight:500;">
              Welcome to Qorix Markets
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#6366F1 0%,#4338CA 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- INTRO -->
        <tr>
          <td class="qx-intro" align="center" style="padding:30px 36px 8px;color:#94A3B8;font-size:14.5px;line-height:1.7;">
            Your AI trading account is ready. Here's everything you need to start earning — <strong style="color:#FFFFFF;">24/7, on autopilot</strong>.
          </td>
        </tr>

        <!-- TRUST / VALUE CARD — institutional positioning + 3 concrete stat tiles
             (replaces personal snapshot to avoid redundancy + MLM-style refer hype) -->
        <tr>
          <td class="qx-trust-pad" style="padding:24px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D1430;background-image:linear-gradient(180deg,#0D1430 0%,#0A0F26 100%);border:1px solid rgba(99,102,241,0.22);border-radius:14px;">
              <tr>
                <td align="center" style="padding:22px 24px 6px;">
                  <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.32);font-size:10px;letter-spacing:2px;color:#A5B4FC;font-weight:700;text-transform:uppercase;margin-bottom:14px;">⚡ Built For Serious Traders</div>
                  <div class="qx-trust-copy" style="font-size:13.5px;color:#CBD5E1;line-height:1.65;max-width:430px;margin:0 auto;">
                    Institutional-grade AI strategies — the same kind used by quant funds — now executing trades on your behalf, around the clock.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="33%" align="center" valign="middle" style="padding:10px 6px;">
                        <div class="qx-stat-num" style="font-size:22px;font-weight:800;color:#A5B4FC;letter-spacing:-0.5px;line-height:1.1;text-shadow:0 0 14px rgba(99,102,241,0.35);">24/7</div>
                        <div class="qx-stat-label" style="font-size:10.5px;color:#94A3B8;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-top:5px;white-space:nowrap;">AI Monitoring</div>
                      </td>
                      <td width="34%" align="center" valign="middle" style="padding:10px 6px;border-left:1px solid rgba(99,102,241,0.18);border-right:1px solid rgba(99,102,241,0.18);">
                        <div class="qx-stat-num" style="font-size:22px;font-weight:800;color:#A5B4FC;letter-spacing:-0.5px;line-height:1.1;text-shadow:0 0 14px rgba(99,102,241,0.35);">&lt;&nbsp;1s</div>
                        <div class="qx-stat-label" style="font-size:10.5px;color:#94A3B8;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-top:5px;white-space:nowrap;">Trade Execution</div>
                      </td>
                      <td width="33%" align="center" valign="middle" style="padding:10px 6px;">
                        <div class="qx-stat-num" style="font-size:22px;font-weight:800;color:#A5B4FC;letter-spacing:-0.5px;line-height:1.1;text-shadow:0 0 14px rgba(99,102,241,0.35);">USDT</div>
                        <div class="qx-stat-label" style="font-size:10.5px;color:#94A3B8;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin-top:5px;white-space:nowrap;">TRC20 Withdraw</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- WHAT'S NEXT — 3 vertical action cards -->
        <tr>
          <td class="qx-step-pad" style="padding:32px 32px 8px;">
            <div style="text-align:center;font-size:11px;letter-spacing:2.4px;color:#A5B4FC;text-transform:uppercase;font-weight:700;margin-bottom:18px;">
              What's Next
            </div>

            <!-- Step 1: Fund -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D1430;border:1px solid rgba(99,102,241,0.18);border-radius:12px;margin-bottom:10px;">
              <tr>
                <td width="64" valign="middle" style="padding:14px 0 14px 16px;">
                  <div class="qx-step-icon" style="width:48px;height:48px;line-height:46px;border-radius:12px;background-image:linear-gradient(135deg,#6366F1 0%,#4338CA 100%);background-color:#6366F1;color:#050818;font-size:22px;font-weight:800;text-align:center;border:1px solid rgba(165,180,252,0.5);box-shadow:0 0 18px rgba(99,102,241,0.35);">💰</div>
                </td>
                <td valign="middle" style="padding:14px 16px 14px 14px;">
                  <div class="qx-step-title" style="font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:0.1px;">Fund Your Wallet</div>
                  <div class="qx-step-desc" style="font-size:13px;color:#94A3B8;line-height:1.5;margin-top:3px;">Deposit USDT (TRC20) — minimum just $10</div>
                </td>
              </tr>
            </table>

            <!-- Step 2: Activate AI -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D1430;border:1px solid rgba(99,102,241,0.18);border-radius:12px;margin-bottom:10px;">
              <tr>
                <td width="64" valign="middle" style="padding:14px 0 14px 16px;">
                  <div class="qx-step-icon" style="width:48px;height:48px;line-height:46px;border-radius:12px;background-image:linear-gradient(135deg,#6366F1 0%,#4338CA 100%);background-color:#6366F1;color:#050818;font-size:22px;font-weight:800;text-align:center;border:1px solid rgba(165,180,252,0.5);box-shadow:0 0 18px rgba(99,102,241,0.35);">🤖</div>
                </td>
                <td valign="middle" style="padding:14px 16px 14px 14px;">
                  <div class="qx-step-title" style="font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:0.1px;">Activate AI Trading</div>
                  <div class="qx-step-desc" style="font-size:13px;color:#94A3B8;line-height:1.5;margin-top:3px;">Pick a strategy — AI handles execution 24/7</div>
                </td>
              </tr>
            </table>

            <!-- Step 3: Refer & Earn -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D1430;border:1px solid rgba(99,102,241,0.18);border-radius:12px;">
              <tr>
                <td width="64" valign="middle" style="padding:14px 0 14px 16px;">
                  <div class="qx-step-icon" style="width:48px;height:48px;line-height:46px;border-radius:12px;background-image:linear-gradient(135deg,#6366F1 0%,#4338CA 100%);background-color:#6366F1;color:#050818;font-size:22px;font-weight:800;text-align:center;border:1px solid rgba(165,180,252,0.5);box-shadow:0 0 18px rgba(99,102,241,0.35);">🎁</div>
                </td>
                <td valign="middle" style="padding:14px 16px 14px 14px;">
                  <div class="qx-step-title" style="font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:0.1px;">Refer &amp; Earn 10%</div>
                  <div class="qx-step-desc" style="font-size:13px;color:#94A3B8;line-height:1.5;margin-top:3px;">Lifetime commission on every friend who trades</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA BUTTON -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#6366F1 0%,#4338CA 100%);background-color:#6366F1;box-shadow:0 8px 28px rgba(99,102,241,0.45);">
                  <a href="https://qorixmarkets.com/dashboard" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 38px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Open Your Dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TRUST PILLS -->
        <tr>
          <td align="center" style="padding:24px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-pill-cell" align="center" style="padding:0 6px;">
                  <span class="qx-pill" style="display:inline-block;padding:6px 12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.32);border-radius:999px;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.3px;white-space:nowrap;">🤖 24/7 AI</span>
                </td>
                <td class="qx-pill-cell" align="center" style="padding:0 6px;">
                  <span class="qx-pill" style="display:inline-block;padding:6px 12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.32);border-radius:999px;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.3px;white-space:nowrap;">🛡️ Risk-Managed</span>
                </td>
                <td class="qx-pill-cell" align="center" style="padding:0 6px;">
                  <span class="qx-pill" style="display:inline-block;padding:6px 12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.32);border-radius:999px;font-size:11px;color:#94A3B8;font-weight:600;letter-spacing:0.3px;white-space:nowrap;">⚡ Instant Withdraw</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HELP NOTE -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <div style="background:rgba(165,180,252,0.04);border-left:2px solid rgba(165,180,252,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#A5B4FC;">Need a hand? </strong>
              Reach our trader support at <a href="mailto:support@qorixmarkets.com" style="color:#A5B4FC;text-decoration:none;">support@qorixmarkets.com</a> — we usually reply within an hour.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#03061D;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Welcome to the future, ${safeFirstName} ✨
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              <a href="https://qorixmarkets.com" style="color:#A5B4FC;text-decoration:none;">qorixmarkets.com</a>
            </div>
          </td>
        </tr>

      </table>

      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Send the branded Welcome email (post-signup).
 * Use this from auth.ts (password signup) and google-oauth.ts (OAuth signup).
 * Fire-and-forget at call site (wrap in setImmediate / try-catch).
 */
export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  referralCode: string,
): Promise<void> {
  const safeName = (firstName || "Trader").trim();
  const subject = `Welcome to Qorix Markets, ${safeName} ✨`;
  const text =
    `Welcome to Qorix Markets, ${safeName}!\n\n` +
    `Your AI trading account is active. Here's what to do next:\n\n` +
    `1. Fund Your Wallet — Deposit USDT (TRC20), minimum $10\n` +
    `2. Activate AI Trading — Pick a strategy, AI handles 24/7\n` +
    `3. Refer & Earn — 10% lifetime commission on every friend who trades\n\n` +
    `Your referral code: ${referralCode}\n\n` +
    `Open your dashboard: https://qorixmarkets.com/dashboard\n\n` +
    `Need help? support@qorixmarkets.com\n\n` +
    `— Qorix Markets`;
  const html = renderWelcomeEmailHtml({ firstName: safeName, email: to, referralCode });
  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Generic OTP template — fallback only. All three OTP purposes now have
// dedicated designs (verify_email, withdrawal_confirm, device_login_approval).
// Kept for safety in case dispatcher misses a future purpose.
// ---------------------------------------------------------------------------
function renderOtpHtml(opts: {
  purposeLabel: string;
  preheader: string;
  intro: string;
  otp: string;
  noteLines: string[];
}): string {
  const { purposeLabel, preheader, intro, otp } = opts;
  const otpSpaced = otp.split("").join(" ");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<title>${purposeLabel} — Qorix Markets</title>
</head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0B0F1A;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F1A;padding:20px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0F172A;border-radius:18px;overflow:hidden;border:1px solid #1F2937;">
        <tr>
          <td align="left" style="padding:20px 20px 14px 28px;background:linear-gradient(135deg,#05070D 0%,#0A0F1C 50%,#111B36 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:30px;color:#ffffff;">
            <h2 style="margin:0;font-size:24px;color:#ffffff;">${purposeLabel}</h2>
            <div style="width:40px;height:3px;background:linear-gradient(90deg,#38BDF8,#7C3AED);margin:10px 0 20px;"></div>
            <p style="color:#9CA3AF;font-size:14px;line-height:1.6;margin:0;">${intro}</p>
            <div style="margin-top:25px;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:14px;padding:22px 12px;text-align:center;box-shadow:0 0 25px rgba(124,58,237,0.4);">
              <p style="margin:0;font-size:12px;letter-spacing:2px;color:#E0F2FE;">YOUR VERIFICATION CODE</p>
              <p style="margin:14px 0 6px 0;font-size:30px;letter-spacing:6px;font-weight:bold;color:#ffffff;font-family:'SF Mono','Menlo','Consolas',monospace;white-space:nowrap;">${otp}</p>
              <p style="margin:0;font-size:11px;color:#E0E7FF;opacity:0.85;">Tap &amp; hold the code to copy</p>
              <p style="margin:10px 0 0;font-size:12px;color:#E0E7FF;">Expires in 10 minutes</p>
            </div>
            <div style="margin-top:25px;">
              <p style="color:#9CA3AF;font-size:13px;margin:0;line-height:1.6;"><b style="color:#ffffff;">Never share this code</b> with anyone — Qorix staff will never ask for it.</p>
              <p style="color:#9CA3AF;font-size:13px;margin:10px 0 0;line-height:1.6;">If you did not initiate this request, please secure your account and contact support immediately.</p>
            </div>
            <div style="margin-top:20px;border-top:1px solid #1F2937;padding-top:20px;">
              <p style="color:#9CA3AF;font-size:13px;margin:0;line-height:1.6;">This is an automated message from Qorix Markets. If you did not request this code, you can safely ignore this email.</p>
              <p style="margin:8px 0 0;font-size:13px;"><a href="mailto:support@qorixmarkets.com" style="color:#38BDF8;text-decoration:none;">support@qorixmarkets.com</a></p>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px;border-top:1px solid #1F2937;color:#6B7280;font-size:12px;">
            <p style="margin:5px 0;">© ${new Date().getFullYear()} Qorix Markets. All rights reserved.</p>
            <p style="margin:5px 0;"><a href="https://qorixmarkets.com" style="color:#38BDF8;text-decoration:none;">qorixmarkets.com</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send an OTP and store it in the database
// ---------------------------------------------------------------------------
export async function sendOtp(
  userId: number,
  email: string,
  purpose: "verify_email" | "withdrawal_confirm" | "device_login_approval",
): Promise<{ otp: string; expiresAt: Date }> {
  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous OTPs for this user/purpose
  await db
    .update(emailOtpsTable)
    .set({ isUsed: true })
    .where(
      and(
        eq(emailOtpsTable.userId, userId),
        eq(emailOtpsTable.purpose, purpose),
        eq(emailOtpsTable.isUsed, false),
      ),
    );

  await db.insert(emailOtpsTable).values({ userId, email, otp, purpose, expiresAt });

  const purposeLabel =
    purpose === "verify_email"
      ? "Email Verification"
      : purpose === "withdrawal_confirm"
        ? "Withdrawal Confirmation"
        : "New Device Login";
  const intro =
    purpose === "verify_email"
      ? "Welcome to Qorix Markets. Use the code below to verify your email and finish creating your account."
      : purpose === "withdrawal_confirm"
        ? "You're confirming a withdrawal request. Use the code below to authorize and complete this transaction."
        : "A new device is trying to sign in to your Qorix Markets account. If this was you, use the code below to approve the login. If not, ignore this email and change your password immediately.";
  const noteLines = [
    "<strong style=\"color:#cbd5e1;\">Never share this code</strong> with anyone — Qorix staff will never ask for it.",
    "If you did not initiate this request, please secure your account and contact support immediately.",
  ];

  const text =
    `Your ${purposeLabel} code is: ${otp}\n\n` +
    `This code expires in 10 minutes. Do not share it with anyone.\n\n` +
    `If you did not request this, you can safely ignore this email.\n\n` +
    `— Qorix Markets\nhttps://qorixmarkets.com`;

  // Per-purpose template dispatch — each OTP type has its own visual identity:
  //   • verify_email          → renderVerifyEmailOtpHtml      (cyan/teal welcome)
  //   • withdrawal_confirm    → renderWithdrawalOtpHtml       (amber/gold vault)
  //   • device_login_approval → renderDeviceLoginOtpHtml      (sapphire shield)
  //   • <fallback>            → renderOtpHtml                 (generic, safety net)
  const preheader = `Your Qorix Markets ${purposeLabel.toLowerCase()} code: ${otp} (expires in 10 minutes)`;
  const html =
    purpose === "verify_email"
      ? renderVerifyEmailOtpHtml({ preheader, intro, otp })
      : purpose === "withdrawal_confirm"
        ? renderWithdrawalOtpHtml({ preheader, intro, otp })
        : purpose === "device_login_approval"
          ? renderDeviceLoginOtpHtml({ preheader, intro, otp })
          : renderOtpHtml({ purposeLabel, preheader, intro, otp, noteLines });

  await sendEmail(email, `Qorix Markets — ${purposeLabel} Code`, text, html);

  // Never log OTP plaintext. Use EMAIL_DEBUG_OTP=1 in dev only if you need it.
  const otpForLog = process.env.EMAIL_DEBUG_OTP === "1" && process.env.NODE_ENV !== "production" ? otp : "***";
  logger.info({ userId, purpose, otp: otpForLog }, "[email-service] OTP created");

  return { otp, expiresAt };
}

// ---------------------------------------------------------------------------
// Helper: send a branded transactional email (deposit/withdrawal/etc).
// Looks up the user's email by id and sends in the background. Safe to call
// fire-and-forget from request handlers — never blocks and never throws.
// ---------------------------------------------------------------------------
export function sendTxnEmailToUser(
  userId: number,
  title: string,
  message: string,
): void {
  setImmediate(() => {
    // Wrap the async work so a transient DB blip (e.g. Neon pool reconnect)
    // never crashes the process via an unhandled rejection. We retry once
    // after a short backoff before giving up — this fixes the silent drop of
    // deposit/withdrawal confirmation emails seen on Fly when the user's row
    // lookup raced with a Neon idle reconnect.
    void (async () => {
      const lookupEmail = async (): Promise<string | null> => {
        const rows = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
        return rows[0]?.email ?? null;
      };

      let email: string | null = null;
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          email = await lookupEmail();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 1) {
            // brief backoff for transient connection / pool issues
            await new Promise((r) => setTimeout(r, 750));
          }
        }
      }

      if (lastErr) {
        const e = lastErr as { message?: string; code?: string; cause?: { message?: string; code?: string } };
        logger.warn(
          {
            userId,
            title,
            errMessage: e?.message,
            errCode: e?.code,
            causeMessage: e?.cause?.message,
            causeCode: e?.cause?.code,
          },
          "[email-service] txn email user lookup failed after retry",
        );
        return;
      }

      if (!email) {
        logger.info({ userId, title }, "[email-service] txn email skipped — user has no email");
        return;
      }

      try {
        const html = buildBrandedEmailHtml(title, message);
        await sendEmail(email, title, message, html);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        logger.warn(
          { userId, title, errMessage: e?.message, errCode: e?.code },
          "[email-service] txn email send failed",
        );
      }
    })();
  });
}

// ---------------------------------------------------------------------------
// Verify an OTP
// ---------------------------------------------------------------------------
export async function verifyOtp(
  userId: number,
  otp: string,
  purpose: "verify_email" | "withdrawal_confirm" | "device_login_approval",
): Promise<{ valid: boolean; error?: string }> {
  const now = new Date();

  // Dev bypass: accept universal code "123456" in non-production environments
  if (process.env.NODE_ENV !== "production" && otp === "123456") {
    logger.info({ userId, purpose }, "[email-service] Dev bypass OTP accepted");
    return { valid: true };
  }

  const rows = await db
    .select()
    .from(emailOtpsTable)
    .where(
      and(
        eq(emailOtpsTable.userId, userId),
        eq(emailOtpsTable.otp, otp),
        eq(emailOtpsTable.purpose, purpose),
        eq(emailOtpsTable.isUsed, false),
        gt(emailOtpsTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { valid: false, error: "Invalid or expired OTP" };
  }

  // Mark as used
  await db
    .update(emailOtpsTable)
    .set({ isUsed: true })
    .where(eq(emailOtpsTable.id, rows[0]!.id));

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Dev-only: return the latest OTP for a user (so devs can test without email)
// ---------------------------------------------------------------------------
export async function getDevOtp(email: string, purpose: string): Promise<string | null> {
  if (process.env.NODE_ENV === "production") return null;
  const user = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (user.length === 0) return null;

  const now = new Date();
  const rows = await db
    .select({ otp: emailOtpsTable.otp })
    .from(emailOtpsTable)
    .where(
      and(
        eq(emailOtpsTable.userId, user[0]!.id),
        eq(emailOtpsTable.purpose, purpose as any),
        eq(emailOtpsTable.isUsed, false),
        gt(emailOtpsTable.expiresAt, now),
      ),
    )
    .orderBy(emailOtpsTable.createdAt)
    .limit(1);

  return rows[0]?.otp ?? null;
}

// ---------------------------------------------------------------------------
// New-Device Login ALERT — UNIQUE crimson/coral "shield" security design.
// Fires the FIRST time a user signs in from a fingerprint that's never been
// seen before. Different from the device-login OTP (sapphire/calm — that one
// asks for a code BEFORE login). This one is informational, sent AFTER a
// successful sign-in, with a strong "wasn't me — secure account" CTA.
//
// Visual differentiators (vs OTPs / welcome):
//   • crimson/coral palette — alert without being aggressive (red-400 family)
//   • "🛡️ NEW SIGN-IN DETECTED" hero pill + "New Device Signed In" headline
//   • Premium device-snapshot card (📍 location · 🌐 IP · 🖥️ device · 🕐 time)
//   • PRIMARY red CTA: "Wasn't Me — Secure My Account" → settings/security
//   • Secondary muted "Yes, this was me — dismiss" reassurance line
//   • "Stay safe out there 🛡️" footer
// ---------------------------------------------------------------------------
export function renderNewDeviceLoginAlertHtml(opts: {
  preheader: string;
  name: string;
  ip: string;
  city: string | null;
  country: string | null;
  browser: string;
  os: string;
  whenUtc: Date;
}): string {
  const { preheader, name, ip, city, country, browser, os, whenUtc } = opts;
  const cityLine = city ? (country ? `${city}, ${country}` : city) : country || "Unknown";
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeCity = escapeHtml(cityLine);
  const safeIp = escapeHtml(ip);
  const safeBrowser = escapeHtml(browser);
  const safeOs = escapeHtml(os);
  const safeWhen = escapeHtml(whenStr);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>New device signed in — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:13.5px !important; }
    .qx-callout { font-size:16px !important; padding:14px 18px 4px !important; line-height:1.35 !important; }
    .qx-subline { padding:0 22px 4px !important; font-size:12.5px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 22px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0F0608;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0F0608;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0F0608;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1A0A0E;border:1px solid rgba(248,113,113,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — crimson alert gradient (unique to security alert) -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0F0608;background-image:linear-gradient(135deg,#0F0608 0%,#2D0F1A 45%,#4A1325 80%,#7F1D1D 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — alert pill + headline + crimson divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0F0608;background-image:linear-gradient(135deg,#0F0608 0%,#2D0F1A 45%,#4A1325 80%,#7F1D1D 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(248,113,113,0.18);border:1px solid rgba(248,113,113,0.5);font-size:10.5px;letter-spacing:2.4px;color:#FCA5A5;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🛡️ New Sign-In Detected
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              New Device Signed In
            </div>
            <div style="font-size:13.5px;color:#FCA5A5;margin-top:10px;font-weight:500;">
              ${safeFirstName}, was this you?
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#F87171 0%,#DC2626 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- INTRO COPY — lead-in sentence -->
        <tr>
          <td class="qx-intro" align="center" style="padding:30px 36px 4px;color:#94A3B8;font-size:14px;line-height:1.65;">
            We noticed a sign-in to your Qorix Markets account from a device you haven't used before.
          </td>
        </tr>

        <!-- STANDOUT CALLOUT — balanced 2-line headline -->
        <tr>
          <td class="qx-callout" align="center" style="padding:18px 32px 4px;font-size:18px;line-height:1.4;font-weight:800;color:#FFFFFF;letter-spacing:-0.2px;">
            If this was you, <span style="color:#FCA5A5;">no action is needed</span> — your account is safe.
          </td>
        </tr>

        <!-- Sub-line below callout -->
        <tr>
          <td class="qx-subline" align="center" style="padding:0 36px 8px;color:#94A3B8;font-size:13px;line-height:1.6;">
            If not, tap the button below to secure your account right away.
          </td>
        </tr>

        <!-- DEVICE SNAPSHOT — STACKED rows (label top, value bottom — never overflows) -->
        <tr>
          <td class="qx-snap-pad" style="padding:30px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FCA5A5;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Sign-In Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(248,113,113,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Location</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeCity}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(248,113,113,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🌐</span>IP Address</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono','Menlo','Consolas',monospace;">${safeIp}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(248,113,113,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🖥️</span>Device</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeBrowser} · ${safeOs}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Signed In At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PRIMARY CTA — "Wasn't Me — Secure My Account" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:28px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#F87171 0%,#DC2626 100%);background-color:#DC2626;box-shadow:0 8px 28px rgba(220,38,38,0.45);">
                  <a href="https://qorixmarkets.com/settings" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 38px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Wasn't Me — Secure My Account
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12px;color:#64748B;line-height:1.6;">
              Or open <strong style="color:#94A3B8;">Settings → Security</strong> to change your password.
            </div>
          </td>
        </tr>

        <!-- "Yes it was me" reassurance + support -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(248,113,113,0.04);border-left:2px solid rgba(248,113,113,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#FCA5A5;">Yes, that was me. </strong>
              No action needed — you can safely ignore this email. We send these alerts whenever we see a sign-in from a brand-new device, so you stay in the loop.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0A0405;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Stay safe out there 🛡️
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FCA5A5;text-decoration:none;">support@qorixmarkets.com</a>
            </div>
          </td>
        </tr>

      </table>

      <!-- Outer spacing -->
      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send the New-Device Login Alert. Caller decides when to fire — see
// lib/device-tracking.ts. Uses renderNewDeviceLoginAlertHtml above.
// ---------------------------------------------------------------------------
export async function sendNewDeviceLoginAlert(args: {
  to: string;
  name: string;
  ip: string;
  city: string | null;
  country: string | null;
  browser: string;
  os: string;
  whenUtc: Date;
}): Promise<void> {
  const { to, name, ip, city, country, browser, os, whenUtc } = args;
  const cityLine = city ? (country ? `${city}, ${country}` : city) : country || "Unknown";
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;

  const subject = "Qorix Markets — New device signed in to your account";
  const preheader = `Sign-in from ${cityLine} · ${browser} on ${os} — was this you?`;

  const html = renderNewDeviceLoginAlertHtml({
    preheader,
    name,
    ip,
    city,
    country,
    browser,
    os,
    whenUtc,
  });

  const text =
    `New device signed in to your Qorix Markets account\n\n` +
    `Hi ${name},\n\n` +
    `We noticed a sign-in from a device you haven't used before.\n\n` +
    `Location:    ${cityLine}\n` +
    `IP address:  ${ip}\n` +
    `Device:      ${browser} on ${os}\n` +
    `Signed in:   ${whenStr}\n\n` +
    `If this was you, no action is needed.\n` +
    `If not, secure your account immediately: https://qorixmarkets.com/settings\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// USDT Deposit Confirmed — UNIQUE emerald "Funds Landed" celebration design.
// Fires after an on-chain TRC20 USDT deposit clears confirmation gate (see
// lib/tron-monitor.ts) OR after a manual /wallet/deposit credit
// (see routes/wallet.ts).
//
// Visual differentiators (vs OTPs / welcome / device-alert):
//   • emerald palette — calm confident "money in" green (emerald-400 family)
//   • "✅ DEPOSIT CONFIRMED" hero pill + "Funds Credited" headline
//   • PREMIUM amount tile — big bold $X,XXX.XX USDT display (like OTP block)
//   • Stacked details: 💵 amount · 📥 destination · 📊 new balance · 🌐 network · 🔗 tx hash (Tronscan link) · 🕐 confirmed
//   • Dual CTA: "Open Wallet" primary green + secondary "Start Trading" link
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderDepositConfirmedHtml(opts: {
  preheader: string;
  name: string;
  amount: number;
  newMainBalance: number;
  network: string;
  txHash: string | null;
  whenUtc: Date;
}): string {
  const { preheader, name, amount, newMainBalance, network, txHash, whenUtc } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountStr = `$${fmt(amount)}`;
  const balanceStr = `$${fmt(newMainBalance)}`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeAmount = escapeHtml(amountStr);
  const safeBalance = escapeHtml(balanceStr);
  const safeNetwork = escapeHtml(network);
  const safeWhen = escapeHtml(whenStr);
  const txShort = txHash
    ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}`
    : null;
  const safeTxShort = txShort ? escapeHtml(txShort) : null;
  const safeTxFull = txHash ? escapeHtml(txHash) : null;
  const tronscanUrl = txHash ? `https://tronscan.org/#/transaction/${encodeURIComponent(txHash)}` : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Deposit confirmed — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-amount-text { font-size:32px !important; letter-spacing:-0.5px !important; }
    .qx-amount-cell { padding:18px 22px !important; }
    .qx-intro { padding:24px 22px 4px !important; font-size:13.5px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#04100C;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#04100C;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#04100C;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#0A1A14;border:1px solid rgba(52,211,153,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — emerald celebration gradient (unique to deposit confirmed) -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#04100C;background-image:linear-gradient(135deg,#04100C 0%,#052015 45%,#053823 80%,#047857 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — confirmed pill + headline + emerald divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#04100C;background-image:linear-gradient(135deg,#04100C 0%,#052015 45%,#053823 80%,#047857 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(52,211,153,0.18);border:1px solid rgba(52,211,153,0.55);font-size:10.5px;letter-spacing:2.4px;color:#6EE7B7;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ✅ Deposit Confirmed
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Funds Credited
            </div>
            <div style="font-size:13.5px;color:#6EE7B7;margin-top:10px;font-weight:500;">
              ${safeFirstName}, your USDT has landed safely.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#34D399 0%,#059669 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PREMIUM AMOUNT TILE — big bold green amount display -->
        <tr>
          <td align="center" style="padding:32px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-amount-cell" align="center" style="padding:22px 44px;background:#052015;background-image:linear-gradient(180deg,#052015 0%,#0A1A14 100%);border:1.5px solid rgba(52,211,153,0.5);border-radius:14px;box-shadow:0 0 28px rgba(52,211,153,0.25),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div style="font-size:10.5px;letter-spacing:2.4px;color:#6EE7B7;font-weight:700;text-transform:uppercase;margin-bottom:8px;">
                    Amount Credited
                  </div>
                  <div class="qx-amount-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:38px;letter-spacing:-0.8px;color:#6EE7B7;font-weight:800;line-height:1.1;text-shadow:0 0 14px rgba(52,211,153,0.45);">
                    ${safeAmount} <span style="font-size:0.5em;color:#A7F3D0;letter-spacing:0.5px;font-weight:600;">USDT</span>
                  </div>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#475569;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Credited to Main Balance
            </div>
          </td>
        </tr>

        <!-- DEPOSIT DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#6EE7B7;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Deposit Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(52,211,153,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📥</span>Credited To</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Main Balance</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(52,211,153,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📊</span>New Main Balance</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeBalance} <span style="font-size:0.78em;color:#A7F3D0;font-weight:500;">USDT</span></div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(52,211,153,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🌐</span>Network</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeNetwork}</div>
                </td>
              </tr>${
                safeTxShort && tronscanUrl
                  ? `
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(52,211,153,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🔗</span>Transaction Hash</div>
                  <div class="qx-snap-value" style="font-size:13.5px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono','Menlo','Consolas',monospace;word-break:break-all;">
                    <a href="${tronscanUrl}" target="_blank" style="color:#6EE7B7;text-decoration:none;border-bottom:1px dashed rgba(110,231,183,0.4);">${safeTxShort}</a>
                  </div>
                </td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Confirmed At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PRIMARY CTA — "Open Wallet" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#34D399 0%,#059669 100%);background-color:#059669;box-shadow:0 8px 28px rgba(5,150,105,0.45);">
                  <a href="https://qorixmarkets.com/wallet" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Open Wallet
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#94A3B8;line-height:1.6;">
              Ready to grow it? <a href="https://qorixmarkets.com/trade" target="_blank" style="color:#6EE7B7;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(110,231,183,0.4);">Start Trading →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance / safety note -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(52,211,153,0.05);border-left:2px solid rgba(52,211,153,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#6EE7B7;">Funds are safely in your wallet. </strong>
              You can move them to your Trading Balance anytime to start earning with our AI-powered strategies. Didn't make this deposit? Reply or email <a href="mailto:support@qorixmarkets.com" style="color:#6EE7B7;text-decoration:none;">support@qorixmarkets.com</a> right away.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#040C09;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#6EE7B7;text-decoration:none;">support@qorixmarkets.com</a>
            </div>
          </td>
        </tr>

      </table>

      <!-- Outer spacing -->
      <div style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send the USDT Deposit Confirmed email. Replaces the previous generic
// sendTxnEmailToUser path for on-chain credits. Caller looks up email
// + name and passes them in. Fire-and-forget caller pattern lives in
// lib/tron-monitor.ts.
// ---------------------------------------------------------------------------
export async function sendDepositConfirmed(args: {
  to: string;
  name: string;
  amount: number;
  newMainBalance: number;
  network: string;
  txHash: string | null;
  whenUtc: Date;
}): Promise<void> {
  const { to, name, amount, newMainBalance, network, txHash, whenUtc } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subject = `Qorix Markets — Deposit confirmed: $${fmt(amount)} USDT credited`;
  const preheader = `$${fmt(amount)} USDT (${network}) credited to your main balance · new balance $${fmt(newMainBalance)}`;

  const html = renderDepositConfirmedHtml({
    preheader,
    name,
    amount,
    newMainBalance,
    network,
    txHash,
    whenUtc,
  });

  const text =
    `Deposit confirmed — funds credited\n\n` +
    `Hi ${name},\n\n` +
    `Great news — your on-chain USDT deposit has cleared and been credited.\n\n` +
    `Amount credited:   $${fmt(amount)} USDT\n` +
    `Credited to:       Main Balance\n` +
    `New main balance:  $${fmt(newMainBalance)} USDT\n` +
    `Network:           ${network}\n` +
    (txHash ? `Transaction hash:  ${txHash}\n` : "") +
    `Confirmed at:      ${whenStr}\n\n` +
    `Open your wallet: https://qorixmarkets.com/wallet\n` +
    `Start trading:    https://qorixmarkets.com/trade\n\n` +
    `Didn't make this deposit? Contact support@qorixmarkets.com immediately.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}
