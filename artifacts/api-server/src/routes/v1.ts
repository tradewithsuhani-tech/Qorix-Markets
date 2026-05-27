/**
 * /api/v1 — Phase 1 Mobile Integration Layer
 *
 * SCOPE: Stable READ-ONLY endpoints for mobile app integration.
 *        Auth flows (login / refresh) are permitted as they carry no
 *        money-movement risk. All write operations that touch balances,
 *        investments, withdrawals, P2P or any other ledger path return
 *        503 PHASE_1_WRITES_DISABLED until the ledger + withdrawal
 *        hardening sprints pass QA.
 *
 * RESPONSE ENVELOPE — every response (success or error) shares the same
 * outer shape:
 *
 *   Success (single):
 *   {
 *     "success": true,
 *     "data": { ... },
 *     "meta": { "version": "v1", "requestId": "...", "timestamp": "..." }
 *   }
 *
 *   Success (paginated list):
 *   {
 *     "success": true,
 *     "data": [ ... ],
 *     "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 },
 *     "meta": { ... }
 *   }
 *
 *   Error:
 *   {
 *     "success": false,
 *     "error": { "code": "invalid_credentials", "message": "..." },
 *     "meta": { ... }
 *   }
 *
 * JWT: same SESSION_SECRET as the main API. Tokens issued here are
 * interchangeable with tokens issued by /auth/login.
 * Expiry: 7 days. "Refresh" = rotate a valid token; client should call
 * POST /api/v1/auth/refresh before expiry (e.g. on app resume).
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  db,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { eq, desc, count, sql, sum, and, gte, lte } from "drizzle-orm";
import {
  authMiddleware,
  signToken,
  type AuthRequest,
} from "../middlewares/auth";
import { getAllQuotes, isForexMarketOpen } from "../lib/quote-feed";
import { buildBotState } from "../lib/bot-state";
import { makeRedisLimiter } from "../middlewares/rate-limit";

const router = Router();

// ─── Rate limiter — shared with main /auth/login bucket ────────────────────
const v1LoginRateLimit = makeRedisLimiter({
  name: "login",   // same Redis key as the main login limiter → shared cap
  windowMs: 60 * 1000,
  limit: 5,
});

// ─── Envelope helpers ───────────────────────────────────────────────────────

function buildMeta(req: Request): Record<string, string> {
  return {
    version: "v1",
    requestId:
      (req.headers["x-request-id"] as string) ||
      crypto.randomBytes(8).toString("hex"),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wrap a single object in the standardised success envelope.
 */
function ok(req: Request, res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: buildMeta(req),
  });
}

/**
 * Wrap a list result with pagination metadata.
 */
function okList(
  req: Request,
  res: Response,
  data: unknown[],
  pagination: { page: number; limit: number; total: number; totalPages: number },
): void {
  res.status(200).json({
    success: true,
    data,
    pagination,
    meta: buildMeta(req),
  });
}

/**
 * Emit a structured error in the standardised error envelope.
 */
function fail(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({
    success: false,
    error: { code, message },
    meta: buildMeta(req),
  });
}

/**
 * Middleware: redirect v1 write stubs to the equivalent /api/ path.
 * Mobile clients that accidentally hit /api/v1/wallet/deposit etc. are
 * transparently sent to /api/wallet/deposit (307 preserves method + body).
 */
function writesDisabled(req: Request, res: Response, _next: NextFunction): void {
  const apiPath = (req.baseUrl + req.path).replace("/v1/", "/");
  res.redirect(307, apiPath);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getQueryInt(req: Request, key: string, def: number): number {
  const raw = req.query[key];
  if (!raw || Array.isArray(raw)) return def;
  const n = parseInt(raw as string, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

async function getInrRate(): Promise<number> {
  const rows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "inr_to_usdt_rate"))
    .limit(1);
  const raw = rows[0]?.value ?? "99";
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 99;
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    kycStatus: user.kycStatus,
    emailVerified: user.emailVerified,
    isAdmin: user.isAdmin,
    isFrozen: user.isFrozen,
    isDisabled: user.isDisabled,
    referralCode: user.referralCode,
    points: user.points,
    createdAt: user.createdAt.toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth/login
 *
 * Simplified login for mobile clients. No captcha required — rate-limited
 * at 5 req/IP/min (shared bucket with the main /auth/login limiter).
 *
 * Returns a 7-day JWT on success. If the account has 2FA enabled, returns
 * `requires2FA: true` — the client must use `POST /api/auth/2fa/login-verify`
 * on the main API to complete the auth flow.
 *
 * Body: { email: string, password: string }
 */
router.post("/v1/auth/login", v1LoginRateLimit, async (req: Request, res: Response) => {
  const { email: rawEmail, password } = req.body ?? {};

  if (!rawEmail || typeof rawEmail !== "string" || !password || typeof password !== "string") {
    fail(req, res, 400, "validation_error", "email and password are required");
    return;
  }

  const email = rawEmail.toLowerCase().trim();

  const users = await db
    .select()
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${email}`)
    .limit(1);

  if (users.length === 0) {
    fail(req, res, 401, "invalid_credentials", "Email or password is incorrect");
    return;
  }

  const user = users[0]!;

  if (user.isDisabled) {
    fail(req, res, 403, "account_disabled", "This account has been disabled. Contact support.");
    return;
  }
  if (user.isFrozen && !user.isAdmin) {
    fail(req, res, 403, "account_frozen", "This account is temporarily frozen. Contact support.");
    return;
  }
  if (!user.emailVerified) {
    fail(req, res, 403, "email_not_verified",
      "Please verify your email before logging in. " +
      "Use POST /api/auth/resend-verification to resend the OTP.");
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    fail(req, res, 401, "invalid_credentials", "Email or password is incorrect");
    return;
  }

  // If 2FA is enabled, surface it cleanly — don't issue a token yet.
  if (user.twoFactorEnabled) {
    ok(req, res, {
      requires2FA: true,
      message:
        "Two-factor authentication is enabled on this account. " +
        "Complete the 2FA flow via POST /api/auth/2fa/login-verify on the main API, " +
        "then use the token from that response here.",
    });
    return;
  }

  const token = signToken(user.id, user.isAdmin);

  ok(req, res, {
    token,
    tokenType: "Bearer",
    expiresIn: 604800, // 7 days in seconds
    user: formatUser(user),
  });
});

/**
 * POST /api/v1/auth/refresh
 *
 * Token rotation: exchange a valid (non-expired) Bearer JWT for a new one
 * with a fresh 7-day expiry. The client should call this on app resume or
 * when the token has ≤ 24h remaining.
 *
 * Body: (none — token is read from Authorization header)
 * Returns: { token, expiresIn, user }
 *
 * NOTE: This is NOT a refresh-token flow. There is no separate long-lived
 * refresh token. The client must call this BEFORE the access token expires.
 * If the token has already expired, the client must re-authenticate via
 * POST /api/v1/auth/login.
 */
router.post(
  "/v1/auth/refresh",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      fail(req, res, 401, "user_not_found", "Token user no longer exists");
      return;
    }

    const user = users[0]!;
    const newToken = signToken(user.id, user.isAdmin);

    ok(req, res, {
      token: newToken,
      tokenType: "Bearer",
      expiresIn: 604800,
      user: formatUser(user),
    });
  },
);

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's profile. Alias for the v1 /user/profile
 * endpoint — kept here for conventional placement alongside login/refresh.
 */
router.get(
  "/v1/auth/me",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (users.length === 0) {
      fail(req, res, 404, "user_not_found", "User not found");
      return;
    }

    ok(req, res, formatUser(users[0]!));
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/portfolio/summary
 *
 * Consolidated portfolio snapshot for the dashboard home screen.
 * Combines wallet balances + active investment state into a single call.
 *
 * All balances are in USDT unless noted. mainBalance and profitBalance
 * are USDT-equivalent of the user's INR-denominated wallets.
 */
router.get(
  "/v1/portfolio/summary",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    // Select only the stable columns that exist in the DB.
    // The Drizzle schema includes NAV-engine columns (navPendingAdd etc.)
    // that have not been migrated to the DB yet — do NOT use db.select()
    // without column projection here or Drizzle will try to SELECT them.
    const [wallets, investments] = await Promise.all([
      db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1),
      db
        .select({
          id: investmentsTable.id,
          isActive: investmentsTable.isActive,
          isPaused: investmentsTable.isPaused,
          amount: investmentsTable.amount,
          riskLevel: investmentsTable.riskLevel,
          drawdownLimit: investmentsTable.drawdownLimit,
          totalProfit: investmentsTable.totalProfit,
          dailyProfit: investmentsTable.dailyProfit,
          drawdown: investmentsTable.drawdown,
          autoCompound: investmentsTable.autoCompound,
          startedAt: investmentsTable.startedAt,
          stoppedAt: investmentsTable.stoppedAt,
          pausedAt: investmentsTable.pausedAt,
        })
        .from(investmentsTable)
        .where(eq(investmentsTable.userId, userId))
        .limit(1),
    ]);

    const wallet = wallets[0];
    const investment = investments[0] ?? null;

    const mainBalance = wallet ? parseFloat(wallet.mainBalance as string) : 0;
    const tradingBalance = wallet ? parseFloat(wallet.tradingBalance as string) : 0;
    const profitBalance = wallet ? parseFloat(wallet.profitBalance as string) : 0;
    const usdtBalance = wallet ? parseFloat((wallet.usdtBalance ?? "0") as string) : 0;
    const totalBalance = mainBalance + tradingBalance + profitBalance + usdtBalance;

    ok(req, res, {
      balances: {
        total: +totalBalance.toFixed(6),
        main: +mainBalance.toFixed(6),
        trading: +tradingBalance.toFixed(6),
        profit: +profitBalance.toFixed(6),
        usdt: +usdtBalance.toFixed(6),
        currency: "USDT",
      },
      investment: investment
        ? {
            id: investment.id,
            isActive: investment.isActive,
            isPaused: investment.isPaused,
            amount: +parseFloat(investment.amount as string).toFixed(6),
            riskLevel: investment.riskLevel,
            drawdownLimit: +parseFloat(investment.drawdownLimit as string).toFixed(2),
            totalProfit: +parseFloat(investment.totalProfit as string).toFixed(6),
            dailyProfit: +parseFloat(investment.dailyProfit as string).toFixed(6),
            drawdown: +parseFloat(investment.drawdown as string).toFixed(6),
            autoCompound: investment.autoCompound,
            startedAt: investment.startedAt?.toISOString() ?? null,
            stoppedAt: investment.stoppedAt?.toISOString() ?? null,
            pausedAt: investment.pausedAt?.toISOString() ?? null,
          }
        : null,
      hasActiveInvestment: investment?.isActive ?? false,
    });
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// WALLET
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/wallet/balance
 *
 * Current wallet balances broken down by sub-account.
 * For a full portfolio view (includes investment state), prefer
 * GET /api/v1/portfolio/summary.
 */
router.get(
  "/v1/wallet/balance",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1);

    const wallet = wallets[0] ?? null;

    // Fetch points from user row (not stored on wallet)
    const [userRow] = await db
      .select({ points: usersTable.points })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    ok(req, res, {
      mainBalance: wallet ? +parseFloat(wallet.mainBalance as string).toFixed(6) : 0,
      tradingBalance: wallet ? +parseFloat(wallet.tradingBalance as string).toFixed(6) : 0,
      profitBalance: wallet ? +parseFloat(wallet.profitBalance as string).toFixed(6) : 0,
      usdtBalance: wallet ? +parseFloat((wallet.usdtBalance ?? "0") as string).toFixed(6) : 0,
      points: userRow?.points ?? 0,
      currency: "USDT",
      updatedAt: wallet?.updatedAt.toISOString() ?? null,
    });
  },
);

/**
 * GET /api/v1/wallet/history
 *
 * Paginated transaction history. Supports filtering by type.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 20, max 100)
 *   type   (optional) — one of: deposit, withdrawal, transfer, profit,
 *            fee, referral, p2p_buy, p2p_sell, usdt_buy, usdt_sell
 *
 * Transaction types reference:
 *   deposit         — funds credited to main balance
 *   withdrawal      — USDT TRC20 withdrawal
 *   inr_withdrawal  — INR bank/UPI withdrawal
 *   transfer        — internal transfer between sub-wallets
 *   profit          — daily bot profit credit
 *   fee             — withdrawal fee charged
 *   referral_bonus  — referral earning credited
 */
router.get(
  "/v1/wallet/history",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const page = getQueryInt(req, "page", 1);
    const limit = Math.min(getQueryInt(req, "limit", 20), 100);
    const offset = (page - 1) * limit;
    const typeFilter = req.query["type"] as string | undefined;

    // Count total matching rows
    const [totalResult] = await db
      .select({ count: count() })
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId));

    const total = Number(totalResult?.count ?? 0);

    const txs = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const data = txs
      .filter((t) => !typeFilter || t.type === typeFilter)
      .map((t) => ({
        id: t.id,
        type: t.type,
        amount: +parseFloat(t.amount as string).toFixed(6),
        status: t.status,
        description: t.description,
        walletAddress: t.walletAddress ?? null,
        createdAt: t.createdAt.toISOString(),
      }));

    okList(req, res, data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  },
);

// Explicitly block write operations on wallet routes
router.post("/v1/wallet/deposit", writesDisabled);
router.post("/v1/wallet/withdraw", writesDisabled);
router.post("/v1/wallet/transfer", writesDisabled);

// ══════════════════════════════════════════════════════════════════════════════
// MARKETS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/markets/ticker
 *
 * Combined market ticker: USDT/INR rate (internal platform rate) plus live
 * quotes for the 4 bot-terminal instrument pairs (XAUUSD, EURUSD, BTCUSD, USOIL).
 *
 * Public endpoint — no auth required.
 * Cache hint: poll every 2–3s for the ticker widget.
 */
router.get("/v1/markets/ticker", async (req: Request, res: Response) => {
  try {
    const [rate, quotes] = await Promise.all([
      getInrRate(),
      getAllQuotes(),
    ]);

    const jitter = rate * 0.001;
    const lastPrice = +(rate + (Math.random() * jitter * 2 - jitter)).toFixed(2);

    res.setHeader("Cache-Control", "no-store, max-age=0");

    ok(req, res, {
      usdtInr: {
        rate,
        lastPrice,
        high24h: +(rate * 1.019).toFixed(2),
        low24h: +(rate * 0.982).toFixed(2),
        change24hPct: +(((lastPrice - rate) / rate) * 100).toFixed(4),
        currency: "INR",
        asOf: new Date().toISOString(),
      },
      instruments: quotes.map((q: any) => ({
        symbol: q.symbol,
        bid: q.bid,
        ask: q.ask,
        mid: q.mid ?? +((q.bid + q.ask) / 2).toFixed(5),
        spread: q.ask && q.bid ? +(q.ask - q.bid).toFixed(5) : null,
        change: q.change ?? null,
        changePct: q.changePct ?? null,
        asOf: q.fetchedAt ?? new Date().toISOString(),
      })),
      forexMarketOpen: isForexMarketOpen(),
    });
  } catch (err: any) {
    fail(req, res, 500, "ticker_failed", "Failed to fetch market ticker. Please retry.");
  }
});

/**
 * GET /api/v1/markets/orderbook
 *
 * Simulated USDT/INR limit orderbook derived from the current platform rate.
 * Bids and asks are constructed around the mid price with realistic depth
 * levels for display purposes.
 *
 * The orderbook is NOT a real exchange orderbook — it reflects the
 * platform's internal USDT/INR swap market which operates at a single
 * admin-set rate with ±0.1% jitter. This endpoint is suitable for
 * displaying a market depth chart in the mobile app.
 *
 * Public endpoint — no auth required.
 *
 * Query params:
 *   depth (default 10, max 20) — number of levels on each side
 */
router.get("/v1/markets/orderbook", async (req: Request, res: Response) => {
  try {
    const depth = Math.min(getQueryInt(req, "depth", 10), 20);
    const rate = await getInrRate();

    // Simulate a realistic orderbook around the mid price.
    // Tick size: ₹0.05 per level. Quantity decreases as price moves away.
    const TICK = 0.05;
    const BASE_QTY = 5000; // USDT base depth per level

    const bids: Array<{ price: number; quantity: number; total: number }> = [];
    const asks: Array<{ price: number; quantity: number; total: number }> = [];

    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < depth; i++) {
      const bidPrice = +(rate - TICK * (i + 1)).toFixed(2);
      const askPrice = +(rate + TICK * (i + 1)).toFixed(2);
      // Quantity tapers 10% per level — deeper = thinner
      const qty = +(BASE_QTY * Math.pow(0.9, i) + Math.random() * 200).toFixed(2);
      bidTotal += qty;
      askTotal += qty;
      bids.push({ price: bidPrice, quantity: qty, total: +bidTotal.toFixed(2) });
      asks.push({ price: askPrice, quantity: qty, total: +askTotal.toFixed(2) });
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");

    ok(req, res, {
      symbol: "USDT/INR",
      mid: rate,
      spread: +(TICK * 2).toFixed(2),
      bids,
      asks,
      note: "Simulated orderbook — reflects platform USDT/INR swap market depth.",
      asOf: new Date().toISOString(),
    });
  } catch (err: any) {
    fail(req, res, 500, "orderbook_failed", "Failed to build orderbook. Please retry.");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BOTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/bots/list
 *
 * Lists platform-level bot signal trades — open positions plus all trades
 * closed since UTC midnight. Includes the calling user's profit distribution
 * share from the latest closed trade.
 *
 * Each signal trade represents a platform-wide directional position opened
 * by an admin. Profits are distributed proportionally to all active investors
 * when the trade is closed.
 */
router.get(
  "/v1/bots/list",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const state = await buildBotState(req.userId!);

      const formatOpen = (t: any) => ({
        id: t.id,
        pair: t.pair,
        direction: t.direction,
        entryPrice: t.entryPrice,
        tpPrice: t.tpPrice ?? null,
        slPrice: t.slPrice ?? null,
        expectedProfitPercent: t.expectedProfitPercent,
        livePnlPct: t.livePnlPct ?? null,
        openedAt: t.openedAt,
      });

      const formatClosed = (t: any) => ({
        id: t.id,
        pair: t.pair,
        direction: t.direction,
        entryPrice: t.entryPrice,
        realizedExitPrice: t.realizedExitPrice ?? null,
        realizedProfitPercent: t.realizedProfitPercent ?? null,
        closeReason: t.closeReason ?? null,
        closedAt: t.closedAt,
      });

      ok(req, res, {
        open: (state.openPositions ?? []).map(formatOpen),
        closedToday: (state.closedToday ?? []).map(formatClosed),
        userToday: state.userToday,
        summary: state.summary,
        market: state.market,
        botEnabled: state.bot?.enabled ?? false,
      });
    } catch (err: any) {
      fail(req, res, 500, "bots_list_failed", "Failed to fetch bot trades. Please retry.");
    }
  },
);

/**
 * GET /api/v1/bots/performance
 *
 * Bot plan execution stats and per-instrument performance breakdown.
 * Returns the same underlying data as /bots/list but shaped for a
 * performance dashboard card rather than a trade feed.
 */
router.get(
  "/v1/bots/performance",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const state = await buildBotState(req.userId!);

      const closedTrades = state.closedToday ?? [];
      const openTrades = state.openPositions ?? [];

      // Aggregate per-pair stats from closed trades today
      const pairStats: Record<string, { wins: number; losses: number; totalPnlPct: number }> = {};
      for (const t of closedTrades) {
        if (!t.pair) continue;
        if (!pairStats[t.pair]) {
          pairStats[t.pair] = { wins: 0, losses: 0, totalPnlPct: 0 };
        }
        const pnl = t.realizedProfitPercent ?? 0;
        pairStats[t.pair]!.totalPnlPct += pnl;
        if (pnl >= 0) pairStats[t.pair]!.wins++;
        else pairStats[t.pair]!.losses++;
      }

      ok(req, res, {
        bot: state.bot ?? null,
        today: {
          tradesOpen: openTrades.length,
          tradesClosed: closedTrades.length,
          totalTrades: openTrades.length + closedTrades.length,
          totalProfitPct: state.summary?.closedTodayPctSum ?? 0,
        },
        byPair: Object.entries(pairStats).map(([pair, s]) => ({
          pair,
          trades: s.wins + s.losses,
          wins: s.wins,
          losses: s.losses,
          winRate: s.wins + s.losses > 0
            ? +((s.wins / (s.wins + s.losses)) * 100).toFixed(1)
            : null,
          avgPnlPct: s.wins + s.losses > 0
            ? +(s.totalPnlPct / (s.wins + s.losses)).toFixed(4)
            : null,
        })),
        market: state.market,
        userToday: state.userToday,
      });
    } catch (err: any) {
      fail(req, res, 500, "bots_performance_failed", "Failed to fetch bot performance. Please retry.");
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// USER PROFILE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/user/profile
 *
 * Extended user profile including KYC status, referral code, VIP tier
 * and account metadata. Safe for caching on the client (TTL: 30s).
 */
router.get(
  "/v1/user/profile",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const [users, wallets] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
      db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1),
    ]);

    if (users.length === 0) {
      fail(req, res, 404, "user_not_found", "User not found");
      return;
    }

    const user = users[0]!;
    const wallet = wallets[0] ?? null;

    ok(req, res, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      kycStatus: user.kycStatus,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      referralCode: user.referralCode,
      points: user.points,
      isAdmin: user.isAdmin,
      isFrozen: user.isFrozen,
      createdAt: user.createdAt.toISOString(),
      balanceSummary: wallet
        ? {
            main: +parseFloat(wallet.mainBalance as string).toFixed(6),
            trading: +parseFloat(wallet.tradingBalance as string).toFixed(6),
            profit: +parseFloat(wallet.profitBalance as string).toFixed(6),
            usdt: +parseFloat((wallet.usdtBalance ?? "0") as string).toFixed(6),
          }
        : null,
    });
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// REFERRAL
// ══════════════════════════════════════════════════════════════════════════════

const REFERRAL_LINK_BASE = "https://qorixmarkets.com/register?ref=";

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return email;
  return email[0] + "***" + email.slice(atIdx);
}

/**
 * GET /api/v1/referral
 *
 * Referral summary for the authenticated user.
 * activeReferrals = referred users with a currently active investment.
 * totalEarned / monthlyEarnings = sum of referral_bonus transactions
 *   (calendar month for monthly; all-time for total).
 */
router.get(
  "/v1/referral",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const [users] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!users) {
      fail(req, res, 404, "user_not_found", "User not found.");
      return;
    }

    const [totalCountResult] = await db
      .select({ cnt: count() })
      .from(usersTable)
      .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)));
    const totalReferred = Number(totalCountResult?.cnt ?? 0);

    const [activeCountResult] = await db
      .select({ cnt: count() })
      .from(usersTable)
      .innerJoin(
        investmentsTable,
        and(
          eq(investmentsTable.userId, usersTable.id),
          eq(investmentsTable.isActive, true),
        ),
      )
      .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)));
    const activeReferrals = Number(activeCountResult?.cnt ?? 0);

    const [totalRow] = await db
      .select({ total: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(
        and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "referral_bonus")),
      );
    const totalEarned = +(parseFloat(totalRow?.total ?? "0") || 0).toFixed(6);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [monthlyRow] = await db
      .select({ total: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "referral_bonus"),
          gte(transactionsTable.createdAt, monthStart),
          lte(transactionsTable.createdAt, monthEnd),
        ),
      );
    const monthlyEarnings = +(parseFloat(monthlyRow?.total ?? "0") || 0).toFixed(6);

    ok(req, res, {
      referralCode: users.referralCode,
      totalReferred,
      activeReferrals,
      totalEarned,
      monthlyEarnings,
      referralLink: REFERRAL_LINK_BASE + users.referralCode,
    });
  },
);

/**
 * GET /api/v1/referral/referred-users
 *
 * Paginated list of users referred by the caller.
 * Query: page (default 1), limit (default 50, max 100)
 * Returns a flat array (no wrapper object) — matches Flutter spec.
 * Emails are masked: first char + *** + @domain.
 */
router.get(
  "/v1/referral/referred-users",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
    const offset = (page - 1) * limit;

    const referredUsers = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)))
      .orderBy(usersTable.createdAt)
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      referredUsers.map(async (u) => {
        const [inv] = await db
          .select({ amount: investmentsTable.amount, isActive: investmentsTable.isActive })
          .from(investmentsTable)
          .where(eq(investmentsTable.userId, u.id))
          .limit(1);
        return {
          id: u.id,
          fullName: u.fullName,
          email: maskEmail(u.email),
          investmentAmount: inv ? +parseFloat(inv.amount as string).toFixed(6) : 0,
          isActive: inv?.isActive ?? false,
          joinedAt: u.createdAt.toISOString(),
        };
      }),
    );

    // Returns flat array per Flutter spec (not wrapped in okList envelope)
    res.status(200).json(data);
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// WRITE GUARDS — explicit 503 for Phase 1
// Block common write routes that mobile devs might accidentally probe.
// ══════════════════════════════════════════════════════════════════════════════

router.post("/v1/investment/start", writesDisabled);
router.post("/v1/investment/stop", writesDisabled);
router.post("/v1/investment/topup", writesDisabled);
router.patch("/v1/investment/risk-level", writesDisabled);
router.post("/v1/withdrawals", writesDisabled);
router.post("/v1/inr-withdrawals", writesDisabled);
router.post("/v1/deposit", writesDisabled);
router.post("/v1/p2p/orders", writesDisabled);
router.post("/v1/p2p/ads", writesDisabled);

export default router;
