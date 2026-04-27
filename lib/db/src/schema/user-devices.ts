import {
  pgTable,
  bigserial,
  integer,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/**
 * Tracks every device a user has EVER successfully logged in from. Combined
 * with the existing `login_attempts` table (which records each attempt) this
 * lets us answer "have I seen this device for this user before?" in O(1) and
 * fire a "Login from a new device detected" email exactly once per device.
 *
 * The unique key is (user_id, device_fingerprint) — the fingerprint is a
 * stable hash of the user-agent + a few headers (see
 * `middlewares/auth.ts → computeDeviceFingerprint`).
 */
export const userDevicesTable = pgTable(
  "user_devices",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    deviceFingerprint: varchar("device_fingerprint", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    browserLabel: varchar("browser_label", { length: 80 }),
    osLabel: varchar("os_label", { length: 80 }),
    firstSeenIp: varchar("first_seen_ip", { length: 64 }),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenIp: varchar("last_seen_ip", { length: 64 }),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    lastCity: varchar("last_city", { length: 120 }),
    lastCountry: varchar("last_country", { length: 80 }),
    alertSentAt: timestamp("alert_sent_at"),
  },
  (t) => ({
    userFpUniq: uniqueIndex("user_devices_user_fp_uniq").on(
      t.userId,
      t.deviceFingerprint,
    ),
    userSeenIdx: index("user_devices_user_seen_idx").on(
      t.userId,
      t.lastSeenAt,
    ),
  }),
);

export type UserDevice = typeof userDevicesTable.$inferSelect;
export type NewUserDevice = typeof userDevicesTable.$inferInsert;
