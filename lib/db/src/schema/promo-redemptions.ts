import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * Each user gets ONE personal 5% deposit-bonus promo code for life.
 * - `status`: "issued" → code generated, not yet used
 *             "redeemed" → user applied the code (claim is active, awaiting
 *                          next confirmed deposit to credit the bonus)
 *             "credited" → 5% bonus has been paid to user's main balance
 * - `depositId`: filled when the bonus is credited (FK to blockchain_deposits.id)
 * - `bonusAmount`: actual USDT bonus credited (5% of the qualifying deposit)
 */
export const promoRedemptionsTable = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("issued"),
  bonusPercent: numeric("bonus_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  bonusAmount: numeric("bonus_amount", { precision: 18, scale: 8 }),
  depositId: integer("deposit_id"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at"),
  creditedAt: timestamp("credited_at"),
});

export type PromoRedemption = typeof promoRedemptionsTable.$inferSelect;
