import { db, notificationsTable } from "@workspace/db";

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
}
