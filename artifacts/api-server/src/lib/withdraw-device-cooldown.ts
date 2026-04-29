import type { Request } from "express";
import { db, userDevicesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { computeDeviceFingerprint } from "../middlewares/auth.js";

/**
 * B7 — 24h new-device withdrawal cooldown.
 *
 * Hours a (user, device-fingerprint) pair must have been recorded in
 * `user_devices` before a withdrawal (INR or USDT) is accepted from
 * that device. Mirrors the time-to-trust window of every other
 * "freshness" lock in this codebase (NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS,
 * WITHDRAWAL_LOCK_HOURS_AFTER_PASSWORD_CHANGE) so an attacker who has
 * just got into a session from a new machine cannot drain the wallet
 * before the real owner reads the "Login from a new device detected"
 * email (which `lib/device-tracking.ts` ships on the SAME login) and
 * acts on it.
 *
 * IMPORTANT: this module is read-only against `user_devices`. The
 * write side is owned exclusively by `trackLoginDevice` in
 * `lib/device-tracking.ts`, which stamps `first_seen_at` the first
 * time this (user, fingerprint) successfully completes a login. The
 * cooldown clock therefore starts at first successful LOGIN from the
 * device, NOT at first /wallet/withdraw call from the device — which
 * is the right semantic (the real owner has had `cooldown` hours since
 * the alert email was sent).
 */
export const NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hand-rolled "DD MMM YYYY, HH:mm IST" formatter. Avoids depending on
 * Intl/icu data being present in the prod container, which historically
 * has bitten us on slim Alpine / distroless base images. IST is
 * UTC+5:30 with no DST, so a fixed offset is exact.
 */
export function formatIstTimestamp(d: Date): string {
  const istMs = d.getTime() + (5 * 60 + 30) * 60_000;
  const ist = new Date(istMs);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mon = months[ist.getUTCMonth()]!;
  const yyyy = ist.getUTCFullYear();
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm} IST`;
}

export type DeviceCooldownResult =
  | { ok: true }
  | {
      ok: false;
      status: 403;
      body: {
        error: "withdrawal_locked_new_device";
        message: string;
        hoursLeft: number;
        unlockAt: string; // ISO 8601
      };
    };

/**
 * Returns `{ ok: true }` when this request's device fingerprint has
 * been observed on this account for >= NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS.
 * Otherwise returns a 403-shaped block payload the caller can pass
 * straight to `res.status(...).json(...)`.
 *
 * Fail-closed cases:
 * - `computeDeviceFingerprint` returns an empty/unknown value
 *   (impossible in current code, defensive against future changes).
 * - No `user_devices` row exists for (user, fingerprint). This means
 *   the caller obtained an authenticated session WITHOUT going through
 *   the standard login path (e.g. a legacy session cookie issued
 *   before device-tracking shipped, or some hypothetical 2FA-only
 *   path that bypasses `trackLoginDevice`). The user is told to
 *   re-login so `trackLoginDevice` writes the row, and the cooldown
 *   then runs from that login.
 */
export async function checkWithdrawDeviceCooldown(
  req: Request,
  userId: number,
): Promise<DeviceCooldownResult> {
  const cooldownMs = NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS * HOUR_MS;
  const now = Date.now();

  const fingerprint = computeDeviceFingerprint(req);
  if (!fingerprint || fingerprint === "unknown") {
    const unlockAt = new Date(now + cooldownMs);
    return {
      ok: false,
      status: 403,
      body: {
        error: "withdrawal_locked_new_device",
        message:
          "We could not verify your device. Please log out and log in " +
          "again from this device, then try the withdrawal.",
        hoursLeft: NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS,
        unlockAt: unlockAt.toISOString(),
      },
    };
  }

  const rows = await db
    .select({ firstSeenAt: userDevicesTable.firstSeenAt })
    .from(userDevicesTable)
    .where(
      and(
        eq(userDevicesTable.userId, userId),
        eq(userDevicesTable.deviceFingerprint, fingerprint),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    const unlockAt = new Date(now + cooldownMs);
    return {
      ok: false,
      status: 403,
      body: {
        error: "withdrawal_locked_new_device",
        message:
          `Withdrawals are locked from new devices for ` +
          `${NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS}h. Please log out and ` +
          `log in again to register this device — withdrawals will then ` +
          `unlock at ${formatIstTimestamp(unlockAt)}.`,
        hoursLeft: NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS,
        unlockAt: unlockAt.toISOString(),
      },
    };
  }

  const firstSeenMs = new Date(rows[0]!.firstSeenAt).getTime();
  const ageMs = now - firstSeenMs;
  if (ageMs >= cooldownMs) {
    return { ok: true };
  }

  const unlockAt = new Date(firstSeenMs + cooldownMs);
  const hoursLeft = Math.max(1, Math.ceil((cooldownMs - ageMs) / HOUR_MS));
  return {
    ok: false,
    status: 403,
    body: {
      error: "withdrawal_locked_new_device",
      message:
        `Withdrawals are locked from new devices for ` +
        `${NEW_DEVICE_WITHDRAWAL_COOLDOWN_HOURS}h. Please try again at ` +
        `${formatIstTimestamp(unlockAt)} (${hoursLeft}h remaining).`,
      hoursLeft,
      unlockAt: unlockAt.toISOString(),
    },
  };
}
