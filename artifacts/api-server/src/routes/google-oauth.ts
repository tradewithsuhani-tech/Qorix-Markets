import { Router } from "express";
import { db, usersTable, walletsTable, investmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../middlewares/auth";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email-service";
import { buildBrandedEmailHtml } from "../lib/email-template";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

function getBackendUrl(req: any): string {
  if (process.env.BACKEND_PUBLIC_URL) return process.env.BACKEND_PUBLIC_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getFrontendUrl(req: any): string {
  // Production: explicit env wins.
  if (process.env.FRONTEND_PUBLIC_URL) return process.env.FRONTEND_PUBLIC_URL.replace(/\/$/, "");
  // Dev / preview: round-trip back to the same origin the OAuth flow started
  // on (Replit preview URL, localhost, etc.) so the token actually lands in
  // the browser tab the user clicked from.
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${proto}://${host}`;
  return "https://qorixmarkets.com";
}

function generateReferralCode(): string {
  return "QX" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Step 1: Begin OAuth — redirect user to Google consent screen
router.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(500).send("Google OAuth not configured");
    return;
  }
  const redirectUri = `${getBackendUrl(req)}/api/auth/google/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: Google calls back here with auth code
router.get("/auth/google/callback", async (req, res) => {
  const frontend = getFrontendUrl(req);
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.redirect(`${frontend}/login?error=google_no_code`);
      return;
    }

    const redirectUri = `${getBackendUrl(req)}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: txt }, "[google-oauth] token exchange failed");
      res.redirect(`${frontend}/login?error=google_token_failed`);
      return;
    }

    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokens.access_token) {
      res.redirect(`${frontend}/login?error=google_no_token`);
      return;
    }

    // Fetch user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      res.redirect(`${frontend}/login?error=google_profile_failed`);
      return;
    }
    const profile = (await profileRes.json()) as {
      sub: string; email: string; email_verified?: boolean; name?: string; picture?: string;
    };
    if (!profile.email) {
      res.redirect(`${frontend}/login?error=google_no_email`);
      return;
    }

    const email = profile.email.toLowerCase();
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    let userId: number;
    let isAdmin = false;

    if (existing[0]) {
      userId = existing[0].id;
      isAdmin = existing[0].isAdmin;
      // Mark email verified for Google sign-ins
      if (!existing[0].emailVerified && profile.email_verified) {
        await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, userId));
      }
    } else {
      // Create new user with random password (they'll only sign in via Google)
      const randomPw = crypto.randomBytes(32).toString("hex");
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(randomPw, 10);
      const [newUser] = await db.insert(usersTable).values({
        email,
        passwordHash,
        fullName: profile.name || email.split("@")[0]!,
        referralCode: generateReferralCode(),
        emailVerified: !!profile.email_verified,
        points: 0,
      }).returning();
      if (!newUser) {
        res.redirect(`${frontend}/login?error=google_create_failed`);
        return;
      }
      userId = newUser.id;
      await db.insert(walletsTable).values({ userId });
      await db.insert(investmentsTable).values({ userId });
      logger.info({ userId, email }, "[google-oauth] new user created");

      // Send branded welcome email to new Google sign-ups (fire-and-forget)
      const newReferralCode = newUser.referralCode;
      const fullName = newUser.fullName ?? "";
      setImmediate(async () => {
        try {
          const firstName = fullName.trim().split(/\s+/)[0] || "Trader";
          const welcomeTitle = `Welcome to Qorix Markets, ${firstName} 👋`;
          const welcomeMessage =
            `Aapka account successfully ban gaya hai — welcome aboard!\n\n` +
            `Qorix Markets ek institutional-grade AI trading platform hai jo aapke liye 24/7 trades execute karta hai — ` +
            `zero emotion, zero delay, fully risk-managed.\n\n` +
            `Aapko mil rahe hain:\n` +
            `• AI-powered automated trading strategies\n` +
            `• Built-in stop-loss aur smart risk management\n` +
            `• USDT (TRC20) deposits aur withdrawals — anytime\n` +
            `• Real-time portfolio dashboard aur live P&L tracking\n` +
            `• 24/7 dedicated support team\n\n` +
            `Shuru karne ke liye:\n` +
            `1. Sirf $10 se fund karo apna trading balance\n` +
            `2. Strategy choose karo — AI baki sambhal lega\n` +
            `3. Apna progress real-time dashboard pe track karo\n\n` +
            `Aapka referral code: ${newReferralCode}\n` +
            `Har dost jo join kare aur trade kare — aapko 10% lifetime commission milta hai.\n\n` +
            `Welcome to the future of automated trading. 🚀`;

          const html = buildBrandedEmailHtml(welcomeTitle, welcomeMessage);
          await sendEmail(email, welcomeTitle, welcomeMessage, html);
        } catch (err) {
          logger.warn({ err: (err as Error).message, userId, email }, "[google-oauth] welcome email failed");
        }
      });
    }

    const token = signToken(userId, isAdmin);
    // Redirect to frontend login page with token — frontend captures and stores it
    res.redirect(`${frontend}/login?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error({ err }, "[google-oauth] callback error");
    res.redirect(`${frontend}/login?error=google_callback_error`);
  }
});

export default router;
