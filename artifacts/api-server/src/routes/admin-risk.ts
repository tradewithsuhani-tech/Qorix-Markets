/**
 * routes/admin-risk.ts — Admin-only risk intelligence endpoints
 *
 * All routes require JWT + isAdmin. No user-facing exposure.
 *
 * GET  /admin/risk/score/:userId          — full risk report for one user
 * GET  /admin/risk/dashboard              — high-risk user list + summary
 * GET  /admin/risk/batch                  — ?userIds=1,2,3 batch reports
 * GET  /admin/metrics/latency             — per-route p50/p95/p99 from in-memory histogram
 */

import { Router } from "express";
import { authMiddleware, adminMiddleware, getParam, getQueryInt, type AuthRequest } from "../middlewares/auth";
import { computeRiskScore, computeBatchRiskScores, getHighRiskUserIds } from "../lib/risk-engine";
import { getAllLatencyStats } from "../lib/monitoring";
import { logger } from "../lib/logger";

const router = Router();

router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

// ---------------------------------------------------------------------------
// GET /admin/risk/score/:userId
// Full risk report for a single user. Computed on-demand (not cached) so it
// always reflects the latest signals. Typically < 200ms.
// ---------------------------------------------------------------------------
router.get("/admin/risk/score/:userId", async (req: AuthRequest, res) => {
  const userId = getParam(req, "userId");
  if (!userId || isNaN(Number(userId))) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  try {
    const report = await computeRiskScore(Number(userId));
    res.json(report);
  } catch (err) {
    logger.error({ err, userId }, "admin-risk: score computation failed");
    res.status(500).json({ error: "Failed to compute risk score" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/risk/dashboard
// High-risk user list. Returns up to `limit` users who have unresolved fraud
// flags, with a full risk score computed for each. Use sparingly on large
// datasets — batch computation runs CONCURRENCY=10 at a time.
//
// Query params:
//   severity=high|medium|any  (default: high)
//   minFlags=1                 (default: 1)
//   limit=50                   (default: 20, max: 50)
//   computeScores=true|false   (default: false — just return flag counts)
// ---------------------------------------------------------------------------
router.get("/admin/risk/dashboard", async (req: AuthRequest, res) => {
  try {
    const severity = (req.query["severity"] as string) || "high";
    if (!["high", "medium", "any"].includes(severity)) {
      res.status(400).json({ error: "severity must be high, medium, or any" });
      return;
    }
    const minFlags = getQueryInt(req, "minFlags", 1);
    const limit = Math.min(getQueryInt(req, "limit", 20), 50);
    const computeScores = req.query["computeScores"] === "true";

    const highRiskUsers = await getHighRiskUserIds(
      minFlags,
      severity as "high" | "medium" | "any",
      limit,
    );

    if (!computeScores) {
      res.json({
        users: highRiskUsers,
        total: highRiskUsers.length,
        computedAt: new Date().toISOString(),
        note: "Set computeScores=true to get full risk reports (slower)",
      });
      return;
    }

    const userIds = highRiskUsers.map((u) => u.userId);
    const reports = await computeBatchRiskScores(userIds);

    // Merge flag count info into reports
    const merged = reports.map((r) => {
      const meta = highRiskUsers.find((u) => u.userId === r.userId);
      return { ...r, unresolvedFlagCount: meta?.flagCount ?? 0, hasCriticalFlag: meta?.hasCriticalFlag ?? false };
    });

    // Sort by score descending
    merged.sort((a, b) => b.score - a.score);

    const summary = {
      critical: merged.filter((r) => r.tier === "critical").length,
      high: merged.filter((r) => r.tier === "high").length,
      medium: merged.filter((r) => r.tier === "medium").length,
      low: merged.filter((r) => r.tier === "low").length,
    };

    res.json({
      summary,
      users: merged,
      total: merged.length,
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "admin-risk: dashboard failed");
    res.status(500).json({ error: "Failed to load risk dashboard" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/risk/batch?userIds=1,2,3
// Batch risk scores for a comma-separated list of user IDs (max 20).
// ---------------------------------------------------------------------------
router.get("/admin/risk/batch", async (req: AuthRequest, res) => {
  try {
    const raw = (req.query["userIds"] as string) ?? "";
    if (!raw) {
      res.status(400).json({ error: "userIds query param required (comma-separated)" });
      return;
    }
    const userIds = raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
      .slice(0, 20);

    if (userIds.length === 0) {
      res.status(400).json({ error: "No valid user IDs provided" });
      return;
    }

    const reports = await computeBatchRiskScores(userIds);
    res.json({
      reports,
      count: reports.length,
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "admin-risk: batch failed");
    res.status(500).json({ error: "Failed to compute batch risk scores" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/metrics/latency
// Returns per-route p50/p90/p95/p99 latency from the in-process ring buffer.
// Only reflects the current instance's traffic (not cluster-wide).
// ---------------------------------------------------------------------------
router.get("/admin/metrics/latency", (_req: AuthRequest, res) => {
  const stats = getAllLatencyStats();
  const routes = Object.entries(stats)
    .filter(([, v]) => v !== null)
    .map(([route, v]) => ({ route, ...v }))
    .sort((a, b) => (b?.p95 ?? 0) - (a?.p95 ?? 0));

  res.json({
    routes,
    note: "In-process ring buffer (last 500 samples per route). Resets on deploy.",
    generatedAt: new Date().toISOString(),
  });
});

export default router;
