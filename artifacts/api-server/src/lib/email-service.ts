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

// ---------------------------------------------------------------------------
// INR Deposit Approved — UNIQUE rose/magenta + gold ₹ "Bank Cleared" design.
// Fires when an admin approves a pending INR (UPI/bank-transfer) deposit at
// POST /admin/inr-deposits/:id/approve (see routes/inr-deposits.ts).
//
// Visual differentiators (vs all other emails so far):
//   • rose/magenta palette with warm gold ₹ accents — Indian celebration
//     (marigold/lakshmi vibe) without being kitschy
//   • "🪔 BANK DEPOSIT CLEARED" hero pill (diya = Indian festive light)
//   • PREMIUM amount tile — ₹X,XX,XXX.XX (Indian lakhs format)
//   • Stacked rows: 💰 INR amount · 🪙 USDT credited · 📥 destination
//                   · [📊 new balance] · 🆔 UTR · 🕐 approved at
//   • Primary CTA: rose→pink gradient "Open Wallet"
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderInrDepositApprovedHtml(opts: {
  preheader: string;
  name: string;
  amountInr: number;
  amountUsdt: number;
  utr: string;
  newMainBalance: number | null;
  whenUtc: Date;
}): string {
  const { preheader, name, amountInr, amountUsdt, utr, newMainBalance, whenUtc } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  // Indian lakhs format (en-IN gives 2,50,000 not 250,000)
  const fmtInr = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inrStr = `₹${fmtInr(amountInr)}`;
  const usdtStr = `$${fmtUsd(amountUsdt)}`;
  const balanceStr = newMainBalance !== null ? `$${fmtUsd(newMainBalance)}` : null;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeInr = escapeHtml(inrStr);
  const safeUsdt = escapeHtml(usdtStr);
  const safeBalance = balanceStr ? escapeHtml(balanceStr) : null;
  const safeUtr = escapeHtml(utr);
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
<title>INR deposit approved — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-amount-text { font-size:32px !important; letter-spacing:-0.5px !important; }
    .qx-amount-cell { padding:18px 22px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#100610;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#100610;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#100610;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1A0A1F;border:1px solid rgba(244,114,182,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — rose/magenta festive gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#100610;background-image:linear-gradient(135deg,#100610 0%,#1F0820 45%,#4A1142 80%,#DB2777 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — diya pill + headline + rose divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#100610;background-image:linear-gradient(135deg,#100610 0%,#1F0820 45%,#4A1142 80%,#DB2777 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(244,114,182,0.18);border:1px solid rgba(244,114,182,0.55);font-size:10.5px;letter-spacing:2.4px;color:#F9A8D4;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🪔 Bank Deposit Cleared
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Funds Credited
            </div>
            <div style="font-size:13.5px;color:#F9A8D4;margin-top:10px;font-weight:500;">
              ${safeFirstName}, your ₹ deposit is now in your wallet.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#F472B6 0%,#FBBF24 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PREMIUM INR AMOUNT TILE — big bold rose with gold ₹ -->
        <tr>
          <td align="center" style="padding:32px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-amount-cell" align="center" style="padding:22px 44px;background:#1F0820;background-image:linear-gradient(180deg,#1F0820 0%,#1A0A1F 100%);border:1.5px solid rgba(244,114,182,0.5);border-radius:14px;box-shadow:0 0 28px rgba(244,114,182,0.25),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div style="font-size:10.5px;letter-spacing:2.4px;color:#F9A8D4;font-weight:700;text-transform:uppercase;margin-bottom:8px;">
                    INR Amount Approved
                  </div>
                  <div class="qx-amount-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:38px;letter-spacing:-0.8px;color:#F9A8D4;font-weight:800;line-height:1.1;text-shadow:0 0 14px rgba(244,114,182,0.45);">
                    <span style="color:#FBBF24;font-weight:700;">₹</span>${safeInr.replace(/^₹/, "")}
                  </div>
                  <div style="margin-top:8px;font-size:12px;color:#94A3B8;font-weight:500;">
                    Credited as <span style="color:#A7F3D0;font-weight:700;">${safeUsdt} USDT</span>
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
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#F9A8D4;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Deposit Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">💰</span>You Paid (INR)</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeInr}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🪙</span>Credited (USDT)</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeUsdt} <span style="font-size:0.78em;color:#A7F3D0;font-weight:500;">USDT</span></div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📥</span>Credited To</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Main Balance</div>
                </td>
              </tr>${
                safeBalance
                  ? `
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📊</span>New Main Balance</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeBalance} <span style="font-size:0.78em;color:#A7F3D0;font-weight:500;">USDT</span></div>
                </td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🆔</span>Reference (UTR)</div>
                  <div class="qx-snap-value" style="font-size:13.5px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono','Menlo','Consolas',monospace;word-break:break-all;">${safeUtr}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Approved At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PRIMARY CTA — rose/pink gradient -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#EC4899 0%,#BE185D 100%);background-color:#BE185D;box-shadow:0 8px 28px rgba(190,24,93,0.45);">
                  <a href="https://qorixmarkets.com/wallet" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Open Wallet
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#94A3B8;line-height:1.6;">
              Ready to grow it? <a href="https://qorixmarkets.com/trade" target="_blank" style="color:#F9A8D4;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(249,168,212,0.4);">Start Trading →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance / safety note -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(244,114,182,0.05);border-left:2px solid rgba(244,114,182,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#F9A8D4;">Funds are safely in your wallet. </strong>
              You can transfer them to your Trading Balance anytime to start earning with our AI-powered strategies. Questions about this deposit? Reply or write to <a href="mailto:support@qorixmarkets.com" style="color:#F9A8D4;text-decoration:none;">support@qorixmarkets.com</a>.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0C040E;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#F9A8D4;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the INR Deposit Approved email. Caller looks up email + name and
// passes them in. Replaces previous generic sendTxnEmailToUser path
// (see routes/inr-deposits.ts approve handler).
// ---------------------------------------------------------------------------
export async function sendInrDepositApproved(args: {
  to: string;
  name: string;
  amountInr: number;
  amountUsdt: number;
  utr: string;
  newMainBalance: number | null;
  whenUtc: Date;
}): Promise<void> {
  const { to, name, amountInr, amountUsdt, utr, newMainBalance, whenUtc } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmtInr = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUsd = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subject = `Qorix Markets — INR deposit approved: ₹${fmtInr(amountInr)} credited`;
  const preheader = `₹${fmtInr(amountInr)} approved · $${fmtUsd(amountUsdt)} USDT credited to your main balance`;

  const html = renderInrDepositApprovedHtml({
    preheader,
    name,
    amountInr,
    amountUsdt,
    utr,
    newMainBalance,
    whenUtc,
  });

  const text =
    `INR deposit approved — funds credited\n\n` +
    `Hi ${name},\n\n` +
    `Good news — your INR deposit has been approved and credited.\n\n` +
    `INR amount paid:    ₹${fmtInr(amountInr)}\n` +
    `Credited as USDT:   $${fmtUsd(amountUsdt)} USDT\n` +
    `Credited to:        Main Balance\n` +
    (newMainBalance !== null ? `New main balance:   $${fmtUsd(newMainBalance)} USDT\n` : "") +
    `Reference (UTR):    ${utr}\n` +
    `Approved at:        ${whenStr}\n\n` +
    `Open your wallet: https://qorixmarkets.com/wallet\n` +
    `Start trading:    https://qorixmarkets.com/trade\n\n` +
    `Questions? Email support@qorixmarkets.com\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Withdrawal Sent — UNIQUE warm-orange "🚀 Funds Dispatched" design.
// Fires when an admin approves a USDT withdrawal AND the on-chain transaction
// is successfully broadcast (see routes/admin.ts approve handler).
//
// Visual differentiators (vs all other emails):
//   • warm-orange palette — courier/dispatch energy without being aggressive
//   • "🚀 FUNDS DISPATCHED" hero pill + "On The Way" headline
//   • PREMIUM amount tile — $X,XXX.XX USDT in glowing orange-300
//   • Stacked rows: 💸 amount · 🌐 network · 📍 destination wallet
//                   · 🔗 tx hash (Tronscan link) · 🆔 request ID · 🕐 sent at
//   • DUAL CTA: "View on Tronscan" primary orange + secondary "Open Wallet"
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderWithdrawalSentHtml(opts: {
  preheader: string;
  name: string;
  netAmount: number;
  toAddress: string;
  txHash: string;
  network: string;
  requestId: number;
  whenUtc: Date;
}): string {
  const { preheader, name, netAmount, toAddress, txHash, network, requestId, whenUtc } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountStr = `$${fmt(netAmount)}`;
  const addrShort = toAddress.length > 18
    ? `${toAddress.slice(0, 10)}…${toAddress.slice(-8)}`
    : toAddress;
  const txShort = txHash.length > 18
    ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}`
    : txHash;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeAmount = escapeHtml(amountStr);
  const safeNetwork = escapeHtml(network);
  const safeAddrShort = escapeHtml(addrShort);
  const safeAddrFull = escapeHtml(toAddress);
  const safeTxShort = escapeHtml(txShort);
  const safeRequestId = escapeHtml(String(requestId));
  const safeWhen = escapeHtml(whenStr);
  const tronscanUrl = `https://tronscan.org/#/transaction/${encodeURIComponent(txHash)}`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Withdrawal sent — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-amount-text { font-size:32px !important; letter-spacing:-0.5px !important; }
    .qx-amount-cell { padding:18px 22px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0F0807;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0F0807;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0F0807;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1A0E08;border:1px solid rgba(251,146,60,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — warm-orange dispatch gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0F0807;background-image:linear-gradient(135deg,#0F0807 0%,#1F100A 45%,#4A2310 80%,#EA580C 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — dispatched pill + headline + orange divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0F0807;background-image:linear-gradient(135deg,#0F0807 0%,#1F100A 45%,#4A2310 80%,#EA580C 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(251,146,60,0.18);border:1px solid rgba(251,146,60,0.55);font-size:10.5px;letter-spacing:2.4px;color:#FDBA74;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🚀 Funds Dispatched
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              On The Way
            </div>
            <div style="font-size:13.5px;color:#FDBA74;margin-top:10px;font-weight:500;">
              ${safeFirstName}, your USDT is broadcast on-chain.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#FB923C 0%,#EA580C 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PREMIUM AMOUNT TILE — big bold orange amount display -->
        <tr>
          <td align="center" style="padding:32px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-amount-cell" align="center" style="padding:22px 44px;background:#1F100A;background-image:linear-gradient(180deg,#1F100A 0%,#1A0E08 100%);border:1.5px solid rgba(251,146,60,0.5);border-radius:14px;box-shadow:0 0 28px rgba(251,146,60,0.25),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div style="font-size:10.5px;letter-spacing:2.4px;color:#FDBA74;font-weight:700;text-transform:uppercase;margin-bottom:8px;">
                    Amount Sent
                  </div>
                  <div class="qx-amount-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:38px;letter-spacing:-0.8px;color:#FDBA74;font-weight:800;line-height:1.1;text-shadow:0 0 14px rgba(251,146,60,0.45);">
                    ${safeAmount} <span style="font-size:0.5em;color:#FED7AA;letter-spacing:0.5px;font-weight:600;">USDT</span>
                  </div>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#475569;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Broadcast on ${safeNetwork}
            </div>
          </td>
        </tr>

        <!-- WITHDRAWAL DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FDBA74;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Transaction Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(251,146,60,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🌐</span>Network</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeNetwork}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(251,146,60,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Destination Wallet</div>
                  <div class="qx-snap-value" style="font-size:13.5px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono','Menlo','Consolas',monospace;word-break:break-all;" title="${safeAddrFull}">${safeAddrShort}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(251,146,60,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🔗</span>Transaction Hash</div>
                  <div class="qx-snap-value" style="font-size:13.5px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono','Menlo','Consolas',monospace;word-break:break-all;">
                    <a href="${tronscanUrl}" target="_blank" style="color:#FDBA74;text-decoration:none;border-bottom:1px dashed rgba(253,186,116,0.4);">${safeTxShort}</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(251,146,60,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🆔</span>Request ID</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">#${safeRequestId}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Sent At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "View on Tronscan" + secondary "Open Wallet" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#FB923C 0%,#EA580C 100%);background-color:#EA580C;box-shadow:0 8px 28px rgba(234,88,12,0.45);">
                  <a href="${tronscanUrl}" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    View on Tronscan
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#94A3B8;line-height:1.6;">
              Or check your <a href="https://qorixmarkets.com/wallet" target="_blank" style="color:#FDBA74;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(253,186,116,0.4);">Wallet History →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance / safety note -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(251,146,60,0.05);border-left:2px solid rgba(251,146,60,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#94A3B8;">
              <strong style="color:#FDBA74;">Funds typically land in 1–3 minutes.</strong>
              On-chain confirmations depend on TRON network speed. If the transaction doesn't show in your destination wallet within 30 minutes, reply to this email or write to <a href="mailto:support@qorixmarkets.com" style="color:#FDBA74;text-decoration:none;">support@qorixmarkets.com</a>.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0A0605;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FDBA74;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the USDT Withdrawal Sent email. Caller looks up email + name and
// passes them in. Replaces previous generic sendTxnEmailToUser path
// (see routes/admin.ts approve handler).
// ---------------------------------------------------------------------------
export async function sendWithdrawalSent(args: {
  to: string;
  name: string;
  netAmount: number;
  toAddress: string;
  txHash: string;
  network: string;
  requestId: number;
  whenUtc: Date;
}): Promise<void> {
  const { to, name, netAmount, toAddress, txHash, network, requestId, whenUtc } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subject = `Qorix Markets — Withdrawal sent: $${fmt(netAmount)} USDT on the way`;
  const preheader = `$${fmt(netAmount)} USDT (${network}) broadcast on-chain to ${toAddress.slice(0, 8)}…${toAddress.slice(-6)}`;

  const html = renderWithdrawalSentHtml({
    preheader,
    name,
    netAmount,
    toAddress,
    txHash,
    network,
    requestId,
    whenUtc,
  });

  const text =
    `Withdrawal sent — funds on the way\n\n` +
    `Hi ${name},\n\n` +
    `Your withdrawal has been approved and broadcast on-chain.\n\n` +
    `Amount sent:        $${fmt(netAmount)} USDT\n` +
    `Network:            ${network}\n` +
    `Destination wallet: ${toAddress}\n` +
    `Transaction hash:   ${txHash}\n` +
    `Request ID:         #${requestId}\n` +
    `Sent at:            ${whenStr}\n\n` +
    `Track on Tronscan: https://tronscan.org/#/transaction/${txHash}\n` +
    `Wallet history:    https://qorixmarkets.com/wallet\n\n` +
    `Funds typically arrive within 1–3 minutes after network confirmation.\n` +
    `If you don't see them in 30 minutes, contact support@qorixmarkets.com\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Withdrawal Rejected — UNIQUE refined-slate "Refund Credited" design.
// Fires when an admin rejects a USDT withdrawal — full amount is refunded
// back to the source balance the user debited from (see routes/admin.ts
// reject handler).
//
// Visual differentiators (vs all other emails):
//   • slate/charcoal neutral palette — calm, refined, NOT alarming
//     (alert = crimson, this is informational + reassuring)
//   • "↩️ REFUND CREDITED" hero pill + "Funds Returned" headline
//   • PREMIUM amount tile — $X,XXX.XX USDT in clean slate-100 white
//   • Stacked rows: 💵 refunded amount · 🏦 credited back to
//                   · 🆔 original request ID · 🕐 refunded at
//   • Empathetic reassurance card with common rejection reasons
//   • DUAL CTA: "Submit New Request" primary slate + "Contact Support" link
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderWithdrawalRejectedHtml(opts: {
  preheader: string;
  name: string;
  refundedAmount: number;
  refundedTo: string;
  requestId: number;
  whenUtc: Date;
}): string {
  const { preheader, name, refundedAmount, refundedTo, requestId, whenUtc } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountStr = `$${fmt(refundedAmount)}`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeAmount = escapeHtml(amountStr);
  const safeRefundedTo = escapeHtml(refundedTo);
  const safeRequestId = escapeHtml(String(requestId));
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
<title>Refund credited — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-amount-text { font-size:32px !important; letter-spacing:-0.5px !important; }
    .qx-amount-cell { padding:18px 22px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0E1014;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0E1014;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0E1014;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#15181F;border:1px solid rgba(148,163,184,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — refined slate gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0E1014;background-image:linear-gradient(135deg,#0E1014 0%,#1A1D26 45%,#2C3340 80%,#475569 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — refund pill + headline + slate divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0E1014;background-image:linear-gradient(135deg,#0E1014 0%,#1A1D26 45%,#2C3340 80%,#475569 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(148,163,184,0.18);border:1px solid rgba(148,163,184,0.55);font-size:10.5px;letter-spacing:2.4px;color:#CBD5E1;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ↩️ Refund Credited
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Funds Returned
            </div>
            <div style="font-size:13.5px;color:#CBD5E1;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your withdrawal couldn't be processed — funds are safely back in your wallet.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#94A3B8 0%,#475569 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PREMIUM AMOUNT TILE — clean slate-white amount display -->
        <tr>
          <td align="center" style="padding:32px 12px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td class="qx-amount-cell" align="center" style="padding:22px 44px;background:#1A1D26;background-image:linear-gradient(180deg,#1A1D26 0%,#15181F 100%);border:1.5px solid rgba(148,163,184,0.5);border-radius:14px;box-shadow:0 0 28px rgba(148,163,184,0.18),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div style="font-size:10.5px;letter-spacing:2.4px;color:#CBD5E1;font-weight:700;text-transform:uppercase;margin-bottom:8px;">
                    Refunded Amount
                  </div>
                  <div class="qx-amount-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:38px;letter-spacing:-0.8px;color:#F1F5F9;font-weight:800;line-height:1.1;text-shadow:0 0 14px rgba(203,213,225,0.20);">
                    ${safeAmount} <span style="font-size:0.5em;color:#CBD5E1;letter-spacing:0.5px;font-weight:600;">USDT</span>
                  </div>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:10.5px;color:#475569;letter-spacing:1.8px;text-transform:uppercase;font-weight:600;">
              Credited back to ${safeRefundedTo}
            </div>
          </td>
        </tr>

        <!-- REFUND DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#CBD5E1;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Refund Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🏦</span>Credited Back To</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeRefundedTo}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,0.14);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🆔</span>Original Request ID</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">#${safeRequestId}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Refunded At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Submit New Request" + secondary "Contact Support" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#64748B 0%,#334155 100%);background-color:#334155;box-shadow:0 8px 28px rgba(51,65,85,0.55);">
                  <a href="https://qorixmarkets.com/wallet" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Submit New Request
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#94A3B8;line-height:1.6;">
              Need clarification? <a href="mailto:support@qorixmarkets.com" style="color:#CBD5E1;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(203,213,225,0.4);">Contact Support →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance / common reasons card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(148,163,184,0.05);border-left:2px solid rgba(148,163,184,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#94A3B8;">
              <div style="color:#E2E8F0;font-weight:600;margin-bottom:6px;">Common reasons for review holds:</div>
              KYC verification incomplete · suspicious activity flag · invalid destination wallet · risk-management hold. Re-check the destination address and KYC status, then submit a new request — or write to <a href="mailto:support@qorixmarkets.com" style="color:#CBD5E1;text-decoration:none;">support@qorixmarkets.com</a> for specifics on this request.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0A0C10;">
            <div style="font-size:13px;color:#CBD5E1;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#CBD5E1;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the USDT Withdrawal Rejected email. Caller looks up email + name and
// passes them in. Replaces previous generic sendTxnEmailToUser path
// (see routes/admin.ts reject handler).
// ---------------------------------------------------------------------------
export async function sendWithdrawalRejected(args: {
  to: string;
  name: string;
  refundedAmount: number;
  refundedTo: string;
  requestId: number;
  whenUtc: Date;
}): Promise<void> {
  const { to, name, refundedAmount, refundedTo, requestId, whenUtc } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${whenUtc.getUTCDate()} ${MONTHS_SHORT[whenUtc.getUTCMonth()]} ${whenUtc.getUTCFullYear()} · ` +
    `${String(whenUtc.getUTCHours()).padStart(2, "0")}:${String(whenUtc.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subject = `Qorix Markets — Refund credited: $${fmt(refundedAmount)} USDT back in your wallet`;
  const preheader = `$${fmt(refundedAmount)} USDT refunded to your ${refundedTo} — request #${requestId} couldn't be processed`;

  const html = renderWithdrawalRejectedHtml({
    preheader,
    name,
    refundedAmount,
    refundedTo,
    requestId,
    whenUtc,
  });

  const text =
    `Refund credited — funds returned\n\n` +
    `Hi ${name},\n\n` +
    `Your withdrawal request couldn't be processed — the full amount has been refunded.\n\n` +
    `Refunded amount:    $${fmt(refundedAmount)} USDT\n` +
    `Credited back to:   ${refundedTo}\n` +
    `Original request:   #${requestId}\n` +
    `Refunded at:        ${whenStr}\n\n` +
    `Common reasons for review holds: KYC pending, suspicious activity flag,\n` +
    `invalid destination wallet, or risk-management hold.\n\n` +
    `Submit a new request: https://qorixmarkets.com/wallet\n` +
    `Contact support:     support@qorixmarkets.com\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Identity Verified (Lv.2) — UNIQUE bronze/copper "Verified Member" design.
// Fires when an admin approves Lv.2 identity verification — this is THE
// unlock moment: withdrawals are now enabled (see routes/kyc.ts admin
// review handler at /admin/kyc/review).
//
// Visual differentiators (vs all other emails):
//   • bronze/copper palette — passport-stamp, member-card aesthetic
//     (distinct from amber-gold OTP, orange dispatch, emerald deposit)
//   • "✅ IDENTITY VERIFIED" hero pill + "You're In" headline
//   • PREMIUM "Member Card" tile — Amex-Platinum vibe with user's name
//     in elegant centerpiece + "VERIFIED" corner badge + tier line
//   • Stacked rows: 🛡️ level · 🪪 document · 🔓 now unlocked · 🕐 verified at
//   • DUAL CTA: "Make a Withdrawal" primary bronze + "Complete Lv.3 Address" link
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
function prettifyDocumentType(raw: string): string {
  const m = raw.toLowerCase().trim();
  if (m === "passport") return "Passport";
  if (m === "national_id" || m === "national-id" || m === "nationalid") return "National ID";
  if (m === "drivers_license" || m === "drivers-license" || m === "driverslicense" || m === "driver_license")
    return "Driver's License";
  if (m === "aadhaar" || m === "aadhar") return "Aadhaar Card";
  if (m === "pan" || m === "pan_card") return "PAN Card";
  // Fallback: title-case the raw string (handles unknown types gracefully).
  return raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Format the timestamp 24 hours after `from` for display in the password-
// changed (and any future "withdrawal hold") emails. Example output:
// "30 Apr 2026 · 12:07 UTC".
function formatHoldUntil(from: Date): string {
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const u = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return (
    `${u.getUTCDate()} ${MONTHS_SHORT[u.getUTCMonth()]} ${u.getUTCFullYear()} · ` +
    `${String(u.getUTCHours()).padStart(2, "0")}:${String(u.getUTCMinutes()).padStart(2, "0")} UTC`
  );
}

export function renderIdentityVerifiedHtml(opts: {
  preheader: string;
  name: string;
  documentType: string;
  verifiedAt: Date;
}): string {
  const { preheader, name, documentType, verifiedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fullName = (name || "Member").trim() || "Member";
  const safeFirstName = escapeHtml(fullName.split(/\s+/)[0] || "there");
  const safeFullName = escapeHtml(fullName);
  const safeDocType = escapeHtml(prettifyDocumentType(documentType));
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
<title>Identity verified — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-mc-name { font-size:22px !important; letter-spacing:1px !important; }
    .qx-mc-cell { padding:18px 18px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#1A0F08;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#1A0F08;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#1A0F08;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#221610;border:1px solid rgba(184,115,51,0.35);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — bronze/copper passport gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#1A0F08;background-image:linear-gradient(135deg,#1A0F08 0%,#2D1A0E 45%,#4A2C16 80%,#8B5A2B 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — verified pill + headline + bronze divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#1A0F08;background-image:linear-gradient(135deg,#1A0F08 0%,#2D1A0E 45%,#4A2C16 80%,#8B5A2B 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(224,176,132,0.20);border:1px solid rgba(224,176,132,0.55);font-size:10.5px;letter-spacing:2.4px;color:#F4D9B5;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ✅ Identity Verified
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              You're In
            </div>
            <div style="font-size:13.5px;color:#F4D9B5;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your ID is verified — withdrawals are now enabled.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#E0B084 0%,#8B5A2B 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PREMIUM MEMBER CARD — Amex-Platinum vibe, name centerpiece -->
        <tr>
          <td align="center" style="padding:32px 24px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;margin:0 auto;">
              <tr>
                <td class="qx-mc-cell" style="padding:22px 26px;background:#2D1A0E;background-image:linear-gradient(135deg,#3A2110 0%,#2D1A0E 50%,#4A2C16 100%);border:1.5px solid rgba(224,176,132,0.55);border-radius:14px;box-shadow:0 0 32px rgba(184,115,51,0.30),inset 0 1px 0 rgba(255,255,255,0.06);">
                  <!-- Top row: brand label + verified badge -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="left" style="font-size:9.5px;letter-spacing:2.4px;color:#E0B084;font-weight:700;text-transform:uppercase;">
                        Qorix Markets
                      </td>
                      <td align="right" style="font-size:9.5px;letter-spacing:1.8px;color:#F4D9B5;font-weight:700;text-transform:uppercase;">
                        ✦ Verified
                      </td>
                    </tr>
                  </table>
                  <!-- Center: name -->
                  <div class="qx-mc-name" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;letter-spacing:1.5px;color:#FFFFFF;font-weight:700;line-height:1.1;text-align:left;padding:24px 0 6px;text-shadow:0 0 18px rgba(224,176,132,0.35);text-transform:uppercase;">
                    ${safeFullName}
                  </div>
                  <div style="height:1px;background:linear-gradient(90deg,rgba(224,176,132,0.6) 0%,rgba(224,176,132,0) 100%);margin:14px 0;"></div>
                  <!-- Bottom row: tier + verified date -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="left" style="font-size:9.5px;letter-spacing:1.8px;color:#E0B084;font-weight:600;text-transform:uppercase;white-space:nowrap;">
                        Member · Identity
                      </td>
                      <td align="right" style="font-size:9.5px;letter-spacing:1.8px;color:#F4D9B5;font-weight:600;text-transform:uppercase;white-space:nowrap;">
                        ✓ Lv.2
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- VERIFICATION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#E0B084;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Verification Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(184,115,51,0.18);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A78866;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🛡️</span>Verification Level</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Lv.2 — Identity</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(184,115,51,0.18);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A78866;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🪪</span>Document Type</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeDocType}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(184,115,51,0.18);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A78866;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🔓</span>Now Unlocked</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">USDT &amp; INR Withdrawals</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A78866;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Verified At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Make a Withdrawal" + secondary "Complete Lv.3 Address" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#B87333 0%,#8B5A2B 100%);background-color:#8B5A2B;box-shadow:0 8px 28px rgba(139,90,43,0.55);">
                  <a href="https://qorixmarkets.com/wallet" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Make a Withdrawal
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#A78866;line-height:1.6;">
              Or complete <a href="https://qorixmarkets.com/profile" target="_blank" style="color:#F4D9B5;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(244,217,181,0.4);">Lv.3 Address Verification →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(184,115,51,0.06);border-left:2px solid rgba(224,176,132,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#A78866;">
              <strong style="color:#F4D9B5;">Verification is permanent.</strong>
              No further action needed unless your ID expires or our compliance team requests an update. Your verified status applies across all Qorix Markets services.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#140A05;">
            <div style="font-size:13px;color:#F4D9B5;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#7A6047;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#F4D9B5;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Identity Verified (Lv.2 KYC approved) email. Caller looks up
// email + name + document type, and passes them in. Replaces the previous
// generic sendTxnEmailToUser path inside the admin KYC review handler
// (see routes/kyc.ts /admin/kyc/review).
// ---------------------------------------------------------------------------
export async function sendIdentityVerified(args: {
  to: string;
  name: string;
  documentType: string;
  verifiedAt: Date;
}): Promise<void> {
  const { to, name, documentType, verifiedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;

  const subject = `Qorix Markets — Identity verified, withdrawals unlocked ✅`;
  const preheader = `Your Lv.2 identity (${prettifyDocumentType(documentType)}) is verified — USDT & INR withdrawals now enabled`;

  const html = renderIdentityVerifiedHtml({
    preheader,
    name,
    documentType,
    verifiedAt,
  });

  const text =
    `Identity verified — you're in\n\n` +
    `Hi ${name},\n\n` +
    `Great news — your Lv.2 identity verification has been approved.\n` +
    `USDT & INR withdrawals are now enabled on your account.\n\n` +
    `Verification level:  Lv.2 — Identity\n` +
    `Document type:       ${prettifyDocumentType(documentType)}\n` +
    `Now unlocked:        USDT & INR Withdrawals\n` +
    `Verified at:         ${whenStr}\n\n` +
    `Make a withdrawal:        https://qorixmarkets.com/wallet\n` +
    `Complete Lv.3 (Address):  https://qorixmarkets.com/profile\n\n` +
    `Verification is permanent. No further action is needed unless your ID\n` +
    `expires or our compliance team requests an update.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Identity Rejected (Lv.2) — UNIQUE dusty-plum "Let's Try Again" design.
// Fires when an admin rejects a Lv.2 identity submission (see routes/kyc.ts
// admin review handler at /admin/kyc/review with action="reject" &
// kind="identity"). Always includes the cleanReason — kyc.ts defaults
// to "Document not acceptable" when blank.
//
// Visual differentiators (vs all other emails):
//   • dusty plum / muted wine palette — refined empathetic "we need to chat"
//     (distinct from crimson alert, slate-cold withdrawal-rejected)
//   • "📋 ID UPDATE NEEDED" hero pill + "Let's Try Again" headline
//   • PROMINENT REASON tile — the centerpiece is the rejection reason
//     in a quote-style box (this is the most important info)
//   • Stacked rows: 🪪 document type · 📋 decision · 🕐 reviewed at
//   • DUAL CTA: "Resubmit Document" primary plum + "Contact Support" link
//   • Helpful "Common issues" reassurance card
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderIdentityRejectedHtml(opts: {
  preheader: string;
  name: string;
  documentType: string;
  reason: string;
  rejectedAt: Date;
}): string {
  const { preheader, name, documentType, reason, rejectedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${rejectedAt.getUTCDate()} ${MONTHS_SHORT[rejectedAt.getUTCMonth()]} ${rejectedAt.getUTCFullYear()} · ` +
    `${String(rejectedAt.getUTCHours()).padStart(2, "0")}:${String(rejectedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeDocType = escapeHtml(prettifyDocumentType(documentType));
  const safeReason = escapeHtml((reason || "").trim() || "Document not acceptable");
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
<title>ID update needed — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-reason-pad { padding:24px 22px 4px !important; }
    .qx-reason-cell { padding:18px 20px !important; }
    .qx-reason-text { font-size:15px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#1A0D14;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#1A0D14;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#1A0D14;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#22131C;border:1px solid rgba(232,168,188,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — dusty plum/wine gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#1A0D14;background-image:linear-gradient(135deg,#1A0D14 0%,#2A1520 45%,#4A1F35 80%,#7B2D52 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — needs-review pill + headline + plum divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#1A0D14;background-image:linear-gradient(135deg,#1A0D14 0%,#2A1520 45%,#4A1F35 80%,#7B2D52 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(232,168,188,0.18);border:1px solid rgba(232,168,188,0.55);font-size:10.5px;letter-spacing:2.4px;color:#F5D0DD;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              📋 ID Update Needed
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Let's Try Again
            </div>
            <div style="font-size:13.5px;color:#F5D0DD;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your ID couldn't be verified this time — here's what we found.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#E8A8BC 0%,#7B2D52 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PROMINENT REASON TILE — the centerpiece -->
        <tr>
          <td class="qx-reason-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#E8A8BC;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Why It Was Held
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-reason-cell" style="padding:22px 26px;background:#2A1520;background-image:linear-gradient(180deg,#2A1520 0%,#22131C 100%);border:1.5px solid rgba(232,168,188,0.45);border-left:4px solid #E8A8BC;border-radius:12px;box-shadow:0 0 28px rgba(123,45,82,0.30),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div class="qx-reason-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#FFFFFF;font-weight:500;line-height:1.55;text-align:left;font-style:italic;">
                    &ldquo;${safeReason}&rdquo;
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SUBMISSION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#E8A8BC;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Submission Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(232,168,188,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A88598;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🪪</span>Document Submitted</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeDocType}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(232,168,188,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A88598;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📋</span>Decision</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Resubmit Required</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#A88598;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Reviewed At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Resubmit Document" + secondary "Contact Support" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#9C3D6B 0%,#7B2D52 100%);background-color:#7B2D52;box-shadow:0 8px 28px rgba(123,45,82,0.55);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Resubmit Document
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#A88598;line-height:1.6;">
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#F5D0DD;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(245,208,221,0.4);">Contact Support →</a>
            </div>
          </td>
        </tr>

        <!-- Common-issues reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(232,168,188,0.06);border-left:2px solid rgba(232,168,188,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#A88598;">
              <div style="color:#F5D0DD;font-weight:600;margin-bottom:6px;">Tips for a smooth resubmission:</div>
              Take a fresh, well-lit photo on a flat surface · all four corners visible · no glare or shadows · ID must not be expired · name should match the one on your Qorix account. We'll review again within 24 hours.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#13080F;">
            <div style="font-size:13px;color:#F5D0DD;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#7A5868;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#F5D0DD;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Identity Rejected (Lv.2 KYC rejected) email. Caller looks up
// email + name + document type + cleaned reason, and passes them in.
// Replaces the previous generic sendTxnEmailToUser path inside the admin
// KYC review handler (see routes/kyc.ts /admin/kyc/review).
// ---------------------------------------------------------------------------
export async function sendIdentityRejected(args: {
  to: string;
  name: string;
  documentType: string;
  reason: string;
  rejectedAt: Date;
}): Promise<void> {
  const { to, name, documentType, reason, rejectedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${rejectedAt.getUTCDate()} ${MONTHS_SHORT[rejectedAt.getUTCMonth()]} ${rejectedAt.getUTCFullYear()} · ` +
    `${String(rejectedAt.getUTCHours()).padStart(2, "0")}:${String(rejectedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const cleanReason = (reason || "").trim() || "Document not acceptable";

  const subject = `Qorix Markets — Identity needs another look`;
  const preheader = `Your Lv.2 identity (${prettifyDocumentType(documentType)}) needs to be resubmitted — ${cleanReason.slice(0, 80)}`;

  const html = renderIdentityRejectedHtml({
    preheader,
    name,
    documentType,
    reason: cleanReason,
    rejectedAt,
  });

  const text =
    `Identity update needed — let's try again\n\n` +
    `Hi ${name},\n\n` +
    `Your Lv.2 identity verification couldn't be approved this time.\n\n` +
    `Reason:             ${cleanReason}\n\n` +
    `Document submitted: ${prettifyDocumentType(documentType)}\n` +
    `Decision:           Resubmit Required\n` +
    `Reviewed at:        ${whenStr}\n\n` +
    `Resubmit document: https://qorixmarkets.com/profile\n` +
    `Contact support:   support@qorixmarkets.com\n\n` +
    `Tips for a smooth resubmission: well-lit photo on a flat surface, all\n` +
    `four corners visible, no glare or shadows, ID not expired, name should\n` +
    `match your Qorix account. We'll review again within 24 hours.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Address Verified (Lv.3) — UNIQUE deep-teal + mint "Fully Verified" design.
// Fires when an admin approves a Lv.3 address proof — this is the FINAL
// KYC unlock, account becomes "fully verified" across all 3 levels
// (see routes/kyc.ts admin review handler at /admin/kyc/review with
// action="approve" & kind="address").
//
// Visual differentiators (vs all other emails):
//   • deep teal + electric mint palette — "elite tier reached" feel
//     (distinct from bright emerald deposit, cool cyan OTP, warm bronze ID)
//   • "🏆 FULLY VERIFIED" hero pill + "Fully Verified" headline
//   • PROGRESS LADDER tile — visual 3-step checklist showing all KYC levels
//     completed, with Lv.3 highlighted as the just-completed one
//   • Stacked rows: 🏠 verified region · 🎖️ account tier · 🕐 verified at
//   • DUAL CTA: "Start Trading" primary teal + "View KYC Status" link
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderAddressVerifiedHtml(opts: {
  preheader: string;
  name: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  verifiedAt: Date;
}): string {
  const { preheader, name, addressCity, addressState, addressCountry, verifiedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const region = [addressCity, addressState, addressCountry]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
  const safeRegion = escapeHtml(region || "On file");
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
<title>Fully verified — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-ladder-pad { padding:24px 22px 4px !important; }
    .qx-ladder-cell { padding:18px 18px !important; }
    .qx-ladder-label { font-size:13px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#031817;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#031817;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#031817;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#0A2624;border:1px solid rgba(94,234,212,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — deep teal + mint glow gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#031817;background-image:linear-gradient(135deg,#031817 0%,#0A2624 45%,#134E4A 80%,#14B8A6 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — fully-verified pill + headline + mint divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#031817;background-image:linear-gradient(135deg,#031817 0%,#0A2624 45%,#134E4A 80%,#14B8A6 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(94,234,212,0.18);border:1px solid rgba(94,234,212,0.55);font-size:10.5px;letter-spacing:2.4px;color:#A7F3D0;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🏆 Fully Verified
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Fully Verified
            </div>
            <div style="font-size:13.5px;color:#A7F3D0;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, all three KYC levels are complete — your account is fully verified.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#5EEAD4 0%,#14B8A6 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PROGRESS LADDER — visual 3-step checklist, Lv.3 highlighted -->
        <tr>
          <td class="qx-ladder-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#A7F3D0;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              KYC Progress
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-ladder-cell" style="padding:20px 22px;background:#0A2624;background-image:linear-gradient(180deg,#0F2E2C 0%,#0A2624 100%);border:1.5px solid rgba(94,234,212,0.35);border-radius:14px;box-shadow:0 0 28px rgba(20,184,166,0.20),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <!-- Step 1: Personal -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(94,234,212,0.20);border:1px solid rgba(94,234,212,0.55);font-size:14px;color:#A7F3D0;font-weight:700;">✓</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-ladder-label" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.3;">Lv.1 — Personal Details</div>
                        <div style="font-size:11px;color:#5EAD9F;font-weight:500;margin-top:2px;">Verified</div>
                      </td>
                    </tr>
                  </table>
                  <div style="height:1px;background:linear-gradient(90deg,rgba(94,234,212,0.4) 0%,rgba(94,234,212,0) 100%);margin:14px 0;"></div>
                  <!-- Step 2: Identity -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(94,234,212,0.20);border:1px solid rgba(94,234,212,0.55);font-size:14px;color:#A7F3D0;font-weight:700;">✓</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-ladder-label" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.3;">Lv.2 — Identity</div>
                        <div style="font-size:11px;color:#5EAD9F;font-weight:500;margin-top:2px;">Verified</div>
                      </td>
                    </tr>
                  </table>
                  <div style="height:1px;background:linear-gradient(90deg,rgba(94,234,212,0.4) 0%,rgba(94,234,212,0) 100%);margin:14px 0;"></div>
                  <!-- Step 3: Address (just completed — highlighted glow) -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#14B8A6;background-image:linear-gradient(135deg,#5EEAD4 0%,#14B8A6 100%);border:1px solid rgba(94,234,212,0.85);font-size:14px;color:#FFFFFF;font-weight:700;box-shadow:0 0 14px rgba(94,234,212,0.55);">✓</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-ladder-label" style="font-size:14px;color:#FFFFFF;font-weight:700;line-height:1.3;">Lv.3 — Address</div>
                        <div style="font-size:11px;color:#5EEAD4;font-weight:600;margin-top:2px;letter-spacing:0.5px;">Just verified ✦</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- VERIFICATION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#A7F3D0;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Verification Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(94,234,212,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#6B9D95;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🏠</span>Verified Region</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeRegion}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(94,234,212,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#6B9D95;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🎖️</span>Account Tier</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Fully Verified Member</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#6B9D95;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Verified At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Start Trading" + secondary "View KYC Status" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#5EEAD4 0%,#14B8A6 100%);background-color:#14B8A6;box-shadow:0 8px 28px rgba(20,184,166,0.45);">
                  <a href="https://qorixmarkets.com/trade" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#042F2C;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Start Trading
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#6B9D95;line-height:1.6;">
              Or check your <a href="https://qorixmarkets.com/profile" target="_blank" style="color:#A7F3D0;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(167,243,208,0.4);">KYC Status →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(94,234,212,0.06);border-left:2px solid rgba(94,234,212,0.5);border-radius:6px;padding:12px 16px;font-size:12.5px;line-height:1.6;color:#6B9D95;">
              <strong style="color:#A7F3D0;">Full verification is permanent.</strong>
              All Qorix Markets services — trading, USDT &amp; INR deposits, withdrawals, AI signals — are now unlocked at the highest tier. No further KYC action needed unless your ID expires.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#021110;">
            <div style="font-size:13px;color:#A7F3D0;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#4F706A;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#A7F3D0;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Address Verified (Lv.3 KYC approved) email — final KYC unlock,
// account becomes fully verified. Caller looks up email + name + address
// fields, and passes them in. Replaces the previous generic
// sendTxnEmailToUser path inside the admin KYC review handler
// (see routes/kyc.ts /admin/kyc/review).
// ---------------------------------------------------------------------------
export async function sendAddressVerified(args: {
  to: string;
  name: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  verifiedAt: Date;
}): Promise<void> {
  const { to, name, addressCity, addressState, addressCountry, verifiedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const region = [addressCity, addressState, addressCountry]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");

  const subject = `Qorix Markets — Fully verified 🏆 (all 3 KYC levels complete)`;
  const preheader = `Your Lv.3 address (${region || "on file"}) is verified — account is now fully verified across all 3 KYC levels`;

  const html = renderAddressVerifiedHtml({
    preheader,
    name,
    addressCity,
    addressState,
    addressCountry,
    verifiedAt,
  });

  const text =
    `Fully verified — all 3 KYC levels complete\n\n` +
    `Hi ${name},\n\n` +
    `Great news — your Lv.3 address verification has been approved.\n` +
    `Your account is now fully verified across all 3 KYC levels.\n\n` +
    `KYC Progress:\n` +
    `  ✓ Lv.1 — Personal Details (Verified)\n` +
    `  ✓ Lv.2 — Identity (Verified)\n` +
    `  ✓ Lv.3 — Address (Just verified)\n\n` +
    `Verified region:  ${region || "On file"}\n` +
    `Account tier:     Fully Verified Member\n` +
    `Verified at:      ${whenStr}\n\n` +
    `Start trading:        https://qorixmarkets.com/trade\n` +
    `View KYC status:      https://qorixmarkets.com/profile\n\n` +
    `Full verification is permanent. All Qorix services — trading, deposits,\n` +
    `withdrawals, AI signals — are now unlocked at the highest tier.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Address Rejected (Lv.3) — UNIQUE mocha/sepia "One More Look" design.
// Fires when an admin rejects a Lv.3 address proof submission (see
// routes/kyc.ts admin review handler at /admin/kyc/review with
// action="reject" & kind="address"). Always includes the cleanReason —
// kyc.ts defaults to "Document not acceptable" when blank.
//
// Visual differentiators (vs all other emails):
//   • mocha/sepia palette — vintage warm letter aesthetic, thematically
//     perfect for address (mail = postal/sepia). Distinct from plum
//     (identity-rejected) and slate (withdrawal-rejected)
//   • "📬 ADDRESS UPDATE NEEDED" hero pill + "One More Look" headline
//   • PROMINENT REASON tile — sepia quote-style with cream left-accent
//   • Stacked rows: 📋 decision · 🕐 reviewed at
//   • Sepia "Common reasons" tips card — DIFFERENT tips than Identity
//     (focuses on doc age, full-address visibility, profile match)
//   • DUAL CTA: "Resubmit Address" primary mocha + "Contact Support" link
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderAddressRejectedHtml(opts: {
  preheader: string;
  name: string;
  reason: string;
  rejectedAt: Date;
}): string {
  const { preheader, name, reason, rejectedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${rejectedAt.getUTCDate()} ${MONTHS_SHORT[rejectedAt.getUTCMonth()]} ${rejectedAt.getUTCFullYear()} · ` +
    `${String(rejectedAt.getUTCHours()).padStart(2, "0")}:${String(rejectedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeReason = escapeHtml((reason || "").trim() || "Document not acceptable");
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
<title>Address update needed — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-reason-pad { padding:24px 22px 4px !important; }
    .qx-reason-cell { padding:18px 20px !important; }
    .qx-reason-text { font-size:15px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#1A1410;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#1A1410;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#1A1410;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#2A1F18;border:1px solid rgba(212,178,138,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — mocha/sepia gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#1A1410;background-image:linear-gradient(135deg,#1A1410 0%,#2A1F18 45%,#4A3826 80%,#8B6F47 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — needs-review pill + headline + sepia divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#1A1410;background-image:linear-gradient(135deg,#1A1410 0%,#2A1F18 45%,#4A3826 80%,#8B6F47 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(212,178,138,0.18);border:1px solid rgba(212,178,138,0.55);font-size:10.5px;letter-spacing:2.4px;color:#E8D4B5;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              📬 Address Update Needed
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              One More Look
            </div>
            <div style="font-size:13.5px;color:#E8D4B5;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your address proof needs another submission — here's what we noticed.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#D4B28A 0%,#8B6F47 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PROMINENT REASON TILE — sepia quote-style centerpiece -->
        <tr>
          <td class="qx-reason-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#D4B28A;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Why It Was Held
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-reason-cell" style="padding:22px 26px;background:#2A1F18;background-image:linear-gradient(180deg,#322318 0%,#2A1F18 100%);border:1.5px solid rgba(212,178,138,0.40);border-left:4px solid #D4B28A;border-radius:12px;box-shadow:0 0 28px rgba(139,111,71,0.25),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div class="qx-reason-text" style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#FFFFFF;font-weight:500;line-height:1.55;text-align:left;font-style:italic;">
                    &ldquo;${safeReason}&rdquo;
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SUBMISSION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#D4B28A;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Submission Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(212,178,138,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#9C8270;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📋</span>Decision</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Resubmit Required</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#9C8270;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Reviewed At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Resubmit Address" + secondary "Contact Support" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#A88758 0%,#8B6F47 100%);background-color:#8B6F47;box-shadow:0 8px 28px rgba(139,111,71,0.55);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Resubmit Address
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#9C8270;line-height:1.6;">
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#E8D4B5;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(232,212,181,0.4);">Contact Support →</a>
            </div>
          </td>
        </tr>

        <!-- Common-reasons tips card (DIFFERENT from identity tips) -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(212,178,138,0.06);border-left:2px solid rgba(212,178,138,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#9C8270;">
              <div style="color:#E8D4B5;font-weight:600;margin-bottom:6px;">What works as valid address proof:</div>
              Utility bill, bank statement, or government letter · dated within the last 3 months · your <strong style="color:#E8D4B5;">full name</strong> and <strong style="color:#E8D4B5;">full address</strong> clearly visible · photo crisp and unobstructed · address must match the one on file in your profile. We'll review again within 24 hours.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#120D0A;">
            <div style="font-size:13px;color:#E8D4B5;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#6E5944;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#E8D4B5;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Address Rejected (Lv.3 KYC rejected) email. Caller looks up
// email + name + cleaned reason, and passes them in. Replaces the previous
// generic sendTxnEmailToUser path inside the admin KYC review handler
// (see routes/kyc.ts /admin/kyc/review).
// ---------------------------------------------------------------------------
export async function sendAddressRejected(args: {
  to: string;
  name: string;
  reason: string;
  rejectedAt: Date;
}): Promise<void> {
  const { to, name, reason, rejectedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${rejectedAt.getUTCDate()} ${MONTHS_SHORT[rejectedAt.getUTCMonth()]} ${rejectedAt.getUTCFullYear()} · ` +
    `${String(rejectedAt.getUTCHours()).padStart(2, "0")}:${String(rejectedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const cleanReason = (reason || "").trim() || "Document not acceptable";

  const subject = `Qorix Markets — Address needs another look`;
  const preheader = `Your Lv.3 address proof needs to be resubmitted — ${cleanReason.slice(0, 80)}`;

  const html = renderAddressRejectedHtml({
    preheader,
    name,
    reason: cleanReason,
    rejectedAt,
  });

  const text =
    `Address update needed — one more look\n\n` +
    `Hi ${name},\n\n` +
    `Your Lv.3 address verification couldn't be approved this time.\n\n` +
    `Reason:        ${cleanReason}\n\n` +
    `Decision:      Resubmit Required\n` +
    `Reviewed at:   ${whenStr}\n\n` +
    `Resubmit address: https://qorixmarkets.com/profile\n` +
    `Contact support:  support@qorixmarkets.com\n\n` +
    `Valid address proof: utility bill, bank statement, or government letter,\n` +
    `dated within the last 3 months, with your full name and full address\n` +
    `clearly visible. Address must match the one on file in your profile.\n` +
    `We'll review again within 24 hours.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Identity Submitted (Lv.2 — pending review) — UNIQUE misty-sage "In Review"
// design. Fires when a user uploads their Lv.2 identity document and the
// submission is queued for admin review (see routes/kyc.ts at the
// /kyc/identity submit endpoint).
//
// Visual differentiators (vs all other emails):
//   • misty sage / slate-green palette — muted desaturated reading
//     as "quietly working in background / nothing alarming". Distinct
//     from bright emerald/teal (celebrations) and cool cyan (OTP)
//   • "🔍 UNDER REVIEW" hero pill + "In Review" headline
//   • REVIEW TIMELINE tile — 3-stage progress bar showing where the
//     user is in the workflow (✓ Submitted · ⏳ Under Review now ·
//     ⏸ Decision). UNIQUE to pending emails — visually differentiates
//     from verified/rejected variants
//   • Stacked rows: 🪪 document submitted · ⏱ submitted at ·
//     ⏳ expected decision
//   • Single CTA: "View KYC Status" (passive — no action required)
//   • Reassurance card explaining what they can still do while waiting
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderIdentitySubmittedHtml(opts: {
  preheader: string;
  name: string;
  documentType: string;
  submittedAt: Date;
}): string {
  const { preheader, name, documentType, submittedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${submittedAt.getUTCDate()} ${MONTHS_SHORT[submittedAt.getUTCMonth()]} ${submittedAt.getUTCFullYear()} · ` +
    `${String(submittedAt.getUTCHours()).padStart(2, "0")}:${String(submittedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeDocType = escapeHtml(prettifyDocumentType(documentType));
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
<title>Identity in review — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-tl-pad { padding:24px 22px 4px !important; }
    .qx-tl-cell { padding:18px 18px !important; }
    .qx-tl-label { font-size:13px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0F1614;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0F1614;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0F1614;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1A2420;border:1px solid rgba(180,220,200,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — misty sage gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0F1614;background-image:linear-gradient(135deg,#0F1614 0%,#1A2420 45%,#2D4138 80%,#5B8478 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — under-review pill + headline + sage divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0F1614;background-image:linear-gradient(135deg,#0F1614 0%,#1A2420 45%,#2D4138 80%,#5B8478 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(180,220,200,0.18);border:1px solid rgba(180,220,200,0.55);font-size:10.5px;letter-spacing:2.4px;color:#C8DDD2;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🔍 Under Review
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              In Review
            </div>
            <div style="font-size:13.5px;color:#C8DDD2;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your Lv.2 identity is with our compliance team — we'll have an answer within 24 hours.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#9DC3B5 0%,#5B8478 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- REVIEW TIMELINE — 3-stage progress bar (UNIQUE to pending emails) -->
        <tr>
          <td class="qx-tl-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#C8DDD2;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Review Timeline
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-tl-cell" style="padding:20px 22px;background:#1A2420;background-image:linear-gradient(180deg,#1F2C27 0%,#1A2420 100%);border:1.5px solid rgba(180,220,200,0.35);border-radius:14px;box-shadow:0 0 28px rgba(91,132,120,0.18),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <!-- Step 1: Submitted (done) -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(180,220,200,0.20);border:1px solid rgba(180,220,200,0.55);font-size:14px;color:#C8DDD2;font-weight:700;">✓</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-tl-label" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.3;">Submitted</div>
                        <div style="font-size:11px;color:#7A9990;font-weight:500;margin-top:2px;">Document received</div>
                      </td>
                    </tr>
                  </table>
                  <div style="height:1px;background:linear-gradient(90deg,rgba(180,220,200,0.4) 0%,rgba(180,220,200,0) 100%);margin:14px 0;"></div>
                  <!-- Step 2: Under Review (current — highlighted glow) -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#5B8478;background-image:linear-gradient(135deg,#9DC3B5 0%,#5B8478 100%);border:1px solid rgba(180,220,200,0.85);font-size:14px;color:#FFFFFF;font-weight:700;box-shadow:0 0 14px rgba(157,195,181,0.55);">⏳</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-tl-label" style="font-size:14px;color:#FFFFFF;font-weight:700;line-height:1.3;">Under Review</div>
                        <div style="font-size:11px;color:#9DC3B5;font-weight:600;margin-top:2px;letter-spacing:0.5px;">Compliance team checking ✦</div>
                      </td>
                    </tr>
                  </table>
                  <div style="height:1px;background:linear-gradient(90deg,rgba(180,220,200,0.4) 0%,rgba(180,220,200,0) 100%);margin:14px 0;"></div>
                  <!-- Step 3: Decision (upcoming — dim) -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="middle" style="width:32px;padding:0 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(180,220,200,0.06);border:1px dashed rgba(180,220,200,0.30);font-size:13px;color:#5C7A72;font-weight:700;">·</div>
                      </td>
                      <td valign="middle">
                        <div class="qx-tl-label" style="font-size:14px;color:#7A9990;font-weight:500;line-height:1.3;">Decision</div>
                        <div style="font-size:11px;color:#5C7A72;font-weight:500;margin-top:2px;">Email + in-app notification</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SUBMISSION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#C8DDD2;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Submission Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(180,220,200,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#7A9990;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🪪</span>Document Submitted</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeDocType}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(180,220,200,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#7A9990;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⏱</span>Submitted At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#7A9990;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⏳</span>Expected Decision</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Within 24 hours</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Single passive CTA — "View KYC Status" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#7BA89B 0%,#5B8478 100%);background-color:#5B8478;box-shadow:0 8px 28px rgba(91,132,120,0.45);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    View KYC Status
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#7A9990;line-height:1.6;">
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#C8DDD2;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(200,221,210,0.4);">Contact Support →</a>
            </div>
          </td>
        </tr>

        <!-- "What you can do while waiting" reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(180,220,200,0.06);border-left:2px solid rgba(180,220,200,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#7A9990;">
              <div style="color:#C8DDD2;font-weight:600;margin-bottom:6px;">While we review:</div>
              You can still trade and make INR deposits. <strong style="color:#C8DDD2;">USDT &amp; INR withdrawals</strong> will unlock once Lv.2 is approved. We never ask for additional documents over email or social media — only inside your Qorix account.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0A100E;">
            <div style="font-size:13px;color:#C8DDD2;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#506862;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#C8DDD2;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Identity Submitted (Lv.2 KYC pending) email — confirms upload
// receipt and sets review-time expectations. Replaces the previous generic
// sendTxnEmailToUser path inside the user-facing /kyc/identity submit
// endpoint (see routes/kyc.ts).
// ---------------------------------------------------------------------------
export async function sendIdentitySubmitted(args: {
  to: string;
  name: string;
  documentType: string;
  submittedAt: Date;
}): Promise<void> {
  const { to, name, documentType, submittedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${submittedAt.getUTCDate()} ${MONTHS_SHORT[submittedAt.getUTCMonth()]} ${submittedAt.getUTCFullYear()} · ` +
    `${String(submittedAt.getUTCHours()).padStart(2, "0")}:${String(submittedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const docPretty = prettifyDocumentType(documentType);

  const subject = `Qorix Markets — Identity in review (Lv.2)`;
  const preheader = `Your ${docPretty} is with our compliance team — we'll have an answer within 24 hours`;

  const html = renderIdentitySubmittedHtml({
    preheader,
    name,
    documentType,
    submittedAt,
  });

  const text =
    `Identity in review — Lv.2\n\n` +
    `Hi ${name},\n\n` +
    `Thanks — your Lv.2 identity is with our compliance team. We'll have\n` +
    `an answer within 24 hours.\n\n` +
    `Review timeline:\n` +
    `  ✓  Submitted (document received)\n` +
    `  ⏳ Under review (compliance team checking)\n` +
    `  ·  Decision (email + in-app notification)\n\n` +
    `Document submitted:  ${docPretty}\n` +
    `Submitted at:        ${whenStr}\n` +
    `Expected decision:   Within 24 hours\n\n` +
    `View KYC status: https://qorixmarkets.com/profile\n` +
    `Contact support: support@qorixmarkets.com\n\n` +
    `While we review, you can still trade and make INR deposits. USDT & INR\n` +
    `withdrawals will unlock once Lv.2 is approved. We never ask for\n` +
    `additional documents over email or social media — only inside your\n` +
    `Qorix account.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Address Submitted (Lv.3 — pending review) — UNIQUE pewter/silver-blue
// "Logged for Review" design with passport-stamp Address Snapshot.
// Fires when a user uploads their Lv.3 address proof and the submission
// is queued for admin review (see routes/kyc.ts at the /kyc/address
// submit endpoint).
//
// Visual differentiators (vs all other emails):
//   • cool pewter / silver-blue palette — postal-sorting-facility metallic
//     vibe. Distinct from sage (identity-submitted's "quiet patience") and
//     sapphire (device-otp's vibrant blue) — pewter is muted/neutral
//   • "📬 REVIEW QUEUED" hero pill + "Logged for Review" headline
//   • ADDRESS SNAPSHOT tile (centerpiece) — passport-stamp-style card
//     showing the submitted city/state/country. The address IS the data
//     here, not a generic process — DIFFERENT from identity-submitted's
//     timeline approach
//   • Compact "in queue" thin strip below — preserves status awareness
//     without duplicating identity-submitted's full 3-step timeline
//   • Stacked rows: ⏱ submitted at · ⏳ expected decision
//   • Single passive CTA: "View KYC Status"
//   • Reassurance card explaining what happens next
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderAddressSubmittedHtml(opts: {
  preheader: string;
  name: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  submittedAt: Date;
}): string {
  const { preheader, name, addressCity, addressState, addressCountry, submittedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${submittedAt.getUTCDate()} ${MONTHS_SHORT[submittedAt.getUTCMonth()]} ${submittedAt.getUTCFullYear()} · ` +
    `${String(submittedAt.getUTCHours()).padStart(2, "0")}:${String(submittedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeCity = escapeHtml((addressCity || "").trim() || "—");
  const safeState = escapeHtml((addressState || "").trim() || "—");
  const safeCountry = escapeHtml((addressCountry || "").trim() || "—");
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
<title>Address logged for review — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-stamp-pad { padding:24px 22px 4px !important; }
    .qx-stamp-cell { padding:22px 22px !important; }
    .qx-stamp-region { font-size:18px !important; letter-spacing:1.5px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#10141A;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#10141A;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#10141A;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1A1F28;border:1px solid rgba(196,214,232,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — pewter/silver-blue gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#10141A;background-image:linear-gradient(135deg,#10141A 0%,#1A1F28 45%,#2E3848 80%,#6B7E96 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — review-queued pill + headline + pewter divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#10141A;background-image:linear-gradient(135deg,#10141A 0%,#1A1F28 45%,#2E3848 80%,#6B7E96 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(196,214,232,0.18);border:1px solid rgba(196,214,232,0.55);font-size:10.5px;letter-spacing:2.4px;color:#D6E2F0;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              📬 Review Queued
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Logged for Review
            </div>
            <div style="font-size:13.5px;color:#D6E2F0;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your Lv.3 address proof has been logged with our compliance team — review usually takes 24 hours.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#A8BFD8 0%,#6B7E96 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- ADDRESS SNAPSHOT — passport-stamp-style centerpiece -->
        <tr>
          <td class="qx-stamp-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#A8BFD8;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Address On File
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-stamp-cell" style="padding:24px 26px;background:#1A1F28;background-image:linear-gradient(135deg,#202836 0%,#1A1F28 60%,#1A1F28 100%);border:1.5px solid rgba(196,214,232,0.40);border-radius:14px;box-shadow:0 0 28px rgba(107,126,150,0.18),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <!-- Top decorative row: address-stamp aesthetic -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                    <tr>
                      <td align="left" style="font-size:9.5px;letter-spacing:1.8px;color:#A8BFD8;font-weight:600;text-transform:uppercase;white-space:nowrap;">
                        🏠 Verified Region
                      </td>
                      <td align="right" style="font-size:9.5px;letter-spacing:1.8px;color:#D6E2F0;font-weight:600;text-transform:uppercase;white-space:nowrap;">
                        Qorix · Lv.3
                      </td>
                    </tr>
                  </table>
                  <!-- City — biggest -->
                  <div class="qx-stamp-region" style="font-size:22px;line-height:1.15;color:#FFFFFF;font-weight:800;letter-spacing:1.5px;text-align:center;text-transform:uppercase;text-shadow:0 0 18px rgba(168,191,216,0.30);">
                    ${safeCity}
                  </div>
                  <!-- State -->
                  <div style="font-size:13px;line-height:1.3;color:#D6E2F0;font-weight:500;text-align:center;margin-top:6px;letter-spacing:0.8px;">
                    ${safeState}
                  </div>
                  <!-- Pewter divider -->
                  <div style="height:1px;background:linear-gradient(90deg,rgba(196,214,232,0) 0%,rgba(196,214,232,0.6) 50%,rgba(196,214,232,0) 100%);margin:14px 0;"></div>
                  <!-- Country -->
                  <div style="font-size:11px;letter-spacing:2.4px;color:#A8BFD8;font-weight:700;text-align:center;text-transform:uppercase;">
                    ${safeCountry}
                  </div>
                </td>
              </tr>
            </table>
            <!-- Compact "in queue" thin strip — preserves status awareness -->
            <div style="margin-top:16px;font-size:11.5px;color:#7E8FA6;line-height:1.5;text-align:center;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#A8BFD8;box-shadow:0 0 10px rgba(168,191,216,0.7);vertical-align:middle;margin-right:6px;"></span>
              <span style="vertical-align:middle;">In compliance queue — decision usually within 24h</span>
            </div>
          </td>
        </tr>

        <!-- SUBMISSION DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#A8BFD8;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Submission Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(196,214,232,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#7E8FA6;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⏱</span>Submitted At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#7E8FA6;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⏳</span>Expected Decision</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Within 24 hours</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Single passive CTA — "View KYC Status" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#7B92AC 0%,#5E7591 100%);background-color:#5E7591;box-shadow:0 8px 28px rgba(94,117,145,0.45);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    View KYC Status
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#7E8FA6;line-height:1.6;">
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#D6E2F0;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(214,226,240,0.4);">Contact Support →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(196,214,232,0.06);border-left:2px solid rgba(196,214,232,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#7E8FA6;">
              <div style="color:#D6E2F0;font-weight:600;margin-bottom:6px;">What happens next:</div>
              Once Lv.3 is approved, your account becomes <strong style="color:#D6E2F0;">fully verified</strong> — all services unlock at the highest tier. You can keep trading and using deposits/withdrawals normally during the review. We never ask for additional documents over email or social media.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0B0E14;">
            <div style="font-size:13px;color:#D6E2F0;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#586577;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#D6E2F0;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Address Submitted (Lv.3 KYC pending) email — confirms the
// address proof was received and sets review-time expectations. Replaces
// the previous generic sendTxnEmailToUser path inside the user-facing
// /kyc/address submit endpoint (see routes/kyc.ts).
// ---------------------------------------------------------------------------
export async function sendAddressSubmitted(args: {
  to: string;
  name: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  submittedAt: Date;
}): Promise<void> {
  const { to, name, addressCity, addressState, addressCountry, submittedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${submittedAt.getUTCDate()} ${MONTHS_SHORT[submittedAt.getUTCMonth()]} ${submittedAt.getUTCFullYear()} · ` +
    `${String(submittedAt.getUTCHours()).padStart(2, "0")}:${String(submittedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const region = [addressCity, addressState, addressCountry]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");

  const subject = `Qorix Markets — Address logged for review (Lv.3)`;
  const preheader = `Your Lv.3 address proof (${region || "on file"}) is in the compliance queue — decision usually within 24 hours`;

  const html = renderAddressSubmittedHtml({
    preheader,
    name,
    addressCity,
    addressState,
    addressCountry,
    submittedAt,
  });

  const text =
    `Address logged for review — Lv.3\n\n` +
    `Hi ${name},\n\n` +
    `Thanks — your Lv.3 address proof has been logged with our compliance\n` +
    `team. Review usually takes 24 hours.\n\n` +
    `Address on file:\n` +
    `  ${region || "On file"}\n\n` +
    `Submitted at:        ${whenStr}\n` +
    `Expected decision:   Within 24 hours\n\n` +
    `View KYC status: https://qorixmarkets.com/profile\n` +
    `Contact support: support@qorixmarkets.com\n\n` +
    `Once Lv.3 is approved, your account becomes fully verified — all\n` +
    `services unlock at the highest tier. You can keep trading and using\n` +
    `deposits/withdrawals normally during the review. We never ask for\n` +
    `additional documents over email or social media.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Personal Verified (Lv.1 — auto-approved) — UNIQUE warm coral "First Step
// Done" design with split Unlocked/What's-Next tiles. Fires when a user
// submits their basic personal details and is auto-approved (no admin
// review needed for Lv.1) — see routes/kyc.ts at the /kyc/personal
// submit endpoint around line 111.
//
// Visual differentiators (vs all other emails):
//   • warm coral / peach palette — sunny, encouraging, forward-momentum.
//     Distinct from rose+gold (festive INR), orange (pure tangerine
//     in-transit), mocha (sepia brown), bronze (metallic warm), crimson
//     (pure red alert)
//   • "🌅 STEP 1 COMPLETE" hero pill + "First Step Done" headline
//   • Split centerpiece (UNIQUE) — TWO side-by-side intent tiles:
//       a) "Unlocked Now" with green checkmarks (what Lv.1 grants)
//       b) "Unlocks at Lv.2" with dim placeholders (forward hint)
//     Frames Lv.1 as a gateway with concrete value, not just paperwork
//   • Stacked rows: 🎖️ tier · 🕐 verified at
//   • Primary CTA: "Continue to Lv.2" (forward momentum) +
//     secondary "Browse Trading Dashboard"
//   • Reassurance card with anti-phishing reminder
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderPersonalVerifiedHtml(opts: {
  preheader: string;
  name: string;
  verifiedAt: Date;
}): string {
  const { preheader, name, verifiedAt } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
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
<title>First step done — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-tiles-pad { padding:24px 22px 4px !important; }
    .qx-tile-cell { padding:18px 18px !important; }
    .qx-tile-title { font-size:11px !important; }
    .qx-tile-stack { display:block !important; width:100% !important; padding:0 !important; }
    .qx-tile-stack-spacer { display:block !important; height:14px !important; line-height:14px !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-label { font-size:10.5px !important; }
    .qx-snap-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#15100D;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#15100D;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#15100D;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1F1612;border:1px solid rgba(255,200,175,0.28);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">

        <!-- LOGO BAR — warm coral/peach gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#15100D;background-image:linear-gradient(135deg,#15100D 0%,#1F1612 45%,#5C2818 78%,#FF7B5C 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — step-1 pill + headline + coral divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#15100D;background-image:linear-gradient(135deg,#15100D 0%,#1F1612 45%,#5C2818 78%,#FF7B5C 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(255,200,175,0.18);border:1px solid rgba(255,200,175,0.55);font-size:10.5px;letter-spacing:2.4px;color:#FFD2B8;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🌅 Step 1 Complete
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              First Step Done
            </div>
            <div style="font-size:13.5px;color:#FFD2B8;margin-top:10px;font-weight:500;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your basic profile is verified — let's complete the next step to unlock more features.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#FFAE8E 0%,#FF7B5C 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- SPLIT TILES — Unlocked Now (left) + Unlocks at Lv.2 (right) -->
        <tr>
          <td class="qx-tiles-pad" align="center" style="padding:32px 24px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- LEFT: Unlocked Now -->
                <td class="qx-tile-stack" valign="top" width="50%" style="width:50%;padding-right:7px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="qx-tile-cell" style="padding:18px 18px;background:#1F1612;background-image:linear-gradient(180deg,#27190F 0%,#1F1612 100%);border:1.5px solid rgba(255,200,175,0.40);border-radius:14px;box-shadow:0 0 24px rgba(255,123,92,0.18),inset 0 1px 0 rgba(255,255,255,0.04);">
                        <div class="qx-tile-title" style="font-size:11px;letter-spacing:1.8px;color:#FFD2B8;font-weight:700;text-transform:uppercase;margin-bottom:12px;">
                          ✨ Unlocked Now
                        </div>
                        <div style="font-size:13px;color:#FFFFFF;font-weight:500;line-height:1.85;">
                          <div><span style="color:#5EEAD4;margin-right:6px;font-weight:700;">✓</span>Browse markets</div>
                          <div><span style="color:#5EEAD4;margin-right:6px;font-weight:700;">✓</span>Crypto trading</div>
                          <div><span style="color:#5EEAD4;margin-right:6px;font-weight:700;">✓</span>INR deposits</div>
                          <div><span style="color:#5EEAD4;margin-right:6px;font-weight:700;">✓</span>USDT deposits</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td class="qx-tile-stack-spacer" width="14" style="width:14px;font-size:1px;line-height:1px;">&nbsp;</td>
                <!-- RIGHT: Unlocks at Lv.2 -->
                <td class="qx-tile-stack" valign="top" width="50%" style="width:50%;padding-left:7px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="qx-tile-cell" style="padding:18px 18px;background:#1A1410;background-image:linear-gradient(180deg,#1F1812 0%,#1A1410 100%);border:1.5px dashed rgba(255,200,175,0.25);border-radius:14px;">
                        <div class="qx-tile-title" style="font-size:11px;letter-spacing:1.8px;color:#A8867A;font-weight:700;text-transform:uppercase;margin-bottom:12px;">
                          🔒 Unlocks at Lv.2
                        </div>
                        <div style="font-size:13px;color:#A8867A;font-weight:500;line-height:1.85;">
                          <div><span style="color:#7A5C50;margin-right:6px;font-weight:700;">·</span>USDT withdrawals</div>
                          <div><span style="color:#7A5C50;margin-right:6px;font-weight:700;">·</span>INR withdrawals</div>
                          <div><span style="color:#7A5C50;margin-right:6px;font-weight:700;">·</span>Higher limits</div>
                          <div><span style="color:#7A5C50;margin-right:6px;font-weight:700;">·</span>Verified badge</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACCOUNT DETAILS — stacked rows -->
        <tr>
          <td class="qx-snap-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FFD2B8;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Account Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(255,200,175,0.16);">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#9C7B6E;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🎖️</span>Account Tier</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Verified Member · Lv.1</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-snap-label" style="font-size:11px;letter-spacing:1.6px;color:#9C7B6E;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Verified At</div>
                  <div class="qx-snap-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Continue to Lv.2" + secondary "Trading Dashboard" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#FFAE8E 0%,#FF7B5C 100%);background-color:#FF7B5C;box-shadow:0 8px 28px rgba(255,123,92,0.55);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 42px;font-size:15px;font-weight:700;color:#3A1408;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Continue to Lv.2 →
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#9C7B6E;line-height:1.6;">
              Or browse the <a href="https://qorixmarkets.com/trade" target="_blank" style="color:#FFD2B8;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(255,210,184,0.4);">Trading Dashboard →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(255,200,175,0.06);border-left:2px solid rgba(255,200,175,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#9C7B6E;">
              <div style="color:#FFD2B8;font-weight:600;margin-bottom:6px;">What's next:</div>
              Lv.2 is a quick ID upload (passport, national ID, driver's licence, Aadhaar, or PAN) — usually reviewed within 24 hours. We never ask for additional documents over email or social media — only inside your Qorix account.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0E0907;">
            <div style="font-size:13px;color:#FFD2B8;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#705247;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FFD2B8;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Personal Verified (Lv.1 KYC auto-approved) email — confirms
// the basic profile is verified and nudges the user toward Lv.2. Replaces
// the previous generic sendTxnEmailToUser path inside the user-facing
// /kyc/personal submit endpoint (see routes/kyc.ts).
// ---------------------------------------------------------------------------
export async function sendPersonalVerified(args: {
  to: string;
  name: string;
  verifiedAt: Date;
}): Promise<void> {
  const { to, name, verifiedAt } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${verifiedAt.getUTCDate()} ${MONTHS_SHORT[verifiedAt.getUTCMonth()]} ${verifiedAt.getUTCFullYear()} · ` +
    `${String(verifiedAt.getUTCHours()).padStart(2, "0")}:${String(verifiedAt.getUTCMinutes()).padStart(2, "0")} UTC`;

  const subject = `Qorix Markets — First step done 🌅 (Lv.1 verified)`;
  const preheader = `Your basic profile is verified — continue to Lv.2 to unlock USDT & INR withdrawals`;

  const html = renderPersonalVerifiedHtml({
    preheader,
    name,
    verifiedAt,
  });

  const text =
    `First step done — Lv.1 verified\n\n` +
    `Hi ${name},\n\n` +
    `Your basic profile has been verified. Welcome to Qorix Markets!\n\n` +
    `Unlocked now:\n` +
    `  ✓ Browse markets\n` +
    `  ✓ Crypto trading\n` +
    `  ✓ INR deposits\n` +
    `  ✓ USDT deposits\n\n` +
    `Unlocks at Lv.2:\n` +
    `  · USDT withdrawals\n` +
    `  · INR withdrawals\n` +
    `  · Higher limits\n` +
    `  · Verified badge\n\n` +
    `Account tier:   Verified Member · Lv.1\n` +
    `Verified at:    ${whenStr}\n\n` +
    `Continue to Lv.2:    https://qorixmarkets.com/profile\n` +
    `Trading dashboard:   https://qorixmarkets.com/trade\n\n` +
    `Lv.2 is a quick ID upload (passport, national ID, driver's licence,\n` +
    `Aadhaar, or PAN) — usually reviewed within 24 hours. We never ask for\n` +
    `additional documents over email or social media.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Password Changed confirmation — UNIQUE carbon-black + electric lime
// "Locked Down" design. Fires after a successful password reset / change
// (forgot-password flow + in-app password change).
//
// Visual differentiators (vs all other emails):
//   • carbon-black + electric LIME palette — yellow-green tech-vault
//     log aesthetic. Lime is distinct from emerald (USDT deposit
//     celebration), teal-mint (Lv.3 verified celebration), and sage
//     (identity-submitted patience) — sharper, more neon, more
//     "security indicator" than "celebration"
//   • "🔒 PASSWORD UPDATED" hero pill + "Locked Down" headline
//   • ACCOUNT CHANGES SNAPSHOT (centerpiece, UNIQUE) — vertical tile
//     with 2 sections:
//       a) ✓ CHANGED · password (just now)
//       b) ⚪ UNCHANGED · email · phone · 2FA · devices
//     Helps users catch attacker tampering — "did anything else change?"
//     This is conceptually different from the Lv.1 split-tile (which
//     was about future feature unlocks)
//   • Stacked rows: 🕐 changed at · 📍 source (IP + browser, optional)
//   • Primary CTA — RED-tinted "Wasn't you? Secure Account" (security
//     red, not the friendly lime) so the recovery action stands out
//   • Secondary "All good — view security settings →"
//   • Reassurance card with 2FA-enable nudge + anti-phishing reminder
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderPasswordChangedHtml(opts: {
  preheader: string;
  name: string;
  changedAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): string {
  const { preheader, name, changedAt, ip, browser, os } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${changedAt.getUTCDate()} ${MONTHS_SHORT[changedAt.getUTCMonth()]} ${changedAt.getUTCFullYear()} · ` +
    `${String(changedAt.getUTCHours()).padStart(2, "0")}:${String(changedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeWhen = escapeHtml(whenStr);
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const safeSource = sourceParts.length > 0 ? escapeHtml(sourceParts.join(" · ")) : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Password updated — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-snap-pad { padding:24px 22px 4px !important; }
    .qx-snap-cell { padding:20px 20px !important; }
    .qx-snap-row-label { font-size:10.5px !important; }
    .qx-snap-row-value { font-size:13.5px !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#08090B;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#08090B;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#08090B;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#13151A;border:1px solid rgba(217,249,157,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.65);">

        <!-- LOGO BAR — carbon → lime gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#08090B;background-image:linear-gradient(135deg,#08090B 0%,#13151A 45%,#1B3017 78%,#A3E635 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — alert pill + headline + lime divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#08090B;background-image:linear-gradient(135deg,#08090B 0%,#13151A 45%,#1B3017 78%,#A3E635 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(217,249,157,0.18);border:1px solid rgba(217,249,157,0.55);font-size:10.5px;letter-spacing:2.4px;color:#D9F99D;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ⚠️ Password Changed
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Password Just Changed
            </div>
            <div style="font-size:13.5px;color:#D9F99D;margin-top:10px;font-weight:500;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your account password was just changed. If this <strong style="color:#FFFFFF;">wasn't you</strong>, reset your password immediately — your funds are safe.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#D9F99D 0%,#84CC16 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- 24-HOUR WITHDRAWAL HOLD banner — security pause notice -->
        <tr>
          <td align="center" style="padding:24px 24px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 18px;background:#1A1308;background-image:linear-gradient(180deg,#241B0E 0%,#1A1308 100%);border:1.5px solid rgba(251,191,36,0.45);border-radius:12px;box-shadow:0 0 24px rgba(251,191,36,0.18);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 12px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(251,191,36,0.18);border:1px solid rgba(251,191,36,0.6);font-size:14px;color:#FBBF24;font-weight:700;">🛡</div>
                      </td>
                      <td valign="top">
                        <div style="font-size:11.5px;letter-spacing:1.6px;color:#FBBF24;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">24-Hour Withdrawal Hold Active</div>
                        <div style="font-size:13px;color:#E5D5A8;font-weight:500;line-height:1.55;">For your safety, all USDT &amp; INR withdrawals are paused until <strong style="color:#FFFFFF;">${escapeHtml(formatHoldUntil(changedAt))}</strong>. Trading and deposits continue as normal during this window.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACCOUNT CHANGES SNAPSHOT — vertical 2-section tile -->
        <tr>
          <td class="qx-snap-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#D9F99D;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Account Changes Snapshot
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-snap-cell" style="padding:22px 24px;background:#13151A;background-image:linear-gradient(180deg,#1A1F18 0%,#13151A 100%);border:1.5px solid rgba(217,249,157,0.35);border-radius:14px;box-shadow:0 0 28px rgba(163,230,53,0.18),inset 0 1px 0 rgba(255,255,255,0.03);">
                  <!-- CHANGED row -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:#A3E635;background-image:linear-gradient(135deg,#D9F99D 0%,#65A30D 100%);border:1px solid rgba(217,249,157,0.85);font-size:13px;color:#1A2008;font-weight:800;box-shadow:0 0 14px rgba(163,230,53,0.55);">✓</div>
                      </td>
                      <td valign="top">
                        <div class="qx-snap-row-label" style="font-size:11px;letter-spacing:1.8px;color:#A3E635;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">Changed</div>
                        <div class="qx-snap-row-value" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.4;">Password <span style="color:#A3E635;font-weight:500;">· just now</span></div>
                      </td>
                    </tr>
                  </table>
                  <!-- Lime divider -->
                  <div style="height:1px;background:linear-gradient(90deg,rgba(217,249,157,0.4) 0%,rgba(217,249,157,0) 100%);margin:18px 0;"></div>
                  <!-- UNCHANGED row -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 14px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(217,249,157,0.06);border:1px dashed rgba(217,249,157,0.30);font-size:11px;color:#7A8B6A;font-weight:700;">·</div>
                      </td>
                      <td valign="top">
                        <div class="qx-snap-row-label" style="font-size:11px;letter-spacing:1.8px;color:#7A8B6A;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">Unchanged</div>
                        <div class="qx-snap-row-value" style="font-size:14px;color:#B5C49A;font-weight:500;line-height:1.5;">Email · Phone · 2FA · Trusted devices</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- "Verify nothing else changed" strip -->
            <div style="margin-top:14px;font-size:11.5px;color:#6B7C5A;line-height:1.5;text-align:center;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#A3E635;box-shadow:0 0 10px rgba(163,230,53,0.7);vertical-align:middle;margin-right:6px;"></span>
              <span style="vertical-align:middle;">Only your password was touched — verify nothing else looks off.</span>
            </div>
          </td>
        </tr>

        <!-- DETAILS — stacked rows -->
        <tr>
          <td class="qx-detail-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#D9F99D;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Event Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(217,249,157,0.16);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7A8B6A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Changed At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              ${safeSource ? `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7A8B6A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Source</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;">${safeSource}</div>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7A8B6A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🛡</span>Status</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Password change applied successfully</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Wasn't you?" RED + secondary "All good" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#F87171 0%,#DC2626 100%);background-color:#DC2626;box-shadow:0 8px 28px rgba(220,38,38,0.45);">
                  <a href="https://qorixmarkets.com/forgot-password" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 36px;font-size:14.5px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Wasn't you? Secure Account
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#7A8B6A;line-height:1.6;">
              All good? <a href="https://qorixmarkets.com/profile" target="_blank" style="color:#D9F99D;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(217,249,157,0.4);">View security settings →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(217,249,157,0.06);border-left:2px solid rgba(217,249,157,0.5);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#7A8B6A;">
              <div style="color:#D9F99D;font-weight:600;margin-bottom:6px;">Why the 24-hour hold?</div>
              Even if an attacker changed your password, they cannot move funds for 24 hours — giving you time to act. Enable <strong style="color:#D9F99D;">2-Factor Authentication</strong> as a second lock so even your password alone can't unlock your account. We never ask for your password over email, social media, or phone.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#06070A;">
            <div style="font-size:13px;color:#D9F99D;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#4C5847;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#D9F99D;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Password Changed confirmation email — fires after a successful
// password change (forgot-password flow + in-app password change).
// ---------------------------------------------------------------------------
export async function sendPasswordChanged(args: {
  to: string;
  name: string;
  changedAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, changedAt, ip, browser, os } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${changedAt.getUTCDate()} ${MONTHS_SHORT[changedAt.getUTCMonth()]} ${changedAt.getUTCFullYear()} · ` +
    `${String(changedAt.getUTCHours()).padStart(2, "0")}:${String(changedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  const subject = `Qorix Markets — Password just changed ⚠️ — verify it was you`;
  const preheader = `Your account password was just changed. If this wasn't you, reset immediately — your funds are safe (24h withdrawal hold active).`;

  const html = renderPasswordChangedHtml({
    preheader,
    name,
    changedAt,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `Password Just Changed\n\n` +
    `Hi ${name},\n\n` +
    `Your Qorix Markets account password was just changed. If this WASN'T\n` +
    `you, reset your password immediately — your funds are safe.\n\n` +
    `🛡 24-hour withdrawal hold active\n` +
    `For your safety, all USDT & INR withdrawals are paused until\n` +
    `${formatHoldUntil(changedAt)}. Trading and deposits continue as normal\n` +
    `during this window.\n\n` +
    `Account changes snapshot:\n` +
    `  ✓ Changed:    Password (just now)\n` +
    `  · Unchanged:  Email · Phone · 2FA · Trusted devices\n\n` +
    `Only your password was touched — verify nothing else looks off.\n\n` +
    `Changed at:   ${whenStr}\n` +
    (sourceLine ? `Source:       ${sourceLine}\n\n` : `Status:       Password change applied successfully\n\n`) +
    `Wasn't you? Reset password: https://qorixmarkets.com/forgot-password\n` +
    `All good? View security settings: https://qorixmarkets.com/profile\n\n` +
    `Why the 24-hour hold? Even if an attacker changed your password, they\n` +
    `cannot move funds for 24 hours — giving you time to act. Enable\n` +
    `2-Factor Authentication as a second lock. We never ask for your\n` +
    `password over email, social media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// TWO-FACTOR AUTHENTICATION ENABLED — confirmation email
// ---------------------------------------------------------------------------
// VAULT theme: midnight indigo + electric violet.
// Layout flow:
//   • Logo bar (midnight → indigo → violet gradient)
//   • Hero: 🛡 2FA ENABLED pill · "Vault Armed" headline · sub
//   • RECOVERY CODES URGENCY banner (deep violet, glowing key icon) — the
//     critical action: backup codes are one-time-shown
//   • PROTECTION LAYERS centerpiece: dual-lock visual (🔒 Password + 🛡 2FA)
//     side-by-side, both glowing, with "both required to sign in" footer
//   • Event Details: armed at · method · source (IP + browser, optional)
//   • Primary CTA "Save Recovery Codes →" (violet gradient)
//   • Secondary "Wasn't you? Contact support →"
//   • Reassurance card: "Lost your phone?" + recovery codes + anti-phishing
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
function prettifyTwoFactorMethod(raw: string): string {
  const m = raw.toLowerCase().trim();
  if (m === "totp" || m === "authenticator" || m === "app") return "TOTP authenticator app";
  if (m === "sms" || m === "phone" || m === "text") return "SMS to your phone";
  if (m === "email" || m === "mail") return "Email code";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function renderTwoFactorEnabledHtml(opts: {
  preheader: string;
  name: string;
  enabledAt: Date;
  method: string;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): string {
  const { preheader, name, enabledAt, method, ip, browser, os } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${enabledAt.getUTCDate()} ${MONTHS_SHORT[enabledAt.getUTCMonth()]} ${enabledAt.getUTCFullYear()} · ` +
    `${String(enabledAt.getUTCHours()).padStart(2, "0")}:${String(enabledAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeWhen = escapeHtml(whenStr);
  const safeMethod = escapeHtml(prettifyTwoFactorMethod(method));
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const safeSource = sourceParts.length > 0 ? escapeHtml(sourceParts.join(" · ")) : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>2FA enabled — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-locks-pad { padding:24px 20px 4px !important; }
    .qx-lock-cell { padding:18px 10px !important; }
    .qx-lock-title { font-size:11px !important; }
    .qx-lock-status { font-size:12px !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#08081A;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#08081A;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#08081A;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#13131F;border:1px solid rgba(167,139,250,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.65);">

        <!-- LOGO BAR — midnight → violet gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#08081A;background-image:linear-gradient(135deg,#08081A 0%,#1E1B4B 45%,#4C1D95 78%,#A78BFA 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — 2FA armed pill + headline + violet divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#08081A;background-image:linear-gradient(135deg,#08081A 0%,#1E1B4B 45%,#4C1D95 78%,#A78BFA 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(196,181,253,0.20);border:1px solid rgba(196,181,253,0.55);font-size:10.5px;letter-spacing:2.4px;color:#DDD6FE;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🛡 2FA Enabled
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Vault Armed
            </div>
            <div style="font-size:13.5px;color:#DDD6FE;margin-top:10px;font-weight:500;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, two-factor authentication is now <strong style="color:#FFFFFF;">active</strong>. Even if someone gets your password, they can't sign in without your second code.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#DDD6FE 0%,#8B5CF6 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- RECOVERY CODES URGENCY banner — critical one-time action -->
        <tr>
          <td align="center" style="padding:24px 24px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 18px;background:#1A0A2E;background-image:linear-gradient(180deg,#220D3A 0%,#1A0A2E 100%);border:1.5px solid rgba(196,181,253,0.50);border-radius:12px;box-shadow:0 0 28px rgba(139,92,246,0.28);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 12px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(196,181,253,0.22);border:1px solid rgba(196,181,253,0.65);font-size:14px;color:#DDD6FE;font-weight:700;">🔑</div>
                      </td>
                      <td valign="top">
                        <div style="font-size:11.5px;letter-spacing:1.6px;color:#DDD6FE;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">Save Your Recovery Codes Now</div>
                        <div style="font-size:13px;color:#C4B5FD;font-weight:500;line-height:1.55;">Your one-time-shown backup codes are needed if you lose your phone. <strong style="color:#FFFFFF;">Save them somewhere safe right now</strong> — they will not be shown again.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PROTECTION LAYERS — dual-lock centerpiece -->
        <tr>
          <td class="qx-locks-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#DDD6FE;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Protection Layers
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Lock 1: Password (existing) -->
                <td class="qx-lock-cell" width="50%" valign="top" style="width:50%;padding:22px 14px;background:#13131F;background-image:linear-gradient(180deg,#1A1530 0%,#13131F 100%);border:1.5px solid rgba(167,139,250,0.30);border-radius:14px;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);">
                  <div style="width:48px;height:48px;line-height:48px;border-radius:14px;background:rgba(167,139,250,0.14);border:1px solid rgba(167,139,250,0.40);font-size:22px;color:#A78BFA;margin:0 auto 12px;text-align:center;">🔒</div>
                  <div class="qx-lock-title" style="font-size:11.5px;letter-spacing:1.8px;color:#A78BFA;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">Password</div>
                  <div class="qx-lock-status" style="font-size:13px;color:#FFFFFF;font-weight:600;line-height:1.4;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#A78BFA;vertical-align:middle;margin-right:5px;"></span>
                    <span style="vertical-align:middle;">Active</span>
                  </div>
                </td>
                <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
                <!-- Lock 2: 2FA (just armed — STRONGER glow) -->
                <td class="qx-lock-cell" width="50%" valign="top" style="width:50%;padding:22px 14px;background:#13131F;background-image:linear-gradient(180deg,#1F1538 0%,#180D2E 100%);border:1.5px solid rgba(196,181,253,0.65);border-radius:14px;text-align:center;box-shadow:0 0 28px rgba(139,92,246,0.32),inset 0 1px 0 rgba(255,255,255,0.04);">
                  <div style="width:48px;height:48px;line-height:48px;border-radius:14px;background:rgba(196,181,253,0.20);border:1px solid rgba(196,181,253,0.65);font-size:22px;color:#DDD6FE;margin:0 auto 12px;text-align:center;box-shadow:0 0 16px rgba(196,181,253,0.50);">🛡</div>
                  <div class="qx-lock-title" style="font-size:11.5px;letter-spacing:1.8px;color:#DDD6FE;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">2-Factor</div>
                  <div class="qx-lock-status" style="font-size:13px;color:#FFFFFF;font-weight:600;line-height:1.4;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#DDD6FE;box-shadow:0 0 8px rgba(221,214,254,0.85);vertical-align:middle;margin-right:5px;"></span>
                    <span style="vertical-align:middle;">Just armed</span>
                  </div>
                </td>
              </tr>
            </table>
            <!-- "both required" strip -->
            <div style="margin-top:14px;font-size:11.5px;color:#7C6F9A;line-height:1.5;text-align:center;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#A78BFA;box-shadow:0 0 10px rgba(167,139,250,0.7);vertical-align:middle;margin-right:6px;"></span>
              <span style="vertical-align:middle;">Both layers required to sign in to your account.</span>
            </div>
          </td>
        </tr>

        <!-- DETAILS — stacked rows -->
        <tr>
          <td class="qx-detail-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#DDD6FE;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Event Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(167,139,250,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C6F9A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Armed At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(167,139,250,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C6F9A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🔐</span>Method</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeMethod}</div>
                </td>
              </tr>
              ${safeSource ? `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C6F9A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Source</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;">${safeSource}</div>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C6F9A;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🛡</span>Status</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Two-factor authentication enabled successfully</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Save Recovery Codes" violet + secondary "Wasn't you" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#A78BFA 0%,#7C3AED 100%);background-color:#7C3AED;box-shadow:0 8px 28px rgba(124,58,237,0.50);">
                  <a href="https://qorixmarkets.com/profile" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 36px;font-size:14.5px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Save Recovery Codes →
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#7C6F9A;line-height:1.6;">
              Wasn't you? <a href="mailto:support@qorixmarkets.com" style="color:#DDD6FE;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(221,214,254,0.4);">Contact support →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(167,139,250,0.07);border-left:2px solid rgba(167,139,250,0.55);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#9989B5;">
              <div style="color:#DDD6FE;font-weight:600;margin-bottom:6px;">Lost your phone? Don't panic.</div>
              Use any one of your <strong style="color:#DDD6FE;">recovery codes</strong> to sign in — that's exactly what they're for. We never ask for your 2FA code over email, social media, or phone.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#06061A;">
            <div style="font-size:13px;color:#DDD6FE;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#5A5278;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#DDD6FE;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the 2FA Enabled confirmation email — fires after the user successfully
// arms two-factor authentication on their account.
// ---------------------------------------------------------------------------
export async function sendTwoFactorEnabled(args: {
  to: string;
  name: string;
  enabledAt: Date;
  method: string;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, enabledAt, method, ip, browser, os } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${enabledAt.getUTCDate()} ${MONTHS_SHORT[enabledAt.getUTCMonth()]} ${enabledAt.getUTCFullYear()} · ` +
    `${String(enabledAt.getUTCHours()).padStart(2, "0")}:${String(enabledAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const methodLabel = prettifyTwoFactorMethod(method);
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  const subject = `Qorix Markets — 2FA armed 🛡 — your account is now stronger`;
  const preheader = `Two-factor authentication is now active. Save your one-time recovery codes right now — they won't be shown again.`;

  const html = renderTwoFactorEnabledHtml({
    preheader,
    name,
    enabledAt,
    method,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `Vault Armed — 2FA Enabled\n\n` +
    `Hi ${name},\n\n` +
    `Two-factor authentication is now ACTIVE on your Qorix Markets account.\n` +
    `Even if someone gets your password, they can't sign in without your\n` +
    `second code. Your account is significantly stronger.\n\n` +
    `🔑 SAVE YOUR RECOVERY CODES NOW\n` +
    `Your one-time-shown backup codes are needed if you lose your phone.\n` +
    `Save them somewhere safe right now — they will not be shown again.\n\n` +
    `Protection layers:\n` +
    `  🔒 Password   · Active\n` +
    `  🛡 2-Factor   · Just armed\n` +
    `Both layers are required to sign in to your account.\n\n` +
    `Armed at:    ${whenStr}\n` +
    `Method:      ${methodLabel}\n` +
    (sourceLine ? `Source:      ${sourceLine}\n\n` : `Status:      Two-factor authentication enabled successfully\n\n`) +
    `Save recovery codes: https://qorixmarkets.com/profile\n` +
    `Wasn't you? Contact support: support@qorixmarkets.com\n\n` +
    `Lost your phone? Use any one of your recovery codes to sign in — that's\n` +
    `exactly what they're for. We never ask for your 2FA code over email,\n` +
    `social media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// TWO-FACTOR AUTHENTICATION DISABLED — security alert email
// ---------------------------------------------------------------------------
// OXBLOOD-EMBER theme: deep burgundy + ember-red. Mirror of "Vault Armed":
// where #18 lit up the second lock, this email shows it removed/dim.
// Layout flow:
//   • Logo bar (oxblood → ember gradient)
//   • Hero: ⚠️ 2FA DISABLED pill · "A Lock Just Came Off" · alert sub
//   • PROTECTION REDUCED banner (deep burgundy, ⚠ shield icon)
//   • PROTECTION LAYERS dual-lock centerpiece — Password ACTIVE, 2FA REMOVED
//     (dim, ✗ icon, dashed border) + "ONLY 1 LAYER LEFT" warning strip
//   • Event Details: disabled at · source (IP + browser, optional)
//   • Primary CTA "Wasn't you? Reset Password" (red gradient)
//   • Secondary "All good? Re-enable 2FA →"
//   • Reassurance card: "Anyone you don't recognize?" + anti-phishing
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderTwoFactorDisabledHtml(opts: {
  preheader: string;
  name: string;
  disabledAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): string {
  const { preheader, name, disabledAt, ip, browser, os } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${disabledAt.getUTCDate()} ${MONTHS_SHORT[disabledAt.getUTCMonth()]} ${disabledAt.getUTCFullYear()} · ` +
    `${String(disabledAt.getUTCHours()).padStart(2, "0")}:${String(disabledAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeWhen = escapeHtml(whenStr);
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const safeSource = sourceParts.length > 0 ? escapeHtml(sourceParts.join(" · ")) : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>2FA disabled — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-locks-pad { padding:24px 20px 4px !important; }
    .qx-lock-cell { padding:18px 10px !important; }
    .qx-lock-title { font-size:11px !important; }
    .qx-lock-status { font-size:12px !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#14060A;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#14060A;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#14060A;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1F0A12;border:1px solid rgba(252,165,165,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.75);">

        <!-- LOGO BAR — oxblood → ember gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#14060A;background-image:linear-gradient(135deg,#14060A 0%,#3F0A14 45%,#7F1D1D 78%,#DC2626 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — alert pill + headline + ember divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#14060A;background-image:linear-gradient(135deg,#14060A 0%,#3F0A14 45%,#7F1D1D 78%,#DC2626 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(252,165,165,0.22);border:1px solid rgba(252,165,165,0.60);font-size:10.5px;letter-spacing:2.4px;color:#FECACA;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ⚠️ 2FA Disabled
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              A Lock Just Came Off
            </div>
            <div style="font-size:13.5px;color:#FECACA;margin-top:10px;font-weight:500;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, two-factor authentication has been removed from your account. If this <strong style="color:#FFFFFF;">wasn't you</strong>, reset your password immediately.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#FCA5A5 0%,#DC2626 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PROTECTION REDUCED banner — security weakened alert -->
        <tr>
          <td align="center" style="padding:24px 24px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 18px;background:#2A0810;background-image:linear-gradient(180deg,#3A0C16 0%,#2A0810 100%);border:1.5px solid rgba(252,165,165,0.50);border-radius:12px;box-shadow:0 0 28px rgba(220,38,38,0.30);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 12px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(252,165,165,0.22);border:1px solid rgba(252,165,165,0.65);font-size:14px;color:#FECACA;font-weight:700;">⚠</div>
                      </td>
                      <td valign="top">
                        <div style="font-size:11.5px;letter-spacing:1.6px;color:#FECACA;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">Account Protection Reduced</div>
                        <div style="font-size:13px;color:#FCA5A5;font-weight:500;line-height:1.55;">Your account is now protected by your <strong style="color:#FFFFFF;">password alone</strong>. Anyone with your password can sign in. We strongly recommend re-enabling 2FA.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PROTECTION LAYERS — dual-lock: Password ACTIVE, 2FA REMOVED -->
        <tr>
          <td class="qx-locks-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FECACA;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Protection Layers
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Lock 1: Password (still active — sole layer) -->
                <td class="qx-lock-cell" width="50%" valign="top" style="width:50%;padding:22px 14px;background:#1F0A12;background-image:linear-gradient(180deg,#2A0E18 0%,#1F0A12 100%);border:1.5px solid rgba(252,165,165,0.35);border-radius:14px;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);">
                  <div style="width:48px;height:48px;line-height:48px;border-radius:14px;background:rgba(252,165,165,0.14);border:1px solid rgba(252,165,165,0.40);font-size:22px;color:#FCA5A5;margin:0 auto 12px;text-align:center;">🔒</div>
                  <div class="qx-lock-title" style="font-size:11.5px;letter-spacing:1.8px;color:#FCA5A5;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">Password</div>
                  <div class="qx-lock-status" style="font-size:13px;color:#FFFFFF;font-weight:600;line-height:1.4;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#FCA5A5;vertical-align:middle;margin-right:5px;"></span>
                    <span style="vertical-align:middle;">Active</span>
                  </div>
                </td>
                <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
                <!-- Lock 2: 2FA — REMOVED (dim, dashed border, ✗ overlay) -->
                <td class="qx-lock-cell" width="50%" valign="top" style="width:50%;padding:22px 14px;background:#160508;background-image:linear-gradient(180deg,#1A0508 0%,#120406 100%);border:1.5px dashed rgba(252,165,165,0.30);border-radius:14px;text-align:center;">
                  <div style="width:48px;height:48px;line-height:48px;border-radius:14px;background:rgba(252,165,165,0.05);border:1px dashed rgba(252,165,165,0.30);font-size:22px;color:#6B3540;margin:0 auto 12px;text-align:center;position:relative;">
                    <span style="opacity:0.35;">🛡</span>
                  </div>
                  <div class="qx-lock-title" style="font-size:11.5px;letter-spacing:1.8px;color:#6B3540;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">2-Factor</div>
                  <div class="qx-lock-status" style="font-size:13px;color:#9F6B75;font-weight:600;line-height:1.4;">
                    <span style="display:inline-block;width:14px;height:14px;line-height:14px;text-align:center;border-radius:999px;background:rgba(220,38,38,0.20);border:1px solid rgba(252,165,165,0.45);font-size:9px;color:#FECACA;font-weight:800;vertical-align:middle;margin-right:5px;">✗</span>
                    <span style="vertical-align:middle;">Removed</span>
                  </div>
                </td>
              </tr>
            </table>
            <!-- "only 1 layer left" warning strip -->
            <div style="margin-top:14px;font-size:11.5px;color:#9F6B75;line-height:1.5;text-align:center;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#DC2626;box-shadow:0 0 10px rgba(220,38,38,0.85);vertical-align:middle;margin-right:6px;"></span>
              <span style="vertical-align:middle;color:#FECACA;font-weight:600;">Only 1 layer left</span><span style="vertical-align:middle;"> — your password is the last line of defense.</span>
            </div>
          </td>
        </tr>

        <!-- DETAILS — stacked rows -->
        <tr>
          <td class="qx-detail-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FECACA;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Event Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(252,165,165,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9F6B75;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Disabled At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              ${safeSource ? `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9F6B75;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Source</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;">${safeSource}</div>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9F6B75;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⚠</span>Status</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Two-factor authentication removed</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Wasn't you?" RED + secondary "Re-enable 2FA" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#F87171 0%,#B91C1C 100%);background-color:#B91C1C;box-shadow:0 8px 28px rgba(185,28,28,0.55);">
                  <a href="https://qorixmarkets.com/forgot-password" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 36px;font-size:14.5px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Wasn't you? Reset Password
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#9F6B75;line-height:1.6;">
              All good? <a href="https://qorixmarkets.com/profile" target="_blank" style="color:#FECACA;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(254,202,202,0.4);">Re-enable 2FA →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(252,165,165,0.07);border-left:2px solid rgba(252,165,165,0.55);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#B59197;">
              <div style="color:#FECACA;font-weight:600;margin-bottom:6px;">Anyone you don't recognize?</div>
              Reset your password right now and re-enable 2FA. We <strong style="color:#FECACA;">never</strong> disable 2FA without an explicit request from your authenticated session, and we never ask for your password over email, social media, or phone.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0E0408;">
            <div style="font-size:13px;color:#FECACA;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#6B3540;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FECACA;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the 2FA Disabled security alert email — fires after the user (or an
// attacker) successfully removes two-factor authentication from the account.
// ---------------------------------------------------------------------------
export async function sendTwoFactorDisabled(args: {
  to: string;
  name: string;
  disabledAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, disabledAt, ip, browser, os } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${disabledAt.getUTCDate()} ${MONTHS_SHORT[disabledAt.getUTCMonth()]} ${disabledAt.getUTCFullYear()} · ` +
    `${String(disabledAt.getUTCHours()).padStart(2, "0")}:${String(disabledAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  const subject = `Qorix Markets — 2FA disabled ⚠️ — verify it was you`;
  const preheader = `Two-factor authentication was just removed from your account. If this wasn't you, reset your password immediately.`;

  const html = renderTwoFactorDisabledHtml({
    preheader,
    name,
    disabledAt,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `A Lock Just Came Off — 2FA Disabled\n\n` +
    `Hi ${name},\n\n` +
    `Two-factor authentication has been REMOVED from your Qorix Markets\n` +
    `account. If this WASN'T you, reset your password immediately.\n\n` +
    `⚠ Account Protection Reduced\n` +
    `Your account is now protected by your password alone. Anyone with\n` +
    `your password can sign in. We strongly recommend re-enabling 2FA.\n\n` +
    `Protection layers:\n` +
    `  🔒 Password   · Active\n` +
    `  ✗ 2-Factor   · Removed\n` +
    `Only 1 layer left — your password is the last line of defense.\n\n` +
    `Disabled at: ${whenStr}\n` +
    (sourceLine ? `Source:      ${sourceLine}\n\n` : `Status:      Two-factor authentication removed\n\n`) +
    `Wasn't you? Reset password: https://qorixmarkets.com/forgot-password\n` +
    `All good? Re-enable 2FA: https://qorixmarkets.com/profile\n\n` +
    `Anyone you don't recognize? Reset your password right now and\n` +
    `re-enable 2FA. We never disable 2FA without an explicit request from\n` +
    `your authenticated session, and we never ask for your password over\n` +
    `email, social media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Mask helpers for displaying contact info in change-alert emails.
// ---------------------------------------------------------------------------
function maskEmailAddress(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}•${domain}`;
  return `${local[0]}${"•".repeat(Math.min(6, local.length - 1))}${domain}`;
}

function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length <= 6) return phone;
  const m = cleaned.match(/^(\+?\d{1,3})(.+)(\d{4})$/);
  if (m) {
    const cc = m[1];
    const last4 = m[3];
    return `${cc} •••• ••${last4}`;
  }
  return `${cleaned.slice(0, 2)}${"•".repeat(Math.max(4, cleaned.length - 6))}${cleaned.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// CONTACT INFO CHANGED — security alert email (sent to the OLD address)
// ---------------------------------------------------------------------------
// TWILIGHT-CHROME theme: deep twilight navy + chrome yellow. Distinct from
// sapphire (more saturated) and carbon+lime (warm cool-black + green-yellow).
// Layout flow:
//   • Logo bar (twilight → storm-grey → chrome-yellow gradient)
//   • Hero: ⚠️ {EMAIL|PHONE} CHANGED pill · "Your {Email|Number} Just Moved"
//     headline · alert sub with "this address no longer linked"
//   • LOST-ACCESS banner (yellow alert: "this {address|number} can't be used
//     to sign in or recover the account anymore")
//   • REROUTE diagram centerpiece: OLD value (✗ removed, dim) → arrow →
//     NEW value (✓ active, glow). Both values are MASKED for security.
//   • Event Details: changed at · source (IP + browser, optional)
//   • Primary CTA "Wasn't you? Contact Support" (red gradient — urgent)
//   • Secondary "Was you? You can ignore this message."
//   • Reassurance card: "Recovering a hijacked account" + anti-phishing
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderContactChangedAlertHtml(opts: {
  preheader: string;
  name: string;
  attribute: "email" | "phone";
  oldDisplay: string; // already masked (or full if caller wants)
  newDisplay: string; // already masked (or full if caller wants)
  changedAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): string {
  const { preheader, name, attribute, oldDisplay, newDisplay, changedAt, ip, browser, os } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${changedAt.getUTCDate()} ${MONTHS_SHORT[changedAt.getUTCMonth()]} ${changedAt.getUTCFullYear()} · ` +
    `${String(changedAt.getUTCHours()).padStart(2, "0")}:${String(changedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeWhen = escapeHtml(whenStr);
  const safeOld = escapeHtml(oldDisplay);
  const safeNew = escapeHtml(newDisplay);
  const isEmail = attribute === "email";
  const attrLabel = isEmail ? "Email" : "Phone";
  const attrLower = isEmail ? "email address" : "phone number";
  const attrIcon = isEmail ? "✉" : "📱";
  const pillEmoji = "⚠️";
  const headline = isEmail ? "Your Email Just Moved" : "Your Number Just Moved";
  const lostAccessLine = isEmail
    ? `This email address (the one you're reading right now) is <strong style="color:#FFFFFF;">no longer linked</strong> to your account. You won't receive future logins, OTPs, or recovery messages here.`
    : `This phone number (the one being notified) is <strong style="color:#FFFFFF;">no longer linked</strong> to your account. You won't receive future SMS OTPs or recovery codes here.`;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const safeSource = sourceParts.length > 0 ? escapeHtml(sourceParts.join(" · ")) : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${attrLabel} changed — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-reroute-pad { padding:24px 18px 4px !important; }
    .qx-reroute-cell { padding:18px 12px !important; }
    .qx-reroute-arrow { padding:14px 0 !important; }
    .qx-reroute-arrow-text { display:block !important; transform:rotate(90deg) !important; font-size:18px !important; }
    .qx-reroute-stack { display:block !important; width:100% !important; }
    .qx-reroute-value { font-size:13px !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0A1424;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0A1424;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0A1424;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#14203A;border:1px solid rgba(253,224,71,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.70);">

        <!-- LOGO BAR — twilight → storm → chrome-yellow gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0A1424;background-image:linear-gradient(135deg,#0A1424 0%,#1E3A5F 45%,#475569 75%,#FACC15 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — alert pill + headline + chrome divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0A1424;background-image:linear-gradient(135deg,#0A1424 0%,#1E3A5F 45%,#475569 75%,#FACC15 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(253,224,71,0.20);border:1px solid rgba(253,224,71,0.55);font-size:10.5px;letter-spacing:2.4px;color:#FDE68A;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ${pillEmoji} ${attrLabel} Changed
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              ${headline}
            </div>
            <div style="font-size:13.5px;color:#FDE68A;margin-top:10px;font-weight:500;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, your account ${attrLower} has been changed. If this <strong style="color:#FFFFFF;">wasn't you</strong>, contact support immediately to recover your account.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#FDE68A 0%,#EAB308 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- LOST-ACCESS banner — this contact no longer linked -->
        <tr>
          <td align="center" style="padding:24px 24px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 18px;background:#1A1308;background-image:linear-gradient(180deg,#241B0E 0%,#1A1308 100%);border:1.5px solid rgba(253,224,71,0.50);border-radius:12px;box-shadow:0 0 24px rgba(250,204,21,0.22);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 12px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(253,224,71,0.22);border:1px solid rgba(253,224,71,0.65);font-size:14px;color:#FDE68A;font-weight:700;">⚠</div>
                      </td>
                      <td valign="top">
                        <div style="font-size:11.5px;letter-spacing:1.6px;color:#FDE68A;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">${isEmail ? "This Address No Longer Linked" : "This Number No Longer Linked"}</div>
                        <div style="font-size:13px;color:#FEF3C7;font-weight:500;line-height:1.55;">${lostAccessLine}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- REROUTE DIAGRAM — old → arrow → new (masked for security) -->
        <tr>
          <td class="qx-reroute-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FDE68A;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Account ${attrLabel} Rerouted
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- OLD (this address — ✗ removed, dim) -->
                <td class="qx-reroute-cell qx-reroute-stack" width="44%" valign="top" style="width:44%;padding:18px 14px;background:#0E1828;background-image:linear-gradient(180deg,#11192C 0%,#0B1322 100%);border:1.5px dashed rgba(253,224,71,0.30);border-radius:14px;text-align:center;">
                  <div style="font-size:10.5px;letter-spacing:1.8px;color:#7C8AA0;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">Previous ${attrLabel}</div>
                  <div class="qx-reroute-value" style="font-size:14px;color:#9EAEC7;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;word-break:break-all;margin-bottom:10px;">${attrIcon} ${safeOld}</div>
                  <div style="font-size:11.5px;color:#FCA5A5;font-weight:600;line-height:1.4;">
                    <span style="display:inline-block;width:14px;height:14px;line-height:14px;text-align:center;border-radius:999px;background:rgba(220,38,38,0.20);border:1px solid rgba(252,165,165,0.45);font-size:9px;color:#FECACA;font-weight:800;vertical-align:middle;margin-right:5px;">✗</span>
                    <span style="vertical-align:middle;">Removed</span>
                  </div>
                </td>
                <!-- ARROW -->
                <td class="qx-reroute-arrow qx-reroute-stack" width="12%" valign="middle" style="width:12%;text-align:center;">
                  <div class="qx-reroute-arrow-text" style="font-size:24px;color:#FDE68A;line-height:1;font-weight:700;">→</div>
                </td>
                <!-- NEW (now active) -->
                <td class="qx-reroute-cell qx-reroute-stack" width="44%" valign="top" style="width:44%;padding:18px 14px;background:#1A1A1F;background-image:linear-gradient(180deg,#1F1F0C 0%,#15150A 100%);border:1.5px solid rgba(253,224,71,0.55);border-radius:14px;text-align:center;box-shadow:0 0 22px rgba(250,204,21,0.30);">
                  <div style="font-size:10.5px;letter-spacing:1.8px;color:#FDE68A;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:8px;">New ${attrLabel}</div>
                  <div class="qx-reroute-value" style="font-size:14px;color:#FFFFFF;font-weight:700;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;word-break:break-all;margin-bottom:10px;">${attrIcon} ${safeNew}</div>
                  <div style="font-size:11.5px;color:#FACC15;font-weight:700;line-height:1.4;">
                    <span style="display:inline-block;width:14px;height:14px;line-height:14px;text-align:center;border-radius:999px;background:rgba(250,204,21,0.22);border:1px solid rgba(253,224,71,0.65);font-size:9px;color:#FDE68A;font-weight:800;vertical-align:middle;margin-right:5px;">✓</span>
                    <span style="vertical-align:middle;">Active</span>
                  </div>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:11.5px;color:#7C8AA0;line-height:1.5;text-align:center;">
              Values shown are masked for your security.
            </div>
          </td>
        </tr>

        <!-- DETAILS — stacked rows -->
        <tr>
          <td class="qx-detail-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FDE68A;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Event Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(253,224,71,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C8AA0;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Changed At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              ${safeSource ? `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C8AA0;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Source</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;">${safeSource}</div>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#7C8AA0;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⚠</span>Status</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${attrLabel} change applied</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary "Wasn't you?" RED + secondary text -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#F87171 0%,#B91C1C 100%);background-color:#B91C1C;box-shadow:0 8px 28px rgba(185,28,28,0.55);">
                  <a href="mailto:support@qorixmarkets.com?subject=Account%20${attrLabel}%20Changed%20Without%20My%20Consent" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 36px;font-size:14.5px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    Wasn't you? Contact Support
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#7C8AA0;line-height:1.6;">
              Was you? You can safely <span style="color:#FDE68A;font-weight:600;">ignore this message</span> — no further action needed.
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(253,224,71,0.07);border-left:2px solid rgba(253,224,71,0.55);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#A6B3C9;">
              <div style="color:#FDE68A;font-weight:600;margin-bottom:6px;">Recovering a hijacked account</div>
              Forward this email to <a href="mailto:support@qorixmarkets.com" style="color:#FDE68A;text-decoration:none;font-weight:600;">support@qorixmarkets.com</a> with subject <em>"Account ${attrLabel} Changed Without My Consent"</em>. Our team will verify your identity and restore access. We <strong style="color:#FDE68A;">never</strong> change your ${attrLower} without an OTP confirmation, and we never ask for your password over email, social media, or phone.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#08111E;">
            <div style="font-size:13px;color:#FDE68A;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#4A586E;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FDE68A;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Contact Changed alert to the OLD email address. The NEW address
// gets its own welcome/confirm email (separate template, future).
// ---------------------------------------------------------------------------
export async function sendEmailChangedAlert(args: {
  to: string;          // OLD email (the address being notified — losing access)
  name: string;
  oldEmail: string;    // raw — masked internally for display
  newEmail: string;    // raw — masked internally for display
  changedAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, oldEmail, newEmail, changedAt, ip, browser, os } = args;
  const oldDisplay = maskEmailAddress(oldEmail);
  const newDisplay = maskEmailAddress(newEmail);
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${changedAt.getUTCDate()} ${MONTHS_SHORT[changedAt.getUTCMonth()]} ${changedAt.getUTCFullYear()} · ` +
    `${String(changedAt.getUTCHours()).padStart(2, "0")}:${String(changedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  const subject = `Qorix Markets — Email changed ⚠️ — verify it was you`;
  const preheader = `Your account email was just changed. This address is no longer linked. If this wasn't you, contact support immediately.`;

  const html = renderContactChangedAlertHtml({
    preheader,
    name,
    attribute: "email",
    oldDisplay,
    newDisplay,
    changedAt,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `Your Email Just Moved\n\n` +
    `Hi ${name},\n\n` +
    `Your Qorix Markets account email has been changed. If this WASN'T\n` +
    `you, contact support immediately to recover your account.\n\n` +
    `⚠ This address (the one you're reading right now) is no longer linked\n` +
    `to your account. You won't receive future logins, OTPs, or recovery\n` +
    `messages here.\n\n` +
    `Account email rerouted (values masked for security):\n` +
    `  Previous: ${oldDisplay}   ✗ Removed\n` +
    `  New:      ${newDisplay}   ✓ Active\n\n` +
    `Changed at:  ${whenStr}\n` +
    (sourceLine ? `Source:      ${sourceLine}\n\n` : `Status:      Email change applied\n\n`) +
    `Wasn't you? Email support@qorixmarkets.com with subject "Account\n` +
    `Email Changed Without My Consent". Our team will verify your identity\n` +
    `and restore access.\n\n` +
    `Was you? You can ignore this message — no further action needed.\n\n` +
    `We never change your email without an OTP confirmation, and we never\n` +
    `ask for your password over email, social media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

export async function sendPhoneChangedAlert(args: {
  to: string;          // OLD email on file (since we still have email; phone change still alerts via email)
  name: string;
  oldPhone: string;    // raw — masked internally
  newPhone: string;    // raw — masked internally
  changedAt: Date;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, oldPhone, newPhone, changedAt, ip, browser, os } = args;
  const oldDisplay = maskPhoneNumber(oldPhone);
  const newDisplay = maskPhoneNumber(newPhone);
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${changedAt.getUTCDate()} ${MONTHS_SHORT[changedAt.getUTCMonth()]} ${changedAt.getUTCFullYear()} · ` +
    `${String(changedAt.getUTCHours()).padStart(2, "0")}:${String(changedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  const subject = `Qorix Markets — Phone number changed ⚠️ — verify it was you`;
  const preheader = `Your account phone number was just changed. The previous number can no longer receive your account messages.`;

  const html = renderContactChangedAlertHtml({
    preheader,
    name,
    attribute: "phone",
    oldDisplay,
    newDisplay,
    changedAt,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `Your Number Just Moved\n\n` +
    `Hi ${name},\n\n` +
    `Your Qorix Markets account phone number has been changed. If this\n` +
    `WASN'T you, contact support immediately to recover your account.\n\n` +
    `⚠ The previous number is no longer linked to your account. It won't\n` +
    `receive future SMS OTPs or recovery codes.\n\n` +
    `Account phone rerouted (values masked for security):\n` +
    `  Previous: ${oldDisplay}   ✗ Removed\n` +
    `  New:      ${newDisplay}   ✓ Active\n\n` +
    `Changed at:  ${whenStr}\n` +
    (sourceLine ? `Source:      ${sourceLine}\n\n` : `Status:      Phone change applied\n\n`) +
    `Wasn't you? Email support@qorixmarkets.com with subject "Account\n` +
    `Phone Changed Without My Consent". Our team will verify your identity\n` +
    `and restore access.\n\n` +
    `Was you? You can ignore this message — no further action needed.\n\n` +
    `We never change your phone without an OTP confirmation, and we never\n` +
    `ask for your password over email, social media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// ACCOUNT LOCKED — security protection email
// ---------------------------------------------------------------------------
// STEEL-VAULT theme: obsidian + graphite + steel + pale silver. Cold,
// protective, distinct from warm alert palettes (#17 carbon+lime, #18 violet,
// #19 oxblood-ember, #20 twilight-chrome). Conceptually: "your account is in
// cold storage / ice-locked vault" — positive protection, not alarming.
// Layout flow:
//   • Logo bar (obsidian → graphite → steel → silver gradient)
//   • Hero: 🔐 ACCOUNT LOCKED pill · "Vault Sealed" · reassuring sub
//   • PROTECTION-IN-PLACE banner (steel: "your funds and data are safe")
//   • LOCK SEAL centerpiece — large 🔐 in framed vault, status pill,
//     reason · trigger · unlock-method stacked details
//   • Event Details: locked at · auto-unlock at (if auto) · source
//   • Primary CTA — varies by unlockMethod:
//       "auto"          → "Wait for Auto-Unlock" (silver, info)
//       "password-reset"→ "Reset Password to Unlock" (silver, primary)
//       "support"       → "Contact Support to Unlock" (silver, primary)
//   • Secondary "Wasn't you trying to sign in? Reset your password."
//   • Reassurance card: anti-phishing + "what triggered this"
//   • "Trade smart 📈" footer
// ---------------------------------------------------------------------------
export function renderAccountLockedHtml(opts: {
  preheader: string;
  name: string;
  lockedAt: Date;
  reason: string;
  trigger?: string | null;
  unlockMethod: "auto" | "password-reset" | "support";
  autoUnlockAt?: Date | null;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): string {
  const { preheader, name, lockedAt, reason, trigger, unlockMethod, autoUnlockAt, ip, browser, os } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtUtc = (d: Date) =>
    `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()} · ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeLockedAt = escapeHtml(fmtUtc(lockedAt));
  const safeReason = escapeHtml(reason);
  const safeTrigger = trigger && trigger.trim() ? escapeHtml(trigger.trim()) : null;
  const safeAutoUnlockAt = autoUnlockAt ? escapeHtml(fmtUtc(autoUnlockAt)) : null;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const safeSource = sourceParts.length > 0 ? escapeHtml(sourceParts.join(" · ")) : null;

  let unlockLabel: string;
  let unlockHref: string;
  let unlockHint: string;
  if (unlockMethod === "auto") {
    unlockLabel = "Wait for Auto-Unlock";
    unlockHref = "https://qorixmarkets.com/login";
    unlockHint = safeAutoUnlockAt
      ? `Your account will automatically reopen at <strong style="color:#FFFFFF;">${safeAutoUnlockAt}</strong>. No action needed unless you want to sign in sooner.`
      : `Your account will automatically reopen shortly. No action needed unless you want to sign in sooner.`;
  } else if (unlockMethod === "support") {
    unlockLabel = "Contact Support to Unlock";
    unlockHref = "mailto:support@qorixmarkets.com?subject=Account%20Unlock%20Request";
    unlockHint = `Reply to this email or write to <a href="mailto:support@qorixmarkets.com" style="color:#CBD5E1;text-decoration:none;font-weight:600;">support@qorixmarkets.com</a>. Our team will verify your identity and reopen your account.`;
  } else {
    unlockLabel = "Reset Password to Unlock";
    unlockHref = "https://qorixmarkets.com/forgot-password";
    unlockHint = `Resetting your password proves your identity and immediately reopens your account. Takes under 60 seconds.`;
  }

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Account locked — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-seal-pad { padding:24px 18px 4px !important; }
    .qx-seal-frame { padding:24px 18px !important; }
    .qx-seal-icon { width:64px !important; height:64px !important; line-height:64px !important; font-size:30px !important; }
    .qx-seal-row { padding:10px 0 !important; }
    .qx-seal-label { font-size:10.5px !important; }
    .qx-seal-value { font-size:13px !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-cta-pad { padding:24px 18px 6px !important; }
    .qx-cta { padding:13px 24px !important; font-size:13.5px !important; letter-spacing:0.2px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#06080C;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#06080C;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#06080C;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#11141A;border:1px solid rgba(203,213,225,0.22);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.75);">

        <!-- LOGO BAR — obsidian → graphite → steel → silver gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#06080C;background-image:linear-gradient(135deg,#06080C 0%,#1A1F28 45%,#334155 75%,#CBD5E1 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO — locked pill + headline + silver divider -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#06080C;background-image:linear-gradient(135deg,#06080C 0%,#1A1F28 45%,#334155 75%,#CBD5E1 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(203,213,225,0.18);border:1px solid rgba(203,213,225,0.55);font-size:10.5px;letter-spacing:2.4px;color:#E2E8F0;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              🔐 Account Locked
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              Vault Sealed
            </div>
            <div style="font-size:13.5px;color:#E2E8F0;margin-top:10px;font-weight:500;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, we paused sign-ins to your account after detecting unusual activity. Your <strong style="color:#FFFFFF;">funds and data are safe</strong>.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#E2E8F0 0%,#94A3B8 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- PROTECTION-IN-PLACE banner -->
        <tr>
          <td align="center" style="padding:24px 24px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 18px;background:#0E141C;background-image:linear-gradient(180deg,#131B26 0%,#0B1118 100%);border:1.5px solid rgba(203,213,225,0.40);border-radius:12px;box-shadow:0 0 24px rgba(148,163,184,0.20);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="32" valign="top" style="width:32px;padding:2px 12px 0 0;">
                        <div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:rgba(203,213,225,0.18);border:1px solid rgba(203,213,225,0.65);font-size:14px;color:#E2E8F0;font-weight:700;">🛡</div>
                      </td>
                      <td valign="top">
                        <div style="font-size:11.5px;letter-spacing:1.6px;color:#E2E8F0;text-transform:uppercase;font-weight:700;line-height:1;margin-bottom:6px;">Your Account Is Protected</div>
                        <div style="font-size:13px;color:#CBD5E1;font-weight:500;line-height:1.55;">Nothing has been moved, withdrawn, or changed. The lock simply blocks new sign-ins until we confirm it's really you.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- LOCK SEAL centerpiece -->
        <tr>
          <td class="qx-seal-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#E2E8F0;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              Lock Status
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="qx-seal-frame" align="center" style="padding:30px 24px;background:#0B0F16;background-image:linear-gradient(180deg,#0F1421 0%,#080B12 100%);border:1.5px solid rgba(203,213,225,0.45);border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),0 0 32px rgba(148,163,184,0.18);">
                  <!-- Lock icon framed -->
                  <div class="qx-seal-icon" style="width:76px;height:76px;line-height:76px;border-radius:18px;background:rgba(203,213,225,0.10);border:1.5px solid rgba(203,213,225,0.55);font-size:36px;color:#E2E8F0;margin:0 auto 14px;text-align:center;box-shadow:0 0 24px rgba(203,213,225,0.30);">🔐</div>
                  <!-- Locked status pill -->
                  <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:rgba(203,213,225,0.18);border:1px solid rgba(203,213,225,0.55);font-size:10.5px;letter-spacing:2.0px;color:#E2E8F0;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#E2E8F0;box-shadow:0 0 8px rgba(226,232,240,0.85);vertical-align:middle;margin-right:6px;"></span>
                    <span style="vertical-align:middle;">Locked</span>
                  </div>
                  <!-- Detail rows: reason · trigger · unlock -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="text-align:left;">
                    <tr>
                      <td class="qx-seal-row" style="padding:12px 0;border-top:1px solid rgba(203,213,225,0.15);">
                        <div class="qx-seal-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:5px;">Reason</div>
                        <div class="qx-seal-value" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.45;">${safeReason}</div>
                      </td>
                    </tr>
                    ${safeTrigger ? `
                    <tr>
                      <td class="qx-seal-row" style="padding:12px 0;border-top:1px solid rgba(203,213,225,0.15);">
                        <div class="qx-seal-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:5px;">Trigger</div>
                        <div class="qx-seal-value" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.45;">${safeTrigger}</div>
                      </td>
                    </tr>` : ``}
                    <tr>
                      <td class="qx-seal-row" style="padding:12px 0 0;border-top:1px solid rgba(203,213,225,0.15);">
                        <div class="qx-seal-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:5px;">How To Unlock</div>
                        <div class="qx-seal-value" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.5;">${unlockHint}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DETAILS — locked at · auto-unlock · source -->
        <tr>
          <td class="qx-detail-pad" style="padding:34px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#E2E8F0;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Event Details
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(203,213,225,0.15);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Locked At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeLockedAt}</div>
                </td>
              </tr>
              ${unlockMethod === "auto" && safeAutoUnlockAt ? `
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(203,213,225,0.15);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⏱</span>Auto-Unlock At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeAutoUnlockAt}</div>
                </td>
              </tr>` : ``}
              ${safeSource ? `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">📍</span>Last Sign-In Attempt</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;">${safeSource}</div>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#94A3B8;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🛡</span>Status</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">Account locked for safety</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>

        <!-- DUAL CTA — primary unlock action + secondary "wasn't you" -->
        <tr>
          <td class="qx-cta-pad" align="center" style="padding:30px 32px 6px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:12px;background-image:linear-gradient(135deg,#E2E8F0 0%,#94A3B8 100%);background-color:#94A3B8;box-shadow:0 8px 28px rgba(148,163,184,0.40);">
                  <a href="${unlockHref}" target="_blank" class="qx-cta" style="display:inline-block;padding:16px 36px;font-size:14.5px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.4px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    ${unlockLabel} →
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:14px;font-size:12.5px;color:#94A3B8;line-height:1.6;">
              Wasn't you trying to sign in? <a href="https://qorixmarkets.com/forgot-password" target="_blank" style="color:#E2E8F0;text-decoration:none;font-weight:600;border-bottom:1px dashed rgba(226,232,240,0.4);">Reset your password →</a>
            </div>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="background:rgba(203,213,225,0.06);border-left:2px solid rgba(203,213,225,0.55);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#94A3B8;">
              <div style="color:#E2E8F0;font-weight:600;margin-bottom:6px;">Why we lock accounts</div>
              We pause sign-ins automatically when something looks off — too many wrong passwords, sign-in attempts from unknown locations, or other suspicious patterns. It's a circuit breaker, not a punishment. We <strong style="color:#E2E8F0;">never</strong> ask for your password over email, social media, or phone.
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#04060A;">
            <div style="font-size:13px;color:#E2E8F0;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#475569;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#E2E8F0;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the Account Locked email — fires when failed-login lockout, suspicious
// activity detection, or admin lock kicks in.
// ---------------------------------------------------------------------------
export async function sendAccountLocked(args: {
  to: string;
  name: string;
  lockedAt: Date;
  reason: string;
  trigger?: string | null;
  unlockMethod: "auto" | "password-reset" | "support";
  autoUnlockAt?: Date | null;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
}): Promise<void> {
  const { to, name, lockedAt, reason, trigger, unlockMethod, autoUnlockAt, ip, browser, os } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtUtc = (d: Date) =>
    `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()} · ` +
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  const lockedAtStr = fmtUtc(lockedAt);
  const autoUnlockAtStr = autoUnlockAt ? fmtUtc(autoUnlockAt) : null;
  const sourceParts: string[] = [];
  if (ip && ip.trim()) sourceParts.push(ip.trim());
  const deviceParts: string[] = [];
  if (browser && browser.trim()) deviceParts.push(browser.trim());
  if (os && os.trim()) deviceParts.push(os.trim());
  if (deviceParts.length > 0) sourceParts.push(deviceParts.join(" on "));
  const sourceLine = sourceParts.length > 0 ? sourceParts.join(" · ") : null;

  let unlockTextHint: string;
  let unlockTextLink: string;
  if (unlockMethod === "auto") {
    unlockTextHint = autoUnlockAtStr
      ? `Your account will automatically reopen at ${autoUnlockAtStr}. No action needed unless you want to sign in sooner.`
      : `Your account will automatically reopen shortly. No action needed unless you want to sign in sooner.`;
    unlockTextLink = `https://qorixmarkets.com/login`;
  } else if (unlockMethod === "support") {
    unlockTextHint = `Reply to this email or write to support@qorixmarkets.com. Our team will verify your identity and reopen your account.`;
    unlockTextLink = `mailto:support@qorixmarkets.com?subject=Account%20Unlock%20Request`;
  } else {
    unlockTextHint = `Resetting your password proves your identity and immediately reopens your account. Takes under 60 seconds.`;
    unlockTextLink = `https://qorixmarkets.com/forgot-password`;
  }

  const subject = `Qorix Markets — Account locked 🔐 — your funds are safe`;
  const preheader = `We paused sign-ins after detecting unusual activity. Your account is protected — nothing was moved or changed.`;

  const html = renderAccountLockedHtml({
    preheader,
    name,
    lockedAt,
    reason,
    trigger: trigger ?? null,
    unlockMethod,
    autoUnlockAt: autoUnlockAt ?? null,
    ip: ip ?? null,
    browser: browser ?? null,
    os: os ?? null,
  });

  const text =
    `Vault Sealed — Account Locked\n\n` +
    `Hi ${name},\n\n` +
    `We paused sign-ins to your Qorix Markets account after detecting\n` +
    `unusual activity. Your funds and data are safe — nothing has been\n` +
    `moved, withdrawn, or changed.\n\n` +
    `🔐 Lock Status: LOCKED\n` +
    `  Reason:  ${reason}\n` +
    (trigger ? `  Trigger: ${trigger}\n` : ``) +
    `  Unlock:  ${unlockTextHint}\n\n` +
    `Locked at: ${lockedAtStr}\n` +
    (autoUnlockAtStr && unlockMethod === "auto" ? `Auto-unlock at: ${autoUnlockAtStr}\n` : ``) +
    (sourceLine ? `Last sign-in attempt: ${sourceLine}\n\n` : `Status: Account locked for safety\n\n`) +
    `Unlock: ${unlockTextLink}\n` +
    `Wasn't you trying to sign in? Reset your password:\n` +
    `https://qorixmarkets.com/forgot-password\n\n` +
    `Why we lock accounts: We pause sign-ins automatically when something\n` +
    `looks off — too many wrong passwords, sign-in attempts from unknown\n` +
    `locations, or other suspicious patterns. It's a circuit breaker, not\n` +
    `a punishment. We never ask for your password over email, social\n` +
    `media, or phone.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}

// ---------------------------------------------------------------------------
// Mask helper for crypto wallet addresses (TRC20 / ERC20 etc).
// Keeps first 6 + last 4 chars; replaces middle with dots. Standard pattern.
// ---------------------------------------------------------------------------
function maskWalletAddress(addr: string): string {
  const a = (addr || "").trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}${"•".repeat(8)}${a.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// USDT WITHDRAWAL REQUESTED — request acknowledged, pending review email
// ---------------------------------------------------------------------------
// MAGENTA-PIPELINE theme: deep magenta + electric pink. Tone: PROCESSING /
// IN-MOTION — your money is in the pipeline. Hopeful, energetic, distinct
// from all prior 21 palettes (no pink/magenta family used).
// Layout flow:
//   • Logo bar (deep-magenta → magenta → pink → light-pink gradient)
//   • Hero: ⏳ WITHDRAWAL REQUESTED pill · "In the Pipeline" headline
//   • AMOUNT card — large net USDT amount + gross/fee breakdown
//   • JOURNEY centerpiece — 3-step pipeline: ✓ Submitted (done) →
//     ⏳ Review (current, pulsing) → ◯ Broadcast (pending) with progress
//     bar underneath
//   • DESTINATION block — masked TRC20 address, monospace, copy-friendly
//   • Event Details: request ID · requested at · VIP tier
//   • Reassurance card "What happens next?"
//   • Anti-phishing footer
// ---------------------------------------------------------------------------
export function renderUsdtWithdrawalRequestedHtml(opts: {
  preheader: string;
  name: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  feeRatePercent: string;
  vipTierLabel: string;
  walletAddress: string;
  requestId: string | number;
  requestedAt: Date;
}): string {
  const {
    preheader, name, grossAmount, feeAmount, netAmount,
    feeRatePercent, vipTierLabel, walletAddress, requestId, requestedAt,
  } = opts;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${requestedAt.getUTCDate()} ${MONTHS_SHORT[requestedAt.getUTCMonth()]} ${requestedAt.getUTCFullYear()} · ` +
    `${String(requestedAt.getUTCHours()).padStart(2, "0")}:${String(requestedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const safeFirstName = escapeHtml((name || "there").trim().split(/\s+/)[0] || "there");
  const safeWhen = escapeHtml(whenStr);
  const safeGross = escapeHtml(grossAmount);
  const safeFee = escapeHtml(feeAmount);
  const safeNet = escapeHtml(netAmount);
  const safeFeeRate = escapeHtml(feeRatePercent);
  const safeVip = escapeHtml(vipTierLabel);
  const safeWallet = escapeHtml(maskWalletAddress(walletAddress));
  const safeRequestId = escapeHtml(String(requestId));
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Withdrawal requested — Qorix Markets</title>
<style type="text/css">
  @media only screen and (max-width:480px) {
    .qx-outer { padding:20px 10px !important; }
    .qx-card { border-radius:18px !important; }
    .qx-hero-pad { padding:6px 18px 22px !important; }
    .qx-hero-h { font-size:24px !important; line-height:1.22 !important; }
    .qx-amount-pad { padding:24px 18px 4px !important; }
    .qx-amount-num { font-size:32px !important; }
    .qx-amount-break { font-size:11.5px !important; }
    .qx-journey-pad { padding:24px 18px 4px !important; }
    .qx-step-icon { width:36px !important; height:36px !important; line-height:36px !important; font-size:14px !important; }
    .qx-step-label { font-size:10.5px !important; }
    .qx-step-state { font-size:10px !important; }
    .qx-dest-pad { padding:24px 22px 4px !important; }
    .qx-dest-addr { font-size:13px !important; word-break:break-all !important; }
    .qx-detail-pad { padding:24px 22px 4px !important; }
    .qx-detail-label { font-size:10.5px !important; }
    .qx-detail-value { font-size:14px !important; }
    .qx-foot-pad { padding:24px 18px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0F0419;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0F0419;opacity:0;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-outer" style="background:#0F0419;padding:32px 16px;">
  <tr>
    <td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qx-card" style="max-width:560px;background:#1E0A28;border:1px solid rgba(244,114,182,0.30);border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.70);">

        <!-- LOGO BAR — magenta → pink gradient -->
        <tr>
          <td align="left" style="padding:20px 24px 0 28px;background:#0F0419;background-image:linear-gradient(135deg,#0F0419 0%,#4A0B5C 45%,#BE185D 78%,#F472B6 100%);">
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="320" height="217" style="display:block;width:320px;max-width:90%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td class="qx-hero-pad" align="center" style="padding:8px 32px 28px;background:#0F0419;background-image:linear-gradient(135deg,#0F0419 0%,#4A0B5C 45%,#BE185D 78%,#F472B6 100%);">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(249,168,212,0.22);border:1px solid rgba(249,168,212,0.55);font-size:10.5px;letter-spacing:2.4px;color:#FBCFE8;font-weight:700;text-transform:uppercase;margin-bottom:18px;">
              ⏳ Withdrawal Requested
            </div>
            <div class="qx-hero-h" style="font-size:30px;line-height:1.18;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;max-width:440px;margin:0 auto;">
              In the Pipeline
            </div>
            <div style="font-size:13.5px;color:#FBCFE8;margin-top:10px;font-weight:500;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.5;">
              ${safeFirstName}, we received your USDT withdrawal request. It's <strong style="color:#FFFFFF;">in the queue</strong> for review and broadcast — typically processed within a few hours.
            </div>
            <div style="width:48px;height:3px;background:linear-gradient(90deg,#F9A8D4 0%,#BE185D 100%);margin:18px auto 0;border-radius:999px;"></div>
          </td>
        </tr>

        <!-- AMOUNT CARD — net + breakdown -->
        <tr>
          <td class="qx-amount-pad" align="center" style="padding:30px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FBCFE8;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 12px 0;">
              You'll Receive
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:24px 18px;background:#16071F;background-image:linear-gradient(180deg,#1E0A28 0%,#11051A 100%);border:1.5px solid rgba(244,114,182,0.45);border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),0 0 28px rgba(190,24,93,0.22);">
                  <div class="qx-amount-num" style="font-size:38px;line-height:1.1;font-weight:800;color:#FFFFFF;letter-spacing:-1px;margin-bottom:6px;">
                    $${safeNet} <span style="font-size:18px;color:#F9A8D4;font-weight:700;letter-spacing:0.2px;">USDT</span>
                  </div>
                  <div class="qx-amount-break" style="font-size:12.5px;color:#C99CB3;font-weight:500;line-height:1.5;">
                    Gross <span style="color:#FFFFFF;font-weight:700;">$${safeGross}</span>  ·  Fee <span style="color:#FFFFFF;font-weight:700;">$${safeFee}</span> <span style="opacity:0.7;">(${safeFeeRate}% — ${safeVip} tier)</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- JOURNEY centerpiece — 3-step pipeline -->
        <tr>
          <td class="qx-journey-pad" align="center" style="padding:32px 24px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FBCFE8;font-weight:700;text-transform:uppercase;text-align:left;padding:0 0 16px 0;">
              Withdrawal Journey
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Step 1: Submitted (DONE) -->
                <td width="33%" valign="top" align="center" style="width:33%;padding:0 4px;">
                  <div class="qx-step-icon" style="width:42px;height:42px;line-height:42px;border-radius:999px;background:rgba(249,168,212,0.20);border:1.5px solid rgba(249,168,212,0.65);font-size:16px;color:#FBCFE8;text-align:center;font-weight:800;margin:0 auto 10px;">✓</div>
                  <div class="qx-step-label" style="font-size:11.5px;letter-spacing:1.2px;color:#FFFFFF;text-transform:uppercase;font-weight:700;line-height:1.3;margin-bottom:3px;">Submitted</div>
                  <div class="qx-step-state" style="font-size:10.5px;color:#C99CB3;font-weight:500;line-height:1.3;">Done</div>
                </td>
                <!-- Step 2: Review (CURRENT — pulse) -->
                <td width="33%" valign="top" align="center" style="width:33%;padding:0 4px;">
                  <div class="qx-step-icon" style="width:42px;height:42px;line-height:42px;border-radius:999px;background:rgba(236,72,153,0.30);border:2px solid rgba(249,168,212,0.95);font-size:16px;color:#FFFFFF;text-align:center;font-weight:800;margin:0 auto 10px;box-shadow:0 0 20px rgba(236,72,153,0.65);">⏳</div>
                  <div class="qx-step-label" style="font-size:11.5px;letter-spacing:1.2px;color:#FFFFFF;text-transform:uppercase;font-weight:700;line-height:1.3;margin-bottom:3px;">Review</div>
                  <div class="qx-step-state" style="font-size:10.5px;color:#FBCFE8;font-weight:700;line-height:1.3;">
                    <span style="display:inline-block;width:5px;height:5px;border-radius:999px;background:#F9A8D4;box-shadow:0 0 8px rgba(249,168,212,0.85);vertical-align:middle;margin-right:4px;"></span>
                    <span style="vertical-align:middle;">In progress</span>
                  </div>
                </td>
                <!-- Step 3: Broadcast (PENDING) -->
                <td width="33%" valign="top" align="center" style="width:33%;padding:0 4px;">
                  <div class="qx-step-icon" style="width:42px;height:42px;line-height:42px;border-radius:999px;background:rgba(249,168,212,0.05);border:1.5px dashed rgba(249,168,212,0.35);font-size:16px;color:#7C5566;text-align:center;font-weight:800;margin:0 auto 10px;">◯</div>
                  <div class="qx-step-label" style="font-size:11.5px;letter-spacing:1.2px;color:#9D7989;text-transform:uppercase;font-weight:700;line-height:1.3;margin-bottom:3px;">Broadcast</div>
                  <div class="qx-step-state" style="font-size:10.5px;color:#7C5566;font-weight:500;line-height:1.3;">Pending</div>
                </td>
              </tr>
            </table>
            <!-- Progress bar (33% complete to reflect step 1 done, step 2 in progress) -->
            <div style="margin-top:18px;height:4px;background:rgba(249,168,212,0.12);border-radius:999px;overflow:hidden;">
              <div style="width:50%;height:4px;background:linear-gradient(90deg,#F9A8D4 0%,#EC4899 100%);border-radius:999px;box-shadow:0 0 12px rgba(236,72,153,0.55);"></div>
            </div>
            <div style="margin-top:10px;font-size:11.5px;color:#9D7989;line-height:1.5;text-align:center;">
              Next email lands when the on-chain broadcast goes out.
            </div>
          </td>
        </tr>

        <!-- DESTINATION -->
        <tr>
          <td class="qx-dest-pad" style="padding:32px 32px 4px;">
            <div style="font-size:10.5px;letter-spacing:2.4px;color:#FBCFE8;text-transform:uppercase;font-weight:700;text-align:left;padding:0 0 14px 0;">
              Destination Wallet
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 16px;background:#160620;border:1px solid rgba(244,114,182,0.25);border-radius:10px;">
                  <div style="font-size:10.5px;letter-spacing:1.6px;color:#9D7989;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;">TRC20 (Tron Network)</div>
                  <div class="qx-dest-addr" style="font-size:14px;color:#FFFFFF;font-weight:600;line-height:1.45;font-family:'SF Mono',Menlo,Consolas,monospace;letter-spacing:-0.2px;word-break:break-all;">${safeWallet}</div>
                  <div style="margin-top:6px;font-size:11px;color:#7C5566;font-style:italic;line-height:1.4;">Address shown is masked for your security.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DETAILS -->
        <tr>
          <td class="qx-detail-pad" style="padding:24px 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9D7989;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">#</span>Request ID</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;font-family:'SF Mono',Menlo,Consolas,monospace;">#${safeRequestId}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(244,114,182,0.18);">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9D7989;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">🕐</span>Requested At</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeWhen}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 4px;">
                  <div class="qx-detail-label" style="font-size:11px;letter-spacing:1.6px;color:#9D7989;text-transform:uppercase;font-weight:600;line-height:1;margin-bottom:6px;"><span style="margin-right:6px;">⭐</span>VIP Tier</div>
                  <div class="qx-detail-value" style="font-size:15px;color:#FFFFFF;font-weight:600;line-height:1.4;">${safeVip} <span style="color:#9D7989;font-weight:500;">(${safeFeeRate}% withdrawal fee)</span></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Reassurance card -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <div style="background:rgba(244,114,182,0.07);border-left:2px solid rgba(244,114,182,0.55);border-radius:6px;padding:14px 16px;font-size:12.5px;line-height:1.65;color:#B895A5;">
              <div style="color:#FBCFE8;font-weight:600;margin-bottom:6px;">What happens next?</div>
              Our team reviews your request, then broadcasts it on the Tron network. You'll get a follow-up email with the transaction hash the moment it goes on-chain. If something looks unusual, we may pause and reach out — that's normal. Didn't make this request? <a href="mailto:support@qorixmarkets.com?subject=Unauthorized%20Withdrawal%20Request%20%23${safeRequestId}" style="color:#FBCFE8;text-decoration:none;font-weight:600;">Contact support immediately →</a>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="qx-foot-pad" align="center" style="padding:30px 32px 28px;border-top:1px solid rgba(255,255,255,0.05);background:#0B0214;">
            <div style="font-size:13px;color:#FBCFE8;margin-bottom:6px;font-weight:600;">
              Trade smart 📈
            </div>
            <div style="font-size:11.5px;color:#5A4452;line-height:1.7;">
              © ${year} Qorix Markets · AI-Powered Trading<br/>
              Need help? <a href="mailto:support@qorixmarkets.com" style="color:#FBCFE8;text-decoration:none;">support@qorixmarkets.com</a>
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
// Send the USDT Withdrawal Requested email — fires when the user submits a
// withdrawal request and it enters the review queue. Used by wallet.ts:560
// after bulk migration.
// ---------------------------------------------------------------------------
export async function sendUsdtWithdrawalRequested(args: {
  to: string;
  name: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  feeRatePercent: string;
  vipTierLabel: string;
  walletAddress: string;
  requestId: string | number;
  requestedAt: Date;
}): Promise<void> {
  const {
    to, name, grossAmount, feeAmount, netAmount,
    feeRatePercent, vipTierLabel, walletAddress, requestId, requestedAt,
  } = args;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const whenStr =
    `${requestedAt.getUTCDate()} ${MONTHS_SHORT[requestedAt.getUTCMonth()]} ${requestedAt.getUTCFullYear()} · ` +
    `${String(requestedAt.getUTCHours()).padStart(2, "0")}:${String(requestedAt.getUTCMinutes()).padStart(2, "0")} UTC`;
  const maskedWallet = maskWalletAddress(walletAddress);

  const subject = `Qorix Markets — Withdrawal request #${requestId} received ⏳`;
  const preheader = `We received your $${netAmount} USDT withdrawal request. It's in the queue for review and broadcast.`;

  const html = renderUsdtWithdrawalRequestedHtml({
    preheader,
    name,
    grossAmount,
    feeAmount,
    netAmount,
    feeRatePercent,
    vipTierLabel,
    walletAddress,
    requestId,
    requestedAt,
  });

  const text =
    `In the Pipeline — Withdrawal Requested\n\n` +
    `Hi ${name},\n\n` +
    `We received your USDT withdrawal request. It's in the queue for\n` +
    `review and broadcast — typically processed within a few hours.\n\n` +
    `You'll receive:\n` +
    `  $${netAmount} USDT (net)\n` +
    `  Gross: $${grossAmount}   Fee: $${feeAmount} (${feeRatePercent}% — ${vipTierLabel} tier)\n\n` +
    `Withdrawal journey:\n` +
    `  ✓ Submitted   (Done)\n` +
    `  ⏳ Review      (In progress)\n` +
    `  ◯ Broadcast   (Pending)\n` +
    `Next email lands when the on-chain broadcast goes out.\n\n` +
    `Destination Wallet (TRC20, masked for security):\n` +
    `  ${maskedWallet}\n\n` +
    `Request ID:    #${requestId}\n` +
    `Requested at:  ${whenStr}\n` +
    `VIP tier:      ${vipTierLabel} (${feeRatePercent}% withdrawal fee)\n\n` +
    `Didn't make this request? Reply or write to\n` +
    `support@qorixmarkets.com immediately.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, subject, text, html);
}
