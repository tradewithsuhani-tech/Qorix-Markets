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

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(authRouter);
router.use(reportsRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(investmentRouter);
router.use(referralRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(notificationsRouter);
router.use(tradingDeskRouter);
router.use(fraudRouter);
router.use(leaderboardRouter);

export default router;
