import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, merchantsTable, paymentMethodsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";

const router = Router();

router.use("/admin/merchants", authMiddleware, adminMiddleware, requireAdminPermission, auditAdminRequest);

// List merchants with their owned-method count. Single SQL — no N+1.
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
      methodCount: sql<number>`(
        select count(*)::int from payment_methods pm where pm.merchant_id = ${merchantsTable.id}
      )`,
    })
    .from(merchantsTable)
    .orderBy(merchantsTable.createdAt);
  res.json({ merchants: rows });
});

router.post("/admin/merchants", async (req: AuthRequest, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const fullName = String(req.body?.fullName ?? "").trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
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
    })
    .returning({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      createdAt: merchantsTable.createdAt,
    });
  res.json({ merchant: created });
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
