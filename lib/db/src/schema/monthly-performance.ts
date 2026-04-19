import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monthlyPerformanceTable = pgTable("monthly_performance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  monthlyReturn: numeric("monthly_return", { precision: 10, scale: 4 }).notNull().default("0"),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }).notNull().default("0"),
  winRate: numeric("win_rate", { precision: 10, scale: 4 }).notNull().default("0"),
  totalProfit: numeric("total_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  tradingDays: integer("trading_days").notNull().default(0),
  winningDays: integer("winning_days").notNull().default(0),
  startEquity: numeric("start_equity", { precision: 18, scale: 8 }).notNull().default("0"),
  peakEquity: numeric("peak_equity", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMonthlyPerformanceSchema = createInsertSchema(monthlyPerformanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMonthlyPerformance = z.infer<typeof insertMonthlyPerformanceSchema>;
export type MonthlyPerformance = typeof monthlyPerformanceTable.$inferSelect;
