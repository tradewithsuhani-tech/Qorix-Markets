/**
 * B8.1 — Session Revoke Endpoints
 *
 * DELETE /api/auth/sessions/:id      — revoke one device session
 * DELETE /api/auth/sessions/others   — revoke all sessions except current
 *
 * After revocation, the revoked device's next authMiddleware call returns
 * 401 { error: "session_revoked" } within ≤30 s (cache TTL).
 *
 * The :id value matches the `id` field returned by GET /api/devices.
 */
import { Router } from "express";
import { db, userDevicesTable } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  authMiddleware,
  computeDeviceFingerprint,
  getParam,
  invalidateRevokedDeviceCache,
  invalidateAllRevokedDeviceCaches,
  type AuthRequest,
} from "../middlewares/auth";
import { publishRevokeDevice, publishRevokeAll } from "../lib/revoke-pubsub";

const router = Router();
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/sessions/others
// Must be registered BEFORE /:id so Express doesn't treat "others" as an id.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/auth/sessions/others", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const currentFp = computeDeviceFingerprint(req);

  try {
    // Find all non-revoked rows that are NOT the current device
    const toRevoke = await db
      .select({
        id: userDevicesTable.id,
        deviceFingerprint: userDevicesTable.deviceFingerprint,
      })
      .from(userDevicesTable)
      .where(
        and(
          eq(userDevicesTable.userId, userId),
          eq(userDevicesTable.isRevoked, false),
          // Exclude current device fingerprint (may be "unknown" if no header)
          ...(currentFp && currentFp !== "unknown"
            ? [ne(userDevicesTable.deviceFingerprint, currentFp)]
            : []),
        ),
      );

    if (toRevoke.length === 0) {
      res.status(400).json({
        success: false,
        error: "no_other_sessions",
        message: "No other active sessions to revoke",
      });
      return;
    }

    // Bulk revoke
    await db
      .update(userDevicesTable)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(
        and(
          eq(userDevicesTable.userId, userId),
          eq(userDevicesTable.isRevoked, false),
          ...(currentFp && currentFp !== "unknown"
            ? [ne(userDevicesTable.deviceFingerprint, currentFp)]
            : []),
        ),
      );

    // Invalidate all per-device caches on this instance immediately,
    // then broadcast to all other instances via Redis pub/sub (B8.1 Task #3).
    invalidateAllRevokedDeviceCaches();
    publishRevokeAll();

    res.json({
      success: true,
      message: "All other sessions revoked",
      revokedCount: toRevoke.length,
    });
  } catch (err: any) {
    console.error("DELETE /auth/sessions/others:", err?.message ?? err);
    res.status(500).json({ success: false, error: "server_error", message: "Failed to revoke sessions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/sessions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/auth/sessions/:id", async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ success: false, error: "invalid_id", message: "Invalid session id" });
    return;
  }

  const userId = req.userId!;
  const currentFp = computeDeviceFingerprint(req);

  try {
    // Fetch the device row (any revoke status so we can give the right error)
    const [device] = await db
      .select({
        userId: userDevicesTable.userId,
        deviceFingerprint: userDevicesTable.deviceFingerprint,
        isRevoked: userDevicesTable.isRevoked,
      })
      .from(userDevicesTable)
      .where(eq(userDevicesTable.id, BigInt(id)))
      .limit(1);

    if (!device || device.isRevoked) {
      res.status(404).json({
        success: false,
        error: "session_not_found",
        message: "Session not found or already revoked",
      });
      return;
    }

    if (device.userId !== userId) {
      res.status(403).json({
        success: false,
        error: "forbidden",
        message: "Not your session",
      });
      return;
    }

    // Block self-revocation — user must use local logout for current device
    if (currentFp && currentFp !== "unknown" && device.deviceFingerprint === currentFp) {
      res.status(400).json({
        success: false,
        error: "cannot_revoke_current",
        message: "Cannot revoke the current session. Use logout instead.",
      });
      return;
    }

    // Revoke
    await db
      .update(userDevicesTable)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(eq(userDevicesTable.id, BigInt(id)));

    // Immediately invalidate cache on this instance, then broadcast to all
    // other instances via Redis pub/sub for near-instant cross-instance revocation.
    invalidateRevokedDeviceCache(userId, device.deviceFingerprint);
    publishRevokeDevice(userId, device.deviceFingerprint);

    res.json({ success: true, message: "Session revoked" });
  } catch (err: any) {
    console.error(`DELETE /auth/sessions/${id}:`, err?.message ?? err);
    res.status(500).json({ success: false, error: "server_error", message: "Failed to revoke session" });
  }
});

export default router;
