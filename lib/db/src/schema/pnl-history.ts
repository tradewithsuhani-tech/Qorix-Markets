import { pgTable, serial, integer, numeric, varchar, uniqueIndex } from "drizzle-orm/pg-core";

export const pnlHistoryTable = pgTable(
  "pnl_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    percent: numeric("percent", { precision: 6, scale: 4 }).notNull().default("0"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    userDateUnique: uniqueIndex("pnl_history_user_date_unique").on(t.userId, t.date),
  }),
);

export type PnlHistory = typeof pnlHistoryTable.$inferSelect;
