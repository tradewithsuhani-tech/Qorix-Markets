import { Router } from "express";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  createSignalTrade,
  closeSignalTrade,
  listTrades,
  getUserTradeHistory,
} from "../lib/signal-trade-service";

const router = Router();

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

// ---------- Admin: create trade ----------
router.post(
  "/admin/signal-trades",
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res) => {
    const b = req.body ?? {};
    const pair = typeof b.pair === "string" ? b.pair.trim() : "";
    const direction = b.direction;
    const entryPrice = num(b.entryPrice);
    const pipsTarget = num(b.pipsTarget);
    const pipSize = num(b.pipSize);
    const expectedProfitPercent = num(b.expectedProfitPercent);

    if (pair.length < 2 || pair.length > 20) { res.status(400).json({ error: "Invalid pair" }); return; }
    if (direction !== "BUY" && direction !== "SELL") { res.status(400).json({ error: "direction must be BUY or SELL" }); return; }
    if (entryPrice === null || entryPrice <= 0) { res.status(400).json({ error: "Invalid entryPrice" }); return; }
    if (pipsTarget === null || pipsTarget <= 0) { res.status(400).json({ error: "Invalid pipsTarget" }); return; }
    if (pipSize !== null && pipSize <= 0) { res.status(400).json({ error: "pipSize must be positive" }); return; }
    if (expectedProfitPercent === null || expectedProfitPercent < -50 || expectedProfitPercent > 50) {
      res.status(400).json({ error: "expectedProfitPercent must be between -50 and 50" }); return;
    }

    try {
      const trade = await createSignalTrade({
        pair,
        direction,
        entryPrice,
        pipsTarget,
        pipSize: pipSize ?? undefined,
        expectedProfitPercent,
        notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : undefined,
        idempotencyKey: typeof b.idempotencyKey === "string" ? b.idempotencyKey.slice(0, 80) : undefined,
        createdBy: req.userId!,
      });
      res.json({ success: true, trade });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

// ---------- Admin: close trade ----------
router.post(
  "/admin/signal-trades/:id/close",
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid trade id" }); return; }
    const b = req.body ?? {};
    const realizedExitPrice = num(b.realizedExitPrice);
    const realizedProfitPercent = num(b.realizedProfitPercent);
    const closeReason = b.closeReason;
    const validReasons = ["target_hit", "manual", "stop_loss", "slippage"];
    if (closeReason !== undefined && !validReasons.includes(closeReason)) {
      res.status(400).json({ error: "Invalid closeReason" }); return;
    }
    if (realizedExitPrice !== null && realizedExitPrice <= 0) {
      res.status(400).json({ error: "Invalid realizedExitPrice" }); return;
    }
    if (realizedProfitPercent !== null && (realizedProfitPercent < -100 || realizedProfitPercent > 100)) {
      res.status(400).json({ error: "realizedProfitPercent out of range" }); return;
    }

    try {
      const result = await closeSignalTrade({
        tradeId: id,
        realizedExitPrice: realizedExitPrice ?? undefined,
        realizedProfitPercent: realizedProfitPercent ?? undefined,
        closeReason: closeReason ?? undefined,
        notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

// ---------- Admin: list all trades ----------
router.get(
  "/admin/signal-trades",
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res) => {
    const status = (req.query.status as "running" | "closed" | undefined) || undefined;
    const trades = await listTrades({ status, limit: 100 });
    res.json({ trades });
  },
);

// ---------- User: my trade history ----------
router.get(
  "/signal-trades/history",
  authMiddleware,
  async (req: AuthRequest, res) => {
    const history = await getUserTradeHistory(req.userId!, 100);
    res.json({ history });
  },
);

// ---------- Public: list of recent closed trades (for trust display) ----------
router.get("/signal-trades/recent", async (_req, res) => {
  const trades = await listTrades({ status: "closed", limit: 20 });
  res.json({
    trades: trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      entryPrice: t.entryPrice,
      realizedExitPrice: t.realizedExitPrice,
      realizedProfitPercent: t.realizedProfitPercent,
      closedAt: t.closedAt,
    })),
  });
});

export default router;
