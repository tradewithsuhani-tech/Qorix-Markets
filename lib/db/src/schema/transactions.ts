import { pgTable, serial, integer, numeric, varchar, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: varchar("type", { length: 50 }).notNull(), // deposit, withdrawal, profit, transfer, referral_bonus
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("completed"), // pending, completed, rejected
    description: text("description"),
    walletAddress: varchar("wallet_address", { length: 255 }),
    txHash: varchar("tx_hash", { length: 255 }),
    // Client-supplied idempotency key. Currently used only for withdrawals to
    // dedupe double-submits / network retries. Nullable + scoped per
    // (user_id, type) so the partial unique index does not affect any
    // existing rows or non-withdrawal transaction types.
    idempotencyKey: varchar("idempotency_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUq: uniqueIndex("transactions_user_type_idem_uq")
      .on(t.userId, t.type, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    // Hot read path: GET /api/transactions filtered by user_id ORDER BY created_at DESC LIMIT 20.
    // Without this composite, the planner did a Seq Scan + in-memory sort on every page load.
    // The existing partial-unique index above only covers rows WHERE idempotency_key IS NOT NULL
    // (a small subset), so it cannot serve the general user-history query.
    userCreatedIdx: index("transactions_user_created_idx").on(t.userId, t.createdAt.desc()),
  }),
);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
