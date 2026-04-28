import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, merchantsTable, paymentMethodsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";

const router = Router();

router.use("/admin/merchants", authMiddleware, adminMiddleware, requireAdminPermission, auditAdminRequest);

// List merchants with their owned-method count + INR wallet snapshot. Single
// SQL — no N+1. `inrBalance` is the on-chain wallet figure, `pendingHold` is
// the locked-in amount across pending user deposits assigned to this
// merchant's methods, and `available` is the spendable headroom for new
// deposits. Returned as strings (numeric) — frontend parses to number.
router.get("/admin/merchants", async (_req, res) => {
  const rows = await db
    .select({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      createdBy: merchantsTable.createdBy,
      lastLoginAt: merchantsTable.lastLoginAt,
      createdAt: merchantsTable.createdAt,
      inrBalance: merchantsTable.inrBalance,
      // NOTE: We use the fully-qualified literal `merchants.id` here instead
      // of `${merchantsTable.id}` because Drizzle interpolates a column
      // reference as the bare identifier `"id"`. Inside these correlated
      // subqueries, `payment_methods` also has its own `id` column, so the
      // bare `"id"` is ambiguous and Postgres raises
      // `column reference "id" is ambiguous`, 500ing the entire endpoint.
      methodCount: sql<number>`(
        select count(*)::int from payment_methods pm where pm.merchant_id = merchants.id
      )`,
      pendingHold: sql<string>`coalesce((
        select sum(d.amount_inr)::text
        from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = merchants.id and d.status = 'pending'
      ), '0')`,
    })
    .from(merchantsTable)
    .orderBy(merchantsTable.createdAt);
  // Compute available client-side from authoritative DB strings to avoid any
  // numeric drift in the SQL expression.
  const enriched = rows.map((r) => ({
    ...r,
    available: (parseFloat(r.inrBalance as string) - parseFloat(r.pendingHold)).toFixed(2),
  }));
  res.json({ merchants: enriched });
});

router.post("/admin/merchants", async (req: AuthRequest, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const fullName = String(req.body?.fullName ?? "").trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  // Optional initial INR security deposit / wallet balance.
  const initialInrBalanceRaw = req.body?.inrBalance;
  let inrBalance: string = "0";
  if (initialInrBalanceRaw !== undefined && initialInrBalanceRaw !== null && initialInrBalanceRaw !== "") {
    const n = Number(initialInrBalanceRaw);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ error: "inrBalance must be a non-negative number" });
      return;
    }
    inrBalance = n.toFixed(2);
  }
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "email, password and fullName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  const existing = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.email, email))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "A merchant with this email already exists" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(merchantsTable)
    .values({
      email,
      passwordHash,
      fullName,
      phone,
      isActive: true,
      createdBy: req.userId ?? null,
      inrBalance,
    })
    .returning({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      inrBalance: merchantsTable.inrBalance,
      createdAt: merchantsTable.createdAt,
    });
  res.json({ merchant: created });
});

// Atomic top-up / debit of a merchant's INR balance. Positive `delta` credits,
// negative debits. Rejected if it would push the balance below 0.
router.post("/admin/merchants/:id/topup", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400).json({ error: "delta must be a non-zero number (+credit / -debit)" });
    return;
  }
  const note = req.body?.note != null ? String(req.body.note).slice(0, 500) : null;
  const deltaStr = delta.toFixed(2);

  // Guard: if delta is negative, ensure resulting balance stays ≥ 0.
  const updated = await db
    .update(merchantsTable)
    .set({
      inrBalance: sql`${merchantsTable.inrBalance} + ${deltaStr}::numeric`,
      updatedAt: new Date(),
    })
    .where(
      delta < 0
        ? sql`${merchantsTable.id} = ${id} and ${merchantsTable.inrBalance} + ${deltaStr}::numeric >= 0`
        : eq(merchantsTable.id, id),
    )
    .returning({
      id: merchantsTable.id,
      inrBalance: merchantsTable.inrBalance,
    });
  if (!updated[0]) {
    if (delta < 0) {
      res.status(409).json({
        error: "insufficient_balance",
        message: "Debit blocked — would push merchant balance below 0.",
      });
      return;
    }
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  res.json({
    merchant: updated[0],
    delta: Number(deltaStr),
    note,
  });
});

router.patch("/admin/merchants/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = req.body ?? {};
  const patch: Partial<typeof merchantsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if ("fullName" in body) patch.fullName = String(body.fullName);
  if ("phone" in body) patch.phone = body.phone ? String(body.phone) : null;
  if ("isActive" in body) patch.isActive = Boolean(body.isActive);
  if ("password" in body && body.password) {
    if (String(body.password).length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    patch.passwordHash = await bcrypt.hash(String(body.password), 12);
  }
  const [updated] = await db
    .update(merchantsTable)
    .set(patch)
    .where(eq(merchantsTable.id, id))
    .returning({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
    });
  if (!updated) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  res.json({ merchant: updated });
});

// DELETE is intentionally NOT exposed — disabling (isActive=false) is the
// recommended operation. Hard-deleting a merchant who already approved
// historical deposits would orphan the reviewedBy reference. If we need
// hard-delete later, add an explicit `?cascade=1` flag and null out
// payment_methods.merchant_id + leave reviewedBy in place.

// Reassign a payment method between merchants (used during the initial
// migration: existing admin-managed methods → first merchant).
router.post("/admin/merchants/:id/assign-method", async (req, res) => {
  const merchantId = Number(req.params["id"]);
  const methodId = Number(req.body?.methodId);
  if (!Number.isFinite(merchantId) || merchantId <= 0 || !Number.isFinite(methodId) || methodId <= 0) {
    res.status(400).json({ error: "Invalid merchantId or methodId" });
    return;
  }
  const merchantExists = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId))
    .limit(1);
  if (!merchantExists[0]) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  const [updated] = await db
    .update(paymentMethodsTable)
    .set({ merchantId, updatedAt: new Date() })
    .where(eq(paymentMethodsTable.id, methodId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Payment method not found" });
    return;
  }
  res.json({ method: updated });
});

// List unassigned payment methods (legacy admin-managed) so the admin can
// hand them off to a merchant from the UI. Gated explicitly because the
// router-level `use(/admin/merchants, ...)` above doesn't cover this prefix.
router.get(
  "/admin/payment-methods/unassigned",
  authMiddleware,
  adminMiddleware,
  requireAdminPermission,
  auditAdminRequest,
  async (_req, res) => {
    const rows = await db
      .select()
      .from(paymentMethodsTable)
      .where(sql`${paymentMethodsTable.merchantId} is null`)
      .orderBy(paymentMethodsTable.id);
    res.json({ methods: rows });
  },
);

export default router;
