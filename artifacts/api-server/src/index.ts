import { ensureRedisRunning } from "./lib/start-redis";
import { initSystemAccounts } from "./lib/ledger-service";
import { seedTasks } from "./lib/task-service";
import { seedSystemSettings } from "./lib/seed-settings";
import { runWalletEncryptionPreflight } from "./lib/wallet-preflight";
import { flagSmokeTestAccount } from "./lib/smoke-test-account";
import {
  getMaintenanceState,
  startMaintenanceInvalidationListener,
} from "./middlewares/maintenance";
import {
  registerBackgroundJobs,
  realBackgroundJobFactories,
} from "./lib/background-jobs";

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

// ─── Per-process role on Fly (web vs worker split) ─────────────────────────
// Fly auto-sets `FLY_PROCESS_GROUP` from fly.toml's [processes] block. We
// run the same image as two process groups so cron / Tron monitor /
// Telegram poller / BullMQ workers never compete with web requests for the
// same DB pool slots:
//
//   app    → web HTTP only         → RUN_BACKGROUND_JOBS=false
//   worker → background jobs only  → RUN_BACKGROUND_JOBS=true
//
// The override is performed here (top-level, before main() runs) so that
// `shouldRunBackgroundJobs()` reads the correct value in registerBackgroundJobs.
// Outside Fly (Replit dev, local), FLY_PROCESS_GROUP is unset and we fall
// back to the env var (defaults to "true" so single-process devs keep
// running cron locally).
const flyProcessGroup = process.env["FLY_PROCESS_GROUP"];
if (flyProcessGroup === "worker") {
  process.env["RUN_BACKGROUND_JOBS"] = "true";
} else if (flyProcessGroup === "app") {
  process.env["RUN_BACKGROUND_JOBS"] = "false";
}

async function main() {
  await ensureRedisRunning();
  await initSystemAccounts();
  await seedTasks();
  await seedSystemSettings();
  // Resolve maintenance state AFTER seed-settings so the admin DB toggle is
  // honoured on the very first boot, then use it to decide whether to start
  // background workers below.
  const maintenance = await getMaintenanceState();
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

  // Open the Postgres LISTEN connection that picks up cross-instance
  // maintenance cache invalidations BEFORE accepting traffic. Without this,
  // an admin flipping the toggle on one Fly machine would only invalidate
  // that machine's cache; every other replica would keep serving the stale
  // state for up to CACHE_TTL_MS. The listener auto-reconnects on errors and
  // is closed in gracefulShutdown below.
  const stopMaintenanceListener = await startMaintenanceInvalidationListener();

  const { default: app } = await import("./app");
  const { logger, errorLogger } = await import("./lib/logger");

  const rawPort = process.env["PORT"];
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  // Background workers / pollers / cron are only spun up on the designated
  // background-jobs instance. registerBackgroundJobs encapsulates the gating
  // decision (maintenance OR RUN_BACKGROUND_JOBS=false → skip everything)
  // AND the actual lazy-loaded factory calls, so the gate is provable from
  // a test that injects stub factories.
  const jobs = await registerBackgroundJobs(maintenance, realBackgroundJobFactories);
  if (jobs) {
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
    jobs?.tronMonitor.stop();
    jobs?.depositWatcher.stop();
    jobs?.telegramPoller.stop();
    if (jobs) {
      await Promise.all([
        jobs.profitDistributionWorker.close(),
        jobs.depositWorker.close(),
        jobs.profitEventWorker.close(),
      ]);
    }
    // Close the LISTEN connection cleanly so we don't leave a zombie
    // backend connection on the Postgres side during a rolling deploy.
    await stopMaintenanceListener();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Defense-in-depth: log unhandled promise rejections instead of crashing the
  // worker. Node v15+ defaults to terminating the process on unhandled
  // rejection, which means a single timed-out Redis command (shared client
  // has commandTimeout: 1500ms) from a fire-and-forget Lua script load or
  // background helper takes the entire worker down — and once worker is
  // dead, cron stops firing → INR escalations stall → user deposits get
  // stuck. The shared Redis client already has a `client.on("error")`
  // listener that logs failures; the catch-all here only covers Promise
  // chains that bypassed it. Same treatment for uncaughtException so a
  // bad chain doesn't leave the worker zombied either.
  process.on("unhandledRejection", (reason) => {
    errorLogger.error({ reason }, "Unhandled promise rejection — keeping process alive");
  });
  process.on("uncaughtException", (err) => {
    errorLogger.error({ err }, "Uncaught exception — keeping process alive");
  });

  app.listen(port, (err?: Error) => {
    if (err) {
      errorLogger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    // B9.6: which captcha provider is active is decided by CAPTCHA_PROVIDER
    // (defaults to "recaptcha"). The matching secret for the active provider
    // must be set, or all captcha-gated routes auto-skip captcha — fine in
    // dev, dangerous in prod.
    const captchaProvider = process.env.CAPTCHA_PROVIDER === "turnstile" ? "turnstile" : "recaptcha";
    const requiredSecretEnv = captchaProvider === "turnstile" ? "TURNSTILE_SECRET_KEY" : "RECAPTCHA_SECRET_KEY";
    if (!process.env[requiredSecretEnv]) {
      const msg = `${requiredSecretEnv} not set (CAPTCHA_PROVIDER=${captchaProvider}) — captcha is DISABLED on /auth routes`;
      if (process.env.NODE_ENV === "production") errorLogger.error(msg);
      else logger.warn(msg);
    } else {
      logger.info({ provider: captchaProvider }, "Captcha provider active");
    }
    if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
      const msg = "SMTP not fully configured (need SES_FROM_EMAIL + SMTP_PASS) — emails will NOT be delivered";
      if (process.env.NODE_ENV === "production") errorLogger.error(msg);
      else logger.warn(msg);
    }
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
