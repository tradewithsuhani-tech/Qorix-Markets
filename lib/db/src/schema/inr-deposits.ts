import { pgTable, serial, integer, varchar, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inrDepositsTable = pgTable(
  "inr_deposits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    paymentMethodId: integer("payment_method_id").notNull(),
    amountInr: numeric("amount_inr", { precision: 18, scale: 2 }).notNull(),
    amountUsdt: numeric("amount_usdt", { precision: 18, scale: 6 }).notNull(),
    rateUsed: numeric("rate_used", { precision: 18, scale: 4 }).notNull(),
    utr: varchar("utr", { length: 100 }).notNull(),
    proofImageBase64: text("proof_image_base64"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    adminNote: text("admin_note"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    utrUq: uniqueIndex("inr_deposits_utr_uq").on(t.utr),
    userIdx: index("inr_deposits_user_idx").on(t.userId),
    statusIdx: index("inr_deposits_status_idx").on(t.status),
  }),
);

export const insertInrDepositSchema = createInsertSchema(inrDepositsTable).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  status: true,
  adminNote: true,
});
export type InsertInrDeposit = z.infer<typeof insertInrDepositSchema>;
export type InrDeposit = typeof inrDepositsTable.$inferSelect;
