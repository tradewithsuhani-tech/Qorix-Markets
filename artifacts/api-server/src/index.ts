import { ensureRedisRunning } from "./lib/start-redis";
import { initSystemAccounts } from "./lib/ledger-service";
import { seedTasks } from "./lib/task-service";
import { seedSystemSettings } from "./lib/seed-settings";
import { runWalletEncryptionPreflight } from "./lib/wallet-preflight";
import { flagSmokeTestAccount } from "./lib/smoke-test-account";
import { getMaintenanceState } from "./middlewares/maintenance";

// Gate single-instance background work (cron, Telegram poller, on-chain
// watchers, BullMQ workers) behind a single env flag so we can flip it off in
// Replit dev and on in Fly prod during the cutover window — without code
// edits and without double-firing the Telegram bot or duplicating cron.
// Defaults to "true" to preserve current Replit-dev behaviour; set
// RUN_BACKGROUND_JOBS=false on the Replit side once Fly is the source of truth.
//
// Maintenance mode (env var OR admin-toggled DB flag) also forces background
// jobs off so a single freeze freezes writes from every path
// (HTTP + cron + workers). Boot-time check only — flipping the admin toggle
// after boot won't stop already-running workers, by design: the freeze is a
// soft user-write freeze, not a process-level kill switch. Operators who
// need to stop workers mid-flight should restart the API.

async function main() {
  await ensureRedisRunning();
  await initSystemAccounts();
  await seedTasks();
  await seedSystemSettings();
  // Resolve maintenance state AFTER seed-settings so the admin DB toggle is
  // honoured on the very first boot, then use it to decide whether to start
  // background workers below.
  const maintenance = await getMaintenanceState();
  const RUN_BACKGROUND_JOBS =
    !maintenance.active &&
    (process.env["RUN_BACKGROUND_JOBS"] ?? "true").toLowerCase() !== "false";
  // Hard-fail on wallet-secret mismatch BEFORE we accept any traffic. This is
  // the safety net for the Fly.io cutover: if the new instance comes up with
  // a different WALLET_ENC_SECRET than the previous deployment, every existing
  // user's TRC20 deposit address would silently become un-decryptable. This
  // call decrypts one known row and exits the process if it can't.
  await runWalletEncryptionPreflight();
  // Tag the dedicated post-deploy smoke-test account (SMOKE_TEST_EMAIL) with
  // users.is_smoke_test=true so it's excluded from leaderboards / referral
  // payouts / fraud signals and blocked from real-money flows. Idempotent —
  // safe to run on every boot, no-op if SMOKE_TEST_EMAIL is unset.
  await flagSmokeTestAccount();

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
  } else if (maintenance.active) {
    logger.warn(
      { source: maintenance.source, hardBlock: maintenance.hardBlock },
      "Maintenance mode active — API is read-only, writes will return 503; cron, Telegram poller, watchers, and workers are DISABLED",
    );
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
