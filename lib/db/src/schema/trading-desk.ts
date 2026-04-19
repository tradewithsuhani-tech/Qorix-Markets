import { pgTable, serial, varchar, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradersTable = pgTable("trading_desk_traders", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  strategyType: varchar("strategy_type", { length: 20 }).notNull(), // scalping | swing | hybrid
  experienceYears: integer("experience_years").notNull(),
  winRatePercent: numeric("win_rate_percent", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertTraderSchema = createInsertSchema(tradersTable).omit({ id: true, joinedAt: true });
export type InsertTrader = z.infer<typeof insertTraderSchema>;
export type Trader = typeof tradersTable.$inferSelect;
