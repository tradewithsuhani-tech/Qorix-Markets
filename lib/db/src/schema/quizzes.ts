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
  // For server-side cache invalidation + audit. Always `usersTable.id` of an admin.
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  // Scheduler scans for `scheduled` rows whose start time has passed.
  index("quizzes_status_start_idx").on(t.status, t.scheduledStartAt),
]);

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
// per ended quiz (rank 1..3). Payout is admin-driven — no automatic wallet
// credit in v1.
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("quiz_winners_quiz_rank_uq").on(t.quizId, t.rank),
  index("quiz_winners_quiz_idx").on(t.quizId),
]);
