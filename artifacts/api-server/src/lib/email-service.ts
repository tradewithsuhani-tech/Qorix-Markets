import { db, emailOtpsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";
import nodemailer, { type Transporter } from "nodemailer";
// Embedded brand logo (bundled via esbuild `binary` loader for .png).
// Sent as a CID inline attachment so it always renders, even when the
// email client blocks remote images.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — base64 loader returns a base64-encoded string
import qorixLogoPng from "./qorix-logo.png";

const LOGO_BUFFER: Buffer = Buffer.from(qorixLogoPng as unknown as string, "base64");
const LOGO_CID = "qorix-logo@qorixmarkets";

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
async function sendEmail(
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

  try {
    const info = await transporter.sendMail({
      from: `"Qorix Markets" <${from}>`,
      to,
      subject,
      text,
      html,
      attachments: html
        ? [
            {
              filename: "qorix-logo.png",
              content: LOGO_BUFFER,
              cid: LOGO_CID,
              contentType: "image/png",
            },
          ]
        : undefined,
    });
    logger.info({ to, subject, messageId: info.messageId }, "[email-service] email sent via SMTP");
  } catch (err) {
    logger.error({ err: (err as Error).message, to, subject }, "[email-service] SMTP send failed");
    // Don't throw — keep OTP saved in DB so user can retry
  }
}

// ---------------------------------------------------------------------------
// Premium branded HTML email template — dark theme matching the Qorix UI.
// Uses table-based layout for maximum email-client compatibility.
// ---------------------------------------------------------------------------
function renderOtpHtml(opts: {
  purposeLabel: string;
  preheader: string;
  intro: string;
  otp: string;
  noteLines: string[];
}): string {
  const { purposeLabel, preheader, intro, otp, noteLines } = opts;
  const otpSpaced = otp.split("").join("&nbsp;&nbsp;");
  const noteHtml = noteLines
    .map((l) => `<p style="margin:0 0 10px 0;color:#94a3b8;font-size:13px;line-height:1.6;">${l}</p>`)
    .join("");

  // OTP digits separated by thin vertical dividers (like the design mockup)
  const otpCells = otp
    .split("")
    .map(
      (d, i) =>
        `<td align="center" style="padding:6px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#ffffff;line-height:1;${
          i > 0 ? "border-left:1px solid rgba(148,163,184,0.25);" : ""
        }">${d}</td>`,
    )
    .join("");

  // Icon row helper — small circular badge + body text
  const iconRow = (svg: string, body: string) => `
    <tr>
      <td style="padding:10px 0;" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="44" valign="top" style="padding-right:14px;">
              <div style="width:36px;height:36px;border-radius:50%;background:rgba(56,189,248,0.10);border:1px solid rgba(56,189,248,0.30);text-align:center;line-height:34px;">
                ${svg}
              </div>
            </td>
            <td valign="middle" style="font-size:13px;line-height:1.6;color:#cbd5e1;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  // Inline SVGs render in most modern email clients (Gmail web/app, Apple Mail, Outlook 365 web)
  const shieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const lockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const mailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`;

  // Social icons (small circular outlined chips with inline SVG)
  const socialIcon = (href: string, svg: string, label: string) => `
    <td style="padding:0 6px;">
      <a href="${href}" style="text-decoration:none;display:inline-block;" aria-label="${label}">
        <div style="width:34px;height:34px;border-radius:50%;border:1px solid rgba(148,163,184,0.30);text-align:center;line-height:32px;background:rgba(148,163,184,0.05);">${svg}</div>
      </a>
    </td>`;
  const xSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#cbd5e1" style="vertical-align:middle;"><path d="M18.244 2H21.5l-7.51 8.58L23 22h-6.94l-5.43-7.1L4.4 22H1.14l8.04-9.18L1 2h7.1l4.91 6.49L18.244 2zm-2.43 18h1.93L7.27 4H5.21l10.604 16z"/></svg>`;
  const tgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#7dd3fc" style="vertical-align:middle;"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>`;
  const ytSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#cbd5e1" style="vertical-align:middle;"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-5.8a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${purposeLabel} — Qorix Markets</title>
  </head>
  <body style="margin:0;padding:0;background:#05070d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#05070d;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05070d;">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <!-- Brand header (logo + wordmark inline) -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
            <tr>
              <td valign="middle" style="padding-right:12px;">
                <img src="cid:${LOGO_CID}" alt="Qorix" width="44" height="44" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none;" />
              </td>
              <td valign="middle" style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;line-height:1;">
                QORIX
                <div style="font-size:11px;letter-spacing:5px;color:#7dd3fc;font-weight:600;margin-top:4px;">— M A R K E T S —</div>
              </td>
            </tr>
          </table>

          <!-- Main card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#0a1020;border:1px solid rgba(56,189,248,0.15);border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;">${purposeLabel}</h1>
                <div style="height:3px;width:70px;background:linear-gradient(90deg,#38bdf8 0%,#a78bfa 100%);border-radius:2px;margin-bottom:18px;"></div>
                <p style="margin:0 0 26px 0;color:#cbd5e1;font-size:14px;line-height:1.7;">${intro}</p>
              </td>
            </tr>

            <!-- OTP block -->
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(59,130,246,0.14) 0%,rgba(139,92,246,0.14) 100%);border:1px solid rgba(99,102,241,0.30);border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:18px 12px 6px 12px;font-size:11px;letter-spacing:3px;color:#7dd3fc;text-transform:uppercase;font-weight:600;">
                      Your verification code
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:6px 12px 4px 12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>${otpCells}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:4px 12px 18px 12px;font-size:12px;color:#94a3b8;">
                      Expires in 10 minutes
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Icon notes -->
            <tr>
              <td style="padding:24px 40px 4px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${iconRow(shieldSvg, `<strong style="color:#ffffff;">Never share this code</strong> with anyone — Qorix staff will never ask for it.`)}
                  ${iconRow(lockSvg, `If you did not initiate this request, please secure your account and contact support immediately.`)}
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:8px 40px;">
                <div style="height:1px;background:rgba(148,163,184,0.14);"></div>
              </td>
            </tr>

            <!-- Footer note with mail icon -->
            <tr>
              <td style="padding:4px 40px 28px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${iconRow(
                    mailSvg,
                    `This is an automated message from Qorix Markets. If you did not request this code, you can safely ignore this email — no action is needed.<br/><br/>Need help? Reach us at <a href="mailto:support@qorixmarkets.com" style="color:#7dd3fc;text-decoration:none;">support@qorixmarkets.com</a>`,
                  )}
                </table>
              </td>
            </tr>

            <!-- Social icons -->
            <tr>
              <td align="center" style="padding:6px 40px 18px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${socialIcon("https://x.com/qorixmarkets", xSvg, "X")}
                    ${socialIcon("https://t.me/qorixmarkets", tgSvg, "Telegram")}
                    ${socialIcon("https://youtube.com/@qorixmarkets", ytSvg, "YouTube")}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Copyright -->
            <tr>
              <td align="center" style="padding:0 40px 26px 40px;font-size:12px;color:#64748b;line-height:1.6;">
                © ${new Date().getFullYear()} Qorix Markets. All rights reserved.<br/>
                <a href="https://qorixmarkets.com" style="color:#7dd3fc;text-decoration:none;">qorixmarkets.com</a>
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
  purpose: "verify_email" | "withdrawal_confirm",
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

  const purposeLabel = purpose === "verify_email" ? "Email Verification" : "Withdrawal Confirmation";
  const intro =
    purpose === "verify_email"
      ? "Welcome to Qorix Markets. Use the code below to verify your email and finish creating your account."
      : "You're confirming a withdrawal request. Use the code below to authorize and complete this transaction.";
  const noteLines = [
    "<strong style=\"color:#cbd5e1;\">Never share this code</strong> with anyone — Qorix staff will never ask for it.",
    "If you did not initiate this request, please secure your account and contact support immediately.",
  ];

  const text =
    `Your ${purposeLabel} code is: ${otp}\n\n` +
    `This code expires in 10 minutes. Do not share it with anyone.\n\n` +
    `If you did not request this, you can safely ignore this email.\n\n` +
    `— Qorix Markets\nhttps://qorixmarkets.com`;

  const html = renderOtpHtml({
    purposeLabel,
    preheader: `Your Qorix Markets ${purposeLabel.toLowerCase()} code: ${otp} (expires in 10 minutes)`,
    intro,
    otp,
    noteLines,
  });

  await sendEmail(email, `Qorix Markets — ${purposeLabel} Code`, text, html);

  // Never log OTP plaintext. Use EMAIL_DEBUG_OTP=1 in dev only if you need it.
  const otpForLog = process.env.EMAIL_DEBUG_OTP === "1" && process.env.NODE_ENV !== "production" ? otp : "***";
  logger.info({ userId, purpose, otp: otpForLog }, "[email-service] OTP created");

  return { otp, expiresAt };
}

// ---------------------------------------------------------------------------
// Verify an OTP
// ---------------------------------------------------------------------------
export async function verifyOtp(
  userId: number,
  otp: string,
  purpose: "verify_email" | "withdrawal_confirm",
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
