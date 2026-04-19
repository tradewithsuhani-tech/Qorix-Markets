import { pgTable, serial, integer, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // buy, sell
  entryPrice: numeric("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 8 }).notNull(),
  profit: numeric("profit", { precision: 18, scale: 8 }).notNull(),
  profitPercent: numeric("profit_percent", { precision: 10, scale: 4 }).notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, executedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
