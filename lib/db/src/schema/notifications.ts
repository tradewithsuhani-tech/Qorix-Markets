import { pgTable, serial, integer, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: varchar("type", { length: 30 }).notNull().default("system"),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Hot read path: GET /api/notifications/mine ORDER BY created_at DESC LIMIT 20-50.
    // Previously zero indexes besides the PK → Seq Scan + sort on every feed load.
    // Composite (user_id, created_at DESC) handles both the WHERE filter and ORDER BY
    // pushdown, eliminating the sort step. Unread-filter queries (WHERE is_read=false)
    // still use this index efficiently because the planner can scan + filter the small
    // recent slice; an extra index just for is_read would be wasteful at current scale.
    userCreatedIdx: index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
