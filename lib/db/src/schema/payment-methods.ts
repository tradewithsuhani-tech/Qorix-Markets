import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  accountHolder: varchar("account_holder", { length: 200 }),
  accountNumber: varchar("account_number", { length: 50 }),
  ifsc: varchar("ifsc", { length: 20 }),
  bankName: varchar("bank_name", { length: 100 }),
  upiId: varchar("upi_id", { length: 100 }),
  qrImageBase64: text("qr_image_base64"),
  minAmount: numeric("min_amount", { precision: 18, scale: 2 }).notNull().default("100"),
  maxAmount: numeric("max_amount", { precision: 18, scale: 2 }).notNull().default("500000"),
  instructions: text("instructions"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Owning merchant. NULL = legacy admin-managed method (kept active so existing
  // deposits flow doesn't break). Admin can reassign to a merchant later from
  // the admin-merchants page.
  merchantId: integer("merchant_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
