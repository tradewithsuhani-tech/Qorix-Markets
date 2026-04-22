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
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:linear-gradient(180deg,#0b1220 0%,#070b14 100%);border:1px solid rgba(56,189,248,0.18);border-radius:18px;box-shadow:0 12px 40px rgba(56,189,248,0.10),0 0 0 1px rgba(56,189,248,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;text-align:center;background:linear-gradient(135deg,rgba(56,189,248,0.10) 0%,rgba(139,92,246,0.10) 100%);">
                <img src="cid:${LOGO_CID}" alt="Qorix Markets" width="56" height="56" style="display:inline-block;width:56px;height:56px;border:0;outline:none;text-decoration:none;" />
                <div style="margin-top:10px;font-size:13px;letter-spacing:3px;color:#7dd3fc;text-transform:uppercase;font-weight:600;">QORIX&nbsp;MARKETS</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 36px 8px 36px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">${purposeLabel}</h1>
                <p style="margin:0 0 22px 0;color:#cbd5e1;font-size:14px;line-height:1.6;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 8px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(59,130,246,0.18) 0%,rgba(139,92,246,0.18) 100%);border:1px solid rgba(59,130,246,0.35);border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:22px 16px;">
                      <div style="font-size:11px;letter-spacing:2px;color:#93c5fd;text-transform:uppercase;font-weight:600;margin-bottom:8px;">Your verification code</div>
                      <div style="font-size:38px;font-weight:800;letter-spacing:8px;color:#ffffff;font-family:'SF Mono','Menlo','Consolas',monospace;line-height:1.1;">${otpSpaced}</div>
                      <div style="margin-top:10px;font-size:12px;color:#94a3b8;">Expires in 10 minutes</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px 8px 36px;">
                ${noteHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px 28px 36px;">
                <div style="border-top:1px solid rgba(148,163,184,0.14);padding-top:18px;">
                  <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;line-height:1.6;">
                    This is an automated message from Qorix Markets. If you did not request this code, you can safely ignore this email — no action is needed.
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
                    Need help? Reach us at <a href="mailto:support@qorixmarkets.com" style="color:#7dd3fc;text-decoration:none;">support@qorixmarkets.com</a>
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:18px;font-size:11px;color:#475569;line-height:1.6;">
            © ${new Date().getFullYear()} Qorix Markets. All rights reserved.<br/>
            <a href="https://qorixmarkets.com" style="color:#475569;text-decoration:none;">qorixmarkets.com</a>
          </div>
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
