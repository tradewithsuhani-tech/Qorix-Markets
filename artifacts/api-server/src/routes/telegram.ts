// ─────────────────────────────────────────────────────────────────────────────
// /api/telegram — user-facing routes for the Telegram alerts opt-in flow.
//
//   POST   /api/telegram/link/start    → mint a one-time link code + deep link
//   GET    /api/telegram/status         → current binding state (poll while
//                                         the link modal is open)
//   POST   /api/telegram/opt-in         → toggle alerts on/off without unlink
//   DELETE /api/telegram/link           → unlink (forget chat_id)
//
// All routes require auth.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type IRouter, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  buildLinkUrl,
  generateLinkCode,
  isTelegramConfigured,
  sendTelegramMessage,
} from "../lib/telegram";

const router: IRouter = Router();

router.use(authMiddleware);

const LINK_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

router.post("/telegram/link/start", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!isTelegramConfigured()) {
    return res.status(503).json({ error: "Telegram bot is not configured on this server." });
  }

  // Re-use the existing code if it's still fresh — keeps the deep link stable
  // if the user closes and re-opens the modal. Otherwise mint a new one.
  const rows = await db
    .select({
      chatId: usersTable.telegramChatId,
      code: usersTable.telegramLinkCode,
      expiresAt: usersTable.telegramLinkCodeExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u) return res.status(404).json({ error: "User not found." });
  if (u.chatId) {
    return res.status(409).json({ error: "Telegram is already linked. Unlink first to re-link." });
  }

  const now = new Date();
  let code = u.code;
  let expiresAt = u.expiresAt;
  if (!code || !expiresAt || expiresAt.getTime() < now.getTime() + 60_000) {
    // Less than a minute left, or no code at all → mint a fresh one.
    code = generateLinkCode();
    expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
    await db
      .update(usersTable)
      .set({ telegramLinkCode: code, telegramLinkCodeExpiresAt: expiresAt })
      .where(eq(usersTable.id, userId));
  }

  const deepLink = await buildLinkUrl(code);
  if (!deepLink) {
    return res.status(503).json({ error: "Could not resolve the bot username — try again shortly." });
  }
  return res.json({
    code,
    deepLink,
    expiresAt: expiresAt.toISOString(),
  });
});

router.get("/telegram/status", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rows = await db
    .select({
      chatId: usersTable.telegramChatId,
      username: usersTable.telegramUsername,
      linkedAt: usersTable.telegramLinkedAt,
      optIn: usersTable.telegramOptIn,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u) return res.status(404).json({ error: "User not found." });
  return res.json({
    linked: u.chatId != null,
    username: u.username,
    linkedAt: u.linkedAt?.toISOString() ?? null,
    optIn: u.optIn,
    configured: isTelegramConfigured(),
  });
});

router.post("/telegram/opt-in", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const optIn = (req.body as { optIn?: unknown })?.optIn;
  if (typeof optIn !== "boolean") {
    return res.status(400).json({ error: "optIn boolean required." });
  }
  await db
    .update(usersTable)
    .set({ telegramOptIn: optIn })
    .where(eq(usersTable.id, userId));
  return res.json({ ok: true, optIn });
});

router.delete("/telegram/link", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rows = await db
    .select({ chatId: usersTable.telegramChatId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const chatId = rows[0]?.chatId;
  await db
    .update(usersTable)
    .set({
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
    })
    .where(eq(usersTable.id, userId));
  // Best-effort goodbye message; never blocks unlink.
  if (chatId) {
    setImmediate(async () => {
      try {
        await sendTelegramMessage(
          chatId,
          "Unlinked",
          "Your Qorix Markets account has been unlinked from this Telegram. You'll no longer receive alerts here. Re-link any time from Settings → Telegram Alerts.",
        );
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, userId, chatId },
          "[telegram] goodbye message failed",
        );
      }
    });
  }
  return res.json({ ok: true });
});

export default router;
