import {
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Enterprise-grade audit trail of EVERY admin action — both reads
// (page visits / GET requests) and writes (mutations). Visible only
// to super admins via /admin/audit-log. Denormalised admin email +
// role so entries survive even if the admin row is deleted later.
export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    adminId: integer("admin_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    adminEmail: varchar("admin_email", { length: 255 }),
    adminRole: varchar("admin_role", { length: 20 }),
    module: varchar("module", { length: 50 }),
    action: varchar("action", { length: 50 }).notNull(),
    method: varchar("method", { length: 10 }),
    path: text("path"),
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 100 }),
    summary: text("summary"),
    metadata: text("metadata"), // JSON blob (before/after diff, etc.)
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    statusCode: integer("status_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index("admin_audit_log_created_at_idx").on(t.createdAt),
    adminIdx: index("admin_audit_log_admin_id_idx").on(t.adminId),
    moduleIdx: index("admin_audit_log_module_idx").on(t.module),
  }),
);

export type AdminAuditLogRow = typeof adminAuditLogTable.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogTable.$inferInsert;
