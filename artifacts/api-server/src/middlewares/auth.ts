import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, systemSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// SESSION_SECRET is the signing key for every Bearer JWT the api hands out.
// Falling back to a hardcoded value would mean anyone could forge tokens for
// any user, so in production we hard-fail at module load instead of silently
// running with the dev fallback. The dev value is only acceptable on Replit /
// localhost where NODE_ENV is "development" or unset.
const SESSION_SECRET_ENV = process.env["SESSION_SECRET"];
if (!SESSION_SECRET_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET environment variable is required in production. " +
      "Set the same value on Fly that the current Replit deployment uses, " +
      "otherwise every existing user JWT becomes invalid and everyone is logged out.",
  );
}
const JWT_SECRET = SESSION_SECRET_ENV || "qorix-markets-secret";

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean; iat?: number };
    const users = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
    const user = users[0];
    if (!user || user.isDisabled || (user.isFrozen && !user.isAdmin)) {
      res.status(401).json({ error: "Account access is restricted" });
      return;
    }
    const maintenanceRows = await db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "maintenance_mode"))
      .limit(1);
    if (maintenanceRows[0]?.value === "true" && !user.isAdmin) {
      res.status(503).json({ error: "System under maintenance" });
      return;
    }
    if (user.forceLogoutAfter && decoded.iat && decoded.iat * 1000 < user.forceLogoutAfter.getTime()) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    req.userId = decoded.userId;
    req.isAdmin = user.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const whitelistRows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"))
    .limit(1);
  const whitelist = whitelistRows[0]?.value
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean) ?? [];
  if (whitelist.length > 0) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.ip || "";
    const normalized = ip.replace("::ffff:", "");
    if (!whitelist.includes(ip) && !whitelist.includes(normalized)) {
      res.status(403).json({ error: "Admin IP is not allowed" });
      return;
    }
  }
  next();
}

export function signToken(userId: number, isAdmin: boolean): string {
  return jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
}

// With @types/express 5, `req.params[key]` is typed as `string | string[]`
// (see ParamsDictionary in express-serve-static-core), which forced every
// route handler to write `req.params.id as string`. Express only ever
// produces string values for matched route params (the array form is for
// wildcard routes we don't use), so this helper centralizes the narrowing
// in one place. New routes should call `getParam(req, "id")` instead of
// reaching into `req.params` directly.
export function getParam(req: Request, name: string): string {
  const raw = req.params[name];
  if (raw === undefined) {
    throw new Error(`Missing required route param: ${name}`);
  }
  // We don't use wildcard routes (`*foo`), so an array here is unexpected
  // and almost certainly a bug — fail loudly rather than silently coerce.
  if (Array.isArray(raw)) {
    throw new Error(`Unexpected array value for route param: ${name}`);
  }
  return raw;
}
