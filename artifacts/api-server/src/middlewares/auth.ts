import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db, systemSettingsTable, usersTable, adminPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getMaintenanceState } from "./maintenance";
import { RedisCache } from "../lib/cache/redis-cache";
import { TTLCache } from "../lib/cache/ttl-cache";
import { getRedisConnection } from "../lib/redis";

// ─── Device fingerprint ────────────────────────────────────────────────────
// SHA-256 of the raw User-Agent header (first 32 hex chars) — stable across
// IP changes (mobile data → wifi etc.) so we don't false-positive a single
// browser as "two devices". Two genuinely different devices in the wild
// almost always have distinct UAs. The fingerprint is paired with the
// raw IP/UA in the approval popup so the user can sanity-check.
export function computeDeviceFingerprint(req: Request): string {
  const ua = (req.headers["user-agent"] ?? "") as string;
  return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 32);
}

// Best-effort browser/OS pretty labels for the approval popup. Pure
// UA-string parsing — no external library, no PII beyond what the UA
// already exposes.
export function describeDevice(req: Request): { browser: string; os: string } {
  const ua = ((req.headers["user-agent"] ?? "") as string).toLowerCase();
  let browser = "Unknown browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("chromium/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";
  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) os = "iOS";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  return { browser, os };
}

// SESSION_SECRET is the signing key for every Bearer JWT the api hands out.
// Falling back to a hardcoded value would mean anyone could forge tokens for
// any user, so in production we hard-fail at module load instead of silently
// running with the dev fallback. The dev value is only acceptable on Replit /
// localhost where NODE_ENV is "development" or unset.
const SESSION_SECRET_ENV = process.env["SESSION_SECRET"];
if (!SESSION_SECRET_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET environment variable is required in production. " +
      "Set the same value on Fly that the current Replit deployment uses, " +
      "otherwise every existing user JWT becomes invalid and everyone is logged out.",
  );
}
const JWT_SECRET = SESSION_SECRET_ENV || "qorix-markets-secret";

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
  /** "super" for super admins, "sub" for sub-admins. Populated by adminMiddleware. */
  adminRole?: "super" | "sub" | null;
  /** List of module slugs this sub-admin is allowed to access. Empty for super (super has access to all). */
  adminPermissions?: string[];
  /** Email of the authenticated admin (denormalised into audit log). */
  adminEmail?: string | null;
}

// ─── Auth-user cache (Phase 6) ─────────────────────────────────────────────
// Every authenticated request used to issue `SELECT * FROM users WHERE id=?`,
// which on Fly BOM → Neon Singapore is ~80ms of pure round-trip per request.
// Multiplied across the 5+ requests an admin page fires that's ~400ms of
// auth overhead alone. We cache the auth-relevant subset of the user row in
// Upstash for 30s, keyed by userId, and the writes that change any cached
// field call `invalidateAuthUserCache(userId)` so disable/freeze/force-logout
// take effect immediately instead of waiting for the TTL.
//
// Date columns are stored as unix-ms numbers because RedisCache uses JSON
// serialisation — Date instances would round-trip as ISO strings and silently
// break `.getTime()` consumers. Numbers are explicit and impossible to
// misuse.
//
// `null` is cacheable: a missing user row (deleted between JWT issue and the
// next request) is itself a definitive answer, no point re-querying every
// time. The TTL is short enough that re-creation within 30s is fine.
type CachedAuthUser = {
  id: number;
  isDisabled: boolean;
  isFrozen: boolean;
  isAdmin: boolean;
  isSmokeTest: boolean;
  /** unix ms; null if no force-logout cutoff is set */
  forceLogoutAfter: number | null;
  activeSessionFingerprint: string | null;
  /** unix ms; null if the user has never claimed a fingerprint */
  activeSessionLastSeen: number | null;
};

const authUserCache = new RedisCache<CachedAuthUser | null>({
  getRedis: getRedisConnection,
  namespace: "auth-user",
  ttlMs: 30_000,
  fallback: new TTLCache<CachedAuthUser | null>(30_000),
});

/**
 * Drop the cached auth user for `userId`. MUST be called after any write
 * that changes one of the fields cached above (isDisabled, isFrozen,
 * isAdmin, forceLogoutAfter, activeSessionFingerprint, activeSessionLastSeen).
 * Cheap (single Redis DEL); failures are logged inside RedisCache and do
 * not throw.
 */
export async function invalidateAuthUserCache(userId: number): Promise<void> {
  await authUserCache.invalidate(`u:${userId}`);
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean; iat?: number };
    const { value: user } = await authUserCache.getOrCompute(`u:${decoded.userId}`, async () => {
      const users = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
      const u = users[0];
      if (!u) return null;
      return {
        id: u.id,
        isDisabled: u.isDisabled,
        isFrozen: u.isFrozen,
        isAdmin: u.isAdmin,
        isSmokeTest: u.isSmokeTest,
        forceLogoutAfter: u.forceLogoutAfter?.getTime() ?? null,
        activeSessionFingerprint: u.activeSessionFingerprint,
        activeSessionLastSeen: u.activeSessionLastSeen?.getTime() ?? null,
      };
    });
    if (!user || user.isDisabled || (user.isFrozen && !user.isAdmin)) {
      res.status(401).json({ error: "Account access is restricted" });
      return;
    }
    // Hard-block path: only takes effect when an operator has explicitly set
    // `system_settings.maintenance_hard_block` alongside `maintenance_mode`.
    // Default soft maintenance only freezes writes (handled upstream in
    // maintenanceMiddleware) so reads keep working and the friendly inline
    // banner shows. We mirror the same structured 503 shape here so the
    // banner still triggers when hard-block is on; admins always bypass so
    // they can disable the toggle from the dashboard.
    const maintenance = await getMaintenanceState();
    if (maintenance.active && maintenance.hardBlock && !user.isAdmin) {
      res.setHeader("Retry-After", "60");
      res.setHeader("X-Maintenance-Mode", "true");
      if (maintenance.endsAt) {
        res.setHeader("X-Maintenance-Ends-At", maintenance.endsAt);
      }
      res.status(503).json({
        error: "maintenance",
        code: "maintenance_mode",
        maintenance: true,
        message: maintenance.message,
        endsAt: maintenance.endsAt,
      });
      return;
    }
    if (user.forceLogoutAfter && decoded.iat && decoded.iat * 1000 < user.forceLogoutAfter) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    // Single-active-device heartbeat. Only the device whose fingerprint
    // currently "owns" the account refreshes activeSessionLastSeen, so a
    // stale tab from a previously-revoked session can't keep the slot
    // warm. Debounced (>30s old) so we don't write on every API call.
    // Skipped for accounts that never claimed a fingerprint yet (NULL),
    // for the smoke-test account (CI rotates fingerprints every deploy),
    // and for admins (admin tooling can legitimately span devices).
    if (
      user.activeSessionFingerprint &&
      !user.isAdmin &&
      !user.isSmokeTest
    ) {
      const fp = computeDeviceFingerprint(req);
      if (fp === user.activeSessionFingerprint) {
        const lastSeenMs = user.activeSessionLastSeen ?? 0;
        if (Date.now() - lastSeenMs > 30_000) {
          // Fire-and-forget: never block the request on this update.
          // Also invalidate the auth-user cache so the next request picks
          // up the fresh activeSessionLastSeen rather than the 30s-stale
          // cached one. Without this the heartbeat would write but never
          // be visible to the device-fingerprint check until the cache
          // entry expired.
          void db
            .update(usersTable)
            .set({ activeSessionLastSeen: new Date() })
            .where(eq(usersTable.id, decoded.userId))
            .then(() => invalidateAuthUserCache(decoded.userId))
            .catch(() => { /* heartbeat is best-effort */ });
        }
      }
    }

    req.userId = decoded.userId;
    req.isAdmin = user.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // Hydrate adminRole + adminPermissions for downstream RBAC + audit-log
  // middleware. Cheap (single user row by PK is already cached in pg buffer
  // pool from authMiddleware), and we additionally fetch the permissions
  // row only for sub-admins.
  if (req.userId) {
    const adminRow = await db
      .select({ email: usersTable.email, adminRole: usersTable.adminRole })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1);
    const role = adminRow[0]?.adminRole;
    req.adminEmail = adminRow[0]?.email ?? null;
    // Backwards-compat: anyone past adminMiddleware already passed isAdmin.
    // Only the explicit "sub" string locks down to sub-admin RBAC; every
    // other value (legacy "admin", default "user", null, "super") is
    // treated as a super admin so legacy admins and tests don't break.
    req.adminRole = role === "sub" ? "sub" : "super";
    if (req.adminRole === "sub") {
      const permRow = await db
        .select({ modules: adminPermissionsTable.modules })
        .from(adminPermissionsTable)
        .where(eq(adminPermissionsTable.adminId, req.userId))
        .limit(1);
      req.adminPermissions = permRow[0]?.modules ?? [];
    } else {
      req.adminPermissions = [];
    }
  }
  const whitelistRows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"))
    .limit(1);
  const whitelist = whitelistRows[0]?.value
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean) ?? [];
  if (whitelist.length > 0) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.ip || "";
    const normalized = ip.replace("::ffff:", "");
    if (!whitelist.includes(ip) && !whitelist.includes(normalized)) {
      res.status(403).json({ error: "Admin IP is not allowed" });
      return;
    }
  }
  next();
}

export function signToken(userId: number, isAdmin: boolean): string {
  return jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
}

// With @types/express 5, `req.params[key]` is typed as `string | string[]`
// (see ParamsDictionary in express-serve-static-core), which forced every
// route handler to write `req.params.id as string`. Express only ever
// produces string values for matched route params (the array form is for
// wildcard routes we don't use), so this helper centralizes the narrowing
// in one place. New routes should call `getParam(req, "id")` instead of
// reaching into `req.params` directly.
export function getParam(req: Request, name: string): string {
  const raw = req.params[name];
  if (raw === undefined) {
    throw new Error(`Missing required route param: ${name}`);
  }
  // We don't use wildcard routes (`*foo`), so an array here is unexpected
  // and almost certainly a bug — fail loudly rather than silently coerce.
  if (Array.isArray(raw)) {
    throw new Error(`Unexpected array value for route param: ${name}`);
  }
  return raw;
}

// Same problem as `getParam`, but for query strings: `req.query[key]` is typed
// as `string | string[] | ParsedQs | ParsedQs[] | undefined`, so handlers
// were sprinkling `req.query["page"] as string` casts everywhere. These
// helpers centralize the narrowing + parsing for the scalar query params our
// routes actually use. Repeated keys (`?x=a&x=b`) and bracket-object syntax
// (`?x[k]=v`) aren't supported by any current route — fail loudly rather than
// silently coerce.
export function getQueryString(req: Request, name: string): string | undefined;
export function getQueryString(req: Request, name: string, defaultValue: string): string;
export function getQueryString(
  req: Request,
  name: string,
  defaultValue?: string,
): string | undefined {
  const raw = req.query[name];
  if (raw === undefined) return defaultValue;
  if (typeof raw !== "string") {
    throw new Error(`Unexpected non-string value for query param: ${name}`);
  }
  // Treat empty-string the same as missing so `?status=` falls back to the
  // default, matching how `(req.query.status as string) || "pending"` used
  // to behave.
  return raw === "" ? defaultValue : raw;
}

// Mirrors the `parseInt(req.query["X"] as string) || default` idiom that
// callers used pre-helper: missing, NaN, and zero all fall back to the
// default. Keeping that semantic avoids surprising regressions for callers
// that compute `(page - 1) * limit` etc.
export function getQueryInt(req: Request, name: string, defaultValue: number): number {
  const raw = getQueryString(req, name);
  if (raw === undefined) return defaultValue;
  const parsed = parseInt(raw, 10);
  return parsed || defaultValue;
}
