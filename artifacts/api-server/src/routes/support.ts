/**
 * Support Ticket Endpoint
 *
 * POST /api/support/tickets
 *   Auth: Bearer token
 *   Body: { category, subject, message }
 *   Response: { ticketId, message: "Ticket submitted" }
 *
 * Generates a short ticket ID, emails the ticket to support@qorixmarkets.com
 * with the user's account info, and returns the ticket ID to the client.
 * Fire-and-forget email — if SMTP is unconfigured the ticket ID is still
 * returned (consistent behaviour in dev/prod).
 */
import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { sendEmail } from "../lib/email-service";
import { logger } from "../lib/logger";

const router = Router();
router.use(authMiddleware);

const ticketBodySchema = z.object({
  category: z.string().min(1).max(80),
  subject: z.string().min(1).max(200),
  message: z.string().min(5).max(5000),
});

router.post("/support/tickets", async (req: AuthRequest, res) => {
  const parsed = ticketBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      message: "category, subject, and message are required",
    });
    return;
  }

  const { category, subject, message } = parsed.data;
  const userId = req.userId!;

  // Generate a short human-readable ticket ID: TKT-XXXXXXXX
  const ticketId = `TKT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // Best-effort: fetch user info for the email notification
  let userEmail = "unknown";
  let userName = "unknown";
  try {
    const [user] = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (user) {
      userEmail = user.email;
      userName = user.name ?? "unknown";
    }
  } catch (err) {
    logger.warn({ err, userId }, "[support] failed to fetch user for ticket email");
  }

  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@qorixmarkets.com";
  const submittedAt = new Date().toISOString();

  const emailText = [
    `New Support Ticket`,
    `==================`,
    `Ticket ID : ${ticketId}`,
    `Submitted : ${submittedAt}`,
    `User ID   : ${userId}`,
    `Email     : ${userEmail}`,
    `Name      : ${userName}`,
    `Category  : ${category}`,
    `Subject   : ${subject}`,
    ``,
    `Message`,
    `-------`,
    message,
  ].join("\n");

  const emailHtml = `
    <h2 style="color:#1a1a2e">New Support Ticket — ${ticketId}</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Ticket ID</td><td style="padding:6px 12px">${ticketId}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Submitted</td><td style="padding:6px 12px">${submittedAt}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">User ID</td><td style="padding:6px 12px">${userId}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Email</td><td style="padding:6px 12px">${userEmail}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Name</td><td style="padding:6px 12px">${userName}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Category</td><td style="padding:6px 12px">${category}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f4f4f8">Subject</td><td style="padding:6px 12px">${subject}</td></tr>
    </table>
    <h3 style="color:#1a1a2e;margin-top:24px">Message</h3>
    <div style="background:#f9f9fc;padding:16px;border-radius:6px;white-space:pre-wrap;font-family:sans-serif;font-size:14px">${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  `;

  // Fire-and-forget — never block the response on email delivery
  sendEmail(supportEmail, `[${ticketId}] ${subject}`, emailText, emailHtml).catch((err) =>
    logger.error({ err, ticketId }, "[support] failed to send ticket email"),
  );

  logger.info({ ticketId, userId, category, subject }, "[support] ticket submitted");

  res.json({ ticketId, message: "Ticket submitted" });
});

export default router;
