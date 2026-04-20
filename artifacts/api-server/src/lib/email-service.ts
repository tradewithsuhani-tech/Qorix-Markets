import { db, emailOtpsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// ---------------------------------------------------------------------------
// Amazon SES client (lazy-initialized; only created if AWS creds are set)
// ---------------------------------------------------------------------------
let sesClient: SESClient | null = null;
function getSesClient(): SESClient | null {
  if (sesClient) return sesClient;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) return null;
  sesClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return sesClient;
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
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const client = getSesClient();
  const from = process.env.SES_FROM_EMAIL;

  if (!client || !from) {
    if (process.env.NODE_ENV !== "production") {
      logger.info({ to, subject, body }, "[email-service] DEV — email would be sent (SES not configured)");
    } else {
      logger.warn({ to, subject }, "[email-service] SES not configured — email NOT sent");
    }
    return;
  }

  try {
    await client.send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Text: { Data: body, Charset: "UTF-8" } },
      },
    }));
    logger.info({ to, subject }, "[email-service] email sent via SES");
  } catch (err) {
    logger.error({ err, to, subject }, "[email-service] SES send failed");
    // Don't throw — we still want the OTP saved in DB so user can retry
  }
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
  const body = `Your ${purposeLabel} code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  await sendEmail(email, `Qorix Markets — ${purposeLabel} Code`, body);

  logger.info({ userId, purpose, otp: process.env.NODE_ENV !== "production" ? otp : "***" }, "[email-service] OTP created");

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
