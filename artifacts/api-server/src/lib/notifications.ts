import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendTelegramMessage } from "./telegram";
import { logger } from "./logger";

export type NotificationType =
  | "daily_profit"
  | "monthly_payout"
  | "drawdown_alert"
  | "deposit"
  | "withdrawal"
  | "referral_bonus"
  | "milestone"
  | "system";

// Optional executor lets callers pass a transaction handle (`tx`) so the
// insert runs on the SAME connection that holds an advisory lock. Defaults
// to the global `db` when called outside a transaction.
type DbExecutor = Pick<typeof db, "insert">;

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  executor: DbExecutor = db,
): Promise<void> {
  await executor.insert(notificationsTable).values({ userId, type, title, message });

  // ── Mirror to Telegram (fire-and-forget) ───────────────────────────────────
  // We never block the in-app notification on Telegram delivery: Telegram is
  // a best-effort secondary channel. Using setImmediate also keeps Telegram
  // I/O off the critical path of any transaction the caller might be holding
  // (we also use the GLOBAL `db` for the user lookup, never the executor, so
  // we don't read from a transaction the user thread will roll back).
  setImmediate(() => {
    void mirrorToTelegram(userId, title, message).catch((err) =>
      logger.warn(
        { err: (err as Error).message, userId, type },
        "[notifications] telegram mirror failed",
      ),
    );
  });
}

async function mirrorToTelegram(userId: number, title: string, message: string): Promise<void> {
  const rows = await db
    .select({
      chatId: usersTable.telegramChatId,
      optIn: usersTable.telegramOptIn,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row?.chatId || !row.optIn) return;
  const result = await sendTelegramMessage(row.chatId, title, message);
  // If the user blocked the bot or deleted the chat, clear the binding so we
  // don't keep retrying. They can re-link from Settings any time.
  if (!result.ok && result.blocked) {
    await db
      .update(usersTable)
      .set({
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      })
      .where(eq(usersTable.id, userId))
      .catch((err) =>
        logger.warn(
          { err: (err as Error).message, userId },
          "[notifications] telegram unbind on block failed",
        ),
      );
    logger.info({ userId }, "[notifications] Cleared telegram binding (user blocked/deleted bot)");
  }
}
