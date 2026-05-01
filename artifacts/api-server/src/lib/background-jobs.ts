import type { MaintenanceState } from "../middlewares/maintenance";
import { shouldRunBackgroundJobs } from "../middlewares/maintenance";

// Single source of truth for "which long-running side processes does this
// instance own". Anything that would double-fire if it ran on every API
// machine (Telegram poller, on-chain watchers, BullMQ workers, cron) lives
// behind this gate so a single env/admin flag can stop everything.
//
// The factories are async so each side process can lazy-import its module —
// preserving the historical behaviour where a frozen instance never even
// loads the worker code (and therefore never opens its Redis subscriptions
// or chain connections). Tests inject in-memory stubs to verify the gate
// without touching real Redis / chain RPCs.

export type CloseableWorker = { close: () => Promise<void> };
export type StoppableWatcher = { stop: () => void };

export interface BackgroundJobFactories {
  startProfitDistributionWorker: () => Promise<CloseableWorker>;
  startDepositWorker: () => Promise<CloseableWorker>;
  startProfitEventWorker: () => Promise<CloseableWorker>;
  startTronMonitor: () => Promise<StoppableWatcher>;
  startDepositWatcher: () => Promise<StoppableWatcher>;
  startTelegramPoller: () => Promise<StoppableWatcher>;
  initCronJobs: () => Promise<void>;
}

export interface BackgroundJobs {
  profitDistributionWorker: CloseableWorker;
  depositWorker: CloseableWorker;
  profitEventWorker: CloseableWorker;
  tronMonitor: StoppableWatcher;
  depositWatcher: StoppableWatcher;
  telegramPoller: StoppableWatcher;
}

// Real factories used in production (and Replit dev when not in maintenance).
// Each factory does its own dynamic import so the worker module — and the
// Redis / chain RPC connections it opens at import time — never loads when
// the gate is closed.
export const realBackgroundJobFactories: BackgroundJobFactories = {
  startProfitDistributionWorker: async () => {
    const { startProfitDistributionWorker } = await import("../workers/profit-distribution-worker");
    return startProfitDistributionWorker();
  },
  startDepositWorker: async () => {
    const { startDepositWorker } = await import("../workers/deposit-worker");
    return startDepositWorker();
  },
  startProfitEventWorker: async () => {
    const { startProfitEventWorker } = await import("../workers/profit-event-worker");
    return startProfitEventWorker();
  },
  startTronMonitor: async () => {
    const { startTronMonitor } = await import("./tron-monitor");
    return startTronMonitor();
  },
  startDepositWatcher: async () => {
    // DISABLED: legacy in-memory deposit watcher caused double-credits on
    // restart because it deduped via an in-process Set instead of the DB.
    // The DB-backed `tron-monitor.ts` is the sole source of truth for
    // crediting blockchain deposits. Returning a no-op stoppable so the
    // background-jobs contract (and tests) stay intact.
    // eslint-disable-next-line no-console
    console.warn(
      "[depositWatcher] DISABLED — superseded by tron-monitor (DB-backed dedup). See background-jobs.ts.",
    );
    return { stop: () => {} };
  },
  startTelegramPoller: async () => {
    const { startTelegramPoller } = await import("./telegram-poller");
    return startTelegramPoller();
  },
  initCronJobs: async () => {
    const { initCronJobs } = await import("./cron");
    await initCronJobs();
  },
};

// Returns the started workers (so the caller can wire them into graceful
// shutdown), or `null` when the gate is closed (maintenance ON or
// RUN_BACKGROUND_JOBS=false). When closed, NONE of the factories run —
// proven by the test suite using stub factories.
export async function registerBackgroundJobs(
  maintenance: MaintenanceState,
  factories: BackgroundJobFactories,
): Promise<BackgroundJobs | null> {
  if (!shouldRunBackgroundJobs(maintenance)) return null;

  const profitDistributionWorker = await factories.startProfitDistributionWorker();
  const depositWorker = await factories.startDepositWorker();
  const profitEventWorker = await factories.startProfitEventWorker();
  const tronMonitor = await factories.startTronMonitor();
  const depositWatcher = await factories.startDepositWatcher();
  const telegramPoller = await factories.startTelegramPoller();

  // Cron init is fire-and-forget in prod (matches the historical pattern of
  // kicking it off from inside app.listen's callback) — surfacing the error
  // through a logger keeps boot moving even if a single cron handler fails
  // to wire up.
  void factories.initCronJobs().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("initCronJobs failed:", err);
  });

  return {
    profitDistributionWorker,
    depositWorker,
    profitEventWorker,
    tronMonitor,
    depositWatcher,
    telegramPoller,
  };
}
