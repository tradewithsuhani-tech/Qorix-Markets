import { pgTable, serial, integer, text, timestamp, varchar, jsonb, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Per-user trading mode and active broker selection. */
export const brokerUserSettingsTable = pgTable("broker_user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** demo | live */
  tradingMode: varchar("trading_mode", { length: 16 }).notNull().default("demo"),
  /** zerodha | null */
  activeBroker: varchar("active_broker", { length: 32 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Encrypted OAuth tokens for live broker connections. */
export const brokerConnectionsTable = pgTable(
  "broker_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    broker: varchar("broker", { length: 32 }).notNull(),
    brokerUserId: varchar("broker_user_id", { length: 64 }),
    brokerUserName: varchar("broker_user_name", { length: 255 }),
    accessTokenEnc: text("access_token_enc").notNull(),
    apiKey: varchar("api_key", { length: 64 }),
    tokenExpiresAt: timestamp("token_expires_at"),
    meta: jsonb("meta"),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("broker_connections_user_broker_uq").on(t.userId, t.broker)],
);

/** Virtual demo trading state — no real orders. */
export const brokerDemoStateTable = pgTable("broker_demo_state", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  cashBalance: numeric("cash_balance", { precision: 18, scale: 2 }).notNull().default("1000000"),
  holdings: jsonb("holdings").notNull().default([]),
  positions: jsonb("positions").notNull().default([]),
  orders: jsonb("orders").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
