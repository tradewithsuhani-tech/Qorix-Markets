import { Router } from "express";
import {
  db,
  usersTable,
  adminPermissionsTable,
  adminAuditLogTable,
} from "@workspace/db";
import { and, desc, eq, ilike, lt, sql } from "drizzle-orm";
import {
  authMiddleware,
  adminMiddleware,
  getParam,
  getQueryInt,
  getQueryString,
  invalidateAuthUserCache,
  type AuthRequest,
} from "../middlewares/auth";
import {
  auditAdminRequest,
  requireAdminPermission,
  SUPER_ONLY_MODULES,
} from "../middlewares/admin-rbac";
import { errorLogger } from "../lib/logger";

// All endpoints in this file are gated to SUPER ADMIN only.
const router = Router();

// Same chain as the rest of /admin/* — auth, then admin, then RBAC, then audit.
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);
router.use("/admin", requireAdminPermission);
router.use("/admin", auditAdminRequest);

// Defense-in-depth: requireAdminPermission already returns 403 for the
// "sub-admins" / "audit-log" modules to a sub-admin, but we re-check here in
// case anyone ever loosens the path map.
function ensureSuper(req: AuthRequest, res: any): boolean {
  if (req.adminRole !== "super") {
    res.status(403).json({ error: "Super admin only" });
    return false;
  }
  return true;
}

// ─── List sub-admins ────────────────────────────────────────────────────────
router.get("/admin/sub-admins", async (req: AuthRequest, res) => {
  if (!ensureSuper(req, res)) return;
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      adminRole: usersTable.adminRole,
      isAdmin: usersTable.isAdmin,
      isFrozen: usersTable.isFrozen,
      isDisabled: usersTable.isDisabled,
      createdAt: usersTable.createdAt,
      modules: adminPermissionsTable.modules,
      permissionsUpdatedAt: adminPermissionsTable.updatedAt,
    })
    .from(usersTable)
    .leftJoin(
      adminPermissionsTable,
      eq(adminPermissionsTable.adminId, usersTable.id),
    )
    .where(eq(usersTable.isAdmin, true))
    .orderBy(desc(usersTable.createdAt));
  res.json({ admins: rows });
});

// ─── Promote an existing user to sub-admin ─────────────────────────────────
// Body: { email: string, modules: string[] }
router.post("/admin/sub-admins", async (req: AuthRequest, res) => {
  if (!ensureSuper(req, res)) return;
  const { email, modules } = (req.body ?? {}) as {
    email?: string;
    modules?: string[];
  };
  if (!email || !email.trim()) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const cleanModules = Array.isArray(modules)
    ? modules
        .map((m) => String(m).trim())
        .filter((m) => m.length > 0 && !SUPER_ONLY_MODULES.has(m))
    : [];

  const [user] = await db
    .select({ id: usersTable.id, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found with that email" });
    return;
  }

  await db
    .update(usersTable)
    .set({ isAdmin: true, adminRole: "sub" })
    .where(eq(usersTable.id, user.id));

  // Phase 6: invalidate auth-user cache so the promotion takes effect on the
  // promoted user's next request without waiting for the 30s TTL.
  await invalidateAuthUserCache(user.id);

  await db
    .insert(adminPermissionsTable)
    .values({
      adminId: user.id,
      modules: cleanModules,
      updatedBy: req.userId ?? null,
    })
    .onConflictDoUpdate({
      target: adminPermissionsTable.adminId,
      set: {
        modules: cleanModules,
        updatedBy: req.userId ?? null,
        updatedAt: new Date(),
      },
    });

  res.json({ success: true, adminId: user.id, modules: cleanModules });
});

// ─── Update a sub-admin's permissions ──────────────────────────────────────
// Body: { modules: string[] }
router.patch("/admin/sub-admins/:id", async (req: AuthRequest, res) => {
  if (!ensureSuper(req, res)) return;
  const id = parseInt(getParam(req, "id"));
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Never let a super demote themselves accidentally — and never edit another
  // super admin's perms via this endpoint (super admins bypass perms anyway).
  const [target] = await db
    .select({
      id: usersTable.id,
      adminRole: usersTable.adminRole,
      isAdmin: usersTable.isAdmin,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!target || !target.isAdmin) {
    res.status(404).json({ error: "Sub-admin not found" });
    return;
  }
  if (target.adminRole === "super") {
    res
      .status(400)
      .json({ error: "Cannot edit a super admin's module permissions" });
    return;
  }

  const { modules } = (req.body ?? {}) as { modules?: string[] };
  const cleanModules = Array.isArray(modules)
    ? modules
        .map((m) => String(m).trim())
        .filter((m) => m.length > 0 && !SUPER_ONLY_MODULES.has(m))
    : [];

  await db
    .insert(adminPermissionsTable)
    .values({
      adminId: id,
      modules: cleanModules,
      updatedBy: req.userId ?? null,
    })
    .onConflictDoUpdate({
      target: adminPermissionsTable.adminId,
      set: {
        modules: cleanModules,
        updatedBy: req.userId ?? null,
        updatedAt: new Date(),
      },
    });

  res.json({ success: true, modules: cleanModules });
});

// ─── Demote a sub-admin (revoke admin entirely) ────────────────────────────
router.delete("/admin/sub-admins/:id", async (req: AuthRequest, res) => {
  if (!ensureSuper(req, res)) return;
  const id = parseInt(getParam(req, "id"));
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (id === req.userId) {
    res.status(400).json({ error: "You can't demote yourself" });
    return;
  }
  const [target] = await db
    .select({
      id: usersTable.id,
      adminRole: usersTable.adminRole,
      isAdmin: usersTable.isAdmin,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!target || !target.isAdmin) {
    res.status(404).json({ error: "Sub-admin not found" });
    return;
  }
  if (target.adminRole === "super") {
    res.status(400).json({ error: "Cannot demote a super admin" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ isAdmin: false, adminRole: "user" })
      .where(eq(usersTable.id, id));
    await tx
      .delete(adminPermissionsTable)
      .where(eq(adminPermissionsTable.adminId, id));
  });

  // Phase 6: invalidate AFTER the transaction commits so a concurrent reader
  // can't repopulate the cache from the pre-commit (still-admin) row state.
  // Critical: without this the demoted user retains admin access for up to
  // the 30s authMiddleware cache TTL.
  await invalidateAuthUserCache(id);

  res.json({ success: true });
});

// ─── Audit log feed (super-admin only) ─────────────────────────────────────
// Query params: ?limit=100&beforeId=…&adminId=…&module=…&q=…
router.get("/admin/audit-log", async (req: AuthRequest, res) => {
  if (!ensureSuper(req, res)) return;
  const limit = Math.min(getQueryInt(req, "limit", 100), 500);
  const rawBeforeId = (req.query["beforeId"] as string | undefined) ?? "";
  const beforeId = rawBeforeId ? Number(rawBeforeId) : null;
  const rawAdminId = (req.query["adminId"] as string | undefined) ?? "";
  const adminIdFilter = rawAdminId ? Number(rawAdminId) : null;
  const moduleFilter = getQueryString(req, "module");
  const q = getQueryString(req, "q");

  const conds: any[] = [];
  if (beforeId) conds.push(lt(adminAuditLogTable.id, beforeId));
  if (adminIdFilter) conds.push(eq(adminAuditLogTable.adminId, adminIdFilter));
  if (moduleFilter) conds.push(eq(adminAuditLogTable.module, moduleFilter));
  if (q) conds.push(ilike(adminAuditLogTable.path, `%${q}%`));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(adminAuditLogTable)
    .where(where as any)
    .orderBy(desc(adminAuditLogTable.id))
    .limit(limit);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminAuditLogTable);

  res.json({ entries: rows, nextBeforeId: rows.at(-1)?.id ?? null, total });
});

// ─── My permissions (any admin) ────────────────────────────────────────────
// Used by the frontend to know which sidebar links to render. Returns the
// effective module list (all modules for a super, granted modules for a sub)
// and the role flag.
router.get("/admin/me/permissions", async (req: AuthRequest, res) => {
  res.json({
    role: req.adminRole,
    modules: req.adminPermissions ?? [],
    isSuper: req.adminRole === "super",
  });
});

export default router;
// Suppress "unused import" — kept intentional for future fields.
void errorLogger;
