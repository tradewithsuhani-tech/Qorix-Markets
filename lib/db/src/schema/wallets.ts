import { pgTable, serial, integer, numeric, timestamp, bigint, varchar, text } from "drizzle-orm/pg-core";
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
  // Per-user synthetic Daily P&L state (display-only). Daily target picked
  // once per UTC weekday between 0.40%–0.60%, split into 4 random chunks
  // released every 4 hours. Sat/Sun = market closed (no advance).
  dailyPnlAmount: numeric("daily_pnl_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  dailyPnlPct: numeric("daily_pnl_pct", { precision: 6, scale: 4 }).notNull().default("0"),
  dailyPnlDay: varchar("daily_pnl_day", { length: 10 }).notNull().default(""),
  dailyPnlTargetPct: numeric("daily_pnl_target_pct", { precision: 6, scale: 4 }).notNull().default("0"),
  dailyPnlChunks: text("daily_pnl_chunks").notNull().default("[]"),
  dailyPnlIncrementsDone: integer("daily_pnl_increments_done").notNull().default(0),
  // Per-user "Active Trading Fund" display boost: random $100–$1000 every 30 min,
  // display-only — never affects real investments or accounting.
  tradingFundBoost: numeric("trading_fund_boost", { precision: 18, scale: 2 }).notNull().default("0"),
  tradingFundLastAt: bigint("trading_fund_last_at", { mode: "number" }).notNull().default(0),
  // Per-user "Total Profit" display boost: monotonic accumulator that tracks
  // every Daily P&L chunk ever dispensed, so Total Profit grows by exactly
  // the same dollar delta as Daily P&L. Display-only.
  totalProfitBoost: numeric("total_profit_boost", { precision: 18, scale: 2 }).notNull().default("0"),
  // Per-user synthetic Performance Metrics (display-only). Recomputed once
  // per UTC day inside /dashboard/performance and persisted so subsequent
  // calls return a stable value. Win rate ∈ [70,95]%, max drawdown ∈ [3,12]%.
  synthWinRate: numeric("synth_win_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  synthMaxDrawdown: numeric("synth_max_drawdown", { precision: 5, scale: 2 }).notNull().default("0"),
  synthAvgReturn: numeric("synth_avg_return", { precision: 5, scale: 2 }).notNull().default("0"),
  synthRiskScore: varchar("synth_risk_score", { length: 10 }).notNull().default("Low"),
  synthMetricsDay: varchar("synth_metrics_day", { length: 10 }).notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
