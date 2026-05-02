/**
 * BOT TERMINAL — public quotes endpoint (Batch R)
 *
 * Surfaces the live 4-pair feed (XAUUSD / EURUSD / BTCUSD / USOIL)
 * for the dashboard's Bot Trading Terminal widget. Fully public —
 * no auth required, since the same prices anchor every visitor's
 * widget and we want the ticker to render even on a logged-out
 * landing preview.
 *
 * Subsequent batches will add:
 *   GET  /api/bot-trading/state          — live engine status + open/closed signal_trades
 *   GET  /api/bot-trading/account        — pulls existing dashboardSummary virtual balance
 *   POST /api/bot-trading/tv-webhook     — TradingView strategy webhook (Phase V)
 *
 * Each future endpoint will gate auth at the route level (not the
 * router level) so /quotes can stay public alongside them.
 */

import { Router, type IRouter } from "express";
import { getAllQuotes, isForexMarketOpen } from "../lib/quote-feed";
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

export default router;
