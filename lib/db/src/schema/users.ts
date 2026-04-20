import { pgTable, serial, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  adminRole: varchar("admin_role", { length: 30 }).notNull().default("user"),
  kycStatus: varchar("kyc_status", { length: 30 }).notNull().default("not_submitted"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  isFrozen: boolean("is_frozen").notNull().default(false),
  forceLogoutAfter: timestamp("force_logout_after"),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  sponsorId: serial("sponsor_id"),
  tronAddress: varchar("tron_address", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
