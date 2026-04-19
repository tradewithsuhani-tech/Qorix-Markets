import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportVerificationsTable = pgTable("report_verifications", {
  id: serial("id").primaryKey(),
  hashId: varchar("hash_id", { length: 64 }).notNull().unique(),
  userId: integer("user_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  monthlyReturn: numeric("monthly_return", { precision: 10, scale: 4 }).notNull(),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }).notNull(),
  winRate: numeric("win_rate", { precision: 10, scale: 4 }).notNull(),
  totalProfit: numeric("total_profit", { precision: 18, scale: 8 }).notNull(),
  tradingDays: integer("trading_days").notNull(),
  winningDays: integer("winning_days").notNull(),
  startEquity: numeric("start_equity", { precision: 18, scale: 8 }).notNull(),
  peakEquity: numeric("peak_equity", { precision: 18, scale: 8 }).notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertReportVerificationSchema = createInsertSchema(reportVerificationsTable).omit({ id: true, generatedAt: true });
export type InsertReportVerification = z.infer<typeof insertReportVerificationSchema>;
export type ReportVerification = typeof reportVerificationsTable.$inferSelect;
