-- B37 — Worker heartbeat table (Task #135: worker health check + auto-restart)
--
-- Backs the every-minute heartbeat written by the Fly worker process group
-- (cron + Tron monitor + Telegram poller + BullMQ workers) so the web
-- process group can detect a dead worker and page admin via the existing
-- voice-call cascade. Without this table, a crashed worker stays unnoticed
-- until a customer complains that INR escalation cron stopped firing
-- (the 2026-05-01 incident this task was raised for).
--
-- Apply via psql against the runtime DB. Idempotent (uses IF NOT EXISTS).
-- Reversibility: purely additive. Rollback = `DROP TABLE public.worker_heartbeats;`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  instance_id   varchar(80)   PRIMARY KEY,
  process_group varchar(40)   NOT NULL,
  beat_at       timestamptz   NOT NULL DEFAULT now()
);

-- Index used by the web-side watchdog: SELECT max(beat_at) FROM
-- worker_heartbeats WHERE process_group = 'worker'. Even with a single row
-- the index keeps the access pattern explicit + cheap.
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_group_beat_at
  ON public.worker_heartbeats (process_group, beat_at DESC);

COMMIT;
