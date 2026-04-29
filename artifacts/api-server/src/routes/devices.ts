import { Router } from "express";
import { db, userDevicesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  authMiddleware,
  computeDeviceFingerprint,
  type AuthRequest,
} from "../middlewares/auth";
import {
  NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS,
  formatIstTimestamp,
} from "../lib/withdraw-device-cooldown";

/**
 * Batch 8 — My Devices (read-only).
 *
 * Lists every (user, device-fingerprint) pair the user has ever
 * successfully logged in from. The write side of `user_devices`
 * is owned EXCLUSIVELY by `lib/device-tracking.ts -> trackLoginDevice`
 * (called from successful login paths in routes/auth.ts and
 * google-oauth.ts). This route is a pure SELECT — it does not
 * create, update or delete any rows.
 *
 * For each device the response includes the B7 withdrawal-cooldown
 * status (whether it's currently locked for new-device withdrawals
 * and when it unlocks), so the UI can show a single source of
 * truth without re-implementing the math.
 *
 * Per-device "sign out / revoke" is intentionally NOT in B8 — that
 * needs session-revocation infra (server-side JWT denylist or a
 * device-bound session token) which is its own batch (B8.1).
 */
const router = Router();
router.use(authMiddleware);

router.get("/devices", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // The fingerprint of the device making THIS request — used to
  // mark exactly one row in the response as `isCurrent: true`.
  // Unknown / empty fp simply means we mark nothing as current
  // (UI shows the list normally without a "this device" badge).
  const currentFp = computeDeviceFingerprint(req);
  const haveCurrentFp = !!currentFp && currentFp !== "unknown";

  const rows = await db
    .select({
      id: userDevicesTable.id,
      deviceFingerprint: userDevicesTable.deviceFingerprint,
      browserLabel: userDevicesTable.browserLabel,
      osLabel: userDevicesTable.osLabel,
      firstSeenAt: userDevicesTable.firstSeenAt,
      lastSeenAt: userDevicesTable.lastSeenAt,
      lastCity: userDevicesTable.lastCity,
      lastCountry: userDevicesTable.lastCountry,
      alertSentAt: userDevicesTable.alertSentAt,
    })
    .from(userDevicesTable)
    .where(eq(userDevicesTable.userId, userId))
    .orderBy(desc(userDevicesTable.lastSeenAt));

  const cooldownMs = NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS * 3600 * 1000;
  const now = Date.now();

  const devices = rows.map((r) => {
    const firstSeenMs = r.firstSeenAt.getTime();
    const elapsedMs = now - firstSeenMs;
    const withdrawalLocked = elapsedMs < cooldownMs;
    const unlockAt = withdrawalLocked
      ? new Date(firstSeenMs + cooldownMs)
      : null;
    // Mirror the B7 helper: floor-protected so we never display
    // "0h remaining" while still actually being locked.
    const hoursLeft = withdrawalLocked
      ? Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 3600000))
      : 0;

    return {
      id: String(r.id),
      browser: (r.browserLabel ?? "Unknown browser").slice(0, 80),
      os: (r.osLabel ?? "Unknown OS").slice(0, 80),
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      city: r.lastCity ?? null,
      country: r.lastCountry ?? null,
      isCurrent: haveCurrentFp && r.deviceFingerprint === currentFp,
      newDeviceAlertSent: r.alertSentAt !== null,
      withdrawalLocked,
      withdrawalUnlockAt: unlockAt?.toISOString() ?? null,
      withdrawalUnlockHoursLeft: hoursLeft,
      withdrawalUnlockIst: unlockAt ? formatIstTimestamp(unlockAt) : null,
    };
  });

  res.json({
    devices,
    cooldownHours: NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS,
    // True if the device making this request is in the list. False
    // means the caller is on a "ghost" session (user_devices row
    // missing — same fail-closed condition that B7 blocks
    // withdrawals on). The UI uses this to surface a "log out and
    // back in" hint.
    currentDeviceTracked: devices.some((d) => d.isCurrent),
  });
});

export default router;
