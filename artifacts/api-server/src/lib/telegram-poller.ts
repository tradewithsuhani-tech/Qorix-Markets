// ─────────────────────────────────────────────────────────────────────────────
// Telegram long-polling worker.
//
// We use long-polling (not a webhook) so the integration works identically in
// dev and prod with no public URL configuration. A single goroutine-style
// loop calls `getUpdates` with a 30s server-side wait, processes each update,
// then advances the offset.
//
// Currently we only react to the `/start <code>` deep-link flow used to bind
// a Qorix user to a Telegram chat. Other incoming messages get a friendly
// "this bot only sends alerts" reply.
// ─────────────────────────────────────────────────────────────────────────────

import { db, usersTable } from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { logger } from "./logger";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram";

const TG_API_BASE = "https://api.telegram.org/bot";
const POLL_TIMEOUT_SECONDS = 30;

type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; username?: string; first_name?: string };
  text?: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

let stopped = false;
let nextOffset = 0;

export function startTelegramPoller(): { stop: () => void } {
  if (!isTelegramConfigured()) {
    logger.warn("[telegram-poller] TELEGRAM_BOT_TOKEN not set — poller disabled");
    return { stop: () => {} };
  }
  stopped = false;
  void pollLoop();
  logger.info("[telegram-poller] Started");
  return { stop: () => { stopped = true; } };
}

async function pollLoop(): Promise<void> {
  const t = process.env.TELEGRAM_BOT_TOKEN!.trim();
  while (!stopped) {
    try {
      const url =
        `${TG_API_BASE}${t}/getUpdates` +
        `?timeout=${POLL_TIMEOUT_SECONDS}` +
        `&offset=${nextOffset}` +
        `&allowed_updates=${encodeURIComponent(JSON.stringify(["message"]))}`;
      // We add a small fetch-side buffer over the long-poll timeout so the
      // server's 30s wait completes naturally before our request gives up.
      const ctl = new AbortController();
      const cancel = setTimeout(() => ctl.abort(), (POLL_TIMEOUT_SECONDS + 10) * 1000);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(cancel);
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: TgUpdate[];
        description?: string;
      };
      if (!json.ok) {
        logger.warn({ desc: json.description }, "[telegram-poller] getUpdates not ok");
        await sleep(5000);
        continue;
      }
      const updates = json.result ?? [];
      for (const upd of updates) {
        nextOffset = Math.max(nextOffset, upd.update_id + 1);
        if (upd.message) {
          await handleMessage(upd.message).catch((err) =>
            logger.warn({ err: (err as Error).message }, "[telegram-poller] handler threw"),
          );
        }
      }
    } catch (err) {
      // AbortError on shutdown is expected — silent. Anything else, back off.
      if ((err as Error).name !== "AbortError") {
        logger.warn({ err: (err as Error).message }, "[telegram-poller] loop error");
        await sleep(5000);
      }
    }
  }
  logger.info("[telegram-poller] Stopped");
}

async function handleMessage(msg: TgMessage): Promise<void> {
  const text = (msg.text ?? "").trim();
  const chatId = msg.chat.id;
  const username = msg.from?.username ?? null;

  // Match `/start CODE` (deep-link path). Telegram delivers `/start CODE`
  // as the message text when a user taps `https://t.me/<bot>?start=CODE`.
  const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);
  if (startMatch) {
    const code = (startMatch[1] ?? "").toUpperCase();
    if (!code) {
      await sendTelegramMessage(
        chatId,
        "Welcome to Qorix Markets",
        "To link this account, open Qorix Markets → Settings → Telegram Alerts and tap the link button. Your one-time code will bring you here automatically.",
      );
      return;
    }
    await tryLinkUser(chatId, username, code);
    return;
  }

  // Any other inbound message — friendly fallback.
  if (text.startsWith("/")) {
    await sendTelegramMessage(
      chatId,
      "Qorix Markets Bot",
      "This bot only sends account alerts (deposits, withdrawals, promos, milestones). Manage notifications from Qorix Markets → Settings.",
    );
  }
}

/**
 * Bind the chat to the user identified by `code`.
 * Idempotent: if the same chat is already linked to the same user we just
 * resend a friendly welcome. If linked to a different user we refuse.
 */
async function tryLinkUser(chatId: number, username: string | null, code: string): Promise<void> {
  // 1. Is this chat already linked?
  const existingForChat = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.telegramChatId, chatId))
    .limit(1);

  // 2. Look up the pending code (only valid if not expired AND not already linked).
  const now = new Date();
  const candidates = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      telegramChatId: usersTable.telegramChatId,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.telegramLinkCode, code),
        gt(usersTable.telegramLinkCodeExpiresAt, now),
        isNull(usersTable.telegramChatId),
      ),
    )
    .limit(1);

  const target = candidates[0];

  if (!target) {
    // Either the code is invalid/expired OR the user is already linked.
    if (existingForChat[0]) {
      await sendTelegramMessage(
        chatId,
        "Already Linked",
        `This Telegram is already linked to your Qorix account (${existingForChat[0].fullName}). You'll keep receiving alerts here.`,
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "Invalid or Expired Code",
        "This link code didn't match any pending request. Open Qorix Markets → Settings → Telegram Alerts and generate a fresh code (codes expire after 15 minutes).",
      );
    }
    return;
  }

  // 3. Refuse if this chat is already bound to a DIFFERENT user.
  if (existingForChat[0] && existingForChat[0].id !== target.id) {
    await sendTelegramMessage(
      chatId,
      "Already Linked Elsewhere",
      "This Telegram account is already linked to a different Qorix user. Unlink there first, or use a different Telegram account.",
    );
    return;
  }

  // 4. Atomic conditional bind. The WHERE predicate re-asserts every property
  //    we relied on in the SELECT above (matching code, not expired, no chat
  //    bound yet). If a concurrent replay or another linker already claimed
  //    this user, the UPDATE affects 0 rows and we tell the user politely.
  //    The unique index on telegram_chat_id additionally guarantees that two
  //    pending codes can never both bind the same chat — one will throw.
  let bound = false;
  try {
    const updated = await db
      .update(usersTable)
      .set({
        telegramChatId: chatId,
        telegramUsername: username,
        telegramLinkedAt: new Date(),
        telegramLinkCode: null,
        telegramLinkCodeExpiresAt: null,
        telegramOptIn: true,
      })
      .where(
        and(
          eq(usersTable.id, target.id),
          eq(usersTable.telegramLinkCode, code),
          gt(usersTable.telegramLinkCodeExpiresAt, new Date()),
          isNull(usersTable.telegramChatId),
        ),
      )
      .returning({ id: usersTable.id });
    bound = updated.length > 0;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, userId: target.id, chatId },
      "[telegram-poller] link write failed",
    );
    await sendTelegramMessage(
      chatId,
      "Link Failed",
      "Something went wrong on our side. Please try again from Settings → Telegram Alerts.",
    );
    return;
  }
  if (!bound) {
    await sendTelegramMessage(
      chatId,
      "Code Already Used",
      "That link code was just consumed by another request. Open Qorix Markets → Settings → Telegram Alerts and generate a fresh code.",
    );
    return;
  }

  logger.info({ userId: target.id, chatId, username }, "[telegram-poller] User linked");
  await sendTelegramMessage(
    chatId,
    `Linked, ${target.fullName.split(" ")[0]}!`,
    "Your Qorix Markets account is now connected. You'll receive alerts here for deposits, withdrawals, promos, milestones and important updates. You can mute these any time from Settings → Telegram Alerts.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
