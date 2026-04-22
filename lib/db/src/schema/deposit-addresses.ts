import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const depositAddressesTable = pgTable("deposit_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  trc20Address: varchar("trc20_address", { length: 64 }).notNull().unique(),
  // AES-256-GCM encrypted private key (base64: iv | tag | ciphertext)
  privateKeyEnc: varchar("private_key_enc", { length: 512 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DepositAddress = typeof depositAddressesTable.$inferSelect;
