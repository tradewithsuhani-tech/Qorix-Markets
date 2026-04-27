import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// One row per admin user. `modules` is an array of module slugs the
// sub-admin is allowed to access (e.g. ["users","withdrawals","kyc"]).
// Super admins (users.admin_role = 'super') bypass this table entirely
// and have access to every module + sub-admin management.
export const adminPermissionsTable = pgTable("admin_permissions", {
  adminId: integer("admin_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  modules: text("modules")
    .array()
    .notNull()
    .default([] as unknown as string[]),
  updatedBy: integer("updated_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminPermissionsRow = typeof adminPermissionsTable.$inferSelect;
export type NewAdminPermissions = typeof adminPermissionsTable.$inferInsert;
