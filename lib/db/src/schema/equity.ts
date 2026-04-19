import { pgTable, serial, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equityHistoryTable = pgTable("equity_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  equity: numeric("equity", { precision: 18, scale: 8 }).notNull(),
  profit: numeric("profit", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEquitySchema = createInsertSchema(equityHistoryTable).omit({ id: true, createdAt: true });
export type InsertEquity = z.infer<typeof insertEquitySchema>;
export type EquityHistory = typeof equityHistoryTable.$inferSelect;
