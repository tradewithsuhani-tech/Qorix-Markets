import { pgTable, serial, integer, text, boolean, timestamp, varchar, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Operational subscription tracker — what services do we pay for, how much,
// and when is the next bill due. Pure admin-facing bookkeeping; the app's
// own users never see this. Used by /admin/subscriptions to surface
// upcoming/overdue payments before they cause an outage (Fly suspension,
// Neon DB freeze, domain expiry, Replit subscription lapse, etc.).
//
// All amounts are stored in USD as a flat numeric — we don't run currency
// conversion on this table; the admin enters whatever currency they pay in
// converted to USD (or leaves it as the local figure with a note). The
// `nextDueDate` column is plain `date` (no time component) — billing
// granularity is days, not seconds, and date arithmetic with timestamptz
// across timezones causes off-by-one bugs in "days until due" math.
export const serviceSubscriptionsTable = pgTable("service_subscriptions", {
  id: serial("id").primaryKey(),
  // Human-readable label e.g. "Fly.io API server", "Neon Singapore DB",
  // "qorixmarkets.com domain", "Replit Pro subscription".
  name: varchar("name", { length: 120 }).notNull(),
  // Coarse provider bucket so the UI can color-code / group rows.
  // Free-form string; suggested values: fly, neon, replit, domain, email,
  // sms, telegram, other.
  provider: varchar("provider", { length: 40 }).notNull(),
  // Cost per billing cycle in USD. Numeric(10,2) is plenty for any
  // realistic SaaS bill.
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  // monthly | yearly | one-time. Used by /mark-paid to advance nextDueDate.
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"),
  // The day the next invoice is due. NULL means "no upcoming bill"
  // (paid in full, lifetime license, etc.).
  nextDueDate: date("next_due_date"),
  // The day the most recent invoice was paid. Updated when admin clicks
  // "Mark paid" — also rolls nextDueDate forward by billingCycle.
  lastPaidDate: date("last_paid_date"),
  // Free-form notes — account email, login URL, who pays, anything the
  // admin needs to remember.
  notes: text("notes"),
  // Hide a row without deleting it (e.g. cancelled service we may revive).
  isActive: boolean("is_active").notNull().default(true),
  // Manual sort override. Lower = higher in the list.
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceSubscriptionSchema = createInsertSchema(serviceSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceSubscription = z.infer<typeof insertServiceSubscriptionSchema>;
export type ServiceSubscription = typeof serviceSubscriptionsTable.$inferSelect;
