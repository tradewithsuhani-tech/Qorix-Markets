import { pgTable, serial, varchar, integer, numeric, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalTradesTable = pgTable("signal_trades", {
  id: serial("id").primaryKey(),
  pair: varchar("pair", { length: 20 }).notNull(),
  direction: varchar("direction", { length: 4 }).notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 5 }).notNull(),
  pipsTarget: numeric("pips_target", { precision: 12, scale: 2 }).notNull(),
  pipSize: numeric("pip_size", { precision: 12, scale: 6 }).notNull().default("0.0001"),
  exitPrice: numeric("exit_price", { precision: 18, scale: 5 }).notNull(),
  expectedProfitPercent: numeric("expected_profit_percent", { precision: 8, scale: 4 }).notNull(),
  realizedProfitPercent: numeric("realized_profit_percent", { precision: 8, scale: 4 }),
  realizedExitPrice: numeric("realized_exit_price", { precision: 18, scale: 5 }),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  closeReason: varchar("close_reason", { length: 30 }),
  notes: text("notes"),
  totalDistributed: numeric("total_distributed", { precision: 18, scale: 8 }).default("0"),
  affectedUsers: integer("affected_users").default(0),
  idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull().unique(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
}, (t) => ({
  statusIdx: index("signal_trades_status_idx").on(t.status),
}));

export const signalTradeDistributionsTable = pgTable("signal_trade_distributions", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(),
  userId: integer("user_id").notNull(),
  shareBasisAmount: numeric("share_basis", { precision: 18, scale: 8 }).notNull(),
  profitAmount: numeric("profit_amount", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  tradeUserUnique: uniqueIndex("signal_trade_dist_trade_user_unique").on(t.tradeId, t.userId),
  userIdx: index("signal_trade_dist_user_idx").on(t.userId),
}));

export const insertSignalTradeSchema = createInsertSchema(signalTradesTable).omit({
  id: true, exitPrice: true, expectedProfitPercent: true, realizedProfitPercent: true,
  realizedExitPrice: true, status: true, closeReason: true, totalDistributed: true,
  affectedUsers: true, createdAt: true, closedAt: true, idempotencyKey: true, createdBy: true,
});

export type SignalTrade = typeof signalTradesTable.$inferSelect;
export type SignalTradeDistribution = typeof signalTradeDistributionsTable.$inferSelect;
