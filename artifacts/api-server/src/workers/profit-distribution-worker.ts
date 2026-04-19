import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { distributeDailyProfit } from "../lib/profit-service";
import { profitLogger, errorLogger } from "../lib/logger";
import { emitProfitDistributionEvent } from "../lib/event-bus";
import type { ProfitDistributionJobData } from "../lib/queues";

export function startProfitDistributionWorker(): Worker {
  const worker = new Worker<ProfitDistributionJobData>(
    "profit-distribution",
    async (job) => {
      const { profitPercent, triggeredBy, triggeredAt } = job.data;

      profitLogger.info(
        { jobId: job.id, profitPercent, triggeredBy, triggeredAt },
        "Profit distribution job started",
      );

      const result = await distributeDailyProfit(profitPercent);

      profitLogger.info(
        {
          jobId: job.id,
          profitPercent,
          triggeredBy,
          investorsAffected: result.investorsAffected,
          totalProfitDistributed: result.totalProfitDistributed,
          referralBonusPaid: result.referralBonusPaid,
        },
        "Profit distribution job completed",
      );

      await emitProfitDistributionEvent({
        userId: 0,
        amount: result.totalProfitDistributed,
        adjustedProfitPercent: profitPercent,
        riskLevel: "all",
        autoCompound: false,
        summary: {
          investorsAffected: result.investorsAffected,
          totalProfitDistributed: result.totalProfitDistributed,
          referralBonusPaid: result.referralBonusPaid,
          triggeredBy,
        },
      });

      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    errorLogger.error(
      { jobId: job?.id, profitPercent: job?.data.profitPercent, err },
      "Profit distribution job failed",
    );
  });

  worker.on("error", (err) => {
    errorLogger.error({ err }, "Profit distribution worker error");
  });

  profitLogger.info("Profit distribution worker started");
  return worker;
}
