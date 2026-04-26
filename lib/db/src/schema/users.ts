import { pgTable, serial, integer, text, boolean, timestamp, varchar, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  adminRole: varchar("admin_role", { length: 30 }).notNull().default("user"),
  // Lv.2 — Identity verification
  kycStatus: varchar("kyc_status", { length: 30 }).notNull().default("not_submitted"),
  kycDocumentUrl: text("kyc_document_url"),
  kycDocumentUrlBack: text("kyc_document_url_back"),
  kycDocumentType: varchar("kyc_document_type", { length: 30 }),
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycReviewedAt: timestamp("kyc_reviewed_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  // Lv.1 — Personal details
  kycPersonalStatus: varchar("kyc_personal_status", { length: 30 }).notNull().default("not_submitted"),
  phoneNumber: varchar("phone_number", { length: 32 }),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  kycPersonalSubmittedAt: timestamp("kyc_personal_submitted_at"),
  // Lv.3 — Address verification
  kycAddressStatus: varchar("kyc_address_status", { length: 30 }).notNull().default("not_submitted"),
  addressLine1: text("address_line1"),
  addressCity: varchar("address_city", { length: 100 }),
  addressState: varchar("address_state", { length: 100 }),
  addressCountry: varchar("address_country", { length: 100 }),
  addressPostalCode: varchar("address_postal_code", { length: 20 }),
  kycAddressDocUrl: text("kyc_address_doc_url"),
  kycAddressSubmittedAt: timestamp("kyc_address_submitted_at"),
  kycAddressReviewedAt: timestamp("kyc_address_reviewed_at"),
  kycAddressRejectionReason: text("kyc_address_rejection_reason"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  isFrozen: boolean("is_frozen").notNull().default(false),
  forceLogoutAfter: timestamp("force_logout_after"),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  sponsorId: serial("sponsor_id"),
  tronAddress: varchar("tron_address", { length: 64 }),
  emailVerified: boolean("email_verified").notNull().default(false),
  points: integer("points").notNull().default(0),
  // ── Deploy smoke-test account flag ────────────────────────────────────────
  // True for the dedicated account used by the post-deploy smoke check
  // (SMOKE_TEST_EMAIL in .github/workflows/deploy.yml). The flag is honored
  // server-side so the account is excluded from leaderboards / referral
  // payouts / public counters, blocked from real-money flows (deposits,
  // withdrawals, transfers, starting trading), and skipped by the fraud
  // detector — see docs/smoke-test-account.md.
  isSmokeTest: boolean("is_smoke_test").notNull().default(false),
  // ── Telegram Bot link (opt-in personal alerts) ─────────────────────────────
  // chat_id is a Telegram-issued integer (can exceed 2^31 for some chats), so
  // we store it as bigint. NULL means user has not linked Telegram. Once
  // linked, the unique index below prevents two Qorix users from claiming the
  // same Telegram account. `link_code` + `expires_at` back the one-time deep
  // link the user taps to bind their account; both clear on success.
  telegramChatId: bigint("telegram_chat_id", { mode: "number" }),
  telegramUsername: varchar("telegram_username", { length: 64 }),
  telegramLinkCode: varchar("telegram_link_code", { length: 16 }),
  telegramLinkCodeExpiresAt: timestamp("telegram_link_code_expires_at"),
  telegramLinkedAt: timestamp("telegram_linked_at"),
  // When linked, defaults to true. User can mute alerts without unlinking.
  telegramOptIn: boolean("telegram_opt_in").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_telegram_chat_id_uidx").on(t.telegramChatId),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
