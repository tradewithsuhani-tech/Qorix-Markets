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
    if (!merchant || !merchant.isActive) {
      res.status(401).json({ error: "Merchant account is not active" });
      return;
    }
    req.merchantId = merchant.id;
    req.merchantEmail = merchant.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function signMerchantToken(merchantId: number): string {
  return jwt.sign({ merchantId, type: "merchant" }, JWT_SECRET, { expiresIn: "7d" });
}
