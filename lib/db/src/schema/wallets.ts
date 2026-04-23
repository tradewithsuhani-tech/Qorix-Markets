import { pgTable, serial, integer, numeric, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  mainBalance: numeric("main_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  tradingBalance: numeric("trading_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  profitBalance: numeric("profit_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  // Display-only synthetic boost shown in the dashboard "Total Equity" card.
  // Never affects real balances, withdrawals, profit distribution or accounting.
  // Auto-grows by random $100–$500 every 10 min via /api/dashboard/summary.
  demoEquityBoost: numeric("demo_equity_boost", { precision: 18, scale: 2 }).notNull().default("0"),
  demoEquityLastAt: bigint("demo_equity_last_at", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
