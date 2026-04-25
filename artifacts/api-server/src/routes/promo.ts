import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { promoRedemptionsTable, systemSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { PROMO_BOUNDS, normalizePromoCodePrefix } from "../lib/promo-bounds";

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
  windowIndex: number;
  windowStart: number;
  activeEnd: number;
  nextWindowStart: number;
  isActive: boolean;
  code: string;
  bonusPercent: number;
}

function getCurrentOffer(cfg: PromoConfig, nowMs: number = Date.now()): CurrentOffer {
  const windowIndex = Math.floor(nowMs / cfg.windowMs);
  const windowStart = windowIndex * cfg.windowMs;
  const activeEnd = windowStart + cfg.windowMs;
  const isActive = cfg.enabled && nowMs < activeEnd;
  return {
    windowIndex,
    windowStart,
    activeEnd,
    nextWindowStart: windowStart + cfg.windowMs,
    isActive,
    code: windowCode(windowIndex, cfg.codePrefix),
    bonusPercent: windowBonusPct(windowIndex, cfg),
  };
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
    const offer = getCurrentOffer(cfg);

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

      // Current system offer
      active: offer.isActive && !used,
      code: offer.code,
      bonusPercent: offer.bonusPercent,
      windowStart: offer.windowStart,       // ms epoch — when this offer started
      expiresAt: offer.activeEnd,           // ms epoch — when this offer stops being redeemable
      nextOfferAt: offer.nextWindowStart,   // ms epoch — when the NEXT new offer begins
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
  const offer = getCurrentOffer(cfg);
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

  try {
    // If a legacy/unused row exists (e.g. status="issued" from the old
    // per-user-code scheme), UPDATE it instead of INSERT — the table has a
    // UNIQUE(user_id) constraint so insert would fail.
    let row;
    if (existing) {
      const [updated] = await db
        .update(promoRedemptionsTable)
        .set({
          code: offer.code,
          status: "redeemed",
          bonusPercent: offer.bonusPercent.toFixed(2),
          redeemedAt: new Date(),
        })
        .where(eq(promoRedemptionsTable.userId, userId))
        .returning();
      row = updated;
    } else {
      const [inserted] = await db
        .insert(promoRedemptionsTable)
        .values({
          userId,
          code: offer.code,
          status: "redeemed",
          bonusPercent: offer.bonusPercent.toFixed(2),
          redeemedAt: new Date(),
        })
        .returning();
      row = inserted;
    }

    logger.info(
      { userId, code: offer.code, bonusPercent: offer.bonusPercent },
      "Promo code redeemed — awaiting qualifying deposit",
    );

    res.json({
      success: true,
      code: row!.code,
      status: row!.status,
      bonusPercent: Number(row!.bonusPercent),
      message: `Locked in ${offer.bonusPercent}% bonus — credits to Trading Balance on next confirmed deposit.`,
    });
  } catch (err: any) {
    // Unique violation on userId → user already redeemed concurrently
    if (String(err?.message ?? "").toLowerCase().includes("duplicate")) {
      res.status(409).json({ error: "You have already redeemed a promo code" });
      return;
    }
    logger.error({ err, userId }, "Failed to redeem promo code");
    res.status(500).json({ error: "Failed to redeem promo code" });
  }
});

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

export default router;
