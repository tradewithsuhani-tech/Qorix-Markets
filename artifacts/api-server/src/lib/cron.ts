import cron from "node-cron";
import { logger } from "./logger";
import { distributeDailyProfit, getLastDailyProfitPercent, transferProfitToMain } from "./profit-service";

export function initCronJobs(): void {
  // Daily at midnight: distribute profit to all active investors
  // Uses the last profit % set by admin; skips if no rate has been configured
  cron.schedule("0 0 * * *", async () => {
    logger.info("Cron: daily profit distribution starting");
    try {
      const profitPercent = await getLastDailyProfitPercent();
      if (profitPercent === 0) {
        logger.info("Cron: daily profit distribution skipped — no profit rate configured");
        return;
      }
      const result = await distributeDailyProfit(profitPercent);
      logger.info(
        {
          profitPercent,
          investorsAffected: result.investorsAffected,
          totalProfitDistributed: result.totalProfitDistributed,
          referralBonusPaid: result.referralBonusPaid,
        },
        "Cron: daily profit distribution complete",
      );
    } catch (err) {
      logger.error({ err }, "Cron: daily profit distribution failed");
    }
  });

  // Monthly on the 25th at midnight: transfer all profit balances to main wallet
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
      logger.error({ err }, "Cron: monthly profit-to-main transfer failed");
    }
  });

  logger.info("Cron: jobs registered — daily profit (00:00), monthly payout (25th 00:00)");
}
