import { pgTable, serial, varchar, numeric, integer, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyRateScheduleTable = pgTable("daily_rate_schedule", {
  id: serial("id").primaryKey(),
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).notNull(),
  tradingDayIndex: integer("trading_day_index").notNull(),
  runDate: date("run_date").notNull(),
  ratePct: numeric("rate_pct", { precision: 12, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_daily_rate_date_risk").on(t.runDate, t.riskLevel),
]);

export const insertDailyRateScheduleSchema = createInsertSchema(dailyRateScheduleTable).omit({ id: true, createdAt: true });
export type InsertDailyRateSchedule = z.infer<typeof insertDailyRateScheduleSchema>;
export type DailyRateSchedule = typeof dailyRateScheduleTable.$inferSelect;
