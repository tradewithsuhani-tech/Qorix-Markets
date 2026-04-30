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

// Constant-time comparison so a side-channel timing oracle can't recover the
// client_secret one byte at a time.
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

// ─── POST /api/oauth/quiz/authorize ───────────────────────────────────────
// Mints a one-time authorization code for a logged-in Markets user.
// Called by the Markets UI (qorixmarkets.com) after the user clicks
// "Continue to Qorixplay" on the consent screen — NOT directly by qorixplay.
//
// Auth: Markets user JWT (via authMiddleware). The user MUST have an active
//       Markets session to authorize qorixplay access.
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

      const { redirect_uri, client_id, scope } = req.body ?? {};

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
      });

      logger.info(
        { userId, clientId, redirect_uri },
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

      const { code, redirect_uri, client_id, client_secret } = req.body ?? {};

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
      const updated = await db
        .update(quizOauthCodesTable)
        .set({ usedAt: sql`now()` })
        .where(
          and(
            eq(quizOauthCodesTable.code, code),
            isNull(quizOauthCodesTable.usedAt),
          ),
        )
        .returning();

      if (updated.length === 0) {
        // Either: code never existed, OR was already used (replay attempt).
        // Same generic 400 either way — don't leak which.
        logger.warn(
          { code: code.substring(0, 8) + "...", ip: req.ip },
          "[oauth-quiz] /token rejected: code unknown or already used",
        );
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      const row = updated[0]!;

      // Expiry check (separate from atomic UPDATE so we can return a
      // distinct error code). Note: we've already burned the code by
      // setting used_at — that's intentional, since an expired code
      // shouldn't ever be redeemable, even on a retry.
      if (row.expiresAt.getTime() < Date.now()) {
        logger.warn(
          { codeId: row.code.substring(0, 8) + "..." },
          "[oauth-quiz] /token rejected: code expired",
        );
        res.status(400).json({ error: "invalid_grant", reason: "expired" });
        return;
      }

      // redirect_uri must EXACTLY match what was sent at /authorize.
      // (Prevents an attacker who steals a code from redeeming it
      // against a different callback URL they control.)
      if (row.redirectUri !== redirect_uri) {
        logger.warn(
          {
            codeId: row.code.substring(0, 8) + "...",
            stored: row.redirectUri,
            sent: redirect_uri,
          },
          "[oauth-quiz] /token rejected: redirect_uri mismatch",
        );
        res
          .status(400)
          .json({ error: "invalid_grant", reason: "redirect_uri_mismatch" });
        return;
      }

      // Look up user — must still exist and not be disabled.
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

      // Issue a short-lived access_token scoped to the qorixplay client.
      // Payload includes `aud: "qorixplay"` so qorixplay's backend can
      // verify it isn't accepting a Markets-issued user token by mistake.
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
        "[oauth-quiz] /token issued access_token",
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
    } catch (err) {
      logger.error({ err }, "[oauth-quiz] /token failed");
      res.status(500).json({ error: "internal_error" });
    }
  },
);

export default router;
