// ─────────────────────────────────────────────────────────────────────────────
// Telegram Bot helper — sends transactional alerts to opted-in Qorix users.
//
// All exports are SAFE to call without TELEGRAM_BOT_TOKEN being set: they
// degrade to no-ops and log a single startup warning. Sends are fire-and-
// forget from caller's perspective and never throw, so failures never break
// existing notification or business logic.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger";

const TG_API_BASE = "https://api.telegram.org/bot";

let cachedBotUsername: string | null = null;
let getMeAttempted = false;

function token(): string | undefined {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  return t && t.trim() ? t.trim() : undefined;
}

export function isTelegramConfigured(): boolean {
  return token() !== undefined;
}

/** Returns the promo channel/group invite link from env, or null if not set. */
export function getPromoChannelLink(): string | null {
  const link = process.env.TELEGRAM_CHANNEL_INVITE_LINK;
  return link && link.trim() ? link.trim() : null;
}

/**
 * Returns the numeric group/supergroup chat ID from env (TELEGRAM_PROMO_GROUP_ID).
 * When set, the bot will attempt to add newly-linked users directly to the group.
 * This only works for groups/supergroups where the bot is an admin with
 * "Add Members" permission. For broadcast channels, use TELEGRAM_CHANNEL_INVITE_LINK.
 */
export function getPromoGroupId(): number | null {
  const id = process.env.TELEGRAM_PROMO_GROUP_ID;
  if (!id || !id.trim()) return null;
  const n = parseInt(id.trim(), 10);
  return isNaN(n) ? null : n;
}

/** Lazy fetch bot username from getMe. Cached after first success. */
export async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  const t = token();
  if (!t) return null;
  if (getMeAttempted && !cachedBotUsername) return null;
  getMeAttempted = true;
  try {
    const res = await fetch(`${TG_API_BASE}${t}/getMe`);
    const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
    if (json.ok && json.result?.username) {
      cachedBotUsername = json.result.username;
      logger.info({ username: cachedBotUsername }, "[telegram] Bot identified");
      return cachedBotUsername;
    }
    logger.warn({ json }, "[telegram] getMe failed");
    return null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[telegram] getMe threw");
    return null;
  }
}

/**
 * Build deep links the Settings card uses to bind a user.
 *  - `httpsUrl`: universal `https://t.me/...` link (always safe, opens in
 *    browser → handoff to native Telegram app via Universal/App Links).
 *  - `tgUrl`: native `tg://resolve?...` scheme — instant app open if
 *    Telegram is installed (no browser bounce). Frontend tries this first.
 */
export async function buildLinkUrl(
  linkCode: string,
): Promise<{ httpsUrl: string; tgUrl: string; username: string } | null> {
  const username = await getBotUsername();
  if (!username) return null;
  const code = encodeURIComponent(linkCode);
  return {
    username,
    httpsUrl: `https://t.me/${username}?start=${code}`,
    tgUrl: `tg://resolve?domain=${username}&start=${code}`,
  };
}

/**
 * Send a Telegram message. Never throws. Returns true on Telegram's
 * `{ ok: true }` response. If the chat blocked the bot we receive 403 — caller
 * may then clear that user's telegram_chat_id; the helper exposes the boolean
 * so callers can react.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  title: string,
  body: string,
): Promise<{ ok: boolean; blocked?: boolean }> {
  const t = token();
  if (!t) return { ok: false };
  const text = `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`;
  try {
    const res = await fetch(`${TG_API_BASE}${t}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
    };
    if (json.ok) return { ok: true };
    const blocked = json.error_code === 403 || json.error_code === 400;
    logger.warn(
      { chatId, code: json.error_code, desc: json.description },
      "[telegram] sendMessage failed",
    );
    return { ok: false, blocked };
  } catch (err) {
    logger.warn({ err: (err as Error).message, chatId }, "[telegram] sendMessage threw");
    return { ok: false };
  }
}

/**
 * Send a Telegram message with inline keyboard buttons.
 * `buttons` is a 2D array: outer = rows, inner = buttons per row.
 * Each button: { text, url } for URL buttons.
 * Never throws.
 */
export async function sendTelegramMessageWithButtons(
  chatId: number | string,
  title: string,
  body: string,
  buttons: Array<Array<{ text: string; url: string }>>,
): Promise<{ ok: boolean; blocked?: boolean }> {
  const t = token();
  if (!t) return { ok: false };
  const text = `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`;
  const inline_keyboard = buttons.map((row) =>
    row.map((btn) => ({ text: btn.text, url: btn.url })),
  );
  try {
    const res = await fetch(`${TG_API_BASE}${t}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
    };
    if (json.ok) return { ok: true };
    const blocked = json.error_code === 403 || json.error_code === 400;
    logger.warn(
      { chatId, code: json.error_code, desc: json.description },
      "[telegram] sendMessageWithButtons failed",
    );
    return { ok: false, blocked };
  } catch (err) {
    logger.warn({ err: (err as Error).message, chatId }, "[telegram] sendMessageWithButtons threw");
    return { ok: false };
  }
}

/**
 * Attempt to add a user (by their Telegram user ID) to a group or supergroup.
 * This only works when:
 *   1. The bot is an admin of the group with "Add Members" permission.
 *   2. The target is a group/supergroup (NOT a broadcast channel).
 * Returns { ok: true } on success, { ok: false, alreadyMember } if the user
 * is already in the group, or { ok: false } on any other failure.
 * Never throws.
 */
export async function addChatMember(
  groupChatId: number | string,
  userTelegramId: number,
): Promise<{ ok: boolean; alreadyMember?: boolean }> {
  const t = token();
  if (!t) return { ok: false };
  try {
    const res = await fetch(`${TG_API_BASE}${t}/addChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: groupChatId, user_id: userTelegramId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
    };
    if (json.ok) return { ok: true };
    // 400 with "USER_ALREADY_PARTICIPANT" — not an error for us
    const alreadyMember =
      json.error_code === 400 &&
      typeof json.description === "string" &&
      json.description.includes("USER_ALREADY_PARTICIPANT");
    if (alreadyMember) return { ok: true, alreadyMember: true };
    logger.warn(
      { groupChatId, userTelegramId, code: json.error_code, desc: json.description },
      "[telegram] addChatMember failed",
    );
    return { ok: false };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, groupChatId, userTelegramId },
      "[telegram] addChatMember threw",
    );
    return { ok: false };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Generate a random link code: 8 chars, A-Z + 2-9 (no I/O/0/1 to avoid confusion). */
export function generateLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
