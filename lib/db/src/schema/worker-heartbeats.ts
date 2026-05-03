import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per worker instance. The worker process upserts on `instance_id`
// every minute; the web (app) process reads `MAX(beat_at)` to detect a
// stalled worker. Single-row-per-instance (vs append-only event log) keeps
// the table tiny and avoids a maintenance sweep — the MAX query stays an
// index seek even after months of uptime.
//
// `process_group` lets a future split (e.g. dedicated cron VM separate
// from BullMQ workers) heartbeat independently — the watchdog can then
// page admin only when a *specific* group goes silent rather than after
// every restart.
export const workerHeartbeatsTable = pgTable("worker_heartbeats", {
  instanceId: varchar("instance_id", { length: 80 }).primaryKey(),
  processGroup: varchar("process_group", { length: 40 }).notNull(),
  beatAt: timestamp("beat_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkerHeartbeatSchema = createInsertSchema(workerHeartbeatsTable);
export type InsertWorkerHeartbeat = z.infer<typeof insertWorkerHeartbeatSchema>;
export type WorkerHeartbeat = typeof workerHeartbeatsTable.$inferSelect;
