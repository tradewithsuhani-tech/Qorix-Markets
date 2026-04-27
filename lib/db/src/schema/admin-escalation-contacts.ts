import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Stores the admin numbers the escalation cron will dial in priority order
// when an INR deposit/withdrawal is still unactioned at the 15-minute mark.
// The cron walks `priority` ascending and calls each active contact in turn,
// stopping at the first one that picks up. Multiple admins → automatic
// fallback chain (1 → 2 → 3 → …) without any code changes.
export const adminEscalationContactsTable = pgTable("admin_escalation_contacts", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 80 }),
  phone: varchar("phone", { length: 30 }).notNull(),
  email: varchar("email", { length: 200 }),
  priority: integer("priority").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminEscalationContactSchema = createInsertSchema(adminEscalationContactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminEscalationContact = z.infer<typeof insertAdminEscalationContactSchema>;
export type AdminEscalationContact = typeof adminEscalationContactsTable.$inferSelect;
