import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, walletsTable, investmentsTable, systemSettingsTable, ipSignupsTable } from "@workspace/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { authMiddleware, signToken, type AuthRequest } from "../middlewares/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { trackLoginEvent, runFraudChecks } from "../lib/fraud-service";
import { sendOtp, verifyOtp, getDevOtp, sendEmail } from "../lib/email-service";
import { buildBrandedEmailHtml } from "../lib/email-template";
import { verifyCaptcha } from "../lib/captcha-service";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
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

  const { email, password, fullName, referralCode: sponsorCode } = result.data;

  // --- IP rate limit check ---
  const rawIp = getClientIp(req);
  const ip = normalizeIp(rawIp);

  // --- Captcha check (skipped if TURNSTILE_SECRET_KEY not configured) ---
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

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
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

  const [newUser] = await db.insert(usersTable).values({
    email,
    passwordHash,
    fullName,
    isAdmin: false,
    referralCode,
    sponsorId: sponsorId ?? 0,
    emailVerified: false,
    points: 0,
  }).returning();

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

  // Send branded welcome email (fire-and-forget)
  setImmediate(async () => {
    try {
      const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "Trader";
      const welcomeTitle = `Welcome to Qorix Markets, ${firstName} 👋`;
      const welcomeMessage =
        `Your account has been successfully created — welcome aboard!\n\n` +
        `Qorix Markets is an institutional-grade AI trading platform that executes trades for you 24/7 — ` +
        `zero emotion, zero delay, fully risk-managed.\n\n` +
        `What you get:\n` +
        `• AI-powered automated trading strategies\n` +
        `• Built-in stop-loss and smart risk management\n` +
        `• USDT (TRC20) deposits and withdrawals — anytime\n` +
        `• Real-time portfolio dashboard and live P&L tracking\n` +
        `• 24/7 dedicated support team\n\n` +
        `To get started:\n` +
        `1. Verify your email (we just sent you an OTP)\n` +
        `2. Fund your trading balance with as little as $10\n` +
        `3. Choose a strategy — the AI handles the rest\n\n` +
        `Your referral code: ${referralCode}\n` +
        `Earn 10% lifetime commission on every friend who joins and trades.\n\n` +
        `Welcome to the future of automated trading.`;

      const html = buildBrandedEmailHtml(welcomeTitle, welcomeMessage);
      await sendEmail(email, welcomeTitle, welcomeMessage, html);
    } catch (err) {
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
  const { email, otp } = req.body ?? {};
  if (!email || typeof email !== "string" || !otp || typeof otp !== "string") {
    res.status(400).json({ error: "Email and OTP are required" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
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
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, emailVerified: usersTable.emailVerified, isDisabled: usersTable.isDisabled })
    .from(usersTable)
    .where(eq(usersTable.email, email))
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

  const { email, password } = result.data;

  // --- Captcha check (skipped if TURNSTILE_SECRET_KEY not configured) ---
  const loginIp = normalizeIp(getClientIp(req));
  const captchaResult = await verifyCaptcha(req.body.captchaToken, loginIp);
  if (!captchaResult.ok) {
    res.status(400).json({ error: captchaResult.error ?? "Captcha required" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
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

  const ip = getClientIp(req);
  const ua = req.headers["user-agent"];

  setImmediate(async () => {
    await trackLoginEvent(user.id, ip, ua, "login");
    await runFraudChecks(user.id, ip, ua, null);
  });

  const token = signToken(user.id, user.isAdmin);
  res.json({ token, user: formatUser(user) });
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
// ---------------------------------------------------------------------------
router.post("/auth/withdrawal-otp", authMiddleware, async (req: AuthRequest, res) => {
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await sendOtp(users[0]!.id, users[0]!.email, "withdrawal_confirm");
  res.json({ success: true, message: "Withdrawal confirmation OTP sent to your email" });
});

// ---------------------------------------------------------------------------
// PUBLIC password-reset flow
// POST /auth/forgot-password   { email }
// POST /auth/verify-reset-otp  { email, otp }
// POST /auth/reset-password    { email, otp, newPassword }
// All endpoints intentionally return generic responses to prevent email
// enumeration. The OTP is delivered via the same SMTP pipeline as email
// verification (lib/email-service).
// ---------------------------------------------------------------------------
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, users[0]!.id));
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
