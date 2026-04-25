import { pgTable, serial, integer, varchar, numeric, timestamp, boolean, text, index } from "drizzle-orm/pg-core";

/**
 * Admin-scheduled holiday / event promos with a fixed bonus % and a
 * concrete date window. When the current wall-clock falls inside an
 * active scheduled promo, that promo OVERRIDES the rotating-window offer
 * (highest bonus % wins if multiple are simultaneously active).
 *
 * Lifetime per-user uniqueness is still enforced by promoRedemptionsTable
 * (one redemption per userId, period — across both rotating and scheduled).
 *
 * Fields:
 * - code:            human-friendly redeem code (e.g. "DIWALI25"). Unique.
 * - bonusPercent:    fixed bonus % (e.g. 25.00).
 * - startsAt/endsAt: redemption window (inclusive start, exclusive end).
 * - maxRedemptions:  optional cap; null = unlimited.
 * - redemptionCount: atomic counter, incremented on each successful redeem.
 * - isActive:        admin kill-switch independent of dates.
 */
export const scheduledPromosTable = pgTable(
  "scheduled_promos",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    description: text("description"),
    bonusPercent: numeric("bonus_percent", { precision: 5, scale: 2 }).notNull(),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    // Active-promo lookup is on the hot path of /promo/offer (and runs on
    // every redeem). Composite index covers the common predicate shape:
    // is_active = true AND starts_at <= now AND ends_at > now.
    activeWindowIdx: index("scheduled_promos_active_window_idx").on(t.isActive, t.startsAt, t.endsAt),
  }),
);

export type ScheduledPromo = typeof scheduledPromosTable.$inferSelect;
export type NewScheduledPromo = typeof scheduledPromosTable.$inferInsert;
