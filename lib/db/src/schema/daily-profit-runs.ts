import { pgTable, serial, numeric, integer, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyProfitRunsTable = pgTable("daily_profit_runs", {
  id: serial("id").primaryKey(),
  runDate: date("run_date").notNull(),
  profitPercent: numeric("profit_percent", { precision: 10, scale: 4 }).notNull(),
  totalAUM: numeric("total_aum", { precision: 18, scale: 8 }).notNull().default("0"),
  totalProfitDistributed: numeric("total_profit_distributed", { precision: 18, scale: 8 }).notNull().default("0"),
  investorsAffected: integer("investors_affected").notNull().default(0),
  referralBonusPaid: numeric("referral_bonus_paid", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_daily_profit_runs_run_date").on(t.runDate),
]);

export const insertDailyProfitRunSchema = createInsertSchema(dailyProfitRunsTable).omit({ id: true, createdAt: true });
export type InsertDailyProfitRun = z.infer<typeof insertDailyProfitRunSchema>;
export type DailyProfitRun = typeof dailyProfitRunsTable.$inferSelect;
