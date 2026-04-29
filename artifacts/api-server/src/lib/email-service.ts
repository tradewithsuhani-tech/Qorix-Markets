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
    .qx-step-pad { padding:24px 14px 4px !important; }
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
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="260" height="176" style="display:block;width:260px;max-width:78%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
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
                <td width="46" align="center" valign="middle">
                  <div class="qx-step-num qx-step-active" style="width:42px;height:42px;line-height:38px;border-radius:999px;background-image:linear-gradient(135deg,#22D3EE 0%,#14B8A6 100%);background-color:#22D3EE;color:#04080F;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(103,232,249,0.45);box-shadow:0 0 22px rgba(34,211,238,0.55),inset 0 1px 0 rgba(255,255,255,0.35);">1</div>
                </td>
                <td valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(34,211,238,0.55) 0%,rgba(34,211,238,0.20) 100%);background-color:rgba(34,211,238,0.32);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="46" align="center" valign="middle">
                  <div class="qx-step-num" style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1726;color:#67E8F9;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(34,211,238,0.42);box-shadow:0 0 12px rgba(34,211,238,0.18);">2</div>
                </td>
                <td valign="middle" style="height:42px;padding:0 6px;">
                  <div style="height:2px;background-image:linear-gradient(90deg,rgba(34,211,238,0.20) 0%,rgba(34,211,238,0.12) 100%);background-color:rgba(34,211,238,0.16);border-radius:2px;line-height:2px;font-size:0;">&nbsp;</div>
                </td>
                <td width="46" align="center" valign="middle">
                  <div class="qx-step-num" style="width:42px;height:42px;line-height:38px;border-radius:999px;background:#0A1726;color:#67E8F9;font-size:15px;font-weight:800;text-align:center;border:2px solid rgba(34,211,238,0.42);box-shadow:0 0 12px rgba(34,211,238,0.18);">3</div>
                </td>
              </tr>
              <!-- Row 2: title + sub under each circle -->
              <tr>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Verify</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;">your email</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Fund</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;">from $10</div>
                </td>
                <td>&nbsp;</td>
                <td align="center" style="padding-top:12px;">
                  <div style="font-size:12.5px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">Trade</div>
                  <div style="font-size:10.5px;color:#64748B;line-height:1.5;margin-top:2px;">AI runs 24/7</div>
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
// Generic OTP template — currently still used for withdrawal_confirm and
// device_login_approval. Each will get its own unique design as the redesign
// rolls out (see roadmap in email-service.ts dispatcher in sendOtp).
// Uses table-based layout for maximum email-client compatibility.
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
            <img src="cid:${BRAND_LOGO_CID}" alt="Qorix Markets" width="280" height="190" style="display:block;width:280px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;margin:0;" />
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

  // Per-purpose template dispatch — each OTP type gets its own visual
  // identity over time. Currently:
  //   • verify_email          → renderVerifyEmailOtpHtml (cyan/teal welcome)
  //   • withdrawal_confirm    → renderOtpHtml (generic — pending redesign)
  //   • device_login_approval → renderOtpHtml (generic — pending redesign)
  const preheader = `Your Qorix Markets ${purposeLabel.toLowerCase()} code: ${otp} (expires in 10 minutes)`;
  const html =
    purpose === "verify_email"
      ? renderVerifyEmailOtpHtml({ preheader, intro, otp })
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
// New-device login alert (Exness/Vantage style). Fires the FIRST time a
// user signs in from a fingerprint that's never been seen before for them.
// Caller decides when to fire — see lib/device-tracking.ts.
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
  const cityLine = city
    ? country
      ? `${city}, ${country}`
      : city
    : country || "Unknown";
  const whenStr = whenUtc.toISOString().replace("T", " ").slice(0, 19) + " (UTC)";
  const safeName = escapeHtml(name);
  const safeBrowser = escapeHtml(browser);
  const safeOs = escapeHtml(os);

  const intro = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
      Dear ${safeName},
    </p>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
      We have detected a sign-in to your Qorix Markets account from a device
      you've never used before. If this was you, no further action is needed.
      If you don't recognise this activity, please change your password
      immediately and contact support.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:separate;border-spacing:0;width:100%;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.18);border-radius:12px;margin:0 0 20px 0;">
      <tr><td style="padding:14px 18px 4px 18px;font-size:13px;color:#94a3b8;">City</td>
          <td style="padding:14px 18px 4px 18px;font-size:14px;color:#e2e8f0;text-align:right;font-weight:600;">${escapeHtml(cityLine)}</td></tr>
      <tr><td style="padding:8px 18px;font-size:13px;color:#94a3b8;">IP address</td>
          <td style="padding:8px 18px;font-size:14px;color:#e2e8f0;text-align:right;font-family:'SF Mono',Menlo,Consolas,monospace;font-weight:600;">${escapeHtml(ip)}</td></tr>
      <tr><td style="padding:8px 18px;font-size:13px;color:#94a3b8;">Device</td>
          <td style="padding:8px 18px;font-size:14px;color:#e2e8f0;text-align:right;font-weight:600;">${safeBrowser} · ${safeOs}</td></tr>
      <tr><td style="padding:8px 18px 14px 18px;font-size:13px;color:#94a3b8;">Login time</td>
          <td style="padding:8px 18px 14px 18px;font-size:14px;color:#e2e8f0;text-align:right;font-weight:600;">${escapeHtml(whenStr)}</td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#94a3b8;">
      <strong style="color:#fca5a5;">Wasn't you?</strong> Open
      <a href="https://qorixmarkets.com/settings" style="color:#60a5fa;text-decoration:none;font-weight:600;">Settings → Security</a>
      and change your password right away.
    </p>`;

  const html = buildBrandedEmailHtml("Login from a new device detected", intro);
  const text =
    `Login from a new device detected\n\n` +
    `Dear ${name},\n\n` +
    `A sign-in to your Qorix Markets account was detected from a device you've never used before.\n\n` +
    `City: ${cityLine}\n` +
    `IP address: ${ip}\n` +
    `Device: ${browser} on ${os}\n` +
    `Login time: ${whenStr}\n\n` +
    `If this wasn't you, change your password immediately at https://qorixmarkets.com/settings.\n\n` +
    `— Qorix Markets`;

  await sendEmail(to, "Qorix Markets — Login from a new device detected", text, html);
}
