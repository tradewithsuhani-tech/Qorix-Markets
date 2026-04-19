import { db, notificationsTable } from "@workspace/db";

export type NotificationType =
  | "daily_profit"
  | "monthly_payout"
  | "drawdown_alert"
  | "deposit"
  | "withdrawal"
  | "system";

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  await db.insert(notificationsTable).values({ userId, type, title, message });
}
