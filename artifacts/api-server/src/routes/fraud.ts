import { Router } from "express";
import { db, usersTable, fraudFlagsTable, loginEventsTable, userDevicesTable } from "@workspace/db";
import { eq, and, desc, count, ne, gte, inArray } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, getQueryInt, getQueryString, describeDeviceFromUserAgent, pickRicherLabel, type AuthRequest } from "../middlewares/auth";
import { getFraudStats } from "../lib/fraud-service";
import { lookupGeoFull, type GeoFullResult } from "../lib/geo-ip";
import { errorLogger } from "../lib/logger";

const router = Router();
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

// ---------------------------------------------------------------------------
// GET /admin/fraud/stats
// ---------------------------------------------------------------------------
router.get("/admin/fraud/stats", async (_req, res) => {
  try {
    const stats = await getFraudStats();
    res.json(stats);
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to get stats");
    res.status(500).json({ error: "Failed to get fraud stats" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fraud/flags?resolved=false&severity=high&page=1
// ---------------------------------------------------------------------------
router.get("/admin/fraud/flags", async (req, res) => {
  try {
    const page = getQueryInt(req, "page", 1);
    const limit = Math.min(getQueryInt(req, "limit", 25), 100);
    const offset = (page - 1) * limit;
    const resolvedParam = getQueryString(req, "resolved");
    const severityParam = getQueryString(req, "severity");

    const flags = await db
      .select()
      .from(fraudFlagsTable)
      .where(
        resolvedParam === "true"
          ? undefined
          : resolvedParam === "false"
          ? eq(fraudFlagsTable.isResolved, false)
          : undefined,
      )
      .orderBy(desc(fraudFlagsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const filteredFlags = severityParam
      ? flags.filter((f) => f.severity === severityParam)
      : flags;

    // Enrich with user info
    const userIds = [...new Set(filteredFlags.map((f) => f.userId))];
    const users =
      userIds.length > 0
        ? await db
            .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds))
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = filteredFlags.map((f) => {
      const user = userMap.get(f.userId);
      let parsedDetails: Record<string, unknown> = {};
      try {
        parsedDetails = JSON.parse(f.details);
      } catch {}
      return {
        id: f.id,
        userId: f.userId,
        userEmail: user?.email ?? "",
        userFullName: user?.fullName ?? "",
        flagType: f.flagType,
        severity: f.severity,
        details: parsedDetails,
        isResolved: f.isResolved,
        resolvedAt: f.resolvedAt?.toISOString() ?? null,
        resolvedNote: f.resolvedNote ?? null,
        createdAt: f.createdAt.toISOString(),
      };
    });

    const [totalResult] = await db.select({ cnt: count() }).from(fraudFlagsTable);
    res.json({
      data: result,
      total: Number(totalResult?.cnt ?? 0),
      page,
      totalPages: Math.ceil(Number(totalResult?.cnt ?? 0) / limit),
    });
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to list flags");
    res.status(500).json({ error: "Failed to list fraud flags" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fraud/flags/:id/resolve
// ---------------------------------------------------------------------------
router.post("/admin/fraud/flags/:id/resolve", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(getParam(req, "id"));
    const note = (req.body as { note?: string }).note ?? "";

    const [updated] = await db
      .update(fraudFlagsTable)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedNote: note })
      .where(eq(fraudFlagsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Flag not found" });
      return;
    }

    res.json({ id: updated.id, isResolved: true, resolvedAt: updated.resolvedAt?.toISOString() });
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to resolve flag");
    res.status(500).json({ error: "Failed to resolve flag" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fraud/flags/:id/reopen
// ---------------------------------------------------------------------------
router.post("/admin/fraud/flags/:id/reopen", async (_req: AuthRequest, res) => {
  try {
    const id = parseInt(getParam(_req, "id"));

    const [updated] = await db
      .update(fraudFlagsTable)
      .set({ isResolved: false, resolvedAt: null, resolvedNote: null })
      .where(eq(fraudFlagsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Flag not found" });
      return;
    }

    res.json({ id: updated.id, isResolved: false });
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to reopen flag");
    res.status(500).json({ error: "Failed to reopen flag" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fraud/users/:userId/events — login history for a user, enriched
// with browser/os labels and city/country (looked up via the matched
// user_devices row by fingerprint, no extra geo API hits).
// ---------------------------------------------------------------------------
router.get("/admin/fraud/users/:userId/events", async (req, res) => {
  try {
    const userId = parseInt(getParam(req, "userId"));
    const events = await db
      .select()
      .from(loginEventsTable)
      .where(eq(loginEventsTable.userId, userId))
      .orderBy(desc(loginEventsTable.createdAt))
      .limit(50);

    // Pull all known devices for this user once, then index by fingerprint.
    // Most events will match an existing device row (since the same fingerprint
    // is used for both tables). This avoids a per-event lookup or geo call.
    const devices = await db
      .select({
        deviceFingerprint: userDevicesTable.deviceFingerprint,
        browserLabel: userDevicesTable.browserLabel,
        osLabel: userDevicesTable.osLabel,
        lastCity: userDevicesTable.lastCity,
        lastCountry: userDevicesTable.lastCountry,
      })
      .from(userDevicesTable)
      .where(eq(userDevicesTable.userId, userId));
    const byFp = new Map(devices.map((d) => [d.deviceFingerprint, d]));

    res.json(
      events.map((e) => {
        const dev = e.deviceFingerprint ? byFp.get(e.deviceFingerprint) : undefined;
        // Lazy refresh: re-parse the event's stored UA at response time using
        // the latest ua-parser-js. Stored labels from `user_devices` may be
        // stale (older parser version); re-parsing gives every historical row
        // the richest current labels with zero DB writes. We `pickRicherLabel`
        // between stored and re-parsed because Batch-2 hint-enabled writes can
        // store more precise versions ("Android 14.4.1") than the UA re-parse
        // ("Android 10") would yield from the frozen UA-Reduction string —
        // always preferring `fresh` would silently downgrade those values.
        const fresh = e.userAgent ? describeDeviceFromUserAgent(e.userAgent) : null;
        return {
          id: e.id,
          userId: e.userId,
          ipAddress: e.ipAddress,
          deviceFingerprint: e.deviceFingerprint,
          eventType: e.eventType,
          userAgent: e.userAgent,
          browserLabel: pickRicherLabel(dev?.browserLabel, fresh?.browser),
          osLabel: pickRicherLabel(dev?.osLabel, fresh?.os),
          deviceType: fresh?.deviceType ?? null,
          deviceModel: fresh?.deviceModel ?? null,
          deviceVendor: fresh?.deviceVendor ?? null,
          browserVersion: fresh?.browserVersion ?? null,
          browserEngine: fresh?.browserEngine ?? null,
          osVersion: fresh?.osVersion ?? null,
          city: dev?.lastCity ?? null,
          country: dev?.lastCountry ?? null,
          createdAt: e.createdAt.toISOString(),
        };
      }),
    );
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to get user events");
    res.status(500).json({ error: "Failed to get login events" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fraud/users/:userId/devices — every device this user has ever
// successfully logged in from, with VPN / proxy / hosting (datacenter / bot)
// intelligence on the last-seen IP. The geo lookup hits the free ip-api.com
// endpoint with a per-IP cache, so repeat views of the same user are cheap.
// ---------------------------------------------------------------------------
router.get("/admin/fraud/users/:userId/devices", async (req, res) => {
  try {
    const userId = parseInt(getParam(req, "userId"));
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: "invalid_user_id" });
      return;
    }

    const devices = await db
      .select({
        id: userDevicesTable.id,
        deviceFingerprint: userDevicesTable.deviceFingerprint,
        userAgent: userDevicesTable.userAgent,
        browserLabel: userDevicesTable.browserLabel,
        osLabel: userDevicesTable.osLabel,
        firstSeenIp: userDevicesTable.firstSeenIp,
        firstSeenAt: userDevicesTable.firstSeenAt,
        lastSeenIp: userDevicesTable.lastSeenIp,
        lastSeenAt: userDevicesTable.lastSeenAt,
        lastCity: userDevicesTable.lastCity,
        lastCountry: userDevicesTable.lastCountry,
        alertSentAt: userDevicesTable.alertSentAt,
      })
      .from(userDevicesTable)
      .where(eq(userDevicesTable.userId, userId))
      .orderBy(desc(userDevicesTable.lastSeenAt))
      .limit(50);

    // Resolve unique IPs in parallel (cached, so re-views are essentially
    // free). Bound concurrency by deduping at the IP level.
    const uniqueIps = Array.from(
      new Set(devices.map((d) => d.lastSeenIp).filter((ip): ip is string => !!ip)),
    );
    const ipIntel = new Map<string, GeoFullResult>();
    await Promise.all(
      uniqueIps.map(async (ip) => {
        const intel = await lookupGeoFull(ip);
        ipIntel.set(ip, intel);
      }),
    );

    res.json(
      devices.map((d) => {
        const intel = d.lastSeenIp ? ipIntel.get(d.lastSeenIp) ?? null : null;
        // Lazy refresh: re-parse the stored UA at response time using the
        // latest ua-parser-js. Older rows were inserted with the regex parser
        // (only "Chrome" / "Android"); re-parsing now produces "Chrome 121"
        // / "Android 14" plus model/vendor/version — all retroactively, with
        // zero DB writes and no backfill migration needed. We `pickRicherLabel`
        // between stored and re-parsed because Batch-2 hint-enabled writes can
        // store more precise versions ("Android 14.4.1") than the UA re-parse
        // ("Android 10") would yield from the frozen UA-Reduction string —
        // always preferring `fresh` would silently downgrade those values.
        const fresh = d.userAgent ? describeDeviceFromUserAgent(d.userAgent) : null;
        return {
          id: String(d.id),
          deviceFingerprint: d.deviceFingerprint,
          userAgent: d.userAgent,
          browserLabel: pickRicherLabel(d.browserLabel, fresh?.browser),
          osLabel: pickRicherLabel(d.osLabel, fresh?.os),
          deviceType: fresh?.deviceType ?? null,
          deviceModel: fresh?.deviceModel ?? null,
          deviceVendor: fresh?.deviceVendor ?? null,
          browserVersion: fresh?.browserVersion ?? null,
          browserEngine: fresh?.browserEngine ?? null,
          osVersion: fresh?.osVersion ?? null,
          firstSeenIp: d.firstSeenIp,
          firstSeenAt: d.firstSeenAt.toISOString(),
          lastSeenIp: d.lastSeenIp,
          lastSeenAt: d.lastSeenAt.toISOString(),
          lastCity: d.lastCity,
          lastCountry: d.lastCountry,
          alertSentAt: d.alertSentAt?.toISOString() ?? null,
          // VPN / proxy / hosting / mobile + ISP / ASN, from ip-api.com.
          ipIntel: intel
            ? {
                isProxy: intel.isProxy,
                isHosting: intel.isHosting,
                isMobile: intel.isMobile,
                suspicious: intel.suspicious,
                isp: intel.isp,
                org: intel.org,
                asn: intel.asn,
                region: intel.region,
                country: intel.country,
                city: intel.city,
              }
            : null,
        };
      }),
    );
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to get user devices");
    res.status(500).json({ error: "Failed to get user devices" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fraud/flagged-users — users with unresolved flags summary
// ---------------------------------------------------------------------------
router.get("/admin/fraud/flagged-users", async (_req, res) => {
  try {
    const flaggedRows = await db
      .select({
        userId: fraudFlagsTable.userId,
        flagCount: count(),
      })
      .from(fraudFlagsTable)
      .where(eq(fraudFlagsTable.isResolved, false))
      .groupBy(fraudFlagsTable.userId)
      .orderBy(desc(count()))
      .limit(20);

    const userIds = flaggedRows.map((r) => r.userId);
    if (userIds.length === 0) {
      res.json([]);
      return;
    }

    const users = await db
      .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get max severity per user
    const severityRows = await db
      .select({ userId: fraudFlagsTable.userId, severity: fraudFlagsTable.severity })
      .from(fraudFlagsTable)
      .where(and(eq(fraudFlagsTable.isResolved, false), inArray(fraudFlagsTable.userId, userIds)));

    const severityMap = new Map<number, string>();
    const order = { high: 3, medium: 2, low: 1 };
    for (const row of severityRows) {
      const current = severityMap.get(row.userId);
      const currentOrder = current ? (order[current as keyof typeof order] ?? 0) : 0;
      if ((order[row.severity as keyof typeof order] ?? 0) > currentOrder) {
        severityMap.set(row.userId, row.severity);
      }
    }

    // Get flag types per user
    const typeRows = await db
      .select({ userId: fraudFlagsTable.userId, flagType: fraudFlagsTable.flagType })
      .from(fraudFlagsTable)
      .where(and(eq(fraudFlagsTable.isResolved, false), inArray(fraudFlagsTable.userId, userIds)));

    const typeMap = new Map<number, Set<string>>();
    for (const row of typeRows) {
      if (!typeMap.has(row.userId)) typeMap.set(row.userId, new Set());
      typeMap.get(row.userId)!.add(row.flagType);
    }

    const result = flaggedRows.map((r) => {
      const user = userMap.get(r.userId);
      return {
        userId: r.userId,
        email: user?.email ?? "",
        fullName: user?.fullName ?? "",
        flagCount: Number(r.flagCount),
        maxSeverity: severityMap.get(r.userId) ?? "low",
        flagTypes: Array.from(typeMap.get(r.userId) ?? []),
        memberSince: user?.createdAt.toISOString() ?? "",
      };
    });

    res.json(result);
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to get flagged users");
    res.status(500).json({ error: "Failed to get flagged users" });
  }
});

export default router;
