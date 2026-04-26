import { Router } from "express";
import { db, usersTable, fraudFlagsTable, loginEventsTable } from "@workspace/db";
import { eq, and, desc, count, ne, gte, inArray } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, getQueryInt, getQueryString, type AuthRequest } from "../middlewares/auth";
import { getFraudStats } from "../lib/fraud-service";
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
// GET /admin/fraud/users/:userId/events — login history for a user
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

    res.json(
      events.map((e) => ({
        id: e.id,
        userId: e.userId,
        ipAddress: e.ipAddress,
        deviceFingerprint: e.deviceFingerprint,
        eventType: e.eventType,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    errorLogger.error({ err }, "fraud: failed to get user events");
    res.status(500).json({ error: "Failed to get login events" });
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
