import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Task definitions (seeded at startup by task-service)
// ---------------------------------------------------------------------------
export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  category: varchar("category", { length: 20 }).notNull().default("daily"),
  // daily | weekly | social | referral | one_time
  pointReward: integer("point_reward").notNull().default(0),
  requiresProof: boolean("requires_proof").notNull().default(false),
  requiresKyc: boolean("requires_kyc").notNull().default(false),
  requiresDeposit: boolean("requires_deposit").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  iconName: varchar("icon_name", { length: 40 }).notNull().default("Star"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// User task completions
// ---------------------------------------------------------------------------
export const userTaskCompletionsTable = pgTable(
  "user_task_completions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    taskId: integer("task_id").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    // completed | pending_review | rejected
    pointsAwarded: integer("points_awarded").notNull().default(0),
    // Period bucket for idempotency: "ALL" for one-time, "YYYY-MM-DD" for daily,
    // "YYYY-Www" for weekly. Enforces uniqueness so concurrent claims can't double-award.
    periodKey: varchar("period_key", { length: 16 }).notNull().default("ALL"),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [
    index("utc_user_id_idx").on(t.userId),
    index("utc_task_id_idx").on(t.taskId),
    index("utc_user_task_idx").on(t.userId, t.taskId),
    uniqueIndex("utc_user_task_period_uniq").on(t.userId, t.taskId, t.periodKey),
  ],
);

// ---------------------------------------------------------------------------
// Social task proof uploads (screenshot / link)
// ---------------------------------------------------------------------------
export const taskProofsTable = pgTable(
  "task_proofs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    taskId: integer("task_id").notNull(),
    proofType: varchar("proof_type", { length: 20 }).notNull().default("text"),
    // text | url | image_base64
    proofContent: text("proof_content").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // pending | approved | rejected
    adminNote: text("admin_note"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("task_proofs_user_id_idx").on(t.userId),
    index("task_proofs_task_id_idx").on(t.taskId),
    index("task_proofs_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Points ledger
// ---------------------------------------------------------------------------
export const pointsTransactionsTable = pgTable(
  "points_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    amount: integer("amount").notNull(),
    // positive = earned, negative = spent
    type: varchar("type", { length: 30 }).notNull(),
    // task_reward | withdrawal_discount | vip_upgrade | admin_grant | admin_deduct
    description: text("description").notNull().default(""),
    referenceId: integer("reference_id"),
    // task completion id or other reference
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("points_txn_user_id_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// IP signup tracking (for rate limiting new accounts per IP per day)
// ---------------------------------------------------------------------------
export const ipSignupsTable = pgTable(
  "ip_signups",
  {
    id: serial("id").primaryKey(),
    ipAddress: varchar("ip_address", { length: 64 }).notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ip_signups_ip_idx").on(t.ipAddress)],
);

export type Task = typeof tasksTable.$inferSelect;
export type UserTaskCompletion = typeof userTaskCompletionsTable.$inferSelect;
export type TaskProof = typeof taskProofsTable.$inferSelect;
export type PointsTransaction = typeof pointsTransactionsTable.$inferSelect;
