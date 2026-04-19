import { ensureRedisRunning } from "./lib/start-redis";

async function main() {
  await ensureRedisRunning();

  const { default: app } = await import("./app");
  const { logger, errorLogger } = await import("./lib/logger");
  const { initCronJobs } = await import("./lib/cron");
  const { startProfitDistributionWorker } = await import("./workers/profit-distribution-worker");
  const { startDepositWorker } = await import("./workers/deposit-worker");
  const { startProfitEventWorker } = await import("./workers/profit-event-worker");

  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  const profitDistributionWorker = startProfitDistributionWorker();
  const depositWorker = startDepositWorker();
  const profitEventWorker = startProfitEventWorker();

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal — closing workers and server");
    await Promise.all([
      profitDistributionWorker.close(),
      depositWorker.close(),
      profitEventWorker.close(),
    ]);
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  app.listen(port, (err?: Error) => {
    if (err) {
      errorLogger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    initCronJobs();
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
