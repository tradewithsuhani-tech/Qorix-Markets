import { Router } from "express";
import { db, adminEscalationContactsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { authMiddleware, adminMiddleware } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";

const router = Router();

router.use(
  "/admin/escalation-contacts",
  authMiddleware,
  adminMiddleware,
  requireAdminPermission,
  auditAdminRequest,
);

// E.164: '+' followed by 8-15 digits. Twilio rejects anything else.
const E164_RE = /^\+[1-9]\d{7,14}$/;

router.get("/admin/escalation-contacts", async (_req, res) => {
  const rows = await db
    .select()
    .from(adminEscalationContactsTable)
    .orderBy(asc(adminEscalationContactsTable.priority), asc(adminEscalationContactsTable.id));
  res.json({ contacts: rows });
});

router.post("/admin/escalation-contacts", async (req, res) => {
  const phone = String(req.body?.phone ?? "").trim();
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const label = req.body?.label ? String(req.body.label).trim().slice(0, 80) : null;
  const priorityRaw = Number(req.body?.priority);
  const priority = Number.isFinite(priorityRaw) && priorityRaw > 0 ? Math.floor(priorityRaw) : 100;
  const isActive = req.body?.isActive !== false;
  if (!E164_RE.test(phone)) {
    res.status(400).json({
      error:
        "phone must be in E.164 format — country code with leading '+' and no spaces (e.g. +919812345678)",
    });
    return;
  }
  const [row] = await db
    .insert(adminEscalationContactsTable)
    .values({ phone, email, label, priority, isActive })
    .returning();
  res.json({ contact: row });
});

router.patch("/admin/escalation-contacts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.phone != null) {
    const phone = String(req.body.phone).trim();
    if (!E164_RE.test(phone)) {
      res.status(400).json({ error: "phone must be in E.164 format" });
      return;
    }
    patch["phone"] = phone;
  }
  if (req.body?.email !== undefined) {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    patch["email"] = email;
  }
  if (req.body?.label !== undefined) {
    patch["label"] = req.body.label ? String(req.body.label).trim().slice(0, 80) : null;
  }
  if (req.body?.priority != null) {
    const p = Number(req.body.priority);
    if (!Number.isFinite(p) || p <= 0) {
      res.status(400).json({ error: "priority must be a positive number" });
      return;
    }
    patch["priority"] = Math.floor(p);
  }
  if (req.body?.isActive != null) {
    patch["isActive"] = Boolean(req.body.isActive);
  }
  const [row] = await db
    .update(adminEscalationContactsTable)
    .set(patch)
    .where(eq(adminEscalationContactsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "contact not found" });
    return;
  }
  res.json({ contact: row });
});

router.delete("/admin/escalation-contacts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [row] = await db
    .delete(adminEscalationContactsTable)
    .where(eq(adminEscalationContactsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "contact not found" });
    return;
  }
  res.json({ deleted: true });
});

export default router;
