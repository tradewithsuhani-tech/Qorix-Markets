import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // deposit, withdrawal, profit, transfer, referral_bonus
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("completed"), // pending, completed, rejected
  description: text("description"),
  walletAddress: varchar("wallet_address", { length: 255 }),
  txHash: varchar("tx_hash", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
