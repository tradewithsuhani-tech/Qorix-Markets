import { pgTable, serial, integer, varchar, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const loginEventsTable = pgTable(
  "login_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    deviceFingerprint: varchar("device_fingerprint", { length: 64 }),
    eventType: varchar("event_type", { length: 20 }).notNull().default("login"), // login | register
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("login_events_user_id_idx").on(t.userId),
    index("login_events_ip_idx").on(t.ipAddress),
    index("login_events_fingerprint_idx").on(t.deviceFingerprint),
  ],
);

export const fraudFlagsTable = pgTable(
  "fraud_flags",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    flagType: varchar("flag_type", { length: 50 }).notNull(),
    // multi_account | referral_abuse | rapid_cycling | device_cluster | self_referral
    severity: varchar("severity", { length: 10 }).notNull().default("medium"),
    // low | medium | high
    details: text("details").notNull().default("{}"),
    isResolved: boolean("is_resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at"),
    resolvedNote: text("resolved_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("fraud_flags_user_id_idx").on(t.userId),
    index("fraud_flags_type_idx").on(t.flagType),
    index("fraud_flags_resolved_idx").on(t.isResolved),
    // Prevent duplicate active flags of the same type for the same user
    uniqueIndex("fraud_flags_user_type_unresolved_uniq")
      .on(t.userId, t.flagType)
      .where(sql`is_resolved = false`),
  ],
);

export type LoginEvent = typeof loginEventsTable.$inferSelect;
export type FraudFlag = typeof fraudFlagsTable.$inferSelect;
