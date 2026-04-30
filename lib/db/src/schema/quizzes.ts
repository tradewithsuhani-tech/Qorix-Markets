import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  varchar,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── Enums ────────────────────────────────────────────────────────────────
// Status lifecycle:
//   scheduled → live → ended
//                   ↘ cancelled (admin can cancel before live)
export const quizStatusEnum = pgEnum("quiz_status", [
  "scheduled",
  "live",
  "ended",
  "cancelled",
]);

export const quizQuestionSourceEnum = pgEnum("quiz_question_source", [
  "manual",
  "ai",
]);

export const quizWinnerPaidStatusEnum = pgEnum("quiz_winner_paid_status", [
  "pending",
  "paid",
]);

// ─── Quizzes ──────────────────────────────────────────────────────────────
// One row per giveaway event. `status` is server-authoritative — only the
// quiz-runner / scheduler ever transitions a row to `live` or `ended`. The
// admin can transition `scheduled → cancelled` and `scheduled → live`
// (force-start); everything else flows through the runner.
//
// Time/scoring config is per-quiz so admins can tune rounds individually
// (e.g. an "easy" 15s window for a holiday giveaway vs a tight 10s for a
// power-user event). Prize split is stored as a JSON array of three
// fractions that sum to 1.0 (validated in the route handler).
export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  status: quizStatusEnum("status").notNull().default("scheduled"),
  scheduledStartAt: timestamp("scheduled_start_at").notNull(),
  // Stamped when the runner actually flips to `live`. Used as the canonical
  // start-of-quiz reference so a force-start vs scheduled-start are both
  // measured the same way.
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  // Prize pool in the chosen currency (e.g. "100.00" USDT).
  prizePool: numeric("prize_pool", { precision: 18, scale: 2 }).notNull().default("0"),
  prizeCurrency: varchar("prize_currency", { length: 10 }).notNull().default("USDT"),
  // Stored as [0.5, 0.3, 0.2] etc. Always length-3 in v1.
  prizeSplit: jsonb("prize_split").$type<number[]>().notNull().default([0.5, 0.3, 0.2]),
  // Per-question timer window in milliseconds. Bounded 10s–15s in handler.
  questionTimeMs: integer("question_time_ms").notNull().default(12_000),
  // For v1 the only entry rule is "must be KYC verified". Stored as JSON so
  // we can bolt on extra rules later (min deposit, country gate, etc) without
  // a migration.
  entryRules: jsonb("entry_rules").$type<{ requireKyc: boolean }>().notNull().default({
    requireKyc: true,
  }),
  // Per-quiz toggle for the "starting in 5 min" + "live now" notifications.
  // Default-on so admins don't have to remember to flip it for every quiz.
  // Flipping this OFF on a quiz that was created with it on still suppresses
  // pings as long as it's done at least one scheduler tick (5s) before the
  // 5-min mark.
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  // Single-shot dedupe stamps for the two pre-quiz pings. We use a
  // conditional UPDATE…WHERE … IS NULL …RETURNING in the dispatcher so the
  // CAS is atomic across Fly machines without needing an extra Redis lock.
  notifiedFiveMinAt: timestamp("notified_five_min_at"),
  notifiedLiveAt: timestamp("notified_live_at"),
  // For server-side cache invalidation + audit. Always `usersTable.id` of an admin.
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ─── B33 extension columns (additive only, all defaulted/nullable) ──────
  // Entry fee charged on join (in `prizeCurrency`). 0 means free practice.
  entryFee: numeric("entry_fee", { precision: 18, scale: 2 }).notNull().default("0"),
  // Cap on participant count (NULL = unlimited).
  maxPlayers: integer("max_players"),
  // Platform's cut of the gross pool when source = 'entry_fees'. Default 10%.
  platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
  // GST levied on entry fees (paid by user, line-item shown). Default 28%.
  gstPct: numeric("gst_pct", { precision: 5, scale: 2 }).notNull().default("28.00"),
  // If true, B37 auto-payout pipeline credits winners on quiz end.
  autoPayout: boolean("auto_payout").notNull().default(true),
  // 'admin' = admin-funded prize_pool (legacy). 'entry_fees' = pool computed
  // from sum(entry_fee) at quiz end with 90/10 split. Default 'admin' so
  // existing admin-created quizzes keep their behaviour.
  prizePoolSource: varchar("prize_pool_source", { length: 20 }).notNull().default("admin"),
  // Optional category badge (FK to quizCategoriesTable below).
  categoryId: integer("category_id").references(() => quizCategoriesTable.id, { onDelete: "set null" }),
}, (t) => [
  // Scheduler scans for `scheduled` rows whose start time has passed.
  index("quizzes_status_start_idx").on(t.status, t.scheduledStartAt),
  index("quizzes_category_idx").on(t.categoryId),
  index("quizzes_pool_source_idx").on(t.prizePoolSource),
]);

// ─── Quiz categories (B33 NEW — lookup) ───────────────────────────────────
// Used for category badges on quiz cards in the qorixplay Game Hub. Slugs
// (`crypto`, `markets`, `forex`, `finance`, `trivia`, `practice`) are the
// stable keys; `name` + `icon` + `color` drive UI rendering. Seeded via
// `B33_qorixplay_schema.sql`.
export const quizCategoriesTable = pgTable("quiz_categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull().default(""),
  icon: varchar("icon", { length: 50 }).notNull().default(""),
  color: varchar("color", { length: 20 }).notNull().default("#7C3AED"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Quiz questions ───────────────────────────────────────────────────────
// 5 per quiz, ordered by `position` (0..4). `correctIndex` is 0..3 into the
// `options` array. `source` distinguishes manually-typed vs AI-drafted —
// useful for analytics and for rendering the "Generated" badge in admin UI.
export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 0..4
  prompt: text("prompt").notNull(),
  // 4-element string array. Validated in handler / on save.
  options: jsonb("options").$type<string[]>().notNull(),
  correctIndex: integer("correct_index").notNull(), // 0..3
  explanation: text("explanation").notNull().default(""),
  source: quizQuestionSourceEnum("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("quiz_questions_quiz_position_uq").on(t.quizId, t.position),
  index("quiz_questions_quiz_idx").on(t.quizId),
]);

// ─── Participants ─────────────────────────────────────────────────────────
// One row per user-per-quiz, created on POST /api/quizzes/:id/join. The
// unique index doubles as the "joined" check at answer-submit time and as
// the "Total participants" counter on the live monitor.
export const quizParticipantsTable = pgTable("quiz_participants", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("quiz_participants_quiz_user_uq").on(t.quizId, t.userId),
  index("quiz_participants_quiz_idx").on(t.quizId),
]);

// ─── Answers ──────────────────────────────────────────────────────────────
// One row per (user, question). The unique index is the FINAL line of
// defence against duplicate submissions — the in-route Redis SETNX shortcut
// avoids most of them but the DB is what guarantees correctness even under
// pathological races.
//
// `responseTimeMs` is computed server-side from `question_started_at` (in
// the runner state) — clients don't get to claim their own response time.
export const quizAnswersTable = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => quizQuestionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  selectedOption: integer("selected_option").notNull(), // 0..3
  isCorrect: boolean("is_correct").notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  scoreAwarded: integer("score_awarded").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("quiz_answers_user_question_uq").on(t.userId, t.questionId),
  index("quiz_answers_quiz_user_idx").on(t.quizId, t.userId),
]);

// ─── Winners ──────────────────────────────────────────────────────────────
// Persisted at quiz end from the Redis sorted-set leaderboard. Three rows
// per ended quiz (rank 1..3). `paidByAdminId` is null and `paidTxnId` is
// set when payout came from the auto-credit pipeline; both are reversed
// for manual mark-paid.
export const quizWinnersTable = pgTable("quiz_winners", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(), // 1..3
  finalScore: integer("final_score").notNull(),
  prizeAmount: numeric("prize_amount", { precision: 18, scale: 2 }).notNull(),
  prizeCurrency: varchar("prize_currency", { length: 10 }).notNull().default("USDT"),
  paidStatus: quizWinnerPaidStatusEnum("paid_status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  paidByAdminId: integer("paid_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  paidNote: text("paid_note"),
  paidTxnId: integer("paid_txn_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("quiz_winners_quiz_rank_uq").on(t.quizId, t.rank),
  index("quiz_winners_quiz_idx").on(t.quizId),
]);

// ─── Quiz devices (B33 NEW — anti-cheat v1.5 review queue) ────────────────
// Per-session device fingerprint + visibility log. Written by the quiz
// route on participant join + every visibility change. Used by the v1.5
// admin review queue (no auto-disqualify in v1).
export const quizDevicesTable = pgTable("quiz_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Nullable — can also be used as a generic device log outside a quiz.
  quizId: integer("quiz_id").references(() => quizzesTable.id, { onDelete: "cascade" }),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }).notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  ipAddress: varchar("ip_address", { length: 45 }).notNull().default(""),
  tabVisibilityChanges: integer("tab_visibility_changes").notNull().default(0),
  suspiciousFlags: jsonb("suspicious_flags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("quiz_devices_user_quiz_idx").on(t.userId, t.quizId),
  index("quiz_devices_quiz_idx").on(t.quizId),
]);

// ─── Quiz events log (B33 NEW — audit trail) ──────────────────────────────
// Append-only log of every lifecycle event per quiz: started, paused,
// resumed, cancelled, admin_disqualify, payout_started, payout_completed,
// refund_issued. `actorUserId` is null for system events (the runner/
// scheduler), set for admin actions.
export const quizEventsLogTable = pgTable("quiz_events_log", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("quiz_events_log_quiz_time_idx").on(t.quizId, t.createdAt),
  index("quiz_events_log_type_idx").on(t.eventType),
]);

// ─── Quiz user stats (B33 NEW — leaderboard aggregates) ───────────────────
// One row per user, upserted on every quiz end. Powers the daily/weekly/
// all-time leaderboards on qorixplay (B44). `userId` is the PK so upserts
// are simple `INSERT … ON CONFLICT (user_id) DO UPDATE`.
export const quizUserStatsTable = pgTable("quiz_user_stats", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  quizzesPlayed: integer("quizzes_played").notNull().default(0),
  quizzesWon: integer("quizzes_won").notNull().default(0),
  top3Finishes: integer("top_3_finishes").notNull().default(0),
  top10Finishes: integer("top_10_finishes").notNull().default(0),
  totalCorrectAnswers: integer("total_correct_answers").notNull().default(0),
  totalQuestionsAnswered: integer("total_questions_answered").notNull().default(0),
  avgResponseTimeMs: integer("avg_response_time_ms").notNull().default(0),
  totalWinningsInr: numeric("total_winnings_inr", { precision: 18, scale: 2 }).notNull().default("0"),
  totalWinningsUsdt: numeric("total_winnings_usdt", { precision: 18, scale: 2 }).notNull().default("0"),
  currentStreakDays: integer("current_streak_days").notNull().default(0),
  longestStreakDays: integer("longest_streak_days").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("quiz_user_stats_winnings_inr_idx").on(t.totalWinningsInr),
  index("quiz_user_stats_winnings_usdt_idx").on(t.totalWinningsUsdt),
]);

// ─── Quiz payouts (B33 NEW — actual payout ledger w/ TDS line) ────────────
// One row per (quiz, winning user). Distinct from `quiz_winners` (which
// just records the rank) — this is the financial ledger for the actual
// transfer, including TDS deduction and a link to the wallet `transactions`
// row. `(quiz_id, user_id)` UNIQUE so the B37 payout pipeline is idempotent.
export const quizPayoutsTable = pgTable("quiz_payouts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // Soft FK to `quiz_winners.id` — set when payout is from auto pipeline,
  // null if winner row was deleted post-payout.
  winnerId: integer("winner_id").references(() => quizWinnersTable.id, { onDelete: "set null" }),
  grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
  tdsAmount: numeric("tds_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  // FK to wallet ledger; nullable so we can insert the payout row before
  // the wallet credit completes (status = 'pending').
  transactionId: integer("transaction_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  uniqueIndex("quiz_payouts_quiz_user_uq").on(t.quizId, t.userId),
  index("quiz_payouts_status_idx").on(t.status),
]);

// ─── Quiz refunds (B33 NEW — refund-on-cancel ledger) ─────────────────────
// One row per (cancelled quiz, participant). Created when an admin cancels
// a paid quiz — the entry-fee refund pipeline iterates participants and
// inserts here, then credits the wallet `transactions` row.
export const quizRefundsTable = pgTable("quiz_refunds", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  reason: text("reason").notNull().default(""),
  transactionId: integer("transaction_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
}, (t) => [
  uniqueIndex("quiz_refunds_quiz_user_uq").on(t.quizId, t.userId),
  index("quiz_refunds_status_idx").on(t.status),
]);

// ─── OAuth authorization codes (B33 NEW — SSO from qorixmarkets) ──────────
// Short-lived (60s) single-use codes minted by qorixmarkets when a logged-in
// user clicks "Login with Qorix" on qorixplay. The qorix-quiz backend
// exchanges the code for a quiz-domain JWT via POST /api/oauth/quiz-token.
// `usedAt` flips on first exchange (single-use enforcement done in handler
// + UNIQUE on `code`).
export const oauthAuthorizationCodesTable = pgTable("oauth_authorization_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 64 }).notNull(),
  redirectUri: text("redirect_uri").notNull(),
  scope: varchar("scope", { length: 200 }).notNull().default(""),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("oauth_codes_user_exp_idx").on(t.userId, t.expiresAt),
  index("oauth_codes_client_idx").on(t.clientId),
]);

// ─── Quiz geo blocks (B33 NEW — paid quiz state allowlist) ────────────────
// State-level block list. Seeded with TN/AP/TG/OR/SK in B33 migration.
// Admin can toggle `blocksPaid`/`blocksPractice` per state via the
// `quiz_geo_blocks` admin tab (B43). Free practice quizzes can be allowed
// even where paid is blocked.
export const quizGeoBlocksTable = pgTable("quiz_geo_blocks", {
  id: serial("id").primaryKey(),
  stateCode: varchar("state_code", { length: 10 }).notNull().unique(),
  stateName: varchar("state_name", { length: 100 }).notNull(),
  blocksPaid: boolean("blocks_paid").notNull().default(true),
  blocksPractice: boolean("blocks_practice").notNull().default(false),
  reason: text("reason").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
