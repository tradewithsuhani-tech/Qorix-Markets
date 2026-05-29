import { index, integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "resolved",
]);

export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    ticketId: varchar("ticket_id", { length: 20 }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 80 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    message: text("message").notNull(),
    status: supportTicketStatusEnum("status").default("open").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("support_tickets_user_created_idx").on(t.userId, t.createdAt)],
);

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
