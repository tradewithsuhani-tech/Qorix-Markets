import { Router } from "express";
import { db, usersTable, walletsTable, investmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, getQueryString } from "../middlewares/auth";
import crypto, { type JsonWebKey } from "crypto";
import { logger } from "../lib/logger";
import { sendWelcomeEmail } from "../lib/email-service";
import { trackLoginDevice } from "../lib/device-tracking";

// ─── Google ID Token verification (no external deps) ─────────────────────────
// Verifies RS256-signed JWTs issued by Google Sign-In SDK using Node's built-in
// crypto module and Google's public JWKS endpoint. Avoids the google-auth-library
// package (saves ~1 MB) while matching its security guarantees.

interface GoogleJWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

// In-process JWKS cache — Google rotates keys every few hours; 6-hour TTL is safe.
let jwksCache: { keys: GoogleJWK[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchGoogleJwks(): Promise<GoogleJWK[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys: GoogleJWK[] };
  jwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

function verifyWithJwk(
  jwk: GoogleJWK,
  headerB64: string,
  payloadB64: string,
  sigB64: string,
  payload: GoogleIdTokenPayload,
): GoogleIdTokenPayload {
  const publicKey = crypto.createPublicKey({ format: "jwk", key: jwk as JsonWebKey });
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(sigB64, "base64url");
  const valid = crypto.verify("RSA-SHA256", data, publicKey, signature);
  if (!valid) throw new Error("Invalid token signature");
  return payload;
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString()) as { kid: string; alg: string };
  if (header.alg !== "RS256") throw new Error(`Unsupported algorithm: ${header.alg}`);

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as GoogleIdTokenPayload;

  // Cheap checks before network I/O
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("ID token expired");
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }
  const allowedAudiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    "905039735320-lc7nauggottuubm9v03k8f64dvqpl57k.apps.googleusercontent.com",
    "905039735320-msqms64vvmemodqp0nk4s0moufsrapps.apps.googleusercontent.com",
  ].filter((v): v is string => !!v && v.length > 0);
  if (allowedAudiences.length > 0 && !allowedAudiences.includes(payload.aud)) {
    throw new Error(`Invalid audience: ${payload.aud}`);
  }

  // Find the matching JWK by kid; force-refresh once if stale
  let keys = await fetchGoogleJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    jwksCache = null;
    keys = await fetchGoogleJwks();
    jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) throw new Error(`Unknown key ID: ${header.kid}`);
  }

  return verifyWithJwk(jwk, headerB64, payloadB64, sigB64, payload);
}

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
  // Encode platform into state so the callback can branch the redirect.
  // Format: "<random_hex>:<platform>" — platform is "mobile" or omitted.
  const nonce = crypto.randomBytes(16).toString("hex");
  const platform = String(req.query["platform"] ?? "").trim().toLowerCase();
  const state = platform === "mobile" ? `${nonce}:mobile` : nonce;
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

// Decode the platform tag embedded in the OAuth state param.
// State format: "<nonce>" (web) or "<nonce>:mobile" (mobile).
function platformFromState(state: string | undefined): "mobile" | "web" {
  if (!state) return "web";
  const parts = state.split(":");
  return parts[parts.length - 1] === "mobile" ? "mobile" : "web";
}

// Build the redirect target depending on the originating platform.
// Mobile uses the Flutter custom-scheme deep link; web uses the frontend URL.
function buildRedirect(
  platform: "mobile" | "web",
  frontend: string,
  params: Record<string, string>,
): string {
  const qs = new URLSearchParams(params).toString();
  if (platform === "mobile") {
    return `qorixmarkets://auth/callback?${qs}`;
  }
  const [key, value] = Object.entries(params)[0]!;
  return `${frontend}/login?${key}=${encodeURIComponent(value)}`;
}

// Step 2: Google calls back here with auth code
router.get("/auth/google/callback", async (req, res) => {
  const frontend = getFrontendUrl(req);
  const platform = platformFromState(getQueryString(req, "state") ?? undefined);
  try {
    const code = getQueryString(req, "code");
    if (!code) {
      res.redirect(buildRedirect(platform, frontend, { error: "google_no_code" }));
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
      res.redirect(buildRedirect(platform, frontend, { error: "google_token_failed" }));
      return;
    }

    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokens.access_token) {
      res.redirect(buildRedirect(platform, frontend, { error: "google_no_token" }));
      return;
    }

    // Fetch user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      res.redirect(buildRedirect(platform, frontend, { error: "google_profile_failed" }));
      return;
    }
    const profile = (await profileRes.json()) as {
      sub: string; email: string; email_verified?: boolean; name?: string; picture?: string;
    };
    if (!profile.email) {
      res.redirect(buildRedirect(platform, frontend, { error: "google_no_email" }));
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
        res.redirect(buildRedirect(platform, frontend, { error: "google_create_failed" }));
        return;
      }
      userId = newUser.id;
      await db.insert(walletsTable).values({ userId });
      await db.insert(investmentsTable).values({ userId });
      logger.info({ userId, email }, "[google-oauth] new user created");

      // Send branded welcome email to new Google sign-ups (fire-and-forget) — emerald template
      const newReferralCode = newUser.referralCode;
      const fullName = newUser.fullName ?? "";
      setImmediate(async () => {
        try {
          const firstName = fullName.trim().split(/\s+/)[0] || "Trader";
          await sendWelcomeEmail(email, firstName, newReferralCode);
        } catch (err) {
          logger.warn({ err: (err as Error).message, userId, email }, "[google-oauth] welcome email failed");
        }
      });
    }

    const token = signToken(userId, isAdmin);
    // Track this device + fire "new device detected" email if this fingerprint
    // is brand-new for the user (and they have other known devices already).
    // Re-fetch a fresh user row so we have email + fullName for the alert.
    try {
      const fullUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (fullUser[0]) trackLoginDevice(fullUser[0], req);
    } catch (err: any) {
      logger.warn({ err: err?.message, userId }, "[google-oauth] device tracking skipped");
    }
    // Redirect to frontend (web) or deep link (mobile) with JWT token
    res.redirect(buildRedirect(platform, frontend, { token }));
  } catch (err) {
    logger.error({ err }, "[google-oauth] callback error");
    res.redirect(buildRedirect(platform, frontend, { error: "google_callback_error" }));
  }
});

// ─── POST /auth/google/mobile ─────────────────────────────────────────────────
// Native mobile Google Sign-In: Flutter's google_sign_in SDK obtains an idToken
// directly from Google; the app sends it here for server-side verification and
// receives a Qorix JWT + basic user profile in return.
//
// No captcha required (mobile clients bypass via X-App-Platform + X-Device-Id).
// No Origin guard required (same mobile headers bypass the guard in origin-guard.ts).
// No redirect — JSON response only.
router.post("/auth/google/mobile", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: "Google OAuth not configured", code: "GOOGLE_NOT_CONFIGURED" });
    return;
  }

  const { idToken } = (req.body ?? {}) as { idToken?: unknown };
  if (!idToken || typeof idToken !== "string") {
    res.status(400).json({ error: "idToken is required", code: "MISSING_ID_TOKEN" });
    return;
  }

  let profile: GoogleIdTokenPayload;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "[google-oauth] mobile id token verification failed");
    res.status(401).json({ error: "Invalid or expired Google token", code: "INVALID_ID_TOKEN" });
    return;
  }

  if (!profile.email) {
    res.status(400).json({ error: "Google account has no email", code: "GOOGLE_NO_EMAIL" });
    return;
  }

  try {
    const email = profile.email.toLowerCase();
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    let userId: number;
    let isAdmin = false;
    let fullName: string;
    let referralCode: string;

    if (existing[0]) {
      userId = existing[0].id;
      isAdmin = existing[0].isAdmin;
      fullName = existing[0].fullName ?? "";
      referralCode = existing[0].referralCode ?? "";
      if (!existing[0].emailVerified && profile.email_verified) {
        await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, userId));
      }
    } else {
      const randomPw = crypto.randomBytes(32).toString("hex");
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(randomPw, 10);
      const newReferralCode = generateReferralCode();
      const newFullName = profile.name || email.split("@")[0]!;
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash,
          fullName: newFullName,
          referralCode: newReferralCode,
          emailVerified: !!profile.email_verified,
          points: 0,
        })
        .returning();
      if (!newUser) {
        res.status(500).json({ error: "Failed to create account", code: "CREATE_FAILED" });
        return;
      }
      userId = newUser.id;
      fullName = newUser.fullName ?? "";
      referralCode = newUser.referralCode ?? "";
      await db.insert(walletsTable).values({ userId });
      await db.insert(investmentsTable).values({ userId });
      logger.info({ userId, email }, "[google-oauth] mobile new user created");

      setImmediate(async () => {
        try {
          const firstName = (fullName.trim().split(/\s+/)[0]) || "Trader";
          await sendWelcomeEmail(email, firstName, referralCode);
        } catch (err) {
          logger.warn({ err: (err as Error).message, userId, email }, "[google-oauth] mobile welcome email failed");
        }
      });
    }

    const token = signToken(userId, isAdmin);

    try {
      const fullUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (fullUser[0]) trackLoginDevice(fullUser[0], req);
    } catch (err: any) {
      logger.warn({ err: err?.message, userId }, "[google-oauth] mobile device tracking skipped");
    }

    res.json({
      token,
      user: {
        id: userId,
        email,
        fullName,
        referralCode,
      },
    });
  } catch (err) {
    logger.error({ err }, "[google-oauth] mobile callback error");
    res.status(500).json({ error: "Authentication failed", code: "AUTH_FAILED" });
  }
});

export default router;
