import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { promoRedemptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(authMiddleware);

/* ── Time-windowed offer system ────────────────────────────────────
 * Every 30-minute wall-clock window defines one system-wide offer.
 * The offer is ACTIVE for the first 10 minutes of each window; after
 * that, the banner hides until the next window starts. Code + bonus %
 * are derived deterministically (HMAC-SHA256 with a server secret)
 * from the window index — no DB write needed per window. A user can
 * redeem at most ONE offer for life.
 * ───────────────────────────────────────────────────────────────── */
const WINDOW_MS = 30 * 60 * 1000; // 30 minutes — each window defines one offer
// The offer is REDEEMABLE for the entire window so users always see a live offer.
// Timer counts down to when the NEW offer rotates in. The UI flips to an "urgent"
// style in the last 60 seconds automatically.
const ACTIVE_MS = WINDOW_MS;
const OFFER_SECRET =
  process.env["PROMO_SECRET"] ||
  process.env["JWT_SECRET"] ||
  "qorix-promo-default-secret-change-me";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function windowCode(windowIndex: number): string {
  const h = createHmac("sha256", OFFER_SECRET).update(`offer:${windowIndex}`).digest();
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[h[i]! % CODE_ALPHABET.length];
  return `QRX-${code}`;
}

/** Deterministic bonus in [2.0, 10.0], step 0.5 → 17 discrete values. */
function windowBonusPct(windowIndex: number): number {
  const h = createHmac("sha256", OFFER_SECRET).update(`bonus:${windowIndex}`).digest();
  const n = h.readUInt32BE(0);
  const steps = 17; // 2.0, 2.5, 3.0, ..., 10.0
  return 2 + (n % steps) * 0.5;
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

function getCurrentOffer(nowMs: number = Date.now()): CurrentOffer {
  const windowIndex = Math.floor(nowMs / WINDOW_MS);
  const windowStart = windowIndex * WINDOW_MS;
  const activeEnd = windowStart + ACTIVE_MS;
  const isActive = nowMs < activeEnd;
  return {
    windowIndex,
    windowStart,
    activeEnd,
    nextWindowStart: windowStart + WINDOW_MS,
    isActive,
    code: windowCode(windowIndex),
    bonusPercent: windowBonusPct(windowIndex),
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
    const redemption = await fetchUserRedemption(userId);
    const used = hasUsedPromo(redemption);
    const offer = getCurrentOffer();

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

  const offer = getCurrentOffer();
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

export default router;
