import { logger, errorLogger } from "./logger";
import { getMostRecentWorkerBeat } from "./worker-heartbeat-service";
import { runAdminCascade } from "./escalation-cron";

// ─── Worker watchdog (runs on the WEB process group only) ─────────────────
// Every minute: queries the most recent heartbeat row written by the worker
// process group. If no beat in the last WORKER_STALE_AFTER_MS, fires the
// admin escalation voice cascade — the same channel used for stuck INR
// deposits — so a dead worker pages someone within the SLA the task
// requires (5 minutes from last good beat).
//
// Cool-down (PAGE_COOLDOWN_MS) prevents repeat-paging while the worker
// stays down. We page once on first detection, then stay quiet for 15
// minutes; if the worker is still silent at that point, we page again.
//
// Hysteresis: the watchdog also tracks consecutive-stale-ticks before
// firing, so a single late beat (e.g. a 70s GC pause on the worker)
// doesn't wake an admin at 3am.

const WATCHDOG_INTERVAL_MS = 60_000;
const WORKER_STALE_AFTER_MS = 5 * 60_000;
const PAGE_COOLDOWN_MS = 15 * 60_000;
// Require N consecutive stale checks before paging. With 1-minute
// intervals and a 5-minute staleness window, 2 ticks ≈ at most ~7 min
// since last good beat — still well within the SLA but prevents single-
// beat blips from waking admin.
const REQUIRED_CONSECUTIVE_STALE = 2;

export interface WorkerWatchdog {
  stop: () => void;
}

interface WatchdogState {
  consecutiveStale: number;
  lastPagedAt: number | null;
}

// Exported so tests can drive a single tick deterministically without
// relying on timer scheduling. The `getBeat` and `page` callbacks are
// injectable so tests don't need a live DB or Twilio credentials — and
// the production wiring still gets the real implementations by default.
export async function tickWorkerWatchdog(
  state: WatchdogState,
  now: number = Date.now(),
  page: (lastBeatAt: Date | null) => Promise<void> = pageAdminWorkerDown,
  getBeat: () => Promise<Date | null> = () => getMostRecentWorkerBeat("worker"),
): Promise<void> {
  let lastBeat: Date | null;
  try {
    lastBeat = await getBeat();
  } catch (err) {
    // A DB error here is usually the same DB the worker would be writing
    // to — paging on it would just generate noise. Log and skip.
    errorLogger.error({ err }, "[worker-watchdog] failed to read heartbeat");
    return;
  }

  // Pre-deploy / fresh table: no rows yet. Treat as "not yet bootstrapped"
  // and don't page — the worker hasn't had a chance to write its first
  // beat. As soon as the worker writes once, the gap measurement kicks in.
  if (!lastBeat) {
    state.consecutiveStale = 0;
    return;
  }

  const gapMs = now - lastBeat.getTime();
  if (gapMs <= WORKER_STALE_AFTER_MS) {
    state.consecutiveStale = 0;
    return;
  }

  state.consecutiveStale += 1;
  if (state.consecutiveStale < REQUIRED_CONSECUTIVE_STALE) {
    logger.warn(
      { gapMs, consecutiveStale: state.consecutiveStale },
      "[worker-watchdog] worker beat is late — waiting for confirmation before paging",
    );
    return;
  }

  if (state.lastPagedAt && now - state.lastPagedAt < PAGE_COOLDOWN_MS) {
    return;
  }

  state.lastPagedAt = now;
  errorLogger.error(
    { gapMs, lastBeatAt: lastBeat.toISOString() },
    "[worker-watchdog] worker has not heartbeated — paging admin",
  );
  try {
    await page(lastBeat);
  } catch (err) {
    errorLogger.error({ err }, "[worker-watchdog] admin page failed");
  }
}

async function pageAdminWorkerDown(lastBeatAt: Date | null): Promise<void> {
  const ageMin = lastBeatAt
    ? Math.round((Date.now() - lastBeatAt.getTime()) / 60_000)
    : null;
  const lastBeatSentence = ageMin !== null
    ? `The worker has not reported a heartbeat for ${ageMin} minutes.`
    : `The worker has not reported any heartbeat.`;

  await runAdminCascade((adminName: string) => {
    const ssmlBody = [
      `Hello ${escape(adminName)}.`,
      `<break time="400ms"/>`,
      `This is an infrastructure alert from Qorix Markets.`,
      `<break time="700ms"/>`,
      `The background worker process is not responding.`,
      `<break time="500ms"/>`,
      escape(lastBeatSentence),
      `<break time="500ms"/>`,
      `Cron jobs, on-chain monitor and Telegram poller may be down. Please check Fly logs immediately.`,
      `<break time="1500ms"/>`,
      `Repeating once again.`,
      `<break time="600ms"/>`,
      `The background worker process is not responding.`,
      `<break time="500ms"/>`,
      escape(lastBeatSentence),
      `<break time="500ms"/>`,
      `Please check Fly logs immediately.`,
    ].join(" ");
    const plainText =
      `Hello ${adminName}. This is an infrastructure alert from Qorix Markets. ` +
      `The background worker process is not responding. ${lastBeatSentence} ` +
      `Cron jobs, on-chain monitor and Telegram poller may be down. ` +
      `Please check Fly logs immediately.`;
    return { ssmlBody, plainText };
  });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function startWorkerWatchdog(): WorkerWatchdog {
  const state: WatchdogState = { consecutiveStale: 0, lastPagedAt: null };
  const timer = setInterval(() => {
    void tickWorkerWatchdog(state).catch((err) =>
      errorLogger.error({ err }, "[worker-watchdog] tick threw"),
    );
  }, WATCHDOG_INTERVAL_MS);
  timer.unref?.();
  logger.info(
    { intervalMs: WATCHDOG_INTERVAL_MS, staleAfterMs: WORKER_STALE_AFTER_MS },
    "[worker-watchdog] started — will page admin if worker beat goes stale",
  );
  return { stop: () => clearInterval(timer) };
}
