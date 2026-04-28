import type { Response, NextFunction } from "express";
import { db, adminAuditLogTable } from "@workspace/db";
import type { AuthRequest } from "./auth";
import { errorLogger } from "../lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Module slug map. Each admin URL is bucketed into one module slug; sub-admins
// are granted access to a list of module slugs, and the audit log records the
// matched slug. Keep these in sync with `ADMIN_MODULES` in the frontend.
// IMPORTANT: order matters — the first matching prefix wins, so list more
// specific prefixes (e.g. "/admin/blockchain-deposits") BEFORE more general
// ones (e.g. "/admin/deposits"). Two slugs are reserved for super admins
// only and are never grantable: "sub-admins" and "audit-log".
// ─────────────────────────────────────────────────────────────────────────────
type ModuleEntry = readonly [pathPrefix: string, moduleSlug: string];

export const SUPER_ONLY_MODULES = new Set(["sub-admins", "audit-log"]);

const MODULE_MAP: ReadonlyArray<ModuleEntry> = [
  ["/admin/sub-admins", "sub-admins"],
  ["/admin/audit-log", "audit-log"],
  ["/admin/stats", "dashboard"],
  ["/admin/profit", "dashboard"],
  ["/admin/users/:id/balance-adjust", "wallet"],
  ["/admin/users/:id/send-email", "communication"],
  ["/admin/users/:id/points", "task-proofs"],
  ["/admin/users", "users"],
  ["/admin/transactions/manual-credit", "wallet"],
  ["/admin/transactions", "transactions"],
  ["/admin/settings", "system"],
  ["/admin/system-health", "system"],
  ["/admin/broadcast", "communication"],
  ["/admin/kyc-reminder", "kyc"],
  ["/admin/kyc", "kyc"],
  ["/admin/activity-logs", "logs"],
  ["/admin/logs", "logs"],
  ["/admin/withdrawals", "withdrawals"],
  ["/admin/inr-withdrawals", "withdrawals"],
  ["/admin/blockchain-deposits", "deposits"],
  ["/admin/inr-deposits", "deposits"],
  ["/admin/inr-rate", "payment-methods"],
  ["/admin/payment-methods", "payment-methods"],
  ["/admin/merchants", "merchants"],
  ["/admin/deposits", "deposits"],
  ["/admin/intelligence", "intelligence"],
  ["/admin/ledger", "wallet"],
  ["/admin/slots", "wallet"],
  ["/admin/auto-engine", "trading"],
  ["/admin/signal-trades", "signal-trades"],
  ["/admin/subscriptions", "subscriptions"],
  ["/admin/task-proofs", "task-proofs"],
  ["/admin/test", "test"],
  ["/admin/fraud", "fraud"],
  ["/admin/chats", "chats"],
  ["/admin/content", "content"],
  ["/admin/hidden-features", "hidden-features"],
];

/**
 * Resolve which module a given admin URL path belongs to. Returns null if
 * the path doesn't start with /admin (so callers can short-circuit).
 */
export function resolveAdminModule(rawPath: string): string | null {
  if (!rawPath.startsWith("/admin")) return null;
  // Strip query string + trailing slash for prefix match.
  const path = rawPath.split("?")[0]!.replace(/\/+$/, "");
  for (const [prefix, slug] of MODULE_MAP) {
    // Treat ":id" segments as wildcards: collapse to a regex on the fly.
    const re = new RegExp(
      "^" +
        prefix
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/:\w+/g, "[^/]+") +
        "(?:/|$)",
    );
    if (re.test(path)) return slug;
  }
  return "other";
}

/**
 * Permission gate. Super admins bypass; sub-admins must have the resolved
 * module in their permissions array, and may NEVER touch super-only modules
 * regardless of what was granted.
 */
export function requireAdminPermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.adminRole === "super") {
    next();
    return;
  }
  const module = resolveAdminModule(req.path);
  if (module && SUPER_ONLY_MODULES.has(module)) {
    res.status(403).json({ error: "Super admin only" });
    return;
  }
  if (!module || !req.adminPermissions?.includes(module)) {
    res.status(403).json({
      error: "You don't have permission to access this module",
      module,
    });
    return;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit-log middleware. Hooks into res.end() so EVERY admin request (read or
// write) is recorded with method, path, module, status, IP, user-agent. The
// row is written fire-and-forget after the response goes out so it adds zero
// latency to the user-facing response. Failures are logged but never crash
// the request — audit MUST NOT break admin functionality.
// ─────────────────────────────────────────────────────────────────────────────
function actionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "view";
    case "POST":
      return "create";
    case "PATCH":
    case "PUT":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return method.toLowerCase();
  }
}

function clientIp(req: AuthRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw =
    (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ||
    req.ip ||
    "";
  return raw.replace("::ffff:", "");
}

export function auditAdminRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  // Capture request snapshot up front — req.path / req.userId may be mutated
  // by downstream middleware before res.end() fires.
  const startedAt = Date.now();
  const path = req.originalUrl || req.url;
  const method = req.method;
  const adminId = req.userId ?? null;
  const adminEmail = req.adminEmail ?? null;
  const adminRole = req.adminRole ?? null;
  const module = resolveAdminModule(req.path);
  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] as string | undefined) ?? null;
  const targetId = (req.params?.id as string | undefined) ?? null;

  const flush = (statusCode: number) => {
    // Pull any structured detail the route handler stashed on `res.locals`
    // for the audit row. Routes that need richer audit (e.g. balance
    // top-ups storing { delta, note, beforeBalance, afterBalance }) set
    // these immediately before responding; everything else stays null and
    // the audit row remains a plain method+path+status record.
    const summaryRaw = (res.locals as Record<string, unknown>)["auditSummary"];
    const metadataRaw = (res.locals as Record<string, unknown>)["auditMetadata"];
    const targetTypeRaw = (res.locals as Record<string, unknown>)["auditTargetType"];
    const summary = typeof summaryRaw === "string" ? summaryRaw.slice(0, 500) : null;
    const metadata =
      metadataRaw == null
        ? null
        : typeof metadataRaw === "string"
          ? metadataRaw
          : JSON.stringify(metadataRaw);
    const targetType = typeof targetTypeRaw === "string" ? targetTypeRaw : null;

    // Fire-and-forget; never await in the hot path.
    db.insert(adminAuditLogTable)
      .values({
        adminId,
        adminEmail,
        adminRole,
        module,
        action: actionFromMethod(method),
        method,
        path,
        targetType,
        targetId,
        summary,
        metadata,
        ipAddress: ip,
        userAgent: ua,
        statusCode,
      })
      .catch((err) => {
        errorLogger.error(
          { err, path, adminId },
          "[admin-audit] failed to write audit log row",
        );
      });
    void startedAt; // reserved for latency metrics later
  };

  res.on("finish", () => flush(res.statusCode));
  res.on("close", () => {
    if (!res.writableEnded) flush(res.statusCode || 499);
  });
  next();
}
