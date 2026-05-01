import { Worker } from "bullmq";
import { newBullMQConnection } from "../lib/redis";
import { profitLogger, errorLogger } from "../lib/logger";
import type { ProfitDistributionEventJobData } from "../lib/queues";

export function startProfitEventWorker(): Worker {
  const worker = new Worker<ProfitDistributionEventJobData>(
    "profit-distribution-event",
    async (job) => {
      const {
        userId,
        amount,
        adjustedProfitPercent,
        riskLevel,
        autoCompound,
        triggeredAt,
        summary,
      } = job.data;

      if (summary) {
        profitLogger.info(
          {
            jobId: job.id,
            event: "profit_distribution_completed",
            triggeredAt,
            investorsAffected: summary.investorsAffected,
            totalProfitDistributed: summary.totalProfitDistributed,
            referralBonusPaid: summary.referralBonusPaid,
            triggeredBy: summary.triggeredBy,
          },
          "Profit distribution batch completed",
        );
      } else {
        profitLogger.info(
          {
            jobId: job.id,
            event: "profit_credited",
            userId,
            amount,
            adjustedProfitPercent,
            riskLevel,
            autoCompound,
            triggeredAt,
          },
          "Per-investor profit distribution event processed",
        );
      }
    },
    {
      connection: newBullMQConnection(),
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    errorLogger.error(
      {
        jobId: job?.id,
        userId: job?.data.userId,
        amount: job?.data.amount,
        err,
      },
      "Profit distribution event job failed",
    );
  });

  worker.on("error", (err) => {
    errorLogger.error({ err }, "Profit event worker error");
  });

  profitLogger.info("Profit distribution event worker started");
  return worker;
}
