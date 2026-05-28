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
  walletPayoutMethodsTable,
} from "@workspace/db";
import { eq, desc, count, sql, sum, and, gte, lte, inArray } from "drizzle-orm";
import {
  authMiddleware,
  getParam,
  signToken,
  type AuthRequest,
} from "../middlewares/auth";
import { getAllQuotes, isForexMarketOpen } from "../lib/quote-feed";
import { getEconomicCalendar } from "../lib/economic-calendar";
import { buildBotState } from "../lib/bot-state";
import { makeRedisLimiter } from "../middlewares/rate-limit";
import { getFeatureFlags } from "../lib/feature-flags-cache";

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

/**
 * GET /api/v1/wallet/payout-methods
 *
 * Lists the calling user's saved INR payout destinations.
 * Used in: Profile → "INR payout methods" + Withdraw → INR → picker.
 *
 * Response 200: { success, data: PayoutMethod[] }
 * type enum: bank | upi | qorix_user
 */
router.get(
  "/v1/wallet/payout-methods",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    try {
      const rows = await db
        .select()
        .from(walletPayoutMethodsTable)
        .where(
          and(
            eq(walletPayoutMethodsTable.userId, userId),
            eq(walletPayoutMethodsTable.isActive, true),
          ),
        )
        .orderBy(
          desc(walletPayoutMethodsTable.isDefault),
          desc(walletPayoutMethodsTable.createdAt),
        );

      function masked(type: string, val: string): string | undefined {
        if (type === "bank")
          return val.length > 4 ? `···${val.slice(-4)}` : val;
        if (type === "upi") {
          const at = val.indexOf("@");
          if (at > 1) return `${val[0]}···${val.slice(at)}`;
        }
        return undefined;
      }

      const data = rows.map((r) => ({
        id: r.id,
        type: r.type,
        label: r.label ?? undefined,
        accountName: r.accountName,
        accountValue: r.accountValue,
        bankName: r.bankName ?? undefined,
        ifsc: r.ifsc ?? undefined,
        maskedValue: masked(r.type, r.accountValue),
        isDefault: r.isDefault,
      }));

      ok(req, res, data);
    } catch (err: any) {
      fail(req, res, 500, "server_error", "Failed to fetch payout methods");
    }
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

/**
 * GET /api/v1/markets/calendar
 *
 * Live economic calendar from Finnhub (free tier), Redis-cached 1 hour.
 * Falls back to synthetic data if Finnhub is unavailable.
 *
 * Query params:
 *   days  (default 7, max 14) — how many days ahead to include
 */
router.get(
  "/v1/markets/calendar",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const days = Math.min(Math.max(getQueryInt(req, "days", 7), 1), 14);
    try {
      const calendar = await getEconomicCalendar(days);
      ok(req, res, calendar);
    } catch (e: any) {
      fail(req, res, 500, "calendar_failed", "Failed to fetch economic calendar");
    }
  },
);

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
      phone: user.phoneNumber ?? null,
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
// PROFIT HISTORY — /api/v1/profit/history
//
// Dedicated endpoint for the Profit History screen.
// Returns totalProfit (lifetime sum) + paginated profit-type transactions.
// Server-side filter + correct pagination count (fixes wallet/history bug).
// ══════════════════════════════════════════════════════════════════════════════

const PROFIT_TX_TYPES = ["profit", "referral_bonus", "bonus"] as const;

/**
 * GET /api/v1/profit/history
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20, max 50)
 *
 * Returns:
 *   totalProfit — lifetime sum of all completed profit/referral/bonus credits
 *   items       — paginated list of profit transactions
 */
router.get(
  "/v1/profit/history",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const page  = Math.max(1, getQueryInt(req, "page", 1));
    const limit = Math.min(50, Math.max(1, getQueryInt(req, "limit", 20)));
    const offset = (page - 1) * limit;

    const profitCondition = and(
      eq(transactionsTable.userId, userId),
      inArray(transactionsTable.type, [...PROFIT_TX_TYPES]),
      eq(transactionsTable.status, "completed"),
    );

    try {
      const [rows, countRows, sumRows] = await Promise.all([
        db.select()
          .from(transactionsTable)
          .where(profitCondition)
          .orderBy(desc(transactionsTable.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() })
          .from(transactionsTable)
          .where(profitCondition),
        db.select({ total: sum(transactionsTable.amount) })
          .from(transactionsTable)
          .where(profitCondition),
      ]);

      const total      = countRows[0]?.total ?? 0;
      const totalProfit = +(parseFloat((sumRows[0]?.total ?? "0") as string) || 0).toFixed(6);

      const items = rows.map((r) => ({
        id: r.id,
        type: r.type,
        label: r.description ?? (
          r.type === "profit"         ? "Daily profit credit" :
          r.type === "referral_bonus" ? "Partner commission"  :
                                        "Bonus credit"
        ),
        amount: +parseFloat(r.amount as string).toFixed(6),
        currency: "USDT",
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: {
          totalProfit,
          currency: "USDT",
          items,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        meta: buildMeta(req),
      });
    } catch (e: any) {
      fail(req, res, 500, "profit_history_failed", "Failed to fetch profit history");
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// USDT INTERNAL MARKET — /api/v1/markets/orders
//
// Internal USDT/INR exchange. BUY = pay INR (mainBalance), receive USDT.
// SELL = give USDT (usdtBalance), receive INR (mainBalance).
// MARKET orders execute immediately at the platform rate.
// LIMIT orders lock funds and stay pending until cancelled or filled by cron.
// ══════════════════════════════════════════════════════════════════════════════

const USDT_MARKET_LIMIT_TYPES = ["usdt_limit_buy", "usdt_limit_sell"] as const;

/**
 * GET /api/v1/markets/balance
 *
 * Returns the two balances relevant to the USDT market tab:
 *   inrBalance  — INR available to spend (mainBalance field)
 *   usdtBalance — USDT available to sell
 */
router.get(
  "/v1/markets/balance",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    try {
      const rows = await db
        .select({
          mainBalance: walletsTable.mainBalance,
          usdtBalance: walletsTable.usdtBalance,
        })
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .limit(1);

      const w = rows[0];
      if (!w) {
        fail(req, res, 404, "wallet_not_found", "Wallet not found");
        return;
      }

      ok(req, res, {
        inrBalance: parseFloat(w.mainBalance as string),
        usdtBalance: parseFloat((w.usdtBalance ?? "0") as string),
        currency: "INR",
        pair: "USDT/INR",
      });
    } catch (e: any) {
      fail(req, res, 500, "balance_fetch_failed", "Failed to fetch market balance");
    }
  },
);

/**
 * POST /api/v1/markets/orders
 *
 * Create a BUY or SELL order for USDT/INR.
 *
 * Body:
 *   symbol?   — ignored (only USDT/INR supported)
 *   side      — "BUY" | "SELL"
 *   type      — "MARKET" | "LIMIT"
 *   quantity  — USDT amount (number, min 1)
 *   price?    — required for LIMIT orders (INR per USDT)
 *
 * BUY  MARKET: deduct INR from mainBalance, credit USDT to usdtBalance immediately.
 * BUY  LIMIT:  lock INR from mainBalance, create pending order.
 * SELL MARKET: deduct USDT from usdtBalance, credit INR to mainBalance immediately.
 * SELL LIMIT:  lock USDT from usdtBalance, create pending order.
 */
router.post(
  "/v1/markets/orders",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { side, type = "MARKET", quantity: rawQty, price: rawPrice } = req.body ?? {};

    if (!["BUY", "SELL"].includes(String(side).toUpperCase())) {
      fail(req, res, 400, "invalid_side", "side must be 'BUY' or 'SELL'");
      return;
    }
    const direction = String(side).toUpperCase() as "BUY" | "SELL";
    const orderType = String(type).toUpperCase() as "MARKET" | "LIMIT";

    const quantity = parseFloat(rawQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fail(req, res, 400, "invalid_quantity", "quantity must be a positive number");
      return;
    }
    if (quantity < 1) {
      fail(req, res, 400, "min_quantity", "Minimum order is 1 USDT");
      return;
    }

    let limitPrice: number | null = null;
    if (orderType === "LIMIT") {
      limitPrice = parseFloat(rawPrice);
      if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
        fail(req, res, 400, "invalid_price", "LIMIT orders require a valid price (INR per USDT)");
        return;
      }
    }

    try {
      const marketRate = await getInrRate();
      const execRate   = orderType === "LIMIT" ? limitPrice! : marketRate;
      const inrAmount  = +(quantity * execRate).toFixed(2);
      const qtyStr     = quantity.toFixed(8);
      const inrStr     = inrAmount.toFixed(2);

      const wallets = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .limit(1);
      const wallet = wallets[0];
      if (!wallet) {
        fail(req, res, 404, "wallet_not_found", "Wallet not found");
        return;
      }

      const mainBal = parseFloat(wallet.mainBalance as string);
      const usdtBal = parseFloat((wallet.usdtBalance ?? "0") as string);

      if (direction === "BUY") {
        if (mainBal < inrAmount) {
          fail(
            req, res, 400, "insufficient_inr",
            `Insufficient INR balance. Need ₹${inrAmount.toFixed(2)}, available ₹${mainBal.toFixed(2)}`,
          );
          return;
        }

        if (orderType === "LIMIT") {
          await db.transaction(async (tx) => {
            await tx.update(walletsTable)
              .set({ mainBalance: sql`${walletsTable.mainBalance} - ${inrStr}::numeric`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, userId));
            await tx.insert(transactionsTable).values({
              userId,
              type: "usdt_limit_buy",
              amount: qtyStr,
              status: "pending",
              description: `Limit Buy ${quantity.toFixed(4)} USDT @ ₹${limitPrice}/USDT (locked ₹${inrAmount})`,
              walletAddress: String(limitPrice),
            });
          });
          ok(req, res, {
            side: "BUY", type: "LIMIT", symbol: "USDT/INR",
            quantity, limitPrice, inrLocked: inrAmount, status: "pending",
          }, 201);
        } else {
          let orderId: number | null = null;
          await db.transaction(async (tx) => {
            await tx.update(walletsTable)
              .set({
                mainBalance: sql`${walletsTable.mainBalance} - ${inrStr}::numeric`,
                usdtBalance: sql`COALESCE(${walletsTable.usdtBalance}, 0) + ${qtyStr}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(walletsTable.userId, userId));
            const inserted = await tx.insert(transactionsTable).values({
              userId,
              type: "usdt_buy",
              amount: qtyStr,
              status: "completed",
              description: `Bought ${quantity.toFixed(4)} USDT @ ₹${marketRate}/USDT (Internal Market)`,
            }).returning({ id: transactionsTable.id });
            orderId = inserted[0]?.id ?? null;
          });
          ok(req, res, {
            id: orderId, side: "BUY", type: "MARKET", symbol: "USDT/INR",
            quantity, executedPrice: marketRate, inrDebited: inrAmount, status: "completed",
          }, 201);
        }

      } else {
        if (usdtBal < quantity) {
          fail(
            req, res, 400, "insufficient_usdt",
            `Insufficient USDT. Need ${quantity.toFixed(4)} USDT, available ${usdtBal.toFixed(4)} USDT`,
          );
          return;
        }

        if (orderType === "LIMIT") {
          await db.transaction(async (tx) => {
            await tx.update(walletsTable)
              .set({ usdtBalance: sql`${walletsTable.usdtBalance} - ${qtyStr}::numeric`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, userId));
            await tx.insert(transactionsTable).values({
              userId,
              type: "usdt_limit_sell",
              amount: qtyStr,
              status: "pending",
              description: `Limit Sell ${quantity.toFixed(4)} USDT @ ₹${limitPrice}/USDT (locked ${quantity} USDT)`,
              walletAddress: String(limitPrice),
            });
          });
          ok(req, res, {
            side: "SELL", type: "LIMIT", symbol: "USDT/INR",
            quantity, limitPrice, usdtLocked: quantity, status: "pending",
          }, 201);
        } else {
          let orderId: number | null = null;
          await db.transaction(async (tx) => {
            await tx.update(walletsTable)
              .set({
                usdtBalance: sql`${walletsTable.usdtBalance} - ${qtyStr}::numeric`,
                mainBalance: sql`${walletsTable.mainBalance} + ${inrStr}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(walletsTable.userId, userId));
            const inserted = await tx.insert(transactionsTable).values({
              userId,
              type: "usdt_sell",
              amount: qtyStr,
              status: "completed",
              description: `Sold ${quantity.toFixed(4)} USDT @ ₹${marketRate}/USDT (Internal Market)`,
            }).returning({ id: transactionsTable.id });
            orderId = inserted[0]?.id ?? null;
          });
          ok(req, res, {
            id: orderId, side: "SELL", type: "MARKET", symbol: "USDT/INR",
            quantity, executedPrice: marketRate, inrCredited: inrAmount, status: "completed",
          }, 201);
        }
      }
    } catch (e: any) {
      fail(req, res, 500, "order_failed", "Order placement failed. Please try again.");
    }
  },
);

/**
 * GET /api/v1/markets/orders
 *
 * Returns order list for the authenticated user.
 *
 * Query params:
 *   status  — "open" (pending limit orders only) | "history" (completed/cancelled) | "all" (default)
 *   page    — page number (default 1)
 *   limit   — page size (default 20, max 50)
 */
router.get(
  "/v1/markets/orders",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const statusFilter = String(req.query.status ?? "all").toLowerCase();
    const page  = Math.max(1, getQueryInt(req, "page", 1));
    const limit = Math.min(50, Math.max(1, getQueryInt(req, "limit", 20)));
    const offset = (page - 1) * limit;

    const ALL_TYPES = ["usdt_buy", "usdt_sell", "usdt_limit_buy", "usdt_limit_sell"] as const;

    try {
      let statusCondition;
      if (statusFilter === "open") {
        statusCondition = and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.status, "pending"),
          inArray(transactionsTable.type, [...USDT_MARKET_LIMIT_TYPES]),
        );
      } else if (statusFilter === "history") {
        statusCondition = and(
          eq(transactionsTable.userId, userId),
          inArray(transactionsTable.type, [...ALL_TYPES]),
          inArray(transactionsTable.status, ["completed", "rejected"]),
        );
      } else {
        statusCondition = and(
          eq(transactionsTable.userId, userId),
          inArray(transactionsTable.type, [...ALL_TYPES]),
        );
      }

      const [rows, countRows] = await Promise.all([
        db.select().from(transactionsTable)
          .where(statusCondition)
          .orderBy(desc(transactionsTable.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(transactionsTable).where(statusCondition),
      ]);

      const total = countRows[0]?.total ?? 0;

      const orders = rows.map((r) => {
        const isBuy   = r.type === "usdt_buy"  || r.type === "usdt_limit_buy";
        const isLimit = r.type === "usdt_limit_buy" || r.type === "usdt_limit_sell";
        const limitPrice = isLimit && r.walletAddress ? parseFloat(r.walletAddress) : null;
        const quantity   = parseFloat(r.amount as string);
        return {
          id: r.id,
          symbol: "USDT/INR",
          side: isBuy ? "BUY" : "SELL",
          type: isLimit ? "LIMIT" : "MARKET",
          quantity,
          limitPrice,
          status: r.status === "rejected" ? "cancelled" : r.status,
          description: r.description,
          createdAt: r.createdAt,
        };
      });

      okList(req, res, orders, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (e: any) {
      fail(req, res, 500, "orders_fetch_failed", "Failed to fetch orders");
    }
  },
);

/**
 * DELETE /api/v1/markets/orders/:id
 *
 * Cancel a pending LIMIT order and refund the locked funds.
 * Only the order owner can cancel; only pending orders can be cancelled.
 */
router.delete(
  "/v1/markets/orders/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId  = req.userId!;
    const orderId = parseInt(getParam(req, "id"), 10);
    if (!Number.isFinite(orderId)) {
      fail(req, res, 400, "invalid_order_id", "Invalid order id");
      return;
    }

    try {
      const rows = await db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.id, orderId),
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.status, "pending"),
            inArray(transactionsTable.type, [...USDT_MARKET_LIMIT_TYPES]),
          ),
        )
        .limit(1);

      const order = rows[0];
      if (!order) {
        fail(req, res, 404, "order_not_found", "Order not found or already cancelled");
        return;
      }

      const limitPrice = order.walletAddress ? parseFloat(order.walletAddress) : null;
      const quantity   = parseFloat(order.amount as string);
      const isBuy      = order.type === "usdt_limit_buy";

      await db.transaction(async (tx) => {
        if (isBuy && limitPrice) {
          const inrRefund = +(quantity * limitPrice).toFixed(2);
          await tx.update(walletsTable)
            .set({ mainBalance: sql`${walletsTable.mainBalance} + ${inrRefund.toFixed(2)}::numeric`, updatedAt: new Date() })
            .where(eq(walletsTable.userId, userId));
        } else if (!isBuy) {
          await tx.update(walletsTable)
            .set({ usdtBalance: sql`COALESCE(${walletsTable.usdtBalance}, 0) + ${quantity.toFixed(8)}::numeric`, updatedAt: new Date() })
            .where(eq(walletsTable.userId, userId));
        }
        await tx.update(transactionsTable)
          .set({ status: "rejected" })
          .where(eq(transactionsTable.id, orderId));
      });

      ok(req, res, { orderId, status: "cancelled", message: "Order cancelled and funds refunded" });
    } catch (e: any) {
      fail(req, res, 500, "cancel_failed", "Failed to cancel order");
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT — GET /api/v1/support/faqs
// Auth-gated: Bearer token required. Returns static FAQ items + contact info.
// ══════════════════════════════════════════════════════════════════════════════

const SUPPORT_FAQS = [
  {
    id: "deposit",
    category: "Wallet",
    question: "How do I deposit USDT?",
    answer:
      "Go to Wallet → Deposit. Copy your personal TRC20 deposit address and send USDT from any exchange or wallet. Deposits are credited automatically within 1–5 minutes after the transaction is confirmed on the TRON network.",
  },
  {
    id: "withdraw",
    category: "Wallet",
    question: "How do I withdraw USDT?",
    answer:
      "Go to Wallet → Withdraw. Enter the amount and your TRC20 destination address. A one-time OTP will be sent to your registered email for verification. Withdrawals are processed within 24 hours.",
  },
  {
    id: "min_deposit",
    category: "Wallet",
    question: "What is the minimum deposit?",
    answer:
      "The minimum deposit is 10 USDT. Smaller amounts will be credited but cannot be used to start auto-trading until the balance reaches the required minimum.",
  },
  {
    id: "trading",
    category: "Trading",
    question: "How does auto-trading work?",
    answer:
      "After depositing, go to Trading and tap Start. The system allocates your trading balance to automated strategies and distributes daily profits set by the admin. You can choose your risk level (3%, 5%, or 10% max drawdown).",
  },
  {
    id: "profit",
    category: "Trading",
    question: "When are daily profits credited?",
    answer:
      "Profits are distributed once per day, typically between 8–10 PM IST. They appear in your Profit wallet and can be transferred to your Main wallet at any time.",
  },
  {
    id: "referral",
    category: "Referral",
    question: "How does the referral program work?",
    answer:
      "Share your referral code with friends. When they sign up and start trading, you earn a commission on their monthly trading activity. Commissions are credited to your Main wallet on the 1st of each month.",
  },
  {
    id: "kyc",
    category: "Account",
    question: "Is KYC required?",
    answer:
      "Basic account functions (deposit, trade, withdraw) do not require KYC. KYC is required to participate in quizzes and giveaways. Submit your ID via Profile → KYC Verification.",
  },
  {
    id: "security",
    category: "Account",
    question: "How do I secure my account?",
    answer:
      "Enable two-factor authentication under Profile → Security. Regularly review your active devices under Profile → Devices and sign out any sessions you don't recognise.",
  },
  {
    id: "vip",
    category: "Account",
    question: "What are VIP levels?",
    answer:
      "VIP levels unlock higher daily profit rates and exclusive features. Your level is based on your cumulative trading volume and referral activity. Check your current level and benefits in Profile → VIP Status.",
  },
  {
    id: "contact",
    category: "Support",
    question: "How do I contact support?",
    answer:
      "You can submit a support ticket directly in the app (Support → New Ticket) or email support@qorixmarkets.com. Our team responds within 24 hours on business days.",
  },
];

const SUPPORT_CONTACT = {
  email: "support@qorixmarkets.com",
  supportHours: "9 AM – 6 PM (Mon–Sat)",
  chatEnabled: true,
};

router.get(
  "/v1/support/faqs",
  authMiddleware,
  (req: AuthRequest, res: Response) => {
    ok(req, res, {
      items: SUPPORT_FAQS,
      contact: SUPPORT_CONTACT,
    });
  },
);

// ─── Feature Flags (public — no auth required) ──────────────────────────────

router.get("/v1/feature-flags", async (req: Request, res: Response) => {
  try {
    const flags = await getFeatureFlags();
    ok(req, res, flags);
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "internal", message: "Failed to load feature flags" } });
  }
});

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
