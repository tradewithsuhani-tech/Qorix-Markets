import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SESSION_SECRET_ENV = process.env["SESSION_SECRET"];
if (!SESSION_SECRET_ENV && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET environment variable is required in production for merchant auth.",
  );
}
const JWT_SECRET = SESSION_SECRET_ENV || "qorix-markets-secret";

export interface MerchantAuthRequest extends Request {
  merchantId?: number;
  merchantEmail?: string;
}

export async function merchantAuthMiddleware(
  req: MerchantAuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      merchantId: number;
      type: string;
    };
    if (decoded.type !== "merchant" || !decoded.merchantId) {
      res.status(401).json({ error: "Invalid merchant token" });
      return;
    }
    const rows = await db
      .select()
      .from(merchantsTable)
      .where(eq(merchantsTable.id, decoded.merchantId))
      .limit(1);
    const merchant = rows[0];
    if (!merchant) {
      // Token references a merchant row that no longer exists — generic 401.
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    // Distinguish "you got disabled while logged in" from a generic stale-
    // token 401 so the SPA can show the user a precise, actionable banner
    // instead of silently bouncing them to login with no explanation. The
    // explicit `code: "ACCOUNT_DISABLED"` is the contract the frontend keys
    // off in merchant-auth-fetch.
    if (!merchant.isActive) {
      res.status(403).json({
        error:
          "Your merchant account has been disabled by the platform admin. Please contact admin to re-enable it.",
        code: "ACCOUNT_DISABLED",
      });
      return;
    }
    req.merchantId = merchant.id;
    req.merchantEmail = merchant.email;

    // Heartbeat: bump lastLoginAt to mark the merchant "online" while they
    // are actively using the merchant panel. Throttled to at most one write
    // per 60s per merchant to avoid hot-row write amplification (the merchant
    // pending beacon polls every 10s, so without throttling we'd hammer the
    // row 6x per minute per active merchant). Fire-and-forget so the request
    // is not blocked on this update — the response is unaffected if it fails.
    // The /payment-methods endpoint reads this column to compute is_online
    // (logged in within last 5 min) for the green/red status dot on the user
    // INR deposit screen.
    const HEARTBEAT_THROTTLE_MS = 60_000;
    const nowMs = Date.now();
    const lastLoginMs = merchant.lastLoginAt ? merchant.lastLoginAt.getTime() : 0;
    if (nowMs - lastLoginMs > HEARTBEAT_THROTTLE_MS) {
      void db
        .update(merchantsTable)
        .set({ lastLoginAt: new Date(nowMs) })
        .where(eq(merchantsTable.id, merchant.id))
        .catch((err) => {
          console.error("[merchant-auth] heartbeat update failed", err);
        });
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function signMerchantToken(merchantId: number): string {
  return jwt.sign({ merchantId, type: "merchant" }, JWT_SECRET, { expiresIn: "7d" });
}
