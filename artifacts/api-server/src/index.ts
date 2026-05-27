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
import { startWorkerHeartbeatLoop } from "./lib/worker-heartbeat-service";
import { startWorkerWatchdog } from "./lib/worker-watchdog";
import { startRevokeSubscriber } from "./lib/revoke-pubsub";

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

// WORKER RESILIENCE: Register unhandled-rejection / uncaught-exception
// handlers IMMEDIATELY at module load — before main() runs — so that a
// Redis commandTimeout firing during BullMQ's startup Lua-script registration
// (which happens before app.listen) cannot crash the worker process.
// Without this, the ioredis commandTimeout (1 500 ms) that fires while
// Upstash is slow to handshake on a cold BOM machine kills the worker
// before it ever starts cron, causing daily profit to stop running.
// Narrowed to FLY_PROCESS_GROUP === "worker" only so web replicas keep
// their default fail-fast semantics.
if (flyProcessGroup === "worker") {
  process.on("unhandledRejection", (reason) => {
    console.error("[worker] Unhandled promise rejection — keeping worker alive:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[worker] Uncaught exception — keeping worker alive:", err);
  });
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

  // B8.1 Task #3 — Start Redis pub/sub subscriber for cross-instance device
  // revocation. When any instance revokes a device session it publishes to
  // `qorix:revoke:device`; every instance (including the publisher's own
  // process) receives the message and immediately evicts the local
  // revokedDeviceCache entry, reducing propagation from ≤30s to ≤~5ms.
  // Fail-open: if Redis is unavailable the 30s in-process TTL still applies.
  const revokeSubscriber = await startRevokeSubscriber();

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

  // ─── Health surface for the worker process group (Task #135) ────────────
  // The worker has no Fly [http_service] in front of it, but it still binds
  // PORT 8080 inside the VM (app.listen below). Fly's per-process [[checks]]
  // probe /api/worker-healthz directly on that internal port; the endpoint
  // returns 503 once the local heartbeat loop has stalled, prompting Fly to
  // restart the machine. The DB-backed heartbeat row written here is also
  // the signal the web-side watchdog reads cross-instance, so a fully-dead
  // worker (machine gone, not just a wedged loop) still pages admin.
  //
  // Heartbeats are written ONLY when background jobs are actually enabled
  // on this process (i.e. this is the worker, or Replit dev with the gate
  // open). If maintenance is on / this is the `app` group, there is no
  // worker work to monitor — writing a heartbeat from the web group would
  // make the watchdog falsely think the worker is alive.
  let stopHeartbeat: (() => void) | null = null;
  if (jobs) {
    const loop = await startWorkerHeartbeatLoop();
    stopHeartbeat = loop.stop;
  }

  // ─── Worker watchdog (web process group only) ───────────────────────────
  // The web group polls the heartbeat table every minute and pages admin
  // via the existing voice-call cascade if no beat has been written in 5+
  // minutes. Gated to the Fly `app` group so a single-process Replit dev
  // run doesn't page admin against itself, and so two web replicas don't
  // race to be the pager (the cascade handles its own dedup, but quieter
  // logs are nicer).
  let stopWatchdog: (() => void) | null = null;
  if (flyProcessGroup === "app") {
    const wd = startWorkerWatchdog();
    stopWatchdog = wd.stop;
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
    stopHeartbeat?.();
    stopWatchdog?.();
    // Close the LISTEN connection cleanly so we don't leave a zombie
    // backend connection on the Postgres side during a rolling deploy.
    await stopMaintenanceListener();
    // Close the revoke pub/sub subscriber socket cleanly.
    revokeSubscriber.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Defense-in-depth, WORKER-ONLY: log unhandled promise rejections instead of
  // crashing the worker. Node v15+ defaults to terminating the process on
  // unhandled rejection, which means a single timed-out Redis command (shared
  // client has commandTimeout: 1500ms) from a fire-and-forget Lua script load
  // or background helper takes the entire worker down — and once worker is
  // dead, cron stops firing → INR escalations stall → user deposits get stuck.
  //
  // Critically narrowed to FLY_PROCESS_GROUP === "worker" only. The `app`
  // process group keeps standard fail-fast semantics so a programmer bug or
  // corrupted state on a web replica still terminates the process and lets
  // Fly route traffic to a healthy peer — masking exceptions there could
  // hide a 500-class regression behind silent "request completed" logs.
  // Outside Fly (Replit dev / local), FLY_PROCESS_GROUP is unset and we leave
  // Node's default behaviour intact so dev surfaces real bugs loudly.
  if (flyProcessGroup === "worker") {
    process.on("unhandledRejection", (reason) => {
      errorLogger.error({ reason }, "Unhandled promise rejection — keeping worker alive");
    });
    process.on("uncaughtException", (err) => {
      errorLogger.error({ err }, "Uncaught exception — keeping worker alive");
    });
  }

  app.listen(port, (err?: Error) => {
    if (err) {
      errorLogger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    // B9.6: which captcha provider is active is decided by CAPTCHA_PROVIDER
    // (defaults to "recaptcha"). The matching secret for the active provider
    // must be set, or all captcha-gated routes auto-skip captcha — fine in
    // dev, dangerous in prod. `none` is the explicit dev-only opt-out
    // (mirrors VITE_CAPTCHA_PROVIDER=none on the web side) — log loud in
    // prod, info in dev.
    const captchaProviderRaw = process.env.CAPTCHA_PROVIDER;
    const captchaProvider =
      captchaProviderRaw === "none"
        ? "none"
        : captchaProviderRaw === "turnstile"
          ? "turnstile"
          : "recaptcha";
    if (captchaProvider === "none") {
      const msg = "CAPTCHA_PROVIDER=none — captcha is DISABLED on /auth routes (dev-only opt-out)";
      if (process.env.NODE_ENV === "production") errorLogger.error(msg);
      else logger.warn(msg);
    } else {
      const requiredSecretEnv = captchaProvider === "turnstile" ? "TURNSTILE_SECRET_KEY" : "RECAPTCHA_SECRET_KEY";
      if (!process.env[requiredSecretEnv]) {
        const msg = `${requiredSecretEnv} not set (CAPTCHA_PROVIDER=${captchaProvider}) — captcha is DISABLED on /auth routes`;
        if (process.env.NODE_ENV === "production") errorLogger.error(msg);
        else logger.warn(msg);
      } else {
        logger.info({ provider: captchaProvider }, "Captcha provider active");
      }
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
