import { pgTable, serial, integer, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginAttemptsTable = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    deviceFingerprint: varchar("device_fingerprint", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    browserLabel: varchar("browser_label", { length: 80 }),
    osLabel: varchar("os_label", { length: 80 }),
    pollToken: varchar("poll_token", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    issuedToken: text("issued_token"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    decidedAt: timestamp("decided_at"),
  },
  (t) => ({
    userPendingIdx: index("login_attempts_user_pending_idx").on(t.userId, t.status),
    pollTokenIdx: index("login_attempts_poll_token_idx").on(t.pollToken),
  }),
);

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
