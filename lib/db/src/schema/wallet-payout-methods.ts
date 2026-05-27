import {
  pgTable, serial, integer, varchar, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Saved INR payout destinations per user.
 * Used in: Profile → Account → "INR payout methods" (CRUD)
 *           Wallet → Withdraw → INR → saved bank/UPI picker
 *
 * type enum:
 *   bank        → accountValue = account number; bankName + ifsc also required
 *   upi         → accountValue = UPI ID (raj@oksbi)
 *   qorix_user  → accountValue = referral/user code (QX-ABC123)
 */
export const walletPayoutMethodsTable = pgTable("wallet_payout_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(),       // bank | upi | qorix_user
  label: varchar("label", { length: 100 }),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountValue: varchar("account_value", { length: 200 }).notNull(),
  bankName: varchar("bank_name", { length: 100 }),
  ifsc: varchar("ifsc", { length: 20 }),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("wpm_user_idx").on(t.userId),
}));

export const insertWalletPayoutMethodSchema = createInsertSchema(walletPayoutMethodsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWalletPayoutMethod = z.infer<typeof insertWalletPayoutMethodSchema>;
export type WalletPayoutMethod = typeof walletPayoutMethodsTable.$inferSelect;
