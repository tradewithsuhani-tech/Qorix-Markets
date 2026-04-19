import cron from "node-cron";
import { logger, profitLogger, errorLogger } from "./logger";
import { getLastDailyProfitPercent, transferProfitToMain } from "./profit-service";
import { emitProfitDistribution } from "./event-bus";

export function initCronJobs(): void {
  cron.schedule("0 0 * * *", async () => {
    profitLogger.info("Cron: daily profit distribution — enqueuing job");
    try {
      const profitPercent = await getLastDailyProfitPercent();
      if (profitPercent === 0) {
        profitLogger.info("Cron: daily profit distribution skipped — no profit rate configured");
        return;
      }
      await emitProfitDistribution({ profitPercent, triggeredBy: "cron" });
      profitLogger.info({ profitPercent }, "Cron: profit distribution job enqueued");
    } catch (err) {
      errorLogger.error({ err }, "Cron: failed to enqueue daily profit distribution");
    }
  });

  cron.schedule("0 0 25 * *", async () => {
    logger.info("Cron: monthly profit-to-main transfer starting");
    try {
      const result = await transferProfitToMain();
      logger.info(
        {
          usersProcessed: result.usersProcessed,
          totalTransferred: result.totalTransferred,
        },
        "Cron: monthly profit-to-main transfer complete",
      );
    } catch (err) {
      errorLogger.error({ err }, "Cron: monthly profit-to-main transfer failed");
    }
  });

  logger.info("Cron: jobs registered — daily profit (00:00), monthly payout (25th 00:00)");
}
