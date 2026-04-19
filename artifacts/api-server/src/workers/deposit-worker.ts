import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { transactionLogger, errorLogger } from "../lib/logger";
import type { DepositEventJobData } from "../lib/queues";

export function startDepositWorker(): Worker {
  const worker = new Worker<DepositEventJobData>(
    "deposit-event",
    async (job) => {
      const { userId, amount, newMainBalance, triggeredAt } = job.data;

      transactionLogger.info(
        {
          jobId: job.id,
          event: "deposit",
          userId,
          amount,
          newMainBalance,
          triggeredAt,
        },
        "Deposit event processed",
      );
    },
    {
      connection: redisConnection,
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
      "Deposit event job failed",
    );
  });

  worker.on("error", (err) => {
    errorLogger.error({ err }, "Deposit worker error");
  });

  transactionLogger.info("Deposit event worker started");
  return worker;
}
