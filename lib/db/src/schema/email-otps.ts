import { pgTable, serial, integer, varchar, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const emailOtpsTable = pgTable(
  "email_otps",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    otp: varchar("otp", { length: 8 }).notNull(),
    purpose: varchar("purpose", { length: 30 }).notNull().default("verify_email"),
    // verify_email | withdrawal_confirm
    isUsed: boolean("is_used").notNull().default(false),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("email_otps_user_id_idx").on(t.userId),
    index("email_otps_email_idx").on(t.email),
  ],
);

export type EmailOtp = typeof emailOtpsTable.$inferSelect;
