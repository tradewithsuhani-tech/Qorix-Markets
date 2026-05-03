import { db, workerHeartbeatsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger, errorLogger } from "./logger";

// ─── Worker heartbeat service ─────────────────────────────────────────────
// The worker process group on Fly (cron, escalation, Tron monitor, Telegram
// poller, BullMQ workers) used to have no health check. When it crashed
// once, Fly auto-stopped it after a few restart cycles and there was no
// alarm — INR escalation cron stopped firing for hours and a user deposit
// got stuck. This module adds two layers of detection:
//
//   1. Local in-memory beat (this file): every minute, the worker UPSERTs
//      its row in `worker_heartbeats` AND updates the in-memory
//      `lastLocalBeatAt` timestamp. The /api/worker-healthz endpoint
//      reads `lastLocalBeatAt` (sync, no DB hit) and returns 503 if the
//      local loop has stalled — Fly's machine check then restarts the VM.
//
//   2. DB-backed cross-instance watchdog (worker-watchdog.ts): the web
//      process group polls MAX(beat_at) every minute and pages admin via
//      the existing voice-call cascade if the most recent worker
//      heartbeat is older than WORKER_STALE_AFTER_MS. Catches the case
//      where the entire worker machine is gone (Fly stopped it after
//      max-restart, network partition, region outage) — which is exactly
//      what the local check cannot see.
//
// Both layers use the same underlying signal so a single bug can't make
// the worker look healthy to one and dead to the other.

const HEARTBEAT_INTERVAL_MS = 60_000;

// Stable per-machine identifier. On Fly each machine gets a unique
// FLY_MACHINE_ID; in Replit dev / local we synthesise one so multi-process
// tests don't collide on the PRIMARY KEY.
function resolveInstanceId(): string {
  const flyMachineId = process.env["FLY_MACHINE_ID"];
  if (flyMachineId) return flyMachineId;
  const flyAlloc = process.env["FLY_ALLOC_ID"];
  if (flyAlloc) return flyAlloc;
  // Local dev / tests — keep the prefix so a stray dev row in prod is
  // obvious in the table dump.
  return `local-${process.pid}`;
}

function resolveProcessGroup(): string {
  return process.env["FLY_PROCESS_GROUP"] ?? "local";
}

let lastLocalBeatAt: number | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

export interface HeartbeatLoop {
  /** Stops the interval. Used by graceful shutdown. */
  stop: () => void;
}

/** Returns the most recent successful local beat timestamp, or null if the
 *  loop has not yet completed its first write. */
export function peekLocalHeartbeat(): number | null {
  return lastLocalBeatAt;
}

/** Test/observability hook — reset the local beat marker so a unit test can
 *  re-exercise the "no beat yet" branch without relaunching the process. */
export function _resetLocalHeartbeatForTests(): void {
  lastLocalBeatAt = null;
}

/** Writes one heartbeat row immediately. Exposed for tests + for callers
 *  that want to record a beat right after boot before the interval fires. */
export async function writeHeartbeatNow(): Promise<void> {
  const instanceId = resolveInstanceId();
  const processGroup = resolveProcessGroup();
  await db
    .insert(workerHeartbeatsTable)
    .values({ instanceId, processGroup, beatAt: new Date() })
    .onConflictDoUpdate({
      target: workerHeartbeatsTable.instanceId,
      set: {
        beatAt: sql`excluded.beat_at`,
        processGroup: sql`excluded.process_group`,
      },
    });
  lastLocalBeatAt = Date.now();
}

/** Starts the every-minute heartbeat loop. Writes one beat immediately so
 *  the first probe after boot doesn't 503 during the initial 60s window,
 *  then schedules an interval for the rest of the lifetime.
 *
 *  Errors inside the loop are logged but never propagated — a transient
 *  DB blip must not take the worker down. The web watchdog will still
 *  detect a *sustained* outage via the staleness threshold. */
export async function startWorkerHeartbeatLoop(): Promise<HeartbeatLoop> {
  try {
    await writeHeartbeatNow();
    logger.info(
      { instanceId: resolveInstanceId(), processGroup: resolveProcessGroup() },
      "[worker-heartbeat] initial beat written",
    );
  } catch (err) {
    errorLogger.error({ err }, "[worker-heartbeat] initial beat failed (will retry)");
  }

  heartbeatTimer = setInterval(() => {
    writeHeartbeatNow().catch((err) => {
      errorLogger.error({ err }, "[worker-heartbeat] beat write failed");
    });
  }, HEARTBEAT_INTERVAL_MS);
  // Don't keep the event loop alive purely on the heartbeat — graceful
  // shutdown should still drain even if other timers were also unref'd.
  heartbeatTimer.unref?.();

  return {
    stop: () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  };
}

/** Reads the most-recent heartbeat across ALL worker instances. Used by
 *  the web watchdog to decide whether to page admin. Returns null when
 *  the table is empty (fresh deploy, table just created). */
export async function getMostRecentWorkerBeat(processGroup = "worker"): Promise<Date | null> {
  const rows = await db
    .select({ beatAt: workerHeartbeatsTable.beatAt })
    .from(workerHeartbeatsTable)
    .where(eq(workerHeartbeatsTable.processGroup, processGroup))
    .orderBy(sql`${workerHeartbeatsTable.beatAt} desc`)
    .limit(1);
  return rows[0]?.beatAt ?? null;
}
