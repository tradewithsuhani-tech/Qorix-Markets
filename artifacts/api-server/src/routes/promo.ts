import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { promoRedemptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(authMiddleware);

const BONUS_PERCENT = 5;

function generateCode(): string {
  // Short, human-friendly, no ambiguous chars. Example: QRX-7H2K9P
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[buf[i]! % alphabet.length];
  return `QRX-${out}`;
}

async function getOrCreateUserPromo(userId: number) {
  const existing = await db
    .select()
    .from(promoRedemptionsTable)
    .where(eq(promoRedemptionsTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  // Generate unique code (retry on unlikely collision)
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    try {
      const [row] = await db
        .insert(promoRedemptionsTable)
        .values({ userId, code, status: "issued", bonusPercent: BONUS_PERCENT.toString() })
        .returning();
      if (row) return row;
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("duplicate")) throw err;
    }
  }
  throw new Error("Failed to issue promo code");
}

/**
 * GET /api/promo/offer
 * Returns the user's personal 5% deposit-bonus promo code.
 * Creates it lazily on first request; one per user for life.
 */
router.get("/promo/offer", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const row = await getOrCreateUserPromo(userId);
    res.json({
      code: row.code,
      status: row.status,
      bonusPercent: Number(row.bonusPercent),
      redeemedAt: row.redeemedAt?.toISOString() ?? null,
      creditedAt: row.creditedAt?.toISOString() ?? null,
      bonusAmount: row.bonusAmount != null ? Number(row.bonusAmount) : null,
      available: row.status === "issued",
    });
  } catch (err: any) {
    logger.error({ err, userId }, "Failed to fetch promo offer");
    res.status(500).json({ error: "Failed to fetch offer" });
  }
});

/**
 * POST /api/promo/redeem
 * Body: { code: string }
 * Marks the user's promo as redeemed (claim locked). The 5% bonus is credited
 * automatically when the user's NEXT confirmed on-chain deposit lands.
 */
router.post("/promo/redeem", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: "Promo code required" });
    return;
  }

  const rows = await db
    .select()
    .from(promoRedemptionsTable)
    .where(eq(promoRedemptionsTable.userId, userId))
    .limit(1);
  const row = rows[0];

  if (!row) {
    res.status(404).json({ error: "No promo code issued for this user" });
    return;
  }
  if (row.code.toUpperCase() !== code) {
    res.status(400).json({ error: "Invalid promo code" });
    return;
  }
  if (row.status !== "issued") {
    res.status(409).json({ error: "Promo code already used", status: row.status });
    return;
  }

  const [updated] = await db
    .update(promoRedemptionsTable)
    .set({ status: "redeemed", redeemedAt: new Date() })
    .where(eq(promoRedemptionsTable.userId, userId))
    .returning();

  logger.info({ userId, code }, "Promo code redeemed — awaiting qualifying deposit");

  res.json({
    success: true,
    code: updated!.code,
    status: updated!.status,
    bonusPercent: Number(updated!.bonusPercent),
    message: "Promo locked. Bonus will credit on your next confirmed deposit.",
  });
});

export default router;
