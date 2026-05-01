import { Router, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { quizOauthCodesTable } from "@workspace/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Config ───────────────────────────────────────────────────────────────
const QUIZ_OAUTH_CLIENT_SECRET = process.env["QUIZ_OAUTH_CLIENT_SECRET"] || "";
const QUIZ_OAUTH_ALLOWED_REDIRECT_URIS = (
  process.env["QUIZ_OAUTH_ALLOWED_REDIRECT_URIS"] || ""
)
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const SESSION_SECRET_ENV = process.env["SESSION_SECRET"];
const JWT_SECRET = SESSION_SECRET_ENV || "qorix-markets-secret";

const CODE_TTL_SECONDS = 60;
const ACCESS_TOKEN_TTL = "1h";
const ALLOWED_CLIENT_IDS = new Set(["qorixplay"]);

// PKCE (RFC 7636) — only S256 is supported. The "plain" method offers no
// real protection because an attacker who can intercept the verifier in
// transit can replay it; SHA-256 hashing makes the challenge non-reversible.
const ALLOWED_PKCE_METHODS = new Set(["S256"]);
// RFC 7636 §4.1 — verifier MUST be 43..128 chars, [A-Z]/[a-z]/[0-9]/-/./_/~
const PKCE_VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
// SHA-256 base64url-encoded with no padding is exactly 43 chars.
const PKCE_S256_CHALLENGE_RE = /^[A-Za-z0-9\-_]{43}$/;

// Constant-time comparison so a side-channel timing oracle can't recover the
// client_secret (or PKCE challenge) one byte at a time.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function isValidRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > 2048)
    return false;
  // Exact match against allow-list (no prefix matching — prevents
  // /auth/callback?evil bypass via /auth/callback../something tricks).
  return QUIZ_OAUTH_ALLOWED_REDIRECT_URIS.includes(uri);
}

// BASE64URL(SHA-256(verifier)) — what RFC 7636 §4.6 says the server
// computes to verify a PKCE exchange. base64url = standard base64 with
// `+` → `-`, `/` → `_`, and no `=` padding.
function s256Challenge(verifier: string): string {
  return crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Shared helper — once a code has been atomically claimed, both the
// confidential and PKCE flows do the same expiry / redirect / user-lookup
// checks and issue the same access_token shape. Keeps the two endpoints
// from drifting apart.
async function issueAccessTokenFromCode(
  row: typeof quizOauthCodesTable.$inferSelect,
  redirect_uri: string,
  res: Response,
  ip: string | undefined,
): Promise<void> {
  if (row.expiresAt.getTime() < Date.now()) {
    logger.warn(
      { codeId: row.code.substring(0, 8) + "...", ip },
      "[oauth-quiz] token rejected: code expired",
    );
    res.status(400).json({ error: "invalid_grant", reason: "expired" });
    return;
  }

  if (row.redirectUri !== redirect_uri) {
    logger.warn(
      {
        codeId: row.code.substring(0, 8) + "...",
        stored: row.redirectUri,
        sent: redirect_uri,
        ip,
      },
      "[oauth-quiz] token rejected: redirect_uri mismatch",
    );
    res
      .status(400)
      .json({ error: "invalid_grant", reason: "redirect_uri_mismatch" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, row.userId))
    .limit(1);

  const user = users[0];
  if (!user || user.isDisabled) {
    res.status(400).json({ error: "invalid_grant", reason: "user_disabled" });
    return;
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      aud: "qorixplay",
      scope: row.scope,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );

  logger.info(
    { userId: user.id, clientId: row.clientId },
    "[oauth-quiz] issued access_token",
  );

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: row.scope,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone_number: user.phoneNumber ?? null,
      kyc_status: user.kycStatus,
      referral_code: user.referralCode,
      email_verified: user.emailVerified,
    },
  });
}

// ─── POST /api/oauth/quiz/authorize ───────────────────────────────────────
// Mints a one-time authorization code for a logged-in Markets user.
// Called by the Markets UI (qorixmarkets.com) after the user clicks
// "Continue to Qorixplay" on the consent screen — NOT directly by qorixplay.
//
// Auth: Markets user JWT (via authMiddleware). The user MUST have an active
//       Markets session to authorize qorixplay access.
//
// PKCE (B35): the caller MAY include `code_challenge` + `code_challenge_method`.
// If present, the resulting code can ONLY be redeemed via the public
// /token-public endpoint by presenting the matching code_verifier — which
// lets a browser SPA complete the OAuth flow without holding a long-lived
// client_secret. If absent, the old confidential-client /token flow applies.
//
// NOTE: parent router is mounted at app.use("/api", router) in app.ts,
// so paths declared here are RELATIVE to /api. The full URL is
// /api/oauth/quiz/authorize.
router.post(
  "/oauth/quiz/authorize",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const {
        redirect_uri,
        client_id,
        scope,
        code_challenge,
        code_challenge_method,
      } = req.body ?? {};

      const clientId = typeof client_id === "string" ? client_id : "qorixplay";
      if (!ALLOWED_CLIENT_IDS.has(clientId)) {
        res.status(400).json({
          error: "invalid_client",
          message: `Unknown client_id: ${clientId}`,
        });
        return;
      }

      if (!isValidRedirectUri(redirect_uri)) {
        logger.warn(
          { userId, redirect_uri },
          "[oauth-quiz] /authorize rejected: redirect_uri not in allow-list",
        );
        res.status(400).json({
          error: "invalid_redirect_uri",
          message:
            "redirect_uri must exactly match one of the registered callback URLs.",
        });
        return;
      }

      // Validate PKCE inputs if either is provided. Both must be present
      // together — accepting just one is a misuse and we fail loudly.
      let storedChallenge: string | null = null;
      let storedMethod: string | null = null;
      if (code_challenge !== undefined || code_challenge_method !== undefined) {
        if (
          typeof code_challenge !== "string" ||
          typeof code_challenge_method !== "string"
        ) {
          res.status(400).json({
            error: "invalid_request",
            message:
              "code_challenge and code_challenge_method must be sent together.",
          });
          return;
        }
        if (!ALLOWED_PKCE_METHODS.has(code_challenge_method)) {
          res.status(400).json({
            error: "invalid_request",
            message: "Only code_challenge_method=S256 is supported.",
          });
          return;
        }
        if (!PKCE_S256_CHALLENGE_RE.test(code_challenge)) {
          res.status(400).json({
            error: "invalid_request",
            message:
              "code_challenge must be 43 base64url chars (S256 of a 32-byte verifier).",
          });
          return;
        }
        storedChallenge = code_challenge;
        storedMethod = code_challenge_method;
      }

      // 32 bytes = 256 bits of entropy, hex-encoded → 64-char string.
      const code = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);
      const finalScope =
        typeof scope === "string" && scope.length > 0 && scope.length <= 256
          ? scope
          : "profile email kyc";

      await db.insert(quizOauthCodesTable).values({
        code,
        userId,
        redirectUri: redirect_uri,
        clientId,
        scope: finalScope,
        expiresAt,
        codeChallenge: storedChallenge,
        codeChallengeMethod: storedMethod,
      });

      logger.info(
        { userId, clientId, redirect_uri, pkce: !!storedChallenge },
        "[oauth-quiz] minted authorization code",
      );

      res.json({
        code,
        expires_in: CODE_TTL_SECONDS,
      });
    } catch (err) {
      logger.error({ err }, "[oauth-quiz] /authorize failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ─── POST /api/oauth/quiz/token ───────────────────────────────────────────
// Exchanges a one-time authorization code for an access_token + user profile.
// Called by qorixplay BACKEND (server-to-server) — NEVER by a browser.
//
// Auth: client_id + client_secret in the request body (HMAC-style). This
//       endpoint is exempt from origin-guard / CSRF (added to PATH_EXEMPTIONS)
//       because server-to-server requests don't carry an Origin header.
//
// Replay safety: the UPDATE ... WHERE used_at IS NULL ... RETURNING is
// atomic — even if two qorixplay backends race to redeem the same code,
// only one UPDATE returns a row.
//
// IMPORTANT (B35): if the original /authorize call used PKCE, the resulting
// code CANNOT be redeemed here — it can only be redeemed via /token-public
// with the matching code_verifier. This prevents a stolen code from being
// exchanged via the confidential-client path if the client_secret leaks.
router.post(
  "/oauth/quiz/token",
  async (req, res) => {
    try {
      if (!QUIZ_OAUTH_CLIENT_SECRET) {
        logger.error(
          "[oauth-quiz] /token called but QUIZ_OAUTH_CLIENT_SECRET is not configured",
        );
        res.status(500).json({ error: "oauth_not_configured" });
        return;
      }

      const { grant_type, code, redirect_uri, client_id, client_secret } =
        req.body ?? {};

      if (
        typeof code !== "string" ||
        typeof redirect_uri !== "string" ||
        typeof client_id !== "string" ||
        typeof client_secret !== "string"
      ) {
        res.status(400).json({
          error: "invalid_request",
          message:
            "code, redirect_uri, client_id, and client_secret are required.",
        });
        return;
      }

      // OAuth 2.0 protocol contract — we only support the authorization_code
      // grant on this endpoint. Reject any other grant_type explicitly so
      // clients can't accidentally drift from the spec.
      if (grant_type !== "authorization_code") {
        res.status(400).json({
          error: "unsupported_grant_type",
          message:
            "Only grant_type=authorization_code is supported on this endpoint.",
        });
        return;
      }

      if (!ALLOWED_CLIENT_IDS.has(client_id)) {
        res.status(401).json({ error: "invalid_client" });
        return;
      }

      if (!timingSafeEqualStr(client_secret, QUIZ_OAUTH_CLIENT_SECRET)) {
        logger.warn(
          { client_id, ip: req.ip },
          "[oauth-quiz] /token rejected: bad client_secret",
        );
        res.status(401).json({ error: "invalid_client" });
        return;
      }

      // Atomic single-use redemption: only the first call wins.
      // We also exclude PKCE-bound codes from this path — those MUST go
      // through /token-public so the verifier check can run.
      const updated = await db
        .update(quizOauthCodesTable)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(quizOauthCodesTable.code, code),
            isNull(quizOauthCodesTable.usedAt),
            isNull(quizOauthCodesTable.codeChallenge),
          ),
        )
        .returning();

      if (updated.length === 0) {
        // Either: code never existed, was already used (replay attempt),
        // or it was minted with PKCE and must be redeemed via /token-public.
        // Same generic 400 either way — don't leak which.
        logger.warn(
          { code: code.substring(0, 8) + "...", ip: req.ip },
          "[oauth-quiz] /token rejected: code unknown / already used / pkce-bound",
        );
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      await issueAccessTokenFromCode(updated[0]!, redirect_uri, res, req.ip);
    } catch (err) {
      logger.error({ err }, "[oauth-quiz] /token failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

// ─── POST /api/oauth/quiz/token-public ────────────────────────────────────
// PKCE-protected token exchange for browser SPAs (B35). Same response shape
// as /token but authenticated by code_verifier instead of client_secret —
// safe to call directly from the qorix-quiz frontend.
//
// Auth: caller proves possession of the original code_verifier whose
//       SHA-256 hash equals the code_challenge stored at /authorize.
//       Origin is also enforced: this endpoint is NOT in PATH_EXEMPTIONS,
//       so origin-guard requires the request to come from a CORS-allowed
//       origin (qorixplay.com / qorix-quiz.fly.dev).
//
// A code minted WITHOUT PKCE cannot be redeemed here — the WHERE clause
// requires code_challenge IS NOT NULL. That keeps the two flows isolated:
// confidential clients use /token, public SPAs use /token-public, and a
// code can only be spent via the same flow it was minted for.
router.post(
  "/oauth/quiz/token-public",
  async (req, res) => {
    try {
      const { grant_type, code, redirect_uri, client_id, code_verifier } =
        req.body ?? {};

      if (
        typeof code !== "string" ||
        typeof redirect_uri !== "string" ||
        typeof client_id !== "string" ||
        typeof code_verifier !== "string"
      ) {
        res.status(400).json({
          error: "invalid_request",
          message:
            "code, redirect_uri, client_id, and code_verifier are required.",
        });
        return;
      }

      if (grant_type !== "authorization_code") {
        res.status(400).json({
          error: "unsupported_grant_type",
          message:
            "Only grant_type=authorization_code is supported on this endpoint.",
        });
        return;
      }

      if (!ALLOWED_CLIENT_IDS.has(client_id)) {
        res.status(401).json({ error: "invalid_client" });
        return;
      }

      if (!PKCE_VERIFIER_RE.test(code_verifier)) {
        res.status(400).json({
          error: "invalid_request",
          message:
            "code_verifier must be 43..128 chars, [A-Za-z0-9-._~] only.",
        });
        return;
      }

      // Atomic single-use redemption — but ONLY for PKCE-bound codes.
      // (Confidential codes go through /token; mixing the flows would let a
      // stolen verifier-less code be redeemed without the secret.)
      const updated = await db
        .update(quizOauthCodesTable)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(quizOauthCodesTable.code, code),
            isNull(quizOauthCodesTable.usedAt),
            sql`${quizOauthCodesTable.codeChallenge} IS NOT NULL`,
          ),
        )
        .returning();

      if (updated.length === 0) {
        logger.warn(
          { code: code.substring(0, 8) + "...", ip: req.ip },
          "[oauth-quiz] /token-public rejected: code unknown / already used / not pkce",
        );
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      const row = updated[0]!;

      // Recompute SHA-256(verifier) and constant-time compare against the
      // stored challenge. RFC 7636 §4.6.
      if (row.codeChallengeMethod !== "S256" || !row.codeChallenge) {
        // Defensive — the /authorize endpoint validates this, but if a
        // future migration ever lands a code with a method we don't
        // support, fail closed.
        logger.error(
          { codeId: row.code.substring(0, 8) + "..." },
          "[oauth-quiz] /token-public rejected: unsupported pkce method on stored code",
        );
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
      const expectedChallenge = s256Challenge(code_verifier);
      if (!timingSafeEqualStr(expectedChallenge, row.codeChallenge)) {
        logger.warn(
          { codeId: row.code.substring(0, 8) + "...", ip: req.ip },
          "[oauth-quiz] /token-public rejected: pkce verifier mismatch",
        );
        res.status(400).json({
          error: "invalid_grant",
          reason: "code_verifier_mismatch",
        });
        return;
      }

      await issueAccessTokenFromCode(row, redirect_uri, res, req.ip);
    } catch (err) {
      logger.error({ err }, "[oauth-quiz] /token-public failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

export default router;
