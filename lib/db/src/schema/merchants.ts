import { pgTable, serial, integer, varchar, boolean, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const merchantsTable = pgTable(
  "merchants",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 200 }).notNull(),
    passwordHash: varchar("password_hash", { length: 200 }).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"),
    // INR wallet / security deposit. Available capacity for accepting new
    // user INR deposits = inrBalance − sum(pending inr_deposits assigned to
    // this merchant via owned payment_methods). Decremented atomically when
    // a deposit is approved; incremented when a withdrawal this merchant
    // paid out is approved.
    inrBalance: numeric("inr_balance", { precision: 18, scale: 2 }).notNull().default("0"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailUq: uniqueIndex("merchants_email_uq").on(t.email),
  }),
);

export const insertMerchantSchema = createInsertSchema(merchantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchantsTable.$inferSelect;
