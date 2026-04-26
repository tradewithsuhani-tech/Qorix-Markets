import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import transactionsRouter from "./transactions";
import investmentRouter from "./investment";
import referralRouter from "./referral";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";
import tradingDeskRouter from "./trading-desk";
import reportsRouter from "./reports";
import publicRouter from "./public";
import fraudRouter from "./fraud";
import leaderboardRouter from "./leaderboard";
import chatRouter from "./chat";
import depositRouter from "./deposit";
import cryptoDepositRouter from "./crypto-deposit";
import testModeRouter from "./test-mode";
import tasksRouter from "./tasks";
import adminTasksRouter from "./admin-tasks";
import signalTradesRouter from "./signal-trades";
import googleOauthRouter from "./google-oauth";
import kycRouter from "./kyc";
import promoRouter from "./promo";
import telegramRouter from "./telegram";
import twoFactorRouter from "./two-factor";

const router: IRouter = Router();

// IMPORTANT: All routers that DO NOT call `router.use(authMiddleware)` at the
// router level (i.e. fully-public OR per-route auth) MUST be mounted BEFORE
// any router that gates the entire router with authMiddleware. Otherwise,
// requests for public routes (e.g. /auth/google, /kyc per-route auth) will
// be intercepted by the first auth-gated router they encounter and respond
// with 401 Unauthorized before ever reaching the intended handler.
router.use(healthRouter);
router.use(publicRouter);
router.use(cryptoDepositRouter);
router.use(authRouter);
router.use(googleOauthRouter); // public OAuth — must be before auth-gated routers
router.use(kycRouter); // per-route authMiddleware — must be before router-level auth gates
router.use(reportsRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(investmentRouter);
router.use(referralRouter);
router.use(dashboardRouter);
router.use(chatRouter);
router.use(adminRouter);
router.use(notificationsRouter);
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

export default router;
