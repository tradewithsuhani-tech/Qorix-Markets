import {
  pgTable,
  serial,
  integer,
  numeric,
  varchar,
  boolean,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const glAccountsTable = pgTable("gl_accounts", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(), // asset | liability | equity | revenue | expense
  normalBalance: varchar("normal_balance", { length: 10 }).notNull().default("debit"), // debit | credit
  userId: integer("user_id"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  journalId: varchar("journal_id", { length: 100 }).notNull(), // groups debit+credit pair(s) for one event
  transactionId: integer("transaction_id"), // nullable — links to transactions table
  accountId: integer("account_id").notNull(), // FK to gl_accounts.id (denorm kept simple)
  accountCode: varchar("account_code", { length: 100 }).notNull(), // denormalized for readability
  entryType: varchar("entry_type", { length: 10 }).notNull(), // debit | credit
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USDT"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
