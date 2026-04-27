import { pgTable, serial, integer, text, boolean, timestamp, varchar, bigint, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  // Voice OTP verification (2Factor.in)
  phoneVerifiedAt: timestamp("phone_verified_at"),
  phoneOtpSessionId: varchar("phone_otp_session_id", { length: 64 }),
  phoneOtpExpiresAt: timestamp("phone_otp_expires_at"),
  phoneOtpSendCount: integer("phone_otp_send_count").notNull().default(0),
  phoneOtpLastSentAt: timestamp("phone_otp_last_sent_at"),
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
  // When the user last changed their password (via the in-app
  // "Update Password" flow). Used to enforce the 24h post-password-change
  // withdrawal cool-off so a stolen-password attacker who immediately
  // changes the password can't cash out before the real owner notices.
  // NULL means "never changed in-app" (pre-existing accounts) — those are
  // not locked.
  passwordChangedAt: timestamp("password_changed_at"),
  // ── Single-active-device login control ────────────────────────────────────
  // Fingerprint (sha256 of User-Agent, first 32 chars) of the device that
  // currently "owns" this account. A login attempt from a DIFFERENT
  // fingerprint is intercepted and held for explicit approval from the
  // active device (POST /auth/login-attempts/:id/respond) or, after a 60s
  // timeout, an email OTP fallback. NULL means "no active session yet" —
  // the next login just claims it (covers pre-existing accounts and fresh
  // signups, so nobody gets locked out by the rollout).
  activeSessionFingerprint: varchar("active_session_fingerprint", { length: 64 }),
  // Last time the active device hit an authenticated endpoint. Used purely
  // for showing "active 2 minutes ago" in the approval popup — the actual
  // single-device enforcement is the fingerprint compare, not this.
  activeSessionLastSeen: timestamp("active_session_last_seen"),
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
  // ── Two-Factor Authentication (TOTP) ──────────────────────────────────────
  // When `twoFactorEnabled = true`, the login flow requires the user to
  // submit a fresh 6-digit TOTP code (generated by Google Authenticator /
  // Authy / 1Password from `twoFactorSecret`) AFTER the password check
  // succeeds, BEFORE any session token is issued. The secret is the
  // base32-encoded shared key that the authenticator app derives codes
  // from; we store it in plaintext (industry-standard for v1 — a DB
  // compromise leaks both password hashes and TOTP secrets, so encrypting
  // here would only buy security against a very specific threat model).
  // `twoFactorBackupCodes` is an array of sha256 hashes of single-use
  // recovery codes shown ONCE at enrolment so a user who loses their
  // device can still get in. Used codes are removed from the array.
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorBackupCodes: jsonb("two_factor_backup_codes").$type<string[]>().notNull().default([]),
  twoFactorEnabledAt: timestamp("two_factor_enabled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_telegram_chat_id_uidx").on(t.telegramChatId),
  // Partial unique index: a phone number can be verified on at most one
  // account. NULL phone or unverified rows are excluded from the constraint
  // so users mid-flow don't collide. Enforces the KYC integrity guard
  // surfaced in /api/phone-otp/send + /verify (clean 409s in routes,
  // hard fence here).
  uniqueIndex("users_phone_verified_uidx").on(t.phoneNumber).where(sql`phone_verified_at IS NOT NULL`),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
