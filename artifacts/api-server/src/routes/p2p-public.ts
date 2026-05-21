// Public P2P routes (NO router-level authMiddleware). Currently only the
// SSE stream endpoint, which authorises via a short-lived purpose-scoped
// JWT supplied in the query string because EventSource cannot set the
// Authorization header.
//
// This MUST be mounted in routes/index.ts BEFORE any router that calls
// `router.use(authMiddleware)` at the router level. Mounting it inside the
// main p2pRouter would not be enough: upstream auth-gated routers
// (wallet, transactions, dashboard, ...) intercept every incoming request
// before Express ever forwards it to p2pRouter.
import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, p2pOrdersTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { addSSEClient } from "../lib/p2p-realtime";

const router = Router();

router.get("/p2p/orders/:id/stream", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const token = typeof req.query?.token === "string" ? req.query.token : "";
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  let userId: number;
  let tokenOrderId: number;
  try {
    const SECRET = process.env.SESSION_SECRET || "qorix-markets-secret";
    const decoded = jwt.verify(token, SECRET) as {
      userId: number; orderId: number; purpose?: string; aud?: string;
    };
    if (decoded.purpose !== "p2p-stream") { res.status(401).json({ error: "Unauthorized" }); return; }
    if (decoded.orderId !== id) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (decoded.aud && decoded.aud !== "markets") { res.status(401).json({ error: "Unauthorized" }); return; }
    userId = decoded.userId;
    tokenOrderId = decoded.orderId;
  } catch {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  // Re-verify membership at connect time — the order could have changed
  // state between token mint and connect.
  const [order] = await db.select({
    buyerId: p2pOrdersTable.buyerId, sellerId: p2pOrdersTable.sellerId,
  }).from(p2pOrdersTable)
    .where(and(
      eq(p2pOrdersTable.id, tokenOrderId),
      or(eq(p2pOrdersTable.buyerId, userId), eq(p2pOrdersTable.sellerId, userId)),
    )).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const cleanup = await addSSEClient(res, id, userId);
  req.on("close", cleanup);
});

export default router;
