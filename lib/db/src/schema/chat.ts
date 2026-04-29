import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatSessionStatusEnum = pgEnum("chat_session_status", ["active", "expert_requested", "resolved"]);

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: chatSessionStatusEnum("status").default("active").notNull(),
  expertRequested: boolean("expert_requested").default(false).notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // ── LLM assistant additions (Task 101) ───────────────────────────────────
  // Detected user intent from the LLM. One of:
  //   beginner | advanced | skeptic | price_sensitive | ready_to_invest | support | other
  // Stored as plain varchar (not enum) so the LLM can emit new tags without
  // requiring a migration each time the playbook expands.
  detectedIntent: varchar("detected_intent", { length: 32 }),
  // Detected language ("en" / "hi" / "hinglish" / etc) — drives mirroring.
  language: varchar("language", { length: 16 }),
  // Cumulative engagement score — incremented per user turn, with bonus
  // weight for positive-signal keywords (see chat-llm.ts). Used to gate
  // CTA injection.
  engagementScore: integer("engagement_score").notNull().default(0),
  // Free-form profile snapshot built up over the conversation. Examples of
  // keys the LLM can populate: experience_level, budget_hint, mentioned_objections,
  // last_topics. Kept as JSON so the playbook can evolve without migrations.
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  // CTA tracking counters (Conversion+engagement logic, Step 6).
  ctaShownCount: integer("cta_shown_count").notNull().default(0),
  ctaClickedCount: integer("cta_clicked_count").notNull().default(0),
  // Stamped when the user lands a successful deposit attributed to this
  // session via ?src=chat&sid=<id>. NULL until conversion fires.
  convertedAt: timestamp("converted_at"),
  // Token + reply budget guards (Step 10). Token usage is tracked PER DAY,
  // not lifetime — `llmBudgetDate` records the UTC date the current
  // `llmTokensUsed` counter was opened on. Whenever a /chat/llm-reply call
  // observes a date roll-over, the counter is reset to 0 and the date is
  // bumped to today before applying budget checks. llmReplyCount is purely
  // informational (kept lifetime for analytics).
  llmReplyCount: integer("llm_reply_count").notNull().default(0),
  llmTokensUsed: integer("llm_tokens_used").notNull().default(0),
  llmBudgetDate: timestamp("llm_budget_date", { mode: "date" }),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // "user" | "bot" | "admin"
  senderId: integer("sender_id"), // null for bot, userId for user/admin
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Conversion-event log (Task 101, Step 1) ────────────────────────────────
// Per-event audit trail bridging chat → deposit. Events:
//   cta_shown           — CTA card rendered in the chat
//   cta_clicked         — user tapped the CTA card
//   deposit_page_visited — user landed on /deposit?src=chat&sid=N
//   deposit_completed   — user completed an actual deposit attributed to chat
// Stored separately from chat_sessions so we can build per-funnel analytics
// without polluting the session row, and so multiple events per session are
// trivially time-ordered.
export const chatConversionEventsTable = pgTable("chat_conversion_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  // Optional metadata (CTA variant id, deposit amount, txn id, etc).
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_conv_events_session_idx").on(t.sessionId),
  index("chat_conv_events_type_idx").on(t.eventType),
]);
