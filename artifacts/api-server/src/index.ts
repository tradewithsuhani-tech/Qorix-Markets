import { ensureRedisRunning } from "./lib/start-redis";
import { initSystemAccounts } from "./lib/ledger-service";
import { seedTasks } from "./lib/task-service";
import { seedSystemSettings } from "./lib/seed-settings";

// Gate single-instance background work (cron, Telegram poller, on-chain
// watchers, BullMQ workers) behind a single env flag so we can flip it off in
// Replit dev and on in Fly prod during the cutover window — without code
// edits and without double-firing the Telegram bot or duplicating cron.
// Defaults to "true" to preserve current Replit-dev behaviour; set
// RUN_BACKGROUND_JOBS=false on the Replit side once Fly is the source of truth.
const RUN_BACKGROUND_JOBS =
  (process.env["RUN_BACKGROUND_JOBS"] ?? "true").toLowerCase() !== "false";

async function main() {
  await ensureRedisRunning();
  await initSystemAccounts();
  await seedTasks();
  await seedSystemSettings();

  const { default: app } = await import("./app");
  const { logger, errorLogger } = await import("./lib/logger");

  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  // Background workers / pollers are only spun up on the designated
  // background-jobs machine. Other instances still serve HTTP requests but
  // skip the singletons.
  let profitDistributionWorker: { close: () => Promise<void> } | null = null;
  let depositWorker: { close: () => Promise<void> } | null = null;
  let profitEventWorker: { close: () => Promise<void> } | null = null;
  let tronMonitor: { stop: () => void } | null = null;
  let depositWatcher: { stop: () => void } | null = null;
  let telegramPoller: { stop: () => void } | null = null;

  if (RUN_BACKGROUND_JOBS) {
    const { startProfitDistributionWorker } = await import("./workers/profit-distribution-worker");
    const { startDepositWorker } = await import("./workers/deposit-worker");
    const { startProfitEventWorker } = await import("./workers/profit-event-worker");
    const { startTronMonitor } = await import("./lib/tron-monitor");
    const { startDepositWatcher } = await import("./lib/crypto-deposit/depositWatcher");
    const { startTelegramPoller } = await import("./lib/telegram-poller");

    profitDistributionWorker = startProfitDistributionWorker();
    depositWorker = startDepositWorker();
    profitEventWorker = startProfitEventWorker();
    tronMonitor = startTronMonitor();
    depositWatcher = startDepositWatcher();
    telegramPoller = startTelegramPoller();
    logger.info("Background jobs enabled (cron, Telegram poller, watchers, workers)");
  } else {
    logger.warn("RUN_BACKGROUND_JOBS=false — cron, Telegram poller, watchers, and workers are DISABLED on this instance");
  }

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal — closing workers and server");
    tronMonitor?.stop();
    depositWatcher?.stop();
    telegramPoller?.stop();
    await Promise.all([
      profitDistributionWorker?.close(),
      depositWorker?.close(),
      profitEventWorker?.close(),
    ].filter(Boolean) as Promise<void>[]);
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
    if (RUN_BACKGROUND_JOBS) {
      void import("./lib/cron").then(({ initCronJobs }) =>
        initCronJobs().catch((err) => {
          console.error("initCronJobs failed:", err);
        }),
      );
    }
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
