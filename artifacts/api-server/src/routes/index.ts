import { Router, type IRouter } from "express";
import healthRouter from "./health";
import captchaRouter from "./captcha";
import authRouter from "./auth";
import walletRouter from "./wallet";
import transactionsRouter from "./transactions";
import investmentRouter from "./investment";
import referralRouter from "./referral";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import adminRbacRouter from "./admin-rbac";
import notificationsRouter from "./notifications";
import devicesRouter from "./devices";
import tradingDeskRouter from "./trading-desk";
import reportsRouter from "./reports";
import publicRouter from "./public";
import fraudRouter from "./fraud";
import leaderboardRouter from "./leaderboard";
import chatRouter from "./chat";
import depositRouter from "./deposit";
// DISABLED: legacy in-memory crypto-deposit router (POST /create-wallet,
// GET /balance/:address) issued addresses backed only by an in-process Map
// and a memory-only watcher. After disabling that watcher in
// background-jobs.ts, any address minted here would never get credited.
// The frontend uses /deposit/address (DB-backed, watched by tron-monitor).
// import cryptoDepositRouter from "./crypto-deposit";
import testModeRouter from "./test-mode";
import tasksRouter from "./tasks";
import adminTasksRouter from "./admin-tasks";
import signalTradesRouter from "./signal-trades";
import googleOauthRouter from "./google-oauth";
import kycRouter from "./kyc";
import promoRouter from "./promo";
import telegramRouter from "./telegram";
import twoFactorRouter from "./two-factor";
import inrDepositsRouter from "./inr-deposits";
import inrWithdrawalsRouter from "./inr-withdrawals";
import phoneVerifyRouter from "./phone-verify";
import phoneChangeRouter from "./phone-change";
import merchantRouter from "./merchant";
import adminMerchantsRouter from "./admin-merchants";
import adminEscalationRouter from "./admin-escalation";
// Batch R — Bot Trading Terminal. Currently exposes only the public
// /bot-trading/quotes feed used by the dashboard widget. Future
// batches will add user-gated endpoints (state, account, orders) on
// the same router; mounting once here keeps wiring stable.
import botTradingRouter from "./bot-trading";

const router: IRouter = Router();

// IMPORTANT: All routers that DO NOT call `router.use(authMiddleware)` at the
// router level (i.e. fully-public OR per-route auth) MUST be mounted BEFORE
// any router that gates the entire router with authMiddleware. Otherwise,
// requests for public routes (e.g. /auth/google, /kyc per-route auth) will
// be intercepted by the first auth-gated router they encounter and respond
// with 401 Unauthorized before ever reaching the intended handler.
router.use(healthRouter);
router.use(publicRouter);
// Slider captcha (B9.1) — fully public; both endpoints
// (POST /captcha/slider/challenge, /verify) need to be reachable
// PRE-auth so signup/login forms can solve the puzzle before they
// have a token. Mounted in the public block to make the public
// intent obvious. State is in-memory + HMAC-signed envelopes (see
// lib/slider-captcha-service.ts) — multi-instance safe.
router.use(captchaRouter);
// router.use(cryptoDepositRouter); // DISABLED — see import comment above
router.use(authRouter);
router.use(googleOauthRouter); // public OAuth — must be before auth-gated routers
router.use(kycRouter); // per-route authMiddleware — must be before router-level auth gates
// Merchant panel — own JWT (separate from user/admin auth). The login route
// (POST /merchant/auth/login) is the ONLY public merchant endpoint; every
// other route inside merchantRouter is gated by a path-prefixed
// `router.use("/merchant", merchantAuthMiddleware)`. Mounting this BEFORE
// any router-level naked `router.use(authMiddleware)` is REQUIRED so
// /merchant/auth/login can fall through to its own handler instead of being
// 401'd by an upstream user/admin authMiddleware that doesn't recognise
// merchant tokens. Same reason kycRouter is hoisted above.
router.use(merchantRouter);
router.use(reportsRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(investmentRouter);
router.use(referralRouter);
router.use(dashboardRouter);
router.use(chatRouter);
router.use(adminRouter);
router.use(adminRbacRouter);
router.use(notificationsRouter);
router.use(devicesRouter);
router.use(tradingDeskRouter);
router.use(fraudRouter);
router.use(leaderboardRouter);
router.use(depositRouter);
router.use(testModeRouter);
router.use(tasksRouter);
router.use(adminTasksRouter);
router.use(signalTradesRouter);
router.use(promoRouter);
router.use(telegramRouter);
router.use(twoFactorRouter);
router.use(inrDepositsRouter);
router.use(inrWithdrawalsRouter);
router.use(phoneVerifyRouter);
router.use(phoneChangeRouter);
// Merchant panel — own JWT (separate from user/admin auth). Login is the
// only public endpoint; everything else is gated by merchantAuthMiddleware.
router.use(merchantRouter);
router.use(adminMerchantsRouter);
router.use(adminEscalationRouter);
// Batch R — public quotes feed for the dashboard Bot Trading Terminal
// widget. /bot-trading/quotes is fully public (no auth); future
// per-user endpoints on this router will gate auth per-route.
router.use(botTradingRouter);

export default router;
