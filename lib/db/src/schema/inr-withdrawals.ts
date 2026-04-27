import { pgTable, serial, integer, varchar, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inrWithdrawalsTable = pgTable(
  "inr_withdrawals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    amountInr: numeric("amount_inr", { precision: 18, scale: 2 }).notNull(),
    amountUsdt: numeric("amount_usdt", { precision: 18, scale: 6 }).notNull(),
    rateUsed: numeric("rate_used", { precision: 18, scale: 4 }).notNull(),
    payoutMethod: varchar("payout_method", { length: 20 }).notNull(),
    upiId: varchar("upi_id", { length: 100 }),
    accountHolder: varchar("account_holder", { length: 200 }),
    accountNumber: varchar("account_number", { length: 50 }),
    ifsc: varchar("ifsc", { length: 20 }),
    bankName: varchar("bank_name", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    adminNote: text("admin_note"),
    payoutReference: varchar("payout_reference", { length: 100 }),
    reviewedBy: integer("reviewed_by"),
    // "admin" or "merchant" — see inr_deposits for rationale.
    reviewedByKind: varchar("reviewed_by_kind", { length: 20 }),
    // First merchant to "claim" the withdrawal owns it from then on. Optional
    // — admin may also approve directly without a claim, leaving this NULL.
    assignedMerchantId: integer("assigned_merchant_id"),
    reviewedAt: timestamp("reviewed_at"),
    escalatedToMerchantAt: timestamp("escalated_to_merchant_at"),
    escalatedToAdminAt: timestamp("escalated_to_admin_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("inr_withdrawals_user_idx").on(t.userId),
    statusIdx: index("inr_withdrawals_status_idx").on(t.status),
  }),
);

export const insertInrWithdrawalSchema = createInsertSchema(inrWithdrawalsTable).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewedByKind: true,
  assignedMerchantId: true,
  status: true,
  adminNote: true,
  payoutReference: true,
  escalatedToMerchantAt: true,
  escalatedToAdminAt: true,
});
export type InsertInrWithdrawal = z.infer<typeof insertInrWithdrawalSchema>;
export type InrWithdrawal = typeof inrWithdrawalsTable.$inferSelect;
