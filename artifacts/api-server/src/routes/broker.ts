/**
 * Broker integration — Zerodha (live) + Demo trading mode.
 * Unified read API so mobile UI stays the same regardless of mode.
 */
import { Router, type Request, type Response } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  connectZerodha,
  disconnectZerodha,
  getBrokerStatus,
  getDemoPortfolio,
  getZerodhaLoginUrl,
  placeDemoOrder,
  resetDemoPortfolio,
  resolveBrokerAdapter,
  setTradingMode,
} from "../lib/broker/broker-service";

const router = Router();

function ok(req: Request, res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    meta: {
      version: "v1",
      timestamp: new Date().toISOString(),
    },
  });
}

function fail(res: Response, message: string, status = 400, code = "broker_error") {
  res.status(status).json({
    success: false,
    error: { code, message },
    meta: { version: "v1", timestamp: new Date().toISOString() },
  });
}

function parseSymbols(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Status & mode ───────────────────────────────────────────────────────────

router.get("/v1/broker/status", authMiddleware, async (req: AuthRequest, res) => {
  try {
    ok(req, res, await getBrokerStatus(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Failed to load broker status", 500);
  }
});

router.put("/v1/broker/mode", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const mode = req.body?.mode;
    if (mode !== "demo" && mode !== "live") {
      return fail(res, "mode must be demo or live");
    }
    ok(req, res, await setTradingMode(req.userId!, mode));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Failed to set mode");
  }
});

// ─── Zerodha OAuth ───────────────────────────────────────────────────────────

router.get("/v1/broker/zerodha/login-url", authMiddleware, (req: AuthRequest, res) => {
  try {
    ok(req, res, getZerodhaLoginUrl());
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Kite not configured", 503, "kite_not_configured");
  }
});

router.post("/v1/broker/zerodha/session", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const requestToken = String(req.body?.requestToken ?? req.body?.request_token ?? "").trim();
    if (!requestToken) return fail(res, "requestToken is required");
    ok(req, res, await connectZerodha(req.userId!, requestToken));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Zerodha connect failed", 502);
  }
});

/** Web redirect callback — forwards token to app deep link or shows success HTML. */
router.get("/v1/broker/zerodha/callback", async (req: Request, res: Response) => {
  const requestToken = String(req.query.request_token ?? "");
  const status = String(req.query.status ?? "");
  const appScheme = process.env["BROKER_APP_SCHEME"] ?? "qorixmarkets";
  if (status === "success" && requestToken) {
    const deepLink = `${appScheme}://broker/zerodha?request_token=${encodeURIComponent(requestToken)}`;
    res
      .status(200)
      .send(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0A0E12;color:#fff;padding:2rem"><h2>Zerodha connected</h2><p>Return to the Qorix Markets app to finish linking.</p><p><a href="${deepLink}" style="color:#4ade80">Open app</a></p><script>setTimeout(()=>location.href=${JSON.stringify(deepLink)},800)</script></body></html>`,
      );
    return;
  }
  res.status(400).send("Zerodha login failed or was cancelled.");
});

router.delete("/v1/broker/zerodha/disconnect", authMiddleware, async (req: AuthRequest, res) => {
  try {
    ok(req, res, await disconnectZerodha(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Disconnect failed", 500);
  }
});

// ─── Unified reads (demo + live) ─────────────────────────────────────────────

router.get("/v1/broker/profile", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const adapter = await resolveBrokerAdapter(req.userId!);
    ok(req, res, await adapter.getProfile(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Profile fetch failed", 502);
  }
});

router.get("/v1/broker/holdings", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const adapter = await resolveBrokerAdapter(req.userId!);
    ok(req, res, { items: await adapter.getHoldings(req.userId!) });
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Holdings fetch failed", 502);
  }
});

router.get("/v1/broker/positions", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const adapter = await resolveBrokerAdapter(req.userId!);
    ok(req, res, { items: await adapter.getPositions(req.userId!) });
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Positions fetch failed", 502);
  }
});

router.get("/v1/broker/funds", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const adapter = await resolveBrokerAdapter(req.userId!);
    ok(req, res, await adapter.getFunds(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Funds fetch failed", 502);
  }
});

router.get("/v1/broker/quotes", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const symbols = parseSymbols(req.query.symbols);
    const adapter = await resolveBrokerAdapter(req.userId!);
    ok(req, res, { items: await adapter.getQuotes(req.userId!, symbols) });
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Quotes fetch failed", 502);
  }
});

// ─── Demo-only writes (simulated trades — no real orders) ────────────────────

router.get("/v1/broker/demo/portfolio", authMiddleware, async (req: AuthRequest, res) => {
  try {
    ok(req, res, await getDemoPortfolio(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Demo portfolio failed", 500);
  }
});

router.post("/v1/broker/demo/order", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const side = req.body?.side;
    const symbol = String(req.body?.symbol ?? "").trim();
    const quantity = Number(req.body?.quantity);
    const price = req.body?.price != null ? Number(req.body.price) : undefined;
    if (side !== "buy" && side !== "sell") return fail(res, "side must be buy or sell");
    if (!symbol) return fail(res, "symbol is required");
    if (!Number.isFinite(quantity) || quantity <= 0) return fail(res, "quantity must be positive");
    ok(req, res, await placeDemoOrder(req.userId!, { symbol, side, quantity, price }));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Demo order failed");
  }
});

router.post("/v1/broker/demo/reset", authMiddleware, async (req: AuthRequest, res) => {
  try {
    ok(req, res, await resetDemoPortfolio(req.userId!));
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Demo reset failed", 500);
  }
});

export default router;
