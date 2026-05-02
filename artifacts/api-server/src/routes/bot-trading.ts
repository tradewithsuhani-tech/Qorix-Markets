/**
 * BOT TERMINAL — quotes + state endpoints (Batch R + S)
 *
 * Public:
 *   GET /api/bot-trading/quotes   — 4-pair live feed
 *                                   (XAUUSD / EURUSD / BTCUSD / USOIL)
 *
 * User (route-level authMiddleware — router itself stays mounted in
 * the public block of routes/index.ts so /quotes remains reachable
 * pre-login):
 *   GET /api/bot-trading/state    — bot plan progress + platform open
 *                                   positions with live PnL% + closed
 *                                   trades since UTC midnight + the
 *                                   calling user's distribution share
 *                                   for today.
 *
 * Future:
 *   GET  /api/bot-trading/account     — virtual balance (Batch U)
 *   POST /api/bot-trading/tv-webhook  — TradingView strategy webhook
 *                                       (Phase V)
 *
 * IMPORTANT: never apply `router.use(authMiddleware)` at the router
 * level. /quotes must stay reachable without a token; auth is
 * attached per-route below.
 */

import { Router, type IRouter, type Response } from "express";
import { getAllQuotes, isForexMarketOpen } from "../lib/quote-feed";
import { buildBotState } from "../lib/bot-state";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/bot-trading/quotes", async (_req, res) => {
  try {
    const quotes = await getAllQuotes();
    // Tell upstream caches not to hold stale ticks. Frontend polls
    // every ~1.5s; a CDN/proxy caching even 5s would freeze the
    // ticker visibly. The Redis layer inside getAllQuotes already
    // bounds upstream fetches to once per 30s per pair, so disabling
    // HTTP caching here does NOT amplify load on Coinbase/Stooq.
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.json({
      asOf: new Date().toISOString(),
      forexMarketOpen: isForexMarketOpen(),
      quotes,
    });
  } catch (err: any) {
    logger.error({ err: err?.message ?? err }, "[bot-trading] /quotes failed");
    res.status(500).json({ error: "quotes_failed" });
  }
});

/**
 * GET /api/bot-trading/state — auth-gated.
 *
 * Returns a snapshot of:
 *   - market gating (forex/crypto open flags from quote-feed)
 *   - bot plan progress (slots executed/pending/next ETA)
 *   - platform-level open signal_trades with live PnL%
 *   - platform-level closed signal_trades since UTC midnight
 *   - the calling user's distributed share for today
 *
 * Frontend (Batch T BotTerminalCard) polls this every few seconds
 * alongside /quotes. We disable HTTP caching for the same reason as
 * /quotes — DB writes (close/open of trades) need to surface in the
 * widget without a CDN-side hold.
 */
router.get(
  "/bot-trading/state",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        // Defensive — authMiddleware should have already 401'd, but
        // AuthRequest.userId is typed as optional. This path stays
        // unreachable in practice.
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const state = await buildBotState(userId);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.json(state);
    } catch (err: any) {
      logger.error(
        { err: err?.message ?? err, userId: req.userId },
        "[bot-trading] /state failed",
      );
      res.status(500).json({ error: "state_failed" });
    }
  },
);

export default router;
