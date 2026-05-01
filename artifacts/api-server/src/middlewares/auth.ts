import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import UAParser from "ua-parser-js";
import { db, systemSettingsTable, usersTable, adminPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getMaintenanceState } from "./maintenance";
import { RedisCache } from "../lib/cache/redis-cache";
import { TTLCache } from "../lib/cache/ttl-cache";
import { getRedisConnection } from "../lib/redis";

// ─── Device fingerprint ────────────────────────────────────────────────────
//
// Two-tier strategy after Batch 3:
//
//   1. PREFERRED — `X-Device-Id` header: a UUID the PWA generates once per
//      browser and persists in localStorage. Hashed before use so a leaked
//      DB row can't be correlated back to the raw localStorage value.
//      This is stable across:
//        * IP changes (mobile data ↔ wifi ↔ tether) — fixes the major
//          false-positive "new device login" alert source.
//        * Browser version bumps that change the UA string within the
//          same session (Chrome auto-updates).
//      And changes when:
//        * User wipes site data / browses in private mode / switches
//          browsers — all of which are correctly NEW devices from a
//          security perspective (no continuity with prior sessions).
//
//   2. FALLBACK — `hash(User-Agent)`: kept exactly identical to the pre-
//      Batch-3 algorithm so existing rows in `user_devices` continue to
//      match their owning browser. Old PWA installs that haven't shipped
//      the new client code yet keep working unchanged. New rows for
//      hint-aware browsers will use the (different) X-Device-Id-derived
//      fingerprint and one-time generate a "new device" alert — that's
//      the expected migration cost and it improves accuracy permanently.
//
// The fingerprint is paired with the raw IP/UA in the approval popup so
// the user can sanity-check what they're approving.

/**
 * Permissive UUID-shape check (any RFC 4122 version 1-8 — current spec
 * defines 1-5 plus the draft 6/7/8). Tighter than `[1-9a-f]` because
 * version nibbles 9 / a-f are not assigned and a value with one of those
 * is more likely a tampered or junk header than a future UUID variant
 * — and if a v9 ever ships, this regex is a one-character update.
 */
const UUID_SHAPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reads and validates the `X-Device-Id` request header sent by the PWA.
 * Returns the canonical (lowercased) UUID when valid, `null` when the
 * header is absent, malformed, or otherwise untrustworthy.
 *
 * Validation matters because the value is hashed into a fingerprint that
 * gates the security UI ("is this device known?"). A tampered or junk
 * value would create a phantom "device" in the user's Account Security
 * list every time the attacker varies the header. Requiring UUID shape
 * keeps the fingerprint space bounded to actual PWA-generated IDs.
 */
export function parseClientDeviceId(req: Request): string | null {
  const raw = req.headers["x-device-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  if (!UUID_SHAPE_RE.test(value)) return null;
  return value.toLowerCase();
}

export function computeDeviceFingerprint(req: Request): string {
  const clientId = parseClientDeviceId(req);
  if (clientId) {
    // The "v2:" prefix namespaces the hash so it cannot collide with the
    // legacy hash(UA) fingerprint space. (A real UA string starting with
    // literally "v2:" followed by a UUID is implausible, but explicit
    // namespacing also documents the intent for any future migration.)
    return crypto.createHash("sha256").update(`v2:${clientId}`).digest("hex").slice(0, 32);
  }
  const ua = (req.headers["user-agent"] ?? "") as string;
  return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 32);
}

/**
 * Rich device description parsed from the User-Agent header via ua-parser-js.
 *
 * `browser` and `os` are pretty single-line labels safe to show in approval
 * popups, alert emails and the admin LoginEvents drawer (e.g.
 * "Chrome 120" / "Android 14"). The lower-level fields below are kept
 * separate so callers that need exact device intel — login_events row
 * enrichment, the user-facing Account Security panel, fraud heuristics —
 * can use them without re-parsing the UA.
 *
 * IMPORTANT: ua-parser-js v1.x is the last MIT-licensed release. v2.x is
 * AGPL-3.0 which would force open-sourcing the api-server. Pin to ^1.0.40.
 */
export interface DeviceDescription {
  /** Pretty single-line label, e.g. "Chrome 120" or "Safari 17". */
  browser: string;
  /** Pretty single-line label, e.g. "Android 14" or "macOS 14.4". */
  os: string;
  /** "mobile" | "tablet" | "desktop" | "smarttv" | "wearable" | "embedded" | "unknown" */
  deviceType: string;
  /** Device model code from UA, e.g. "SM-S918B" (Samsung Galaxy S23 Ultra) or "iPhone15,3". */
  deviceModel: string | null;
  /** Vendor, e.g. "Samsung", "Apple", "Xiaomi". */
  deviceVendor: string | null;
  browserName: string | null;
  /** Full version, e.g. "120.0.0.0" (callers can extract major themselves). */
  browserVersion: string | null;
  /** Engine + major version, e.g. "Blink 120" or "WebKit 605". */
  browserEngine: string | null;
  osName: string | null;
  osVersion: string | null;
  /** "amd64" | "arm64" | etc. — only populated when UA exposes it. */
  cpuArchitecture: string | null;
}

/**
 * Models reported by ua-parser-js that aren't real device identifiers and
 * would render as misleading badges in the admin Account Security drawer:
 *
 * - "K" — Chrome 110+ on Android freezes the UA to "Linux; Android 10; K"
 *   under the UA Reduction policy. The literal letter K is a placeholder,
 *   not a model. The real model only arrives via the `Sec-CH-UA-Model`
 *   client hint (handled below).
 * - "Macintosh" — every Mac UA is "Macintosh; Intel Mac OS X 10_15_7"
 *   regardless of the actual hardware. ua-parser-js surfaces "Macintosh"
 *   as the model, which is just the platform name and tells you nothing.
 *   Apple deliberately doesn't expose Mac models on any browser, so no
 *   hint will ever fix this — surface as null and rely on the OS / browser
 *   labels for identification.
 *
 * "iPhone" / "iPad" are intentionally NOT filtered: they distinguish
 * Apple mobile form factors and are a useful signal even without the
 * specific generation.
 */
const PLACEHOLDER_DEVICE_MODELS = new Set([
  "K",
  "Macintosh",
]);

function cleanModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const trimmed = model.trim();
  if (trimmed.length === 0) return null;
  if (PLACEHOLDER_DEVICE_MODELS.has(trimmed)) return null;
  return trimmed;
}

/**
 * Full parsed device intel from the request's User-Agent header. Pure
 * function over the UA string — no external service calls, no PII beyond
 * what the UA already exposes, safe to call on the hot login path.
 *
 * Notes on UA limitations (deliberate, not bugs):
 * - Modern Chrome on Android with UA Reduction sends "Linux; Android 10; K"
 *   — model from UA alone is the placeholder "K", filtered to null here.
 *   The real model arrives via `Sec-CH-UA-Model`, merged in
 *   `describeDeviceFull(req)` below once the browser sends the hint.
 * - Mac never exposes hardware model on any browser (Apple privacy stance);
 *   "Macintosh" is filtered to null and the card relies on OS / browser
 *   labels.
 * - Safari on iOS does NOT support UA Client Hints — those clients keep
 *   exposing only what the (unchanged) UA string reveals.
 * - Windows 11 still reports as "Windows NT 10.0" in the UA;
 *   `Sec-CH-UA-Platform-Version` distinguishes 10 vs 11.
 */
/**
 * Extracts a 3-tuple of integers (major, minor, patch) from the first version
 * number in a label like `"Android 14.4.1"` → `[14, 4, 1]`. Returns `null`
 * when the label has no version digits (e.g. pre-Batch-1 generic `"Mac"` or
 * `"Chrome"`). Used by `pickRicherLabel` to do a real numeric comparison
 * instead of a fragile string-length heuristic.
 */
function extractVersionTuple(s: string): [number, number, number] | null {
  const m = s.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [
    Number.parseInt(m[1] ?? "0", 10),
    Number.parseInt(m[2] ?? "0", 10),
    Number.parseInt(m[3] ?? "0", 10),
  ];
}

/**
 * Picks the richer of two label candidates (stored vs freshly re-parsed).
 *
 * Lazy-refresh paths in admin routes re-parse the stored UA on every read
 * to upgrade pre-Batch-1 generic labels (`"Mac"` / `"Chrome"`) into rich
 * ones (`"Mac OS 10.15.7"` / `"Chrome 147"`). But after Batch 2 the stored
 * label may itself be hint-derived and represent a NEWER OS version than
 * the UA-only re-parse, even though the UA-derived string is sometimes
 * lexically longer. Examples:
 *
 *   stored "Android 14.4.1"  vs  fresh "Android 10"        → stored wins
 *   stored "Mac OS 14.4.1"   vs  fresh "Mac OS 10.15.7"    → stored wins
 *                                  ^^^^^^^^^^^^^^^^^^ frozen Apple sentinel
 *   stored "Mac"             vs  fresh "Mac OS 10.15.7"    → fresh wins
 *   stored "Chrome"          vs  fresh "Chrome 147"        → fresh wins
 *
 * Strategy: when both sides have a version number, the higher major.minor.patch
 * wins (a real semver-style compare — string length is unreliable because
 * "10.15.7" is longer than "14.4.1"). When only one side has a version (or
 * versions tie), the longer string wins as a fall-back so generic stored
 * labels get upgraded by the re-parse. Ties go to `stored` for stability
 * (avoids visible jitter from parser micro-bumps between deploys).
 */
export function pickRicherLabel(
  stored: string | null | undefined,
  fresh: string | null | undefined,
): string | null {
  if (!stored) return fresh ?? null;
  if (!fresh) return stored;
  const sV = extractVersionTuple(stored);
  const fV = extractVersionTuple(fresh);
  if (sV && fV) {
    for (let i = 0; i < 3; i++) {
      if (sV[i]! !== fV[i]!) return sV[i]! > fV[i]! ? stored : fresh;
    }
  }
  return fresh.length > stored.length ? fresh : stored;
}

/**
 * Pure UA-string parser. Used both by request-shaped callers
 * (`describeDeviceFull(req)`) and by the lazy-refresh paths in admin
 * routes that re-parse stored `user_agent` columns from the DB so
 * historical rows show the latest, richest labels without any DB writes.
 *
 * Note: this path has no access to Client Hints (the stored row is just
 * the UA string), so it represents the floor of what we can know about
 * a device. `describeDeviceFull(req)` layers hints on top when available.
 */
export function describeDeviceFromUserAgent(
  ua: string | null | undefined,
): DeviceDescription {
  const result = new UAParser(ua ?? "").getResult();

  const browserName = result.browser.name ?? null;
  const browserVersion = result.browser.version ?? null;
  const browserMajor = browserVersion ? browserVersion.split(".")[0] ?? null : null;
  const browserLabel = browserName
    ? browserMajor
      ? `${browserName} ${browserMajor}`
      : browserName
    : "Unknown browser";

  const osName = result.os.name ?? null;
  const osVersion = result.os.version ?? null;
  const osLabel = osName
    ? osVersion
      ? `${osName} ${osVersion}`
      : osName
    : "Unknown OS";

  const engineName = result.engine.name ?? null;
  const engineVersion = result.engine.version ?? null;
  const engineMajor = engineVersion ? engineVersion.split(".")[0] ?? null : null;
  const browserEngine = engineName
    ? engineMajor
      ? `${engineName} ${engineMajor}`
      : engineName
    : null;

  // ua-parser-js leaves device.type undefined for desktops. Infer from OS
  // when missing so downstream filters always have a usable bucket.
  // Note: ua-parser-js v1.x labels macOS as "Mac OS" (not "macOS") and may
  // also report "Chromium OS" / "Chrome OS" — match all desktop variants
  // case-insensitively to avoid silent "unknown" classifications.
  const desktopOsNames = new Set([
    "windows", "mac os", "macos", "linux", "chromium os", "chrome os", "ubuntu", "debian", "fedora",
  ]);
  const mobileOsNames = new Set(["android", "ios"]);
  const osNameLower = osName?.toLowerCase() ?? null;
  const inferredType = result.device.type
    ? result.device.type
    : osNameLower && mobileOsNames.has(osNameLower)
      ? "mobile"
      : osNameLower && desktopOsNames.has(osNameLower)
        ? "desktop"
        : "unknown";

  return {
    browser: browserLabel,
    os: osLabel,
    deviceType: inferredType,
    deviceModel: cleanModel(result.device.model),
    deviceVendor: result.device.vendor ?? null,
    browserName,
    browserVersion,
    browserEngine,
    osName,
    osVersion,
    cpuArchitecture: result.cpu.architecture ?? null,
  };
}

// ─── Client Hints parsing ────────────────────────────────────────────────
// `Sec-CH-UA-*` header values are wrapped in double quotes per RFC 8941
// structured-headers (e.g. `Sec-CH-UA-Model: "Pixel 7"`). Booleans use
// `?1` / `?0`. Empty strings should be treated as "not provided" — Chrome
// sometimes sends `""` for high-entropy hints when the page hasn't yet
// promised to handle them.

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseStructuredString(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Strip surrounding double quotes if present — RFC 8941 structured
  // header strings are quoted. Some intermediaries strip them, so accept
  // both forms.
  const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
    ? trimmed.slice(1, -1)
    : trimmed;
  return unquoted.length === 0 ? null : unquoted;
}

interface ClientHints {
  /** Real device model ("Pixel 7", "SM-S918B"). Android Chrome only — Safari doesn't ship hints. */
  model: string | null;
  /** OS family per the browser ("Android", "macOS", "Windows"). */
  platform: string | null;
  /** OS version with patch level ("14.4.1") — distinguishes Win 10 vs 11. */
  platformVersion: string | null;
  /** True if the browser self-identifies as mobile, per `Sec-CH-UA-Mobile: ?1`. */
  isMobile: boolean | null;
}

/**
 * Read the four high-entropy UA Client Hints we ask for in `Accept-CH`
 * (set globally in app.ts). All return null if the browser didn't ship
 * the hint, including the common case of Safari/iOS which never sends
 * any UA-CH headers.
 */
export function parseClientHints(req: Request): ClientHints {
  const mobileRaw = getHeader(req, "sec-ch-ua-mobile");
  const isMobile = mobileRaw === "?1" ? true : mobileRaw === "?0" ? false : null;
  return {
    model: parseStructuredString(getHeader(req, "sec-ch-ua-model")),
    platform: parseStructuredString(getHeader(req, "sec-ch-ua-platform")),
    platformVersion: parseStructuredString(getHeader(req, "sec-ch-ua-platform-version")),
    isMobile,
  };
}

/**
 * Like `describeDeviceFromUserAgent` but layers UA Client Hints on top.
 * Hints are a strictly more accurate signal than the (frequently frozen)
 * UA string, so they win where present:
 *
 * - `Sec-CH-UA-Model` → overrides `deviceModel` (this is the whole point —
 *   it's what surfaces "Pixel 7" instead of the UA Reduction "K"
 *   placeholder on modern Chrome for Android).
 * - `Sec-CH-UA-Platform-Version` → overrides `osVersion` and rebuilds
 *   `os` label so the card shows e.g. "Android 14.4.1" or "Windows 11".
 * - `Sec-CH-UA-Mobile` → corrects `deviceType` if the UA-derived bucket
 *   contradicts the browser's own self-classification.
 *
 * Stored UA-only paths (admin lazy-refresh in routes/fraud.ts) keep
 * calling `describeDeviceFromUserAgent` because they don't have access
 * to the hints from the original request.
 */
export function describeDeviceFull(req: Request): DeviceDescription {
  const ua = (req.headers["user-agent"] ?? "") as string;
  const base = describeDeviceFromUserAgent(ua);
  const hints = parseClientHints(req);

  const deviceModel = cleanModel(hints.model) ?? base.deviceModel;
  const osVersion = hints.platformVersion ?? base.osVersion;
  // Reuse base.osName — UA-CH `Sec-CH-UA-Platform` is "Android" / "macOS"
  // / "Windows" which is essentially what UAParser already gives us. No
  // value in overriding the family name; just refresh the label so the
  // more precise platform-version flows into it.
  const osLabel = base.osName
    ? osVersion
      ? `${base.osName} ${osVersion}`
      : base.osName
    : "Unknown OS";

  // If hints contradict the inferred type (e.g. iPad Safari with "Request
  // Desktop Site" sends a Mac UA but `Sec-CH-UA-Mobile: ?1`), trust the
  // hint — the browser knows its own form factor better than UA regex.
  let deviceType = base.deviceType;
  if (hints.isMobile === true && deviceType === "desktop") deviceType = "mobile";
  if (hints.isMobile === false && deviceType === "mobile") deviceType = "desktop";

  return {
    ...base,
    deviceModel,
    osVersion,
    os: osLabel,
    deviceType,
  };
}

/**
 * Backwards-compatible thin wrapper. Returns just the pretty
 * `{ browser, os }` labels expected by existing callers
 * (device-tracking, routes/auth.ts approval popup, alert emails).
 *
 * Labels are now richer than the old hand-rolled regex: e.g. "Chrome 120"
 * instead of "Chrome", "Android 14" instead of "Android". Callers who
 * need exact device model / OS version / engine should call
 * describeDeviceFull() instead.
 */
export function describeDevice(req: Request): { browser: string; os: string } {
  const full = describeDeviceFull(req);
  return { browser: full.browser, os: full.os };
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean; iat?: number; aud?: string };
    // B35-fix: explicitly reject any token issued for an external audience
    // (currently only Qorixplay). Markets session tokens have no `aud` claim;
    // qorixplay-issued tokens carry `aud: "qorixplay"`. Without this check a
    // qorixplay access_token (signed with the same SESSION_SECRET) would
    // pass jwt.verify and authenticate against any Markets API route — a
    // privilege escalation across audience boundaries.
    if (decoded.aud && decoded.aud !== "markets") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
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
