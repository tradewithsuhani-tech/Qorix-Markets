import { ensureRedisRunning } from "./lib/start-redis";
import { initSystemAccounts } from "./lib/ledger-service";
import { seedTasks } from "./lib/task-service";

async function main() {
  await ensureRedisRunning();
  await initSystemAccounts();
  await seedTasks();

  const { default: app } = await import("./app");
  const { logger, errorLogger } = await import("./lib/logger");
  const { initCronJobs } = await import("./lib/cron");
  const { startProfitDistributionWorker } = await import("./workers/profit-distribution-worker");
  const { startDepositWorker } = await import("./workers/deposit-worker");
  const { startProfitEventWorker } = await import("./workers/profit-event-worker");
  const { startTronMonitor } = await import("./lib/tron-monitor");
  const { startDepositWatcher } = await import("./lib/crypto-deposit/depositWatcher");

  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  const profitDistributionWorker = startProfitDistributionWorker();
  const depositWorker = startDepositWorker();
  const profitEventWorker = startProfitEventWorker();
  const tronMonitor = startTronMonitor();
  const depositWatcher = startDepositWatcher();

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal — closing workers and server");
    tronMonitor.stop();
    depositWatcher.stop();
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
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      const msg = "RECAPTCHA_SECRET_KEY not set — captcha is DISABLED on /auth routes";
      if (process.env.NODE_ENV === "production") errorLogger.error(msg);
      else logger.warn(msg);
    }
    if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
      const msg = "SMTP not fully configured (need SES_FROM_EMAIL + SMTP_PASS) — emails will NOT be delivered";
      if (process.env.NODE_ENV === "production") errorLogger.error(msg);
      else logger.warn(msg);
    }
    initCronJobs();
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
