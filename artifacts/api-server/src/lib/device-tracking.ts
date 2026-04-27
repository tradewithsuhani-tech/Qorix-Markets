import type { Request } from "express";
import { db, userDevicesTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { computeDeviceFingerprint, describeDevice } from "../middlewares/auth.js";
import { lookupGeo } from "./geo-ip.js";
import { sendNewDeviceLoginAlert } from "./email-service.js";
import { logger } from "./logger.js";

// Local copy of routes/auth.ts → getClientIp (not exported there). Reads
// X-Forwarded-For (Fly's edge sets this), falls back to socket address.
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0];
    return first?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? (req.socket as any)?.remoteAddress ?? "unknown";
}

/** Pre-extracted device info — used by paths where the caller does not hold
 *  the Request from the new device (e.g. the existing-device approval path). */
export interface DeviceInfo {
  fingerprint: string;
  ip: string | null;
  userAgent: string | null;
  browser: string;
  os: string;
}

function infoFromRequest(req: Request): DeviceInfo {
  const fingerprint = computeDeviceFingerprint(req);
  const ip = (getClientIp(req) || "").slice(0, 64) || null;
  const ua = typeof req.headers["user-agent"] === "string"
    ? (req.headers["user-agent"] as string).slice(0, 500)
    : null;
  const { browser, os } = describeDevice(req);
  return { fingerprint, ip, userAgent: ua, browser, os };
}

/**
 * Records a successful login from a device. If the (user, device) pair
 * has been seen before → just bumps last-seen IP/time. If brand-new AND
 * the user has at least one previously-known device → fires a "Login
 * from a new device detected" email (Exness/Vantage style).
 *
 * Always fire-and-forget — never throws, never blocks the caller. Safe
 * to call from request handlers without await.
 */
export function trackLoginDevice(
  user: typeof usersTable.$inferSelect,
  source: Request | DeviceInfo,
): void {
  const info = "fingerprint" in source ? source : infoFromRequest(source);
  // Fire-and-forget — but log unhandled errors so they don't disappear.
  void (async () => {
    try {
      await trackLoginDeviceImpl(user, info);
    } catch (err: any) {
      logger.error(
        { userId: user.id, err: err?.message },
        "[device-tracking] failed (silent)",
      );
    }
  })();
}

async function trackLoginDeviceImpl(
  user: typeof usersTable.$inferSelect,
  info: DeviceInfo,
): Promise<void> {
  // Admins also get tracked — useful audit trail, but no email alert
  // (they have a separate audit log).
  const { fingerprint, browser, os } = info;
  if (!fingerprint || fingerprint === "unknown") return;

  const ip = (info.ip || "").slice(0, 64);
  const ua = info.userAgent;

  const existing = await db
    .select({
      id: userDevicesTable.id,
      alertSentAt: userDevicesTable.alertSentAt,
    })
    .from(userDevicesTable)
    .where(
      and(
        eq(userDevicesTable.userId, user.id),
        eq(userDevicesTable.deviceFingerprint, fingerprint),
      ),
    )
    .limit(1);

  // Geo lookup is best-effort and slow — only do it on insert/update paths
  // that actually need it.
  if (existing.length > 0) {
    // Known device — bump last-seen and refresh geo.
    const geo = await lookupGeo(ip);
    await db
      .update(userDevicesTable)
      .set({
        lastSeenAt: new Date(),
        lastSeenIp: ip || null,
        lastCity: geo.city,
        lastCountry: geo.country,
      })
      .where(eq(userDevicesTable.id, existing[0]!.id));
    return;
  }

  // Brand-new device for this user. Insert first so we never double-alert
  // on a race (two parallel logins).
  const geo = await lookupGeo(ip);
  const inserted = await db
    .insert(userDevicesTable)
    .values({
      userId: user.id,
      deviceFingerprint: fingerprint,
      userAgent: ua,
      browserLabel: browser.slice(0, 80),
      osLabel: os.slice(0, 80),
      firstSeenIp: ip || null,
      lastSeenIp: ip || null,
      lastCity: geo.city,
      lastCountry: geo.country,
    })
    .onConflictDoNothing({
      target: [userDevicesTable.userId, userDevicesTable.deviceFingerprint],
    })
    .returning({ id: userDevicesTable.id });

  // If the conflict-do-nothing matched (race), another writer already
  // handled this device — skip the email.
  if (inserted.length === 0) return;

  // Decide whether this is the user's "first ever" device. If so, no
  // alert (they're literally signing up — alert would be confusing).
  const otherDevices = await db
    .select({ id: userDevicesTable.id })
    .from(userDevicesTable)
    .where(
      and(
        eq(userDevicesTable.userId, user.id),
        sql`${userDevicesTable.id} <> ${inserted[0]!.id}`,
      ),
    )
    .limit(1);

  if (otherDevices.length === 0) {
    // First ever device — silent.
    return;
  }

  if (!user.email) return;

  // Send the alert and stamp it so we never re-fire for this device row.
  try {
    await sendNewDeviceLoginAlert({
      to: user.email,
      name: user.fullName || user.email,
      ip: ip || "unknown",
      city: geo.city,
      country: geo.country,
      browser,
      os,
      whenUtc: new Date(),
    });
    await db
      .update(userDevicesTable)
      .set({ alertSentAt: new Date() })
      .where(eq(userDevicesTable.id, inserted[0]!.id));
  } catch (err: any) {
    logger.warn(
      { userId: user.id, err: err?.message },
      "[device-tracking] alert email failed",
    );
  }
}
