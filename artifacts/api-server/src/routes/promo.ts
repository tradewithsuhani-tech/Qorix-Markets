import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import {
  promoRedemptionsTable,
  systemSettingsTable,
  scheduledPromosTable,
} from "@workspace/db/schema";
import { and, eq, lte, gt, sql, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { PROMO_BOUNDS, normalizePromoCodePrefix, normalizeScheduledPromoCode } from "../lib/promo-bounds";

const router = Router();
router.use(authMiddleware);

/* ── Time-windowed offer system ────────────────────────────────────
 * Each wall-clock window of `windowMinutes` minutes defines one system-wide
 * offer. Code + bonus % are derived deterministically (HMAC-SHA256 with a
 * server secret) from the window index — no DB write needed per window.
 * A user can redeem at most ONE offer for life.
 *
 * Window length, % range, code prefix and the master enable toggle are
 * read from `system_settings` (admin-configurable) and cached for 60s.
 * ───────────────────────────────────────────────────────────────── */
const OFFER_SECRET =
  process.env["PROMO_SECRET"] ||
  process.env["JWT_SECRET"] ||
  "qorix-promo-default-secret-change-me";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

interface PromoConfig {
  enabled: boolean;
  windowMs: number;
  minPct: number;
  maxPct: number;
  stepPct: number;
  codePrefix: string;
}

let promoConfigCache: { value: PromoConfig; expiresAt: number } | null = null;
const PROMO_CONFIG_TTL_MS = 60_000;

function defaultPromoConfig(): PromoConfig {
  return {
    enabled: true,
    windowMs: 30 * 60 * 1000,
    minPct: 2,
    maxPct: 10,
    stepPct: 0.5,
    codePrefix: "QRX",
  };
}

async function getPromoConfig(): Promise<PromoConfig> {
  const now = Date.now();
  if (promoConfigCache && promoConfigCache.expiresAt > now) return promoConfigCache.value;
  try {
    const rows = await db.select().from(systemSettingsTable);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    // Defensive runtime clamp using the SAME bounds the admin validator
    // enforces. If the row was somehow inserted out-of-band (manual SQL,
    // legacy data) we still produce a sane config.
    const windowMinutes = Math.max(
      PROMO_BOUNDS.windowMin,
      Math.min(PROMO_BOUNDS.windowMax, Number(s["promo_window_minutes"] ?? "30") || 30),
    );
    let minPct = Math.max(
      PROMO_BOUNDS.pctMin,
      Math.min(PROMO_BOUNDS.pctMax, Number(s["promo_min_pct"] ?? "2") || 2),
    );
    let maxPct = Math.max(
      minPct,
      Math.min(PROMO_BOUNDS.pctMax, Number(s["promo_max_pct"] ?? "10") || 10),
    );
    if (maxPct < minPct) maxPct = minPct;
    const stepPct = Math.max(
      PROMO_BOUNDS.stepMin,
      Math.min(PROMO_BOUNDS.stepMax, Number(s["promo_step_pct"] ?? "0.5") || 0.5),
    );
    const codePrefix = normalizePromoCodePrefix(String(s["promo_code_prefix"] ?? "QRX"));
    const config: PromoConfig = {
      enabled: s["promo_enabled"] !== "false",
      windowMs: windowMinutes * 60 * 1000,
      minPct,
      maxPct,
      stepPct,
      codePrefix,
    };
    promoConfigCache = { value: config, expiresAt: now + PROMO_CONFIG_TTL_MS };
    return config;
  } catch (err) {
    logger.warn({ err }, "Failed to load promo config — using defaults");
    return defaultPromoConfig();
  }
}

function windowCode(windowIndex: number, codePrefix: string): string {
  const h = createHmac("sha256", OFFER_SECRET).update(`offer:${windowIndex}`).digest();
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[h[i]! % CODE_ALPHABET.length];
  return `${codePrefix}-${code}`;
}

/** Deterministic bonus % rounded to admin-configured step within [minPct, maxPct]. */
function windowBonusPct(windowIndex: number, cfg: PromoConfig): number {
  const h = createHmac("sha256", OFFER_SECRET).update(`bonus:${windowIndex}`).digest();
  const n = h.readUInt32BE(0);
  const steps = Math.max(1, Math.floor((cfg.maxPct - cfg.minPct) / cfg.stepPct) + 1);
  const value = cfg.minPct + (n % steps) * cfg.stepPct;
  return Math.round(value * 10) / 10;
}

interface CurrentOffer {
  source: "scheduled" | "rotating";
  windowIndex: number;
  windowStart: number;
  activeEnd: number;
  nextWindowStart: number;
  isActive: boolean;
  code: string;
  bonusPercent: number;
  // Scheduled-promo metadata (only present when source === "scheduled")
  scheduledId?: number;
  name?: string;
  description?: string | null;
}

function getRotatingOffer(cfg: PromoConfig, nowMs: number): CurrentOffer {
  const windowIndex = Math.floor(nowMs / cfg.windowMs);
  const windowStart = windowIndex * cfg.windowMs;
  const activeEnd = windowStart + cfg.windowMs;
  const isActive = cfg.enabled && nowMs < activeEnd;
  return {
    source: "rotating",
    windowIndex,
    windowStart,
    activeEnd,
    nextWindowStart: windowStart + cfg.windowMs,
    isActive,
    code: windowCode(windowIndex, cfg.codePrefix),
    bonusPercent: windowBonusPct(windowIndex, cfg),
  };
}

/**
 * Returns the single best ACTIVE scheduled promo at `nowMs`, or null.
 * "Active" = is_active AND now in [starts_at, ends_at) AND under the cap.
 * If multiple overlap we pick the one with the highest bonus % so the user
 * always sees the most generous offer.
 */
async function fetchActiveScheduledPromo(nowMs: number) {
  const now = new Date(nowMs);
  // Window semantics: [startsAt, endsAt). endsAt is EXCLUSIVE — at the
  // exact end timestamp the promo is no longer claimable.
  const rows = await db
    .select()
    .from(scheduledPromosTable)
    .where(
      and(
        eq(scheduledPromosTable.isActive, true),
        lte(scheduledPromosTable.startsAt, now),
        gt(scheduledPromosTable.endsAt, now),
      ),
    )
    .orderBy(desc(scheduledPromosTable.bonusPercent));
  for (const r of rows) {
    if (r.maxRedemptions == null || r.redemptionCount < r.maxRedemptions) {
      return r;
    }
  }
  return null;
}

/**
 * Resolves the offer the user should see RIGHT NOW. Scheduled holiday
 * promos override the rotating-window offer when active.
 */
async function getCurrentOffer(cfg: PromoConfig, nowMs: number = Date.now()): Promise<CurrentOffer> {
  const scheduled = await fetchActiveScheduledPromo(nowMs);
  if (scheduled) {
    const startMs = scheduled.startsAt.getTime();
    const endMs = scheduled.endsAt.getTime();
    return {
      source: "scheduled",
      windowIndex: scheduled.id, // reuse field as a stable identifier
      windowStart: startMs,
      activeEnd: endMs,
      nextWindowStart: endMs, // no auto-rotate for scheduled
      isActive: true,
      code: scheduled.code,
      bonusPercent: Number(scheduled.bonusPercent),
      scheduledId: scheduled.id,
      name: scheduled.name,
      description: scheduled.description,
    };
  }
  return getRotatingOffer(cfg, nowMs);
}

async function fetchUserRedemption(userId: number) {
  const rows = await db
    .select()
    .from(promoRedemptionsTable)
    .where(eq(promoRedemptionsTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Only "redeemed" or "credited" rows count as an actual used promo.
 *  Legacy "issued" rows (from the old per-user-code scheme) are ignored so
 *  the new rotating-window banner still shows for those users. */
function hasUsedPromo(row: { status: string } | null): boolean {
  if (!row) return false;
  return row.status === "redeemed" || row.status === "credited";
}

/**
 * GET /api/promo/offer
 * Returns the current system-wide offer (if active) plus this user's
 * redemption status. Frontend uses the returned timestamps to render a
 * live countdown.
 */
router.get("/promo/offer", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const cfg = await getPromoConfig();
    const redemption = await fetchUserRedemption(userId);
    const used = hasUsedPromo(redemption);
    const offer = await getCurrentOffer(cfg);

    res.json({
      // User state — if already redeemed/credited, banner stays hidden forever.
      // Legacy "issued" rows do NOT count (they're relics of the old lazy scheme).
      alreadyRedeemed: used,
      redemption: used && redemption
        ? {
            code: redemption.code,
            status: redemption.status,
            bonusPercent: Number(redemption.bonusPercent),
            bonusAmount: redemption.bonusAmount != null ? Number(redemption.bonusAmount) : null,
            redeemedAt: redemption.redeemedAt?.toISOString() ?? null,
            creditedAt: redemption.creditedAt?.toISOString() ?? null,
          }
        : null,

      // Current system offer (scheduled holiday promo wins over rotating)
      active: offer.isActive && !used,
      source: offer.source,
      code: offer.code,
      bonusPercent: offer.bonusPercent,
      windowStart: offer.windowStart,       // ms epoch — when this offer started
      expiresAt: offer.activeEnd,           // ms epoch — when this offer stops being redeemable
      nextOfferAt: offer.nextWindowStart,   // ms epoch — when the NEXT new offer begins
      // Holiday promo display fields (null for rotating)
      name: offer.name ?? null,
      description: offer.description ?? null,
      serverTime: Date.now(),               // for client-side clock-skew correction
    });
  } catch (err: any) {
    logger.error({ err, userId }, "Failed to fetch promo offer");
    res.status(500).json({ error: "Failed to fetch offer" });
  }
});

/**
 * POST /api/promo/redeem
 * Body: { code }
 * Locks the user's redemption to the currently-active offer. The %
 * used is the one that was active in the current window at request
 * time. Bonus credits automatically on the user's next confirmed
 * on-chain deposit (handled by tron-monitor.ts).
 */
router.post("/promo/redeem", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const submitted = String(req.body?.code ?? "").trim().toUpperCase();
  if (!submitted) {
    res.status(400).json({ error: "Promo code required" });
    return;
  }

  const existing = await fetchUserRedemption(userId);
  if (hasUsedPromo(existing)) {
    res.status(409).json({
      error: "You have already redeemed a promo code",
      status: existing!.status,
    });
    return;
  }

  const cfg = await getPromoConfig();
  const offer = await getCurrentOffer(cfg);
  if (!offer.isActive) {
    res.status(410).json({
      error: "Offer window has expired. Wait for the next offer.",
      nextOfferAt: offer.nextWindowStart,
    });
    return;
  }
  if (offer.code.toUpperCase() !== submitted) {
    res.status(400).json({ error: "Invalid or expired promo code" });
    return;
  }

  // Whole claim runs in ONE transaction: cap-claim and redemption write are
  // either both committed or both rolled back. This eliminates cap drift if
  // the redemption insert fails for ANY reason (not just duplicate-key), and
  // also serialises concurrent redeems for the same user via a row lock.
  try {
    type RedeemRow = typeof promoRedemptionsTable.$inferSelect;
    let row: RedeemRow;
    let soldOut = false;
    try {
      row = await db.transaction(async (tx) => {
        // Lock the user's existing redemption row (if any) so two concurrent
        // requests can't both pass the "already redeemed?" check below.
        const locked = await tx
          .select()
          .from(promoRedemptionsTable)
          .where(eq(promoRedemptionsTable.userId, userId))
          .for("update")
          .limit(1);
        const lockedRow = locked[0] ?? null;
        if (hasUsedPromo(lockedRow)) {
          throw new RedeemError(409, "You have already redeemed a promo code");
        }

        if (offer.source === "scheduled" && offer.scheduledId) {
          const nowDate = new Date();
          // WHERE-filtered UPDATE doubles as the cap gatekeeper AND re-verifies
          // the date window + active flag, so a promo that flipped between
          // offer-read and claim cannot still be claimed.
          const claim = await tx
            .update(scheduledPromosTable)
            .set({
              redemptionCount: sql`${scheduledPromosTable.redemptionCount} + 1`,
              updatedAt: nowDate,
            })
            .where(
              and(
                eq(scheduledPromosTable.id, offer.scheduledId),
                eq(scheduledPromosTable.isActive, true),
                lte(scheduledPromosTable.startsAt, nowDate),
                gt(scheduledPromosTable.endsAt, nowDate),
                sql`(${scheduledPromosTable.maxRedemptions} IS NULL OR ${scheduledPromosTable.redemptionCount} < ${scheduledPromosTable.maxRedemptions})`,
              ),
            )
            .returning({ id: scheduledPromosTable.id });
          if (claim.length === 0) {
            throw new RedeemError(410, "Holiday promo just sold out — please try the next offer.");
          }
        }

        if (lockedRow) {
          const [updated] = await tx
            .update(promoRedemptionsTable)
            .set({
              code: offer.code,
              status: "redeemed",
              bonusPercent: offer.bonusPercent.toFixed(2),
              redeemedAt: new Date(),
            })
            .where(eq(promoRedemptionsTable.userId, userId))
            .returning();
          return updated!;
        }
        const [inserted] = await tx
          .insert(promoRedemptionsTable)
          .values({
            userId,
            code: offer.code,
            status: "redeemed",
            bonusPercent: offer.bonusPercent.toFixed(2),
            redeemedAt: new Date(),
          })
          .returning();
        return inserted!;
      });
    } catch (txErr: any) {
      if (txErr instanceof RedeemError) {
        if (txErr.status === 410) soldOut = true;
        res.status(txErr.status).json({ error: txErr.message });
        return;
      }
      // Race fallback: if the unique(user_id) constraint fires (extremely
      // unlikely now that we SELECT...FOR UPDATE, but possible if the row
      // didn't exist when we locked), the whole tx aborts → cap auto-rolled.
      if (String(txErr?.message ?? "").toLowerCase().includes("duplicate")) {
        res.status(409).json({ error: "You have already redeemed a promo code" });
        return;
      }
      throw txErr;
    }
    if (soldOut) return; // unreachable, but keeps TS happy

    logger.info(
      { userId, code: offer.code, bonusPercent: offer.bonusPercent, source: offer.source },
      "Promo code redeemed — awaiting qualifying deposit",
    );

    res.json({
      success: true,
      code: row.code,
      status: row.status,
      bonusPercent: Number(row.bonusPercent),
      message: `Locked in ${offer.bonusPercent}% bonus — credits to Trading Balance on next confirmed deposit.`,
    });
  } catch (err: any) {
    logger.error({ err, userId }, "Failed to redeem promo code");
    res.status(500).json({ error: "Failed to redeem promo code" });
  }
});

// Internal sentinel for transaction-scoped rejections we want to bubble up
// with a specific HTTP status. Throwing this aborts the tx (rolling back the
// cap claim if it ran) and gets caught above to render the response.
class RedeemError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * DELETE /api/promo/redemption
 * Cancels a pending (status="redeemed") redemption so the user can apply a
 * different code or simply walk away. Does NOT touch credited rows — once
 * the bonus has actually been paid out it cannot be reversed from here.
 */
router.delete("/promo/redemption", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const existing = await fetchUserRedemption(userId);
    if (!existing) {
      res.json({ success: true, cleared: false });
      return;
    }
    if (existing.status === "credited") {
      res.status(409).json({ error: "Bonus already credited — cannot remove." });
      return;
    }
    await db
      .delete(promoRedemptionsTable)
      .where(eq(promoRedemptionsTable.userId, userId));
    res.json({ success: true, cleared: true });
  } catch (err: any) {
    logger.error({ err, userId }, "Failed to clear promo redemption");
    res.status(500).json({ error: "Failed to clear redemption" });
  }
});

// ─── Admin: Scheduled Holiday Promos CRUD ────────────────────────────────────
// All endpoints below require admin role. We re-check admin on every handler
// so a bad route registration upstream can't accidentally expose them.
async function requireAdmin(req: AuthRequest, res: any): Promise<boolean> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const { usersTable } = await import("@workspace/db/schema");
  const rows = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!rows[0]?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

interface ScheduledPromoBody {
  name?: unknown;
  code?: unknown;
  description?: unknown;
  bonusPercent?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  maxRedemptions?: unknown;
  isActive?: unknown;
}

function parseScheduledPromoBody(body: ScheduledPromoBody, partial: boolean) {
  const errors: string[] = [];
  const out: Record<string, unknown> = {};

  if (body.name != null || !partial) {
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 120) errors.push("name is required (1-120 chars)");
    else out["name"] = name;
  }
  if (body.code != null || !partial) {
    // IMPORTANT: use the dedicated scheduled-code normalizer (A-Z0-9, max 32).
    // The rotating-window prefix normalizer truncates to 8 chars and would
    // silently mangle codes like "SUMMERFEST2026".
    const code = normalizeScheduledPromoCode(String(body.code ?? ""));
    if (!code) errors.push("code is required (alphanumeric, 1-32 chars)");
    else out["code"] = code;
  }
  if ("description" in body) {
    out["description"] = body.description == null ? null : String(body.description).slice(0, 500);
  }
  if (body.bonusPercent != null || !partial) {
    const n = Number(body.bonusPercent);
    if (!Number.isFinite(n) || n < 0.5 || n > 100) errors.push("bonusPercent must be between 0.5 and 100");
    else out["bonusPercent"] = n.toFixed(2);
  }
  if (body.startsAt != null || !partial) {
    const d = new Date(String(body.startsAt));
    if (isNaN(d.getTime())) errors.push("startsAt must be a valid date");
    else out["startsAt"] = d;
  }
  if (body.endsAt != null || !partial) {
    const d = new Date(String(body.endsAt));
    if (isNaN(d.getTime())) errors.push("endsAt must be a valid date");
    else out["endsAt"] = d;
  }
  if (out["startsAt"] && out["endsAt"]) {
    if ((out["endsAt"] as Date).getTime() <= (out["startsAt"] as Date).getTime()) {
      errors.push("endsAt must be strictly after startsAt");
    }
  }
  if ("maxRedemptions" in body && body.maxRedemptions !== null && body.maxRedemptions !== "") {
    const n = Number(body.maxRedemptions);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) errors.push("maxRedemptions must be a positive integer or null");
    else out["maxRedemptions"] = n;
  } else if ("maxRedemptions" in body) {
    out["maxRedemptions"] = null;
  }
  if ("isActive" in body) {
    out["isActive"] = Boolean(body.isActive);
  }

  return { out, errors };
}

router.get("/admin/scheduled-promos", async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const rows = await db.select().from(scheduledPromosTable).orderBy(desc(scheduledPromosTable.startsAt));
    res.json({ promos: rows });
  } catch (err) {
    logger.error({ err }, "Failed to list scheduled promos");
    res.status(500).json({ error: "Failed to list promos" });
  }
});

router.post("/admin/scheduled-promos", async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { out, errors } = parseScheduledPromoBody(req.body ?? {}, false);
  if (errors.length) {
    res.status(400).json({ error: errors.join("; ") });
    return;
  }
  try {
    const [row] = await db
      .insert(scheduledPromosTable)
      .values({
        ...(out as any),
        createdBy: req.userId!,
      })
      .returning();
    logger.info({ adminId: req.userId, promoId: row!.id, code: row!.code }, "Scheduled promo created");
    res.status(201).json({ promo: row });
  } catch (err: any) {
    if (String(err?.message ?? "").toLowerCase().includes("duplicate")) {
      res.status(409).json({ error: "Code already exists — pick a different code" });
      return;
    }
    logger.error({ err }, "Failed to create scheduled promo");
    res.status(500).json({ error: "Failed to create promo" });
  }
});

router.patch("/admin/scheduled-promos/:id", async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { out, errors } = parseScheduledPromoBody(req.body ?? {}, true);
  if (errors.length) {
    res.status(400).json({ error: errors.join("; ") });
    return;
  }
  if (Object.keys(out).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  try {
    // Cross-row date sanity for PARTIAL updates: if only one of startsAt /
    // endsAt is being patched, verify the resulting window against the
    // already-persisted other side. (parseScheduledPromoBody only enforces
    // start<end when BOTH are in the same payload.)
    if (("startsAt" in out) !== ("endsAt" in out)) {
      const existing = await db
        .select({ startsAt: scheduledPromosTable.startsAt, endsAt: scheduledPromosTable.endsAt })
        .from(scheduledPromosTable)
        .where(eq(scheduledPromosTable.id, id))
        .limit(1);
      if (!existing[0]) {
        res.status(404).json({ error: "Promo not found" });
        return;
      }
      const nextStart = (out["startsAt"] as Date | undefined) ?? existing[0].startsAt;
      const nextEnd = (out["endsAt"] as Date | undefined) ?? existing[0].endsAt;
      if (nextEnd.getTime() <= nextStart.getTime()) {
        res.status(400).json({ error: "endsAt must be strictly after startsAt" });
        return;
      }
    }

    const [row] = await db
      .update(scheduledPromosTable)
      .set({ ...(out as any), updatedAt: new Date() })
      .where(eq(scheduledPromosTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Promo not found" });
      return;
    }
    logger.info({ adminId: req.userId, promoId: id }, "Scheduled promo updated");
    res.json({ promo: row });
  } catch (err: any) {
    if (String(err?.message ?? "").toLowerCase().includes("duplicate")) {
      res.status(409).json({ error: "Code already exists — pick a different code" });
      return;
    }
    logger.error({ err }, "Failed to update scheduled promo");
    res.status(500).json({ error: "Failed to update promo" });
  }
});

router.delete("/admin/scheduled-promos/:id", async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req, res))) return;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    // Refuse to delete if the promo has been redeemed even once — keep the
    // row for audit and toggle isActive=false instead.
    const existing = await db
      .select({ count: scheduledPromosTable.redemptionCount })
      .from(scheduledPromosTable)
      .where(eq(scheduledPromosTable.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Promo not found" });
      return;
    }
    if (existing[0].count > 0) {
      res.status(409).json({ error: "Promo has redemptions — disable it instead of deleting." });
      return;
    }
    await db.delete(scheduledPromosTable).where(eq(scheduledPromosTable.id, id));
    logger.info({ adminId: req.userId, promoId: id }, "Scheduled promo deleted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete scheduled promo");
    res.status(500).json({ error: "Failed to delete promo" });
  }
});

export default router;
