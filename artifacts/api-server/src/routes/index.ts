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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(investmentRouter);
router.use(referralRouter);
router.use(dashboardRouter);
router.use(adminRouter);
router.use(notificationsRouter);
router.use(tradingDeskRouter);

export default router;
