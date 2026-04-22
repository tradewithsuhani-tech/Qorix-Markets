import { pgTable, serial, integer, varchar, numeric, timestamp, boolean } from "drizzle-orm/pg-core";

export const blockchainDepositsTable = pgTable("blockchain_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  txHash: varchar("tx_hash", { length: 128 }).notNull().unique(),
  fromAddress: varchar("from_address", { length: 64 }).notNull(),
  toAddress: varchar("to_address", { length: 64 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  credited: boolean("credited").notNull().default(false),
  swept: boolean("swept").notNull().default(false),
  sweepTxHash: varchar("sweep_tx_hash", { length: 128 }),
  blockTimestamp: timestamp("block_timestamp"),
  creditedAt: timestamp("credited_at"),
  sweptAt: timestamp("swept_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BlockchainDeposit = typeof blockchainDepositsTable.$inferSelect;
