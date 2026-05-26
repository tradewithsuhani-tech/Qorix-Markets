import { pgTable, serial, integer, numeric, boolean, varchar, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull().default("0"),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("low"), // low, medium, high
  isActive: boolean("is_active").notNull().default(false),
  isPaused: boolean("is_paused").notNull().default(false),
  autoCompound: boolean("auto_compound").notNull().default(false),
  totalProfit: numeric("total_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  dailyProfit: numeric("daily_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  drawdown: numeric("drawdown", { precision: 18, scale: 8 }).notNull().default("0"),
  drawdownLimit: numeric("drawdown_limit", { precision: 5, scale: 2 }).notNull().default("5.00"), // percentage e.g. 5.00 = 5%
  peakBalance: numeric("peak_balance", { precision: 18, scale: 8 }).notNull().default("0"), // highest equity reached
  referralBonusPaid: boolean("referral_bonus_paid").notNull().default(false), // one-time signup bonus to sponsor (3% of first activation amount)
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  pausedAt: timestamp("paused_at"),
  // NAV engine: pending top-up capital — set on top-up, settled next trading day before profit run
  navPendingAdd: numeric("nav_pending_add", { precision: 18, scale: 8 }).notNull().default("0"),
  navPendingDate: date("nav_pending_date"), // date the pending add was recorded; NULL when no pending
  // NAV engine: start-of-day snapshot used as the profit basis for today's run
  navSnapshotBalance: numeric("nav_snapshot_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  navSnapshotDate: date("nav_snapshot_date"), // date the snapshot was captured; NULL until first run
  // NAV engine: pending risk-level change — set when user requests mid-month switch,
  // promoted to riskLevel by the profit engine before the NEXT trading day's run.
  // Today earns at the old rate; tomorrow onward earns at the new rate.
  pendingRiskLevel: varchar("pending_risk_level", { length: 20 }), // NULL when no change pending
  pendingRiskLevelDate: date("pending_risk_level_date"), // date the change was requested; NULL when no change pending
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true });
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
