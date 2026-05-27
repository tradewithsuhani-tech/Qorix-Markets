/**
 * INR Wallet Payout Methods — WRITE routes (flat-JSON, no v1 wrapper)
 *
 * POST   /api/wallet/payout-methods          — add new method
 * DELETE /api/wallet/payout-methods/:id      — soft-delete
 * PATCH  /api/wallet/payout-methods/:id/default — set as default
 *
 * READ route lives in v1.ts:
 *   GET /api/v1/wallet/payout-methods
 */
import { Router } from "express";
import { db, walletPayoutMethodsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

// ─── Limits ──────────────────────────────────────────────────────────────────
const MAX_PER_TYPE: Record<string, number> = {
  bank: 5,
  upi: 5,
  qorix_user: 3,
};
const MAX_TOTAL = 10;

// ─── Validation ──────────────────────────────────────────────────────────────
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const UPI_RE  = /^[\w.\-_+]+@[\w]+$/;

const AddSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bank"),
    label: z.string().max(100).optional(),
    accountName: z.string().min(2).max(200),
    accountValue: z.string().min(5).max(200),    // account number
    bankName: z.string().min(2).max(100),
    ifsc: z.string().regex(IFSC_RE, "Invalid IFSC code (e.g. HDFC0001234)"),
  }),
  z.object({
    type: z.literal("upi"),
    label: z.string().max(100).optional(),
    accountName: z.string().min(2).max(200),
    accountValue: z.string().regex(UPI_RE, "Invalid UPI ID (e.g. raj@oksbi)"),
    bankName: z.undefined().optional(),
    ifsc: z.undefined().optional(),
  }),
  z.object({
    type: z.literal("qorix_user"),
    label: z.string().max(100).optional(),
    accountName: z.string().min(2).max(200),
    accountValue: z.string().min(3).max(200),    // referral code
    bankName: z.undefined().optional(),
    ifsc: z.undefined().optional(),
  }),
]);

// ─── Helper: mask account value ───────────────────────────────────────────────
function maskedValue(type: string, val: string): string | undefined {
  if (type === "bank") {
    return val.length > 4 ? `···${val.slice(-4)}` : val;
  }
  if (type === "upi") {
    const at = val.indexOf("@");
    if (at > 1) return `${val[0]}···${val.slice(at)}`;
  }
  return undefined;
}

// ─── Helper: format row for API response ─────────────────────────────────────
function fmt(row: typeof walletPayoutMethodsTable.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    label: row.label ?? undefined,
    accountName: row.accountName,
    accountValue: row.accountValue,
    bankName: row.bankName ?? undefined,
    ifsc: row.ifsc ?? undefined,
    maskedValue: maskedValue(row.type, row.accountValue),
    isDefault: row.isDefault,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/payout-methods
// ─────────────────────────────────────────────────────────────────────────────
router.post("/wallet/payout-methods", async (req: AuthRequest, res) => {
  const parsed = AddSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "validation_failed",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      details: parsed.error.issues,
    });
    return;
  }

  const { type, accountName, accountValue, label } = parsed.data;
  const bankName = (parsed.data as any).bankName as string | undefined;
  const ifsc     = (parsed.data as any).ifsc     as string | undefined;
  const userId   = req.userId!;

  try {
    // ── Count check ──
    const [totalRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(walletPayoutMethodsTable)
      .where(and(
        eq(walletPayoutMethodsTable.userId, userId),
        eq(walletPayoutMethodsTable.isActive, true),
      ));
    if (Number(totalRow?.c ?? 0) >= MAX_TOTAL) {
      res.status(400).json({ success: false, error: "limit_reached", message: `Maximum ${MAX_TOTAL} payout methods allowed` });
      return;
    }

    const [typeRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(walletPayoutMethodsTable)
      .where(and(
        eq(walletPayoutMethodsTable.userId, userId),
        eq(walletPayoutMethodsTable.type, type),
        eq(walletPayoutMethodsTable.isActive, true),
      ));
    const typeMax = MAX_PER_TYPE[type] ?? 5;
    if (Number(typeRow?.c ?? 0) >= typeMax) {
      res.status(400).json({ success: false, error: "type_limit_reached", message: `Maximum ${typeMax} ${type} methods allowed` });
      return;
    }

    // ── Duplicate check ──
    const [dup] = await db
      .select({ id: walletPayoutMethodsTable.id })
      .from(walletPayoutMethodsTable)
      .where(and(
        eq(walletPayoutMethodsTable.userId, userId),
        eq(walletPayoutMethodsTable.type, type),
        eq(walletPayoutMethodsTable.accountValue, accountValue),
        eq(walletPayoutMethodsTable.isActive, true),
      ))
      .limit(1);
    if (dup) {
      res.status(400).json({ success: false, error: "duplicate_method", message: "This account/UPI is already saved" });
      return;
    }

    // ── For qorix_user: validate the referral code exists ──
    if (type === "qorix_user") {
      const [target] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.referralCode, accountValue))
        .limit(1);
      if (!target) {
        res.status(400).json({ success: false, error: "invalid_qorix_user", message: "Qorix user not found for this referral code" });
        return;
      }
      if (target.id === userId) {
        res.status(400).json({ success: false, error: "self_transfer", message: "Cannot add yourself as a payout destination" });
        return;
      }
    }

    // ── Insert ──
    const [method] = await db
      .insert(walletPayoutMethodsTable)
      .values({
        userId,
        type,
        label: label ?? null,
        accountName,
        accountValue,
        bankName: bankName ?? null,
        ifsc: ifsc ? ifsc.toUpperCase() : null,
        isDefault: false,
        isActive: true,
      })
      .returning();

    res.json({ success: true, method: fmt(method!) });
  } catch (err: any) {
    console.error("POST /wallet/payout-methods:", err?.message ?? err);
    res.status(500).json({ success: false, error: "server_error", message: "Failed to add payout method" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/wallet/payout-methods/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/wallet/payout-methods/:id", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: "invalid_id", message: "Invalid method id" });
    return;
  }

  try {
    const [existing] = await db
      .select({ userId: walletPayoutMethodsTable.userId })
      .from(walletPayoutMethodsTable)
      .where(and(
        eq(walletPayoutMethodsTable.id, id),
        eq(walletPayoutMethodsTable.isActive, true),
      ))
      .limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: "not_found", message: "Payout method not found" });
      return;
    }
    if (existing.userId !== req.userId!) {
      res.status(403).json({ success: false, error: "forbidden", message: "Not your payout method" });
      return;
    }

    await db
      .update(walletPayoutMethodsTable)
      .set({ isActive: false, isDefault: false })
      .where(eq(walletPayoutMethodsTable.id, id));

    res.json({ success: true, message: "Payout method removed" });
  } catch (err: any) {
    console.error("DELETE /wallet/payout-methods:", err?.message ?? err);
    res.status(500).json({ success: false, error: "server_error", message: "Failed to remove payout method" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/wallet/payout-methods/:id/default
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/wallet/payout-methods/:id/default", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: "invalid_id", message: "Invalid method id" });
    return;
  }

  const userId = req.userId!;

  try {
    const [existing] = await db
      .select({ userId: walletPayoutMethodsTable.userId })
      .from(walletPayoutMethodsTable)
      .where(and(
        eq(walletPayoutMethodsTable.id, id),
        eq(walletPayoutMethodsTable.isActive, true),
      ))
      .limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: "not_found", message: "Payout method not found" });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ success: false, error: "forbidden", message: "Not your payout method" });
      return;
    }

    // Clear existing default for this user, then set the new one
    await db
      .update(walletPayoutMethodsTable)
      .set({ isDefault: false })
      .where(and(
        eq(walletPayoutMethodsTable.userId, userId),
        eq(walletPayoutMethodsTable.isDefault, true),
      ));

    await db
      .update(walletPayoutMethodsTable)
      .set({ isDefault: true })
      .where(eq(walletPayoutMethodsTable.id, id));

    res.json({ success: true, message: "Default payout method updated" });
  } catch (err: any) {
    console.error("PATCH /wallet/payout-methods/:id/default:", err?.message ?? err);
    res.status(500).json({ success: false, error: "server_error", message: "Failed to update default" });
  }
});

export { fmt as fmtPayoutMethod };
export default router;
