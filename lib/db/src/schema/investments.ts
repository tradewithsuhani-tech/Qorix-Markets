import { pgTable, serial, integer, numeric, boolean, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentsTable = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull().default("0"),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("low"), // low, medium, high
  isActive: boolean("is_active").notNull().default(false),
  autoCompound: boolean("auto_compound").notNull().default(false),
  totalProfit: numeric("total_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  dailyProfit: numeric("daily_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  drawdown: numeric("drawdown", { precision: 18, scale: 8 }).notNull().default("0"),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
});

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({ id: true });
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investmentsTable.$inferSelect;
