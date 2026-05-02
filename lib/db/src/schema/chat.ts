import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, jsonb, varchar, index, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatSessionStatusEnum = pgEnum("chat_session_status", ["active", "expert_requested", "resolved"]);

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  // Nullable since Task 145 — guest (anonymous) visitors get a session keyed
  // by `visitorId` instead of a real userId. The DB-level CHECK constraint
  // `chat_sessions_user_or_visitor_chk` enforces that exactly one of the two
  // is populated for every row.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  // Opaque client-generated UUID stored in the visitor's localStorage. Used
  // to resume the same conversation across page reloads / new tabs before
  // the visitor signs up. When the visitor later authenticates, the client
  // calls /chat/guest-session/claim to migrate the session to their userId
  // (visitor_id stays for analytics / dedupe).
  visitorId: varchar("visitor_id", { length: 64 }),
  status: chatSessionStatusEnum("status").default("active").notNull(),
  expertRequested: boolean("expert_requested").default(false).notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // ── LLM assistant additions (Task 101) ───────────────────────────────────
  detectedIntent: varchar("detected_intent", { length: 32 }),
  language: varchar("language", { length: 16 }),
  preferredLanguage: varchar("preferred_language", { length: 16 }),
  engagementScore: integer("engagement_score").notNull().default(0),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  ctaShownCount: integer("cta_shown_count").notNull().default(0),
  ctaClickedCount: integer("cta_clicked_count").notNull().default(0),
  convertedAt: timestamp("converted_at"),
  llmReplyCount: integer("llm_reply_count").notNull().default(0),
  llmTokensUsed: integer("llm_tokens_used").notNull().default(0),
  llmBudgetDate: timestamp("llm_budget_date", { mode: "date" }),
}, (t) => [
  index("chat_sessions_visitor_idx").on(t.visitorId),
  index("chat_sessions_user_active_idx").on(t.userId, t.lastMessageAt),
]);

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // "user" | "bot" | "admin"
  senderId: integer("sender_id"),             // null for bot/guest, userId for authed user/admin
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Conversion-event log (Task 101, Step 1) ────────────────────────────────
export const chatConversionEventsTable = pgTable("chat_conversion_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_conv_events_session_idx").on(t.sessionId),
  index("chat_conv_events_type_idx").on(t.eventType),
]);

// ── Singleton settings row (Task 145) ──────────────────────────────────────
// One row enforced by `id = 1` CHECK constraint. The admin panel reads/writes
// this; the chat-llm module reads it on demand (small in-process cache w/
// short TTL so updates propagate within ~60s without a deploy).
//
// `systemPrompt` is the editable override. When NULL the chat-llm module
// falls back to the hard-coded DEFAULT_SYSTEM_PROMPT shipped in code.
//
// `quickReplies` is a JSON array of `{ id, label, value, lang? }` tags —
// the widget's quick-reply chips. `value` matches the existing FLOWS click
// handler so admins can route to canned answers without code changes.
//
// `depositCta` is a JSON object `{ small_deposit: { label, ackText }, ... }`
// overriding the localized CTA card copy. Empty object = use built-in copy.
//
// `emailFollowup` is `{ enabled, delayMinutes, subject, body, fromName }`
// — controls the chat-leads follow-up worker.
export const chatSettingsTable = pgTable("chat_settings", {
  id: integer("id").primaryKey().default(1),
  systemPrompt: text("system_prompt"),
  quickReplies: jsonb("quick_replies").$type<Array<{ id: string; label: string; value: string; lang?: string }>>().notNull().default([]),
  depositCta: jsonb("deposit_cta").$type<Record<string, { label?: string; ackText?: string; href?: string }>>().notNull().default({}),
  emailFollowup: jsonb("email_followup").$type<{
    enabled?: boolean;
    delayMinutes?: number;
    subject?: string;
    body?: string;
    fromName?: string;
  }>().notNull().default({}),
  model: varchar("model", { length: 64 }).notNull().default("gpt-4o-mini"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).notNull().default("0.7"),
  maxTokens: integer("max_tokens").notNull().default(600),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
});

// ── Guest lead capture (Task 145) ──────────────────────────────────────────
// Anonymous visitors who hand over an email/name in the chat widget. The
// follow-up worker scans this table for unsent leads older than the
// configured delay and sends a single SES email per lead. `convertedAt` is
// stamped when the visitor (now a real user via the same visitor_id link)
// hits a chat→deposit conversion event.
export const chatLeadsTable = pgTable("chat_leads", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  visitorId: varchar("visitor_id", { length: 64 }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  consent: boolean("consent").notNull().default(false),
  followUpSentAt: timestamp("follow_up_sent_at"),
  followUpAttempts: integer("follow_up_attempts").notNull().default(0),
  unsubscribedAt: timestamp("unsubscribed_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_leads_session_idx").on(t.sessionId),
]);
