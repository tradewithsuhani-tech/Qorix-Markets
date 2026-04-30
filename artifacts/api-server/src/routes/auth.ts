import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, walletsTable, investmentsTable, systemSettingsTable, ipSignupsTable } from "@workspace/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { authMiddleware, signToken, computeDeviceFingerprint, describeDevice, invalidateAuthUserCache, type AuthRequest } from "../middlewares/auth";
import { loginAttemptsTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { trackLoginEvent, runFraudChecks } from "../lib/fraud-service";
import { sendOtp, verifyOtp, getDevOtp, sendEmail, sendWelcomeEmail } from "../lib/email-service";
import { trackLoginDevice } from "../lib/device-tracking";
import { buildBrandedEmailHtml } from "../lib/email-template";
import { verifyCaptcha } from "../lib/captcha-service";
import {
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  consumeAuthCodeForUser,
  TWO_FA_CHALLENGE_TTL_SECONDS,
} from "./two-factor";
import crypto from "crypto";
import { makeRedisLimiter } from "../middlewares/rate-limit";

const router = Router();

// B9.5 (Apr 2026) — tightened from 20 / 15min to 5 / 1min to bring the
// brute-force ceiling in line with fintech norms (Coinbase / Binance use
// a similar 5-attempts-then-cool-down shape). Honest users with a couple
// of password / 2FA typos still finish in ≤ 4 calls; brute forcers hit
// the wall inside the first ~6 seconds.
//
// Bucket is INTENTIONALLY shared across /auth/login,
// /auth/2fa/login-verify, and /auth/2fa/email-fallback/request because
// those three endpoints are the same authentication attempt — counting
// them separately would let an attacker get 5 password tries AND
// 5 2FA-verify tries AND 5 OTP-email-resend tries from the same IP per
// minute, which defeats the cap. The header on rate-limit.ts warns
// against sharing buckets across DIFFERENT concerns (login vs forgot
// vs 2FA-mgmt setup) — those still use their own dedicated limiters
// further down this file.
const loginRateLimit = makeRedisLimiter({
  name: "login",
  windowMs: 60 * 1000,
  limit: 5,
});

// Max 5 new accounts per IP per day
const SIGNUP_IP_DAILY_LIMIT = 5;
// Max 10 referrals per sponsor per day (anti farming)
const SIGNUP_REFERRAL_DAILY_LIMIT = 10;

function generateReferralCode(): string {
  return "QX" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0];
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? req.connection?.remoteAddress ?? "unknown";
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, "").trim();
}

// Hours that withdrawals stay frozen after a successful in-app password
// change. Surfaced via /auth/security-status and enforced server-side in
// POST /wallet/withdraw.
export const WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE = 24;

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    adminRole: user.adminRole,
    kycStatus: user.kycStatus,
    isDisabled: user.isDisabled,
    isFrozen: user.isFrozen,
    referralCode: user.referralCode,
    emailVerified: user.emailVerified,
    points: user.points,
    createdAt: user.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
router.post("/auth/register", async (req, res) => {
  // --- Honeypot check (bots fill hidden fields, humans don't) ---
  if (req.body._hp && req.body._hp !== "") {
    // Silently reject — don't reveal this check to bots
    res.status(201).json({ token: "ok", user: {} });
    return;
  }

  const registrationSetting = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "registration_enabled"))
    .limit(1);
  if (registrationSetting[0]?.value === "false") {
    res.status(403).json({ error: "Registration is currently disabled" });
    return;
  }

  const result = RegisterBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const { email: rawEmail, password, fullName, referralCode: sponsorCode } = result.data;
  // ─── Email normalization (B24) ─────────────────────────────────────────
  // Lowercase + trim so "Foo@x.com", "foo@x.com" and " foo@x.com " all
  // resolve to the same canonical address. Without this, the unique
  // index on `email` (case-sensitive btree) lets the same human sign up
  // multiple times by varying capitalization (e.g., the prod
  // Vimlesh1group@gmail.com vs vimlesh1group@gmail.com pair). We use
  // the normalized form for BOTH the duplicate check and the INSERT
  // so all new rows are stored canonical.
  const email = rawEmail.toLowerCase().trim();

  // ─── Disposable / temporary email block (B27) ──────────────────────────
  // Block signups from known throwaway / public-inbox services
  // (mailinator, 10minutemail, guerrillamail, yopmail, tempmail, etc).
  // These bypass our B23 email-verify gate because either anyone can
  // read the OTP from the public inbox (mailinator) or the inbox
  // self-destructs in 10-60 minutes (guerrillamail), enabling cheap
  // sybil / spam signups that survive captcha + IP rate limits because
  // each new identity is a fresh "real-looking" email. Defense-in-depth
  // on top of captcha + per-IP rate limit + behaviour timing.
  // List: artifacts/api-server/src/lib/disposable-email-domains.ts
  const { isDisposableEmail } = await import("../lib/disposable-email-domains");
  if (isDisposableEmail(email)) {
    res.status(400).json({
      error: "Disposable or temporary email addresses are not allowed. Please use a permanent email like Gmail, Outlook, Yahoo, or your work email.",
      code: "DISPOSABLE_EMAIL",
    });
    return;
  }

  // --- IP rate limit check ---
  const rawIp = getClientIp(req);
  const ip = normalizeIp(rawIp);

  // --- Captcha check ---
  // Re-enabled in Batch 6.1 (2026-04-30) now that login.tsx (which is
  // the shared form for /login, /register, /signup) renders the widget
  // for every mode and resets it on failed submit. Server enforcement
  // here matches /auth/login. Local/dev builds with no
  // RECAPTCHA_SECRET_KEY auto-skip via captcha-service.ts.
  const captchaResult = await verifyCaptcha(req.body.captchaToken, ip);
  if (!captchaResult.ok) {
    res.status(400).json({ error: captchaResult.error ?? "Captcha required" });
    return;
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [ipCount] = await db
    .select({ cnt: count() })
    .from(ipSignupsTable)
    .where(and(eq(ipSignupsTable.ipAddress, ip), gte(ipSignupsTable.createdAt, since)));

  if (Number(ipCount?.cnt ?? 0) >= SIGNUP_IP_DAILY_LIMIT) {
    res.status(429).json({ error: "Too many accounts created from this network today. Please try again tomorrow." });
    return;
  }

  // --- Behavior timing check (fast-action bot detection) ---
  const plt = req.body._plt || req.headers["x-page-load-time"];
  if (plt) {
    const loadTs = parseInt(String(plt), 10);
    if (!isNaN(loadTs) && Date.now() - loadTs < 3000) {
      // Form completed in under 3 seconds — likely a bot
      res.status(429).json({ error: "Please slow down and try again" });
      return;
    }
  }

  // B24: case-insensitive duplicate check — covers BOTH new normalized
  // rows AND legacy mixed-case rows (e.g., prod Vimlesh1group vs
  // vimlesh1group, SAFEPAYU vs safepayu) that pre-date this fix.
  const existing = await db
    .select()
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  let sponsorId: number | undefined;
  if (sponsorCode) {
    const sponsor = await db.select().from(usersTable).where(eq(usersTable.referralCode, sponsorCode)).limit(1);
    if (sponsor.length > 0) {
      const candidateSponsorId = sponsor[0]!.id;
      // Cap referrals per sponsor per day — beyond cap, allow signup but drop sponsor link
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [refCount] = await db
        .select({ cnt: count() })
        .from(usersTable)
        .where(and(eq(usersTable.sponsorId, candidateSponsorId), gte(usersTable.createdAt, sinceDay)));
      if (Number(refCount?.cnt ?? 0) >= SIGNUP_REFERRAL_DAILY_LIMIT) {
        // Sponsor exceeded daily referral cap — orphan this signup, no reward
        sponsorId = undefined;
      } else {
        sponsorId = candidateSponsorId;
      }
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const referralCode = generateReferralCode();
  const ua = req.headers["user-agent"];

  // B24: race-safe insert. The pre-check above resolves the common
  // case, but two concurrent signups for the same email could both
  // pass the existence check and reach the INSERT — the unique index
  // on `email` rejects the second one with Postgres error 23505. We
  // surface that as the same friendly 409 instead of a 500.
  let newUser: typeof usersTable.$inferSelect | undefined;
  try {
    [newUser] = await db.insert(usersTable).values({
      email,
      passwordHash,
      fullName,
      isAdmin: false,
      referralCode,
      sponsorId: sponsorId ?? 0,
      emailVerified: false,
      points: 0,
    }).returning();
  } catch (e: any) {
    const code = e?.code ?? e?.cause?.code;
    const msg = String(e?.message ?? "");
    if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw e;
  }

  if (!newUser) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  await db.insert(walletsTable).values({ userId: newUser.id });
  await db.insert(investmentsTable).values({ userId: newUser.id });

  // Auto-credit demo welcome funds (gated by `auto_demo_signup` system setting; default OFF in production)
  try {
    const { seedDemoFunds, isAutoDemoSignupEnabled } = await import("../lib/demo-funding");
    if (await isAutoDemoSignupEnabled()) {
      await seedDemoFunds(newUser.id);
    }
  } catch (e) {
    // non-fatal — signup continues even if demo funding fails
    console.error("[DEMO] Failed to seed funds for new user", newUser.id, e);
  }

  // Track IP signup
  await db.insert(ipSignupsTable).values({ ipAddress: ip, userId: newUser.id });

  // Bump the public "Active Investors" counter by +1 on real signup
  // (counter also auto-increments 5–25 every 30 min via /api/public/market-indicators).
  // Skip for the deploy smoke-test account so re-creating it on a fresh DB
  // never inflates the public counter.
  if (!newUser.isSmokeTest) {
    try {
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('active_investors_count', '1', NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = (COALESCE(NULLIF(system_settings.value, '')::int, 0) + 1)::text,
            updated_at = NOW()
      `);
    } catch (e) {
      console.error("[INVESTORS] Failed to bump counter on signup", e);
    }
  }

  // Fire-and-forget: track event and run fraud checks
  setImmediate(async () => {
    await trackLoginEvent(newUser.id, ip, ua, "register");
    await runFraudChecks(newUser.id, ip, ua, sponsorId ?? null);
  });

  // Send email OTP for verification (fire-and-forget, don't block response)
  setImmediate(async () => {
    try {
      await sendOtp(newUser.id, email, "verify_email");
    } catch (err) {
      // Non-fatal — user can resend
    }
  });

  // Send branded welcome email (fire-and-forget) — emerald "You're In" template
  setImmediate(async () => {
    try {
      const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "Trader";
      await sendWelcomeEmail(email, firstName, referralCode);
    } catch {
      // Non-fatal — welcome email is a nice-to-have
    }
  });

  // IMPORTANT: do NOT issue an auth token here. The user must verify their
  // email via OTP first (see POST /auth/verify-email-public). Returning a
  // token here would let users skip verification entirely.
  res.status(201).json({
    requiresVerification: true,
    email: newUser.email,
    message: "Account created. Please verify your email with the OTP we just sent.",
  });
});

// ---------------------------------------------------------------------------
// POST /auth/verify-email-public — public OTP verify (used immediately after
// registration, before the user has a session token). On success, issues the
// auth JWT so the user can be logged in.
// ---------------------------------------------------------------------------
router.post("/auth/verify-email-public", async (req, res) => {
  const { email: rawEmail, otp } = req.body ?? {};
  if (!rawEmail || typeof rawEmail !== "string" || !otp || typeof otp !== "string") {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }
  // B24: same normalization /auth/register applies on insert.
  const email = rawEmail.toLowerCase().trim();

  const users = await db
    .select()
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);
  if (users.length === 0) {
    // Generic error to avoid email enumeration
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  const user = users[0]!;
  if (user.isDisabled || (user.isFrozen && !user.isAdmin)) {
    res.status(403).json({ error: "Account access is restricted" });
    return;
  }

  if (user.emailVerified) {
    // Already verified — just issue the token so they can sign in
    const token = signToken(user.id, user.isAdmin);
    res.json({ token, user: formatUser(user), alreadyVerified: true });
    return;
  }

  const result = await verifyOtp(user.id, otp, "verify_email");
  if (!result.valid) {
    res.status(400).json({ error: result.error ?? "Invalid or expired code" });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, user.id));
  await invalidateAuthUserCache(user.id);

  // Award one-time points (fire-and-forget)
  setImmediate(async () => {
    try {
      const { awardPoints } = await import("../lib/task-service");
      await awardPoints(user.id, 25, "task_reward", "Email verification bonus");
    } catch { /* non-fatal */ }
  });

  const token = signToken(user.id, user.isAdmin);
  res.json({ token, user: formatUser({ ...user, emailVerified: true }) });
});

// ---------------------------------------------------------------------------
// POST /auth/resend-verification — public OTP resend (no auth required).
// Always returns generic success to prevent email enumeration.
// ---------------------------------------------------------------------------
router.post("/auth/resend-verification", async (req, res) => {
  const { email: rawEmail } = req.body ?? {};
  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  // B24: same normalization /auth/register applies on insert.
  const email = rawEmail.toLowerCase().trim();

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, emailVerified: usersTable.emailVerified, isDisabled: usersTable.isDisabled })
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);

  if (users.length > 0 && !users[0]!.isDisabled && !users[0]!.emailVerified) {
    setImmediate(async () => {
      try { await sendOtp(users[0]!.id, users[0]!.email, "verify_email"); } catch { /* non-fatal */ }
    });
  }

  // Always generic — don't reveal whether email exists or is verified
  res.json({ success: true, message: "If an unverified account exists for that email, a new code has been sent." });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
router.post("/auth/login", loginRateLimit, async (req, res) => {
  const result = LoginBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const { email: rawEmailLogin, password } = result.data;
  // B24: normalize email same way /auth/register now does so a user
  // who signed up as "Foo@x.com" can sign in as "foo@x.com" (and any
  // other case variation). The DB lookup uses LOWER(email) below to
  // also match legacy mixed-case rows that pre-date this fix.
  const email = rawEmailLogin.toLowerCase().trim();

  // --- Captcha check ---
  // B9.6: verifyCaptcha() is a provider dispatcher (lib/captcha-service.ts);
  // it routes to either reCAPTCHA or Cloudflare Turnstile based on the
  // CAPTCHA_PROVIDER env var. Either way the token field on the request
  // body is `captchaToken` — the dispatcher hides which vendor verifies it.
  // Auto-skips if the active provider's secret is missing (dev escape
  // hatch); production always has the active secret set as a Fly app secret.
  const loginIp = normalizeIp(getClientIp(req));
  const captchaResult = await verifyCaptcha(req.body.captchaToken, loginIp);
  if (!captchaResult.ok) {
    res.status(400).json({ error: captchaResult.error ?? "Captcha required" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);
  if (users.length === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = users[0]!;
  if (user.isDisabled || (user.isFrozen && !user.isAdmin)) {
    res.status(403).json({ error: "Account access is restricted" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // ─── Email verification gate (B23) ─────────────────────────────────────
  // Block login for accounts that registered but never confirmed their
  // email OTP. Without this gate, a user could complete /auth/register
  // (which creates the user with emailVerified=false) and then sign in
  // with email+password before ever entering the code we mailed them —
  // bypassing verification entirely. We also fire a fresh OTP so the
  // frontend can move them straight to the verify-OTP screen.
  if (!user.emailVerified) {
    setImmediate(async () => {
      try { await sendOtp(user.id, user.email, "verify_email"); } catch { /* non-fatal */ }
    });
    res.json({
      requiresVerification: true,
      email: user.email,
      message: "Please verify your email first. We've sent a fresh code to your inbox.",
    });
    return;
  }

  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];

  setImmediate(async () => {
    await trackLoginEvent(user.id, ip, ua, "login");
    await runFraudChecks(user.id, ip, ua, null);
  });

  // ─── Two-Factor Authentication gate ────────────────────────────────────
  // If the user has TOTP 2FA enabled, halt the login here and hand back
  // a short-lived challenge token. The frontend will collect a 6-digit
  // code (or 8-char backup code) and POST to /auth/2fa/login-verify,
  // which will run the SAME single-device + session-token logic below
  // once the code checks out. We skip this for admins ONLY if they
  // haven't enrolled — once an admin opts in, they get the prompt too.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const twoFactorToken = signTwoFactorChallenge(user.id);
    res.json({
      requires2FA: true,
      twoFactorToken,
      ttlSeconds: TWO_FA_CHALLENGE_TTL_SECONDS,
    });
    return;
  }

  await issueSessionAfterAuth(user, req, res);
});

// ─── Helper: post-password session issuance ─────────────────────────────
// Extracted so /auth/2fa/login-verify can reuse the EXACT same single-
// active-device + session-token logic the password-only login path uses.
// Anything written into res here ends the request — caller must return
// immediately after calling.
async function issueSessionAfterAuth(
  user: typeof usersTable.$inferSelect,
  req: any,
  res: any,
): Promise<void> {
  // ─── Defense-in-depth: never issue a session for an unverified email
  // (B23). The /auth/login route already gates this for the password
  // path, but every code path that ends in a JWT goes through this
  // helper (2FA verify, login-attempt approval, OTP fallback). Keeping
  // the check here ensures any future entry point inherits the rule.
  if (!user.emailVerified) {
    res.status(403).json({
      error: "Please verify your email first",
      requiresVerification: true,
      email: user.email,
    });
    return;
  }
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];
  const fingerprint = computeDeviceFingerprint(req);
  const skipDeviceGate = user.isAdmin || user.isSmokeTest;
  if (
    !skipDeviceGate &&
    user.activeSessionFingerprint &&
    user.activeSessionFingerprint !== fingerprint
  ) {
    const pollToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + LOGIN_APPROVAL_WINDOW_MS);
    const { browser, os } = describeDevice(req);
    const [attempt] = await db
      .insert(loginAttemptsTable)
      .values({
        userId: user.id,
        deviceFingerprint: fingerprint,
        userAgent: typeof ua === "string" ? ua.slice(0, 500) : null,
        ipAddress: ip ? ip.slice(0, 64) : null,
        browserLabel: browser.slice(0, 80),
        osLabel: os.slice(0, 80),
        pollToken,
        status: "pending",
        expiresAt,
      })
      .returning();
    res.json({
      requiresApproval: true,
      attemptId: attempt!.id,
      pollToken,
      expiresAt: expiresAt.toISOString(),
      otpFallbackAfterMs: LOGIN_APPROVAL_OTP_FALLBACK_MS,
      device: { browser, os },
    });
    return;
  }

  if (!skipDeviceGate) {
    await db
      .update(usersTable)
      .set({ activeSessionFingerprint: fingerprint, activeSessionLastSeen: new Date() })
      .where(eq(usersTable.id, user.id));
    await invalidateAuthUserCache(user.id);
  }
  const token = signToken(user.id, user.isAdmin);
  // Track this device + fire "new device detected" email if it's the first
  // time we've seen this fingerprint for the user (and they have other
  // known devices already). Fire-and-forget — never blocks the response.
  trackLoginDevice(user, req);
  res.json({ token, user: formatUser(user) });
}

// ---------------------------------------------------------------------------
// POST /auth/2fa/login-verify
// Second leg of the 2FA-gated login. Body: { twoFactorToken, code, mode? }.
//   • mode === "email_otp" → `code` is the 6-digit one-time code we mailed
//     to the user via /auth/2fa/email-fallback/request (single-use, 10-min
//     TTL, stored in email_otps with purpose="two_factor_login").
//   • otherwise            → `code` is a 6-digit TOTP code OR an 8-char
//     backup code (existing path).
// On success we hand the user off to issueSessionAfterAuth() — same
// single-device + JWT path the password-only login uses.
// ---------------------------------------------------------------------------
router.post("/auth/2fa/login-verify", loginRateLimit, async (req, res) => {
  const token: unknown = req.body?.twoFactorToken;
  const code: unknown = req.body?.code;
  const mode: unknown = req.body?.mode;
  if (typeof token !== "string" || typeof code !== "string") {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  if (mode !== undefined && mode !== "email_otp" && mode !== "totp_or_backup") {
    res.status(400).json({ error: "Invalid verification mode" });
    return;
  }
  const decoded = verifyTwoFactorChallenge(token);
  if (!decoded) {
    res.status(401).json({ error: "Two-factor session expired. Please log in again." });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  if (user.isDisabled || (user.isFrozen && !user.isAdmin)) {
    res.status(403).json({ error: "Account access is restricted" });
    return;
  }
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    // Race: 2FA was disabled between login and verify. Treat as success — the
    // user proved password already. Most apps just log in here.
    await issueSessionAfterAuth(user, req, res);
    return;
  }

  // ── Branch 1: email-OTP fallback ───────────────────────────────────────
  // Used when the user lost access to their authenticator AND backup codes,
  // and chose "Email me a verification code" in the UI. Code was sent via
  // /auth/2fa/email-fallback/request → verifyOtp atomically marks it used.
  if (mode === "email_otp") {
    const cleaned = code.trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleaned)) {
      res.status(400).json({ error: "Email codes are 6 digits." });
      return;
    }
    const result = await verifyOtp(user.id, cleaned, "two_factor_login");
    if (!result.valid) {
      res.status(400).json({ error: result.error || "Invalid or expired code. Please try again." });
      return;
    }
    await issueSessionAfterAuth(user, req, res);
    return;
  }

  // ── Branch 2: TOTP or backup code (existing path) ──────────────────────
  // Atomic verify+consume: row lock + verify against fresh state +
  // persist consumed backup-code state, all inside one transaction.
  // Prevents two concurrent login-verify requests from both burning
  // the same backup code.
  const consumed = await consumeAuthCodeForUser(user.id, code.trim());
  if (!consumed.ok) {
    if (consumed.reason === "not-enabled") {
      // Race: 2FA was disabled between password check and verify.
      await issueSessionAfterAuth(user, req, res);
      return;
    }
    res.status(400).json({ error: "Invalid code. Please try again." });
    return;
  }
  await issueSessionAfterAuth(user, req, res);
});

// ---------------------------------------------------------------------------
// POST /auth/2fa/email-fallback/request
// Triggered when a 2FA-enabled user clicks "Email me a verification code"
// on the login screen because they've lost access to their authenticator
// app AND their backup codes. We email a 6-digit OTP to their registered
// address (single-use, 10-min TTL) and they then submit it via
// /auth/2fa/login-verify with mode="email_otp".
//
// Security:
//   • Requires a valid 2FA challenge token (proves password was just
//     verified) — random people can't trigger emails to arbitrary users.
//   • Rate-limited via loginRateLimit (5/min per IP, B9.5).
//   • sendOtp invalidates any prior pending OTP for the same purpose, so
//     spamming "resend" only ever leaves the latest code valid.
//   • Email is masked in the response (a***@d***.com) so we never leak
//     the full address back to the network.
// ---------------------------------------------------------------------------
function maskEmailForResponse(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your registered email";
  const maskedLocal =
    local.length <= 2
      ? local[0] + "*"
      : local[0] + "*".repeat(Math.max(1, local.length - 2)) + local[local.length - 1];
  const dotIdx = domain.indexOf(".");
  const domainHead = dotIdx === -1 ? domain : domain.slice(0, dotIdx);
  const domainTail = dotIdx === -1 ? "" : domain.slice(dotIdx);
  const maskedDomain =
    domainHead.length <= 1
      ? domainHead + "*" + domainTail
      : domainHead[0] + "*".repeat(Math.max(1, domainHead.length - 1)) + domainTail;
  return `${maskedLocal}@${maskedDomain}`;
}

router.post("/auth/2fa/email-fallback/request", loginRateLimit, async (req, res) => {
  const token: unknown = req.body?.twoFactorToken;
  if (typeof token !== "string") {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const decoded = verifyTwoFactorChallenge(token);
  if (!decoded) {
    res.status(401).json({ error: "Two-factor session expired. Please log in again." });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  if (user.isDisabled || (user.isFrozen && !user.isAdmin)) {
    res.status(403).json({ error: "Account access is restricted" });
    return;
  }
  if (!user.twoFactorEnabled) {
    res.status(400).json({ error: "Two-factor authentication is not enabled on this account." });
    return;
  }
  try {
    await sendOtp(user.id, user.email, "two_factor_login");
  } catch (err) {
    // sendEmail logs the underlying SES/SMTP failure — surface a generic
    // message so the user knows to try again or fall back to backup codes.
    res.status(500).json({
      error:
        "We couldn't send your verification email right now. Please try again, or use a backup code instead.",
    });
    return;
  }
  res.json({ ok: true, email: maskEmailForResponse(user.email) });
});

// ─── Single-active-device login: tunables ────────────────────────────────
// Window during which an attempt stays in "pending" before it expires.
// Also the upper bound for how long the new device's polling will keep
// hoping for an answer (the UI pivots to email-OTP fallback at the
// OTP_FALLBACK mark, well before EXPIRY hits).
export const LOGIN_APPROVAL_WINDOW_MS = 5 * 60 * 1000;
export const LOGIN_APPROVAL_OTP_FALLBACK_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// GET /auth/login-attempts/pending — polled by the currently-active device.
// Returns any not-yet-decided login attempts on this account, EXCLUDING
// ones from the requesting device itself (so a tab that's polling doesn't
// see itself). The active device shows an Approve/Deny modal per row.
// ---------------------------------------------------------------------------
router.get("/auth/login-attempts/pending", authMiddleware, async (req: AuthRequest, res) => {
  const myFp = computeDeviceFingerprint(req);
  const now = new Date();
  const rows = await db
    .select({
      id: loginAttemptsTable.id,
      deviceFingerprint: loginAttemptsTable.deviceFingerprint,
      ipAddress: loginAttemptsTable.ipAddress,
      browserLabel: loginAttemptsTable.browserLabel,
      osLabel: loginAttemptsTable.osLabel,
      createdAt: loginAttemptsTable.createdAt,
      expiresAt: loginAttemptsTable.expiresAt,
    })
    .from(loginAttemptsTable)
    .where(
      and(
        eq(loginAttemptsTable.userId, req.userId!),
        eq(loginAttemptsTable.status, "pending"),
        gte(loginAttemptsTable.expiresAt, now),
      ),
    );
  const others = rows.filter((r) => r.deviceFingerprint !== myFp);
  res.json({
    attempts: others.map((r) => ({
      id: r.id,
      ip: r.ipAddress,
      browser: r.browserLabel,
      os: r.osLabel,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login-attempts/:id/respond — the active device accepts or
// denies a pending login attempt. On approve we KICK the active device by
// bumping forceLogoutAfter (per the user's "single device at a time"
// choice) and hand the slot to the new device; the new device picks up its
// JWT on its next /status poll. On deny we just mark the row.
// ---------------------------------------------------------------------------
router.post("/auth/login-attempts/:id/respond", authMiddleware, async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid attempt id" });
    return;
  }
  const decision = req.body?.decision;
  if (decision !== "approve" && decision !== "deny") {
    res.status(400).json({ error: "decision must be 'approve' or 'deny'" });
    return;
  }
  // Race-safe: only the genuinely-pending row for THIS user gets touched,
  // and we read back what we updated so a double-tap can't double-issue.
  const [row] = await db
    .update(loginAttemptsTable)
    .set({ status: decision === "approve" ? "approved" : "denied", decidedAt: new Date() })
    .where(
      and(
        eq(loginAttemptsTable.id, id),
        eq(loginAttemptsTable.userId, req.userId!),
        eq(loginAttemptsTable.status, "pending"),
        gte(loginAttemptsTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Attempt not found, already decided, or expired" });
    return;
  }
  if (decision === "approve") {
    // Hand the slot to the new device AND kick every existing JWT (the
    // current device included — that's the "single device at a time"
    // contract the user picked).
    await db
      .update(usersTable)
      .set({
        activeSessionFingerprint: row.deviceFingerprint,
        activeSessionLastSeen: new Date(),
        forceLogoutAfter: new Date(),
      })
      .where(eq(usersTable.id, req.userId!));
    await invalidateAuthUserCache(req.userId!);
    // Mint the JWT NOW (after forceLogoutAfter is set) so the iat is
    // strictly later than the kill-switch and the new device's token
    // stays valid.
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    const issuedToken = signToken(userRows[0]!.id, userRows[0]!.isAdmin);
    await db
      .update(loginAttemptsTable)
      .set({ issuedToken })
      .where(eq(loginAttemptsTable.id, id));
    // Record the now-approved device + fire alert email. We use the row
    // data (not req) because `req` is from the OLD device that just
    // approved — the device we want to track is the NEW one waiting in
    // the loginAttempts row.
    trackLoginDevice(userRows[0]!, {
      fingerprint: row.deviceFingerprint,
      ip: row.ipAddress,
      userAgent: row.userAgent,
      browser: row.browserLabel || "Unknown",
      os: row.osLabel || "Unknown",
    });
  }
  res.json({ ok: true, decision });
});

// ---------------------------------------------------------------------------
// GET /auth/login-attempts/:id/status — UNAUTHENTICATED endpoint polled by
// the device that's WAITING for approval. Auth is via the per-attempt
// pollToken handed back from /auth/login. On approval we hand the JWT
// over exactly once and clear it from the row so a leaked URL can't reuse
// it. Treats the smoke-test account's bypass path consistently.
// ---------------------------------------------------------------------------
router.get("/auth/login-attempts/:id/status", async (req, res) => {
  const id = Number(req.params["id"]);
  const pollToken = (req.query["pollToken"] ?? "") as string;
  if (!Number.isFinite(id) || id <= 0 || !pollToken) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [row] = await db
    .select()
    .from(loginAttemptsTable)
    .where(and(eq(loginAttemptsTable.id, id), eq(loginAttemptsTable.pollToken, pollToken)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (row.status === "approved" && row.issuedToken) {
    // One-shot hand-off: atomically clear the token so two concurrent
    // polls can't both mint a session. The conditional WHERE on the
    // token's current value is the lock — only the winner gets rows
    // back, the loser sees `consumed`.
    const claimed = await db
      .update(loginAttemptsTable)
      .set({ issuedToken: null })
      .where(
        and(
          eq(loginAttemptsTable.id, id),
          eq(loginAttemptsTable.pollToken, pollToken),
          eq(loginAttemptsTable.issuedToken, row.issuedToken),
        ),
      )
      .returning({ id: loginAttemptsTable.id });
    if (claimed.length === 0) {
      res.json({ status: "consumed" });
      return;
    }
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, row.userId))
      .limit(1);
    res.json({ status: "approved", token: row.issuedToken, user: formatUser(userRows[0]!) });
    return;
  }
  if (row.status === "approved") {
    // Token was already collected on a previous poll.
    res.json({ status: "consumed" });
    return;
  }
  if (row.expiresAt.getTime() < Date.now() && row.status === "pending") {
    res.json({ status: "expired" });
    return;
  }
  res.json({ status: row.status });
});

// ---------------------------------------------------------------------------
// POST /auth/login-attempts/:id/request-otp — fallback path for the case
// the active device never responds within the OTP fallback window
// (typically because it's offline, the app is closed, or the phone is on
// silent). UNAUTHENTICATED, gated by pollToken. Sends a 6-digit code to
// the account's verified email.
// ---------------------------------------------------------------------------
router.post("/auth/login-attempts/:id/request-otp", async (req, res) => {
  const id = Number(req.params["id"]);
  const { pollToken } = req.body ?? {};
  if (!Number.isFinite(id) || id <= 0 || !pollToken) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [row] = await db
    .select()
    .from(loginAttemptsTable)
    .where(and(eq(loginAttemptsTable.id, id), eq(loginAttemptsTable.pollToken, pollToken)))
    .limit(1);
  if (!row || row.status === "denied" || row.status === "approved") {
    res.status(400).json({ error: "Attempt is not eligible for OTP fallback" });
    return;
  }
  // Only allow the OTP path AFTER the fallback window — otherwise a
  // determined user could just spam this and skip the active device's
  // approval entirely.
  const ageMs = Date.now() - row.createdAt.getTime();
  if (ageMs < LOGIN_APPROVAL_OTP_FALLBACK_MS) {
    res.status(425).json({
      error: "too_early",
      retryAfterMs: LOGIN_APPROVAL_OTP_FALLBACK_MS - ageMs,
    });
    return;
  }
  const userRows = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);
  if (!userRows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await sendOtp(row.userId, userRows[0].email, "device_login_approval");
  await db
    .update(loginAttemptsTable)
    .set({ status: "otp_sent" })
    .where(eq(loginAttemptsTable.id, id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /auth/login-attempts/:id/verify-otp — the new device finishes
// login by entering the 6-digit code from email. Same effect as the
// active device pressing Approve: kicks all existing sessions, hands
// the slot to this device, mints a JWT.
// ---------------------------------------------------------------------------
router.post("/auth/login-attempts/:id/verify-otp", async (req, res) => {
  const id = Number(req.params["id"]);
  const { pollToken, otp } = req.body ?? {};
  if (!Number.isFinite(id) || id <= 0 || !pollToken || !otp) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const [row] = await db
    .select()
    .from(loginAttemptsTable)
    .where(and(eq(loginAttemptsTable.id, id), eq(loginAttemptsTable.pollToken, pollToken)))
    .limit(1);
  if (!row || row.status === "denied" || row.status === "approved") {
    res.status(400).json({ error: "Attempt is not eligible" });
    return;
  }
  const otpResult = await verifyOtp(row.userId, otp, "device_login_approval");
  if (!otpResult.valid) {
    res.status(400).json({ error: otpResult.error ?? "Invalid or expired code" });
    return;
  }
  // Same kick-and-claim sequence as the approve path.
  await db
    .update(usersTable)
    .set({
      activeSessionFingerprint: row.deviceFingerprint,
      activeSessionLastSeen: new Date(),
      forceLogoutAfter: new Date(),
    })
    .where(eq(usersTable.id, row.userId));
  await invalidateAuthUserCache(row.userId);
  const userRows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);
  const token = signToken(userRows[0]!.id, userRows[0]!.isAdmin);
  await db
    .update(loginAttemptsTable)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(loginAttemptsTable.id, id));
  // Track this device — req IS the new device (it submitted the OTP).
  trackLoginDevice(userRows[0]!, req);
  res.json({ token, user: formatUser(userRows[0]!) });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
router.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(users[0]!));
});

// ---------------------------------------------------------------------------
// GET /auth/security-status — exposes password-change history and the
// resulting 24h post-change withdrawal lock status, so the settings page
// can render an accurate "Last changed" line and the withdraw page can
// show a banner when the lock is active. The withdraw endpoint enforces
// this server-side; this is purely informational for the UI.
// ---------------------------------------------------------------------------
router.get("/auth/security-status", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db
    .select({ passwordChangedAt: usersTable.passwordChangedAt })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const passwordChangedAt = rows[0]!.passwordChangedAt;
  const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
  const withdrawalLockedUntilMs = passwordChangedAt
    ? new Date(passwordChangedAt).getTime() + lockMs
    : null;
  const now = Date.now();
  const withdrawalLocked = !!withdrawalLockedUntilMs && withdrawalLockedUntilMs > now;
  res.json({
    passwordChangedAt: passwordChangedAt ? new Date(passwordChangedAt).toISOString() : null,
    withdrawalLockHours: WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE,
    withdrawalLockedUntil: withdrawalLockedUntilMs
      ? new Date(withdrawalLockedUntilMs).toISOString()
      : null,
    withdrawalLocked,
    serverTime: new Date(now).toISOString(),
  });
});

// ---------------------------------------------------------------------------
// POST /auth/change-password — logged-in user updates their own password.
// Requires the current password to prevent session-hijack abuse. On success
// stamps `password_changed_at` so /wallet/withdraw will block payouts for
// the next WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE hours — gives the
// real owner a window to react if their account was just taken over.
// ---------------------------------------------------------------------------
const changePasswordLimiter = makeRedisLimiter({
  name: "change-password",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many password change attempts. Try again later." },
});

router.post(
  "/auth/change-password",
  changePasswordLimiter,
  authMiddleware,
  async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      res.status(400).json({ error: "Current password is required" });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: "New password must be 8-128 characters long" });
      return;
    }
    if (newPassword === currentPassword) {
      res.status(400).json({ error: "New password must be different from current password" });
      return;
    }

    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        passwordHash: usersTable.passwordHash,
        isDisabled: usersTable.isDisabled,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0]!;
    if (user.isDisabled) {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    await db
      .update(usersTable)
      .set({ passwordHash: newHash, passwordChangedAt: now })
      .where(eq(usersTable.id, user.id));
    await invalidateAuthUserCache(user.id);

    // Notify the user out-of-band that their password was just changed —
    // gives the real owner a chance to react if this was an attacker.
    // Failure is non-fatal (the password change itself already succeeded
    // and is logged), but we DO log it so we can spot a broken email path.
    setImmediate(async () => {
      try {
        const subject = "Your Qorix Markets password was changed";
        const message =
          `Your account password was just updated.\n\n` +
          `For your security, withdrawals from your account are temporarily ` +
          `paused for the next ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE} hours. ` +
          `Deposits, trading and all other activity continue as normal.\n\n` +
          `If you did NOT change your password, contact support immediately ` +
          `so we can secure your account.`;
        const html = buildBrandedEmailHtml(subject, message);
        await sendEmail(user.email, subject, message, html);
      } catch (err) {
        try {
          const { errorLogger } = await import("../lib/logger");
          errorLogger.error(
            { err, userId: user.id, route: "/auth/change-password" },
            "Failed to send password-change confirmation email",
          );
        } catch { /* logger import failed — give up silently */ }
      }
    });

    const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
    res.json({
      success: true,
      message: "Password updated successfully",
      passwordChangedAt: now.toISOString(),
      withdrawalLockedUntil: new Date(now.getTime() + lockMs).toISOString(),
      withdrawalLockHours: WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /auth/send-otp — resend email verification OTP
// ---------------------------------------------------------------------------
router.post("/auth/send-otp", authMiddleware, async (req: AuthRequest, res) => {
  const users = await db.select({ id: usersTable.id, email: usersTable.email, emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = users[0]!;
  if (user.emailVerified) {
    res.status(400).json({ error: "Email already verified" });
    return;
  }

  await sendOtp(user.id, user.email, "verify_email");
  res.json({ success: true, message: "OTP sent to your email" });
});

// ---------------------------------------------------------------------------
// POST /auth/verify-email — verify OTP and mark email as verified
// ---------------------------------------------------------------------------
router.post("/auth/verify-email", authMiddleware, async (req: AuthRequest, res) => {
  const { otp } = req.body;
  if (!otp || typeof otp !== "string") {
    res.status(400).json({ error: "OTP is required" });
    return;
  }

  const result = await verifyOtp(req.userId!, otp, "verify_email");
  if (!result.valid) {
    res.status(400).json({ error: result.error ?? "Invalid OTP" });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, req.userId!));
  await invalidateAuthUserCache(req.userId!);

  // Award points for email verification (one-time task)
  setImmediate(async () => {
    try {
      const { completeTask } = await import("../lib/task-service");
      // trigger the KYC-adjacent "verified email" bonus via general points award
      const { awardPoints } = await import("../lib/task-service");
      await awardPoints(req.userId!, 25, "task_reward", "Email verification bonus");
    } catch { /* non-fatal */ }
  });

  res.json({ success: true, message: "Email verified successfully" });
});

// ---------------------------------------------------------------------------
// POST /auth/withdrawal-otp — send OTP before a withdrawal
//
// Hardened in Batch 5.6 (2026-04-29) after the parallel security audit:
//
// 1) Per-user rate limit (Redis-backed, like /auth/forgot-password). Without
//    it a stolen-session attacker could flood the legit owner's inbox by
//    looping POSTs to this endpoint — the global 600/min/IP cap is an order
//    of magnitude too coarse to stop an inbox bomb. 3 sends per 10 minutes
//    per userId is enough headroom for "I clicked resend twice and didn't
//    see the email" while bounding abuse to one email burst per window.
//    keyGenerator runs AFTER authMiddleware (mount order below), so
//    req.userId is populated; falls back to ip for the unreachable case
//    where auth somehow let an unauthed request through.
//
// 2) Precondition gate: the withdraw routes themselves reject
//    KYC-pending / disabled / frozen / new-account / post-password-change
//    accounts (see routes/inr-withdrawals.ts and routes/wallet.ts). If any
//    of those will reject, sending an OTP first is pure waste — and worse,
//    leaks lock state to an attacker (e.g. "OTP sent" vs "withdrawal
//    locked" tells them when the lock will expire). This handler now
//    short-circuits with the same error codes the withdraw routes use, so
//    the client sees a single consistent error model regardless of which
//    layer rejected. Admins/test-mode are deliberately not exempted: this
//    is a money-out path.
// ---------------------------------------------------------------------------
const withdrawalOtpLimiter = makeRedisLimiter({
  name: "withdrawal-otp",
  windowMs: 10 * 60 * 1000,
  limit: 3,
  message: {
    error: "Too many OTP requests. Please wait 10 minutes before requesting another withdrawal code.",
    code: "rate_limited",
  },
  // Per-userId, not per-IP, because the threat is "spam the OWNER'S inbox"
  // not "spam from one IP". Two honest users sharing a household NAT must
  // not interfere with each other's withdraw retries.
  //
  // Note on the unauth fallback: this limiter is mounted AFTER authMiddleware
  // (see router.post call below), so reaching this point without a userId is
  // a contract violation — we throw so misconfiguration surfaces loudly at
  // boot/test time instead of silently degrading to a global single-key
  // bucket that would let an attacker share-bypass other users' limits.
  // We deliberately do NOT fall back to req.ip because (a) auth has already
  // guaranteed userId by mount order, and (b) the v8 express-rate-limit
  // ERR_ERL_KEY_GEN_IPV6 validator (correctly) refuses ad-hoc req.ip use
  // without the ipKeyGenerator helper.
  keyGenerator: (req) => {
    const userId = (req as AuthRequest).userId;
    if (!userId) {
      throw new Error(
        "withdrawalOtpLimiter reached without authMiddleware setting req.userId — check route mount order",
      );
    }
    return `u:${userId}`;
  },
  // Fail-CLOSED on Redis errors. The default for our limiter factory is
  // fail-OPEN (better availability for cheap auth surfaces like /auth/login
  // where bcrypt cost already caps brute-force throughput). For this
  // endpoint the side-effect is an OUTBOUND OTP EMAIL — leaving it ungated
  // during a Redis incident effectively re-opens the inbox-bomb vector this
  // limiter exists to close. Prefer transient 5xx during an Upstash outage
  // over silently letting a stolen session spam the user's mailbox.
  passOnStoreError: false,
});

router.post(
  "/auth/withdrawal-otp",
  authMiddleware,
  withdrawalOtpLimiter,
  async (req: AuthRequest, res) => {
    // Pull every column the precondition checks need in a single round-trip.
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        kycStatus: usersTable.kycStatus,
        isDisabled: usersTable.isDisabled,
        isFrozen: usersTable.isFrozen,
        createdAt: usersTable.createdAt,
        passwordChangedAt: usersTable.passwordChangedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0]!;

    // Mirror the withdraw routes' guards verbatim — same error codes so the
    // client's existing toast handlers work without modification.
    if (user.isDisabled || user.isFrozen) {
      res.status(403).json({
        error: "account_restricted",
        message: "Withdrawals are blocked for restricted accounts",
      });
      return;
    }
    if (user.kycStatus !== "approved") {
      res.status(403).json({
        error: "kyc_required",
        message: "Complete KYC verification before withdrawing",
      });
      return;
    }

    // Lazy import to avoid the auth.ts ↔ wallet.ts cycle (wallet.ts already
    // does the symmetric `await import("./auth")` for the password-change
    // constant — see routes/wallet.ts:260). Keeps the constants single-
    // source-of-truth instead of redefining "24" here.
    const { NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS } = await import("./wallet");

    const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
    if (accountAgeMs < NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil(NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS - accountAgeMs / 3_600_000);
      res.status(403).json({
        error: "withdrawal_locked_new_account",
        message: `New accounts must wait ${NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS}h before first withdrawal (${hoursLeft}h remaining)`,
      });
      return;
    }

    if (user.passwordChangedAt) {
      const lockMs = WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE * 60 * 60 * 1000;
      const sinceChangeMs = Date.now() - new Date(user.passwordChangedAt).getTime();
      if (sinceChangeMs < lockMs) {
        const hoursLeft = Math.ceil((lockMs - sinceChangeMs) / 3_600_000);
        res.status(403).json({
          error: "withdrawal_locked_password_change",
          message:
            `Withdrawals are paused for ${WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE}h after a password change ` +
            `for your security (${hoursLeft}h remaining). Deposits and trading continue as normal.`,
          hoursLeft,
        });
        return;
      }
    }

    await sendOtp(user.id, user.email, "withdrawal_confirm");
    res.json({ success: true, message: "Withdrawal confirmation OTP sent to your email" });
  },
);

// ---------------------------------------------------------------------------
// PUBLIC password-reset flow
// POST /auth/forgot-password   { email }
// POST /auth/verify-reset-otp  { email, otp }
// POST /auth/reset-password    { email, otp, newPassword }
// All endpoints intentionally return generic responses to prevent email
// enumeration. The OTP is delivered via the same SMTP pipeline as email
// verification (lib/email-service).
// ---------------------------------------------------------------------------
const forgotLimiter = makeRedisLimiter({
  name: "forgot-password",
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "Too many reset requests. Try again later." },
});

router.post("/auth/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, isDisabled: usersTable.isDisabled })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (users.length > 0 && !users[0]!.isDisabled) {
    setImmediate(async () => {
      try {
        await sendOtp(users[0]!.id, users[0]!.email, "verify_email");
      } catch { /* non-fatal — keep generic response */ }
    });
  }
  // Always generic — never reveal whether email exists.
  res.json({ success: true, message: "If an account exists for that email, a reset code has been sent." });
});

router.post("/auth/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body ?? {};
  if (!email || typeof email !== "string" || !otp || typeof otp !== "string") {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const users = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (users.length === 0) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }
  const result = await verifyOtp(users[0]!.id, otp, "verify_email");
  if (!result.valid) {
    res.status(400).json({ error: result.error ?? "Invalid or expired code" });
    return;
  }
  // Re-issue a fresh OTP that the user must present in the reset step. We
  // store it back so the next call (reset-password) can validate it without
  // re-prompting the user. Reuses the same row pattern (5-min window).
  const fresh = await sendOtp(users[0]!.id, normalizedEmail, "verify_email");
  res.json({ success: true, otp: fresh.otp });
});

router.post("/auth/reset-password", forgotLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body ?? {};
  if (!email || typeof email !== "string" || !otp || typeof otp !== "string") {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: "Password must be 8-128 characters long" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const users = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (users.length === 0) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }
  const result = await verifyOtp(users[0]!.id, otp, "verify_email");
  if (!result.valid) {
    res.status(400).json({ error: result.error ?? "Invalid or expired code" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  // ALSO stamp passwordChangedAt — same as the in-app change-password
  // endpoint. Without this, an attacker who hijacks an email inbox could
  // use the reset flow as a 24h-lock bypass and immediately withdraw.
  // See WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE for the freeze window.
  await db
    .update(usersTable)
    .set({ passwordHash, passwordChangedAt: new Date() })
    .where(eq(usersTable.id, users[0]!.id));
  await invalidateAuthUserCache(users[0]!.id);
  res.json({ success: true, message: "Password reset successfully" });
});

// ---------------------------------------------------------------------------
// GET /auth/dev-otp — DEV ONLY: retrieve latest OTP for testing
// ---------------------------------------------------------------------------
router.get("/auth/dev-otp", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { email, purpose } = req.query;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email query param required" });
    return;
  }
  const otp = await getDevOtp(email, (purpose as string) || "verify_email");
  res.json({ otp });
});

export default router;
