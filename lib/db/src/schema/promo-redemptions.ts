import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * One redemption row per user (lifetime cap on promo bonuses).
 *
 * Under the current rotating-window scheme, `code` is a SYSTEM-WIDE code
 * shared by every user who redeems within the same time window — so the
 * `code` column is intentionally NOT unique. Per-user uniqueness is
 * enforced by the `userId` unique constraint.
 *
 * Lifecycle:
 * - `status`: "issued"   → legacy row from the old per-user-code scheme
 *             "redeemed" → user locked in the current window's code, awaiting
 *                          next confirmed deposit to credit the bonus
 *             "credited" → bonus has been paid to user's trading balance
 *             "expired"  → redeemed but not credited within 24h (cron purge)
 * - `depositId`: filled when the bonus is credited (FK to blockchain_deposits.id)
 * - `bonusAmount`: actual USDT bonus credited (bonus% of the qualifying deposit)
 */
export const promoRedemptionsTable = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  code: varchar("code", { length: 32 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("issued"),
  bonusPercent: numeric("bonus_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  bonusAmount: numeric("bonus_amount", { precision: 18, scale: 8 }),
  depositId: integer("deposit_id"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at"),
  creditedAt: timestamp("credited_at"),
});

export type PromoRedemption = typeof promoRedemptionsTable.$inferSelect;
