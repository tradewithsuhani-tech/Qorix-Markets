import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatSessionStatusEnum = pgEnum("chat_session_status", ["active", "expert_requested", "resolved"]);

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: chatSessionStatusEnum("status").default("active").notNull(),
  expertRequested: boolean("expert_requested").default(false).notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // "user" | "bot" | "admin"
  senderId: integer("sender_id"), // null for bot, userId for user/admin
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
