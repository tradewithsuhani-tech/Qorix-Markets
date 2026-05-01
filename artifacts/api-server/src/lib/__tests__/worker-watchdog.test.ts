import { test } from "node:test";
import assert from "node:assert/strict";

const { tickWorkerWatchdog } = await import("../worker-watchdog");

// Drive `tickWorkerWatchdog` with stubbed dependencies so we can assert the
// page/cool-down state machine directly without spinning up Express, Twilio,
// or the cron scheduler. Both `page` and `getBeat` are injected so the test
// stays hermetic — no DB, no cascade, just the state machine.

interface PageRecord {
  count: number;
  lastBeat: Date | null;
}

function newPageStub(): { fn: (b: Date | null) => Promise<void>; record: PageRecord } {
  const record: PageRecord = { count: 0, lastBeat: null };
  return {
    record,
    fn: async (b) => {
      record.count += 1;
      record.lastBeat = b;
    },
  };
}

function beatStub(value: Date | null): () => Promise<Date | null> {
  return async () => value;
}

test("watchdog: fresh beat -> resets stale counter, no page", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 5, lastPagedAt: null };
  const now = Date.now();
  const beat = new Date(now - 30_000); // 30s ago — fresh
  await tickWorkerWatchdog(state, now, fn, beatStub(beat));
  assert.equal(record.count, 0, "must not page on a fresh beat");
  assert.equal(state.consecutiveStale, 0, "stale counter must reset");
});

test("watchdog: empty table (no beat ever) -> no page, no counter advance", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 3, lastPagedAt: null };
  await tickWorkerWatchdog(state, Date.now(), fn, beatStub(null));
  assert.equal(record.count, 0);
  assert.equal(state.consecutiveStale, 0);
});

test("watchdog: single stale tick -> no page yet (hysteresis)", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 0, lastPagedAt: null };
  const now = Date.now();
  const beat = new Date(now - 6 * 60_000); // 6 min ago — stale
  await tickWorkerWatchdog(state, now, fn, beatStub(beat));
  assert.equal(record.count, 0, "first stale tick must not page");
  assert.equal(state.consecutiveStale, 1);
});

test("watchdog: two consecutive stale ticks -> pages admin once", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 0, lastPagedAt: null };
  const now = Date.now();
  const beat = new Date(now - 6 * 60_000);
  const get = beatStub(beat);
  await tickWorkerWatchdog(state, now, fn, get);
  await tickWorkerWatchdog(state, now + 60_000, fn, get);
  assert.equal(record.count, 1, "must page exactly once after 2 stale ticks");
  assert.equal(record.lastBeat?.getTime(), beat.getTime());
});

test("watchdog: cool-down suppresses repeat pages", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 0, lastPagedAt: null };
  const t0 = Date.now();
  const beat = new Date(t0 - 6 * 60_000);
  const get = beatStub(beat);
  await tickWorkerWatchdog(state, t0, fn, get);
  await tickWorkerWatchdog(state, t0 + 60_000, fn, get); // pages
  for (let i = 2; i <= 6; i++) {
    await tickWorkerWatchdog(state, t0 + i * 60_000, fn, get);
  }
  assert.equal(record.count, 1, "must page once during cool-down regardless of repeated staleness");
});

test("watchdog: page fires again after cool-down expires", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 0, lastPagedAt: null };
  const t0 = Date.now();
  const beat = new Date(t0 - 30 * 60_000);
  const get = beatStub(beat);
  await tickWorkerWatchdog(state, t0, fn, get);
  await tickWorkerWatchdog(state, t0 + 60_000, fn, get); // first page
  await tickWorkerWatchdog(state, t0 + 16 * 60_000, fn, get); // 16 min later — past cool-down
  assert.equal(record.count, 2, "must page again after cool-down");
});

test("watchdog: beat recovering after a page resets the counter (does not re-page)", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 0, lastPagedAt: null };
  const t0 = Date.now();
  const staleBeat = new Date(t0 - 6 * 60_000);
  const staleGet = beatStub(staleBeat);
  await tickWorkerWatchdog(state, t0, fn, staleGet);
  await tickWorkerWatchdog(state, t0 + 60_000, fn, staleGet);
  assert.equal(record.count, 1);
  // Now beat recovers.
  const freshBeat = new Date(t0 + 90_000);
  await tickWorkerWatchdog(state, t0 + 120_000, fn, beatStub(freshBeat));
  assert.equal(state.consecutiveStale, 0, "must reset when worker recovers");
  assert.equal(record.count, 1, "must not re-page on recovery tick");
});

test("watchdog: getBeat throwing does not page or advance the counter", async () => {
  const { fn, record } = newPageStub();
  const state = { consecutiveStale: 1, lastPagedAt: null };
  const get = async (): Promise<Date | null> => {
    throw new Error("db down");
  };
  await tickWorkerWatchdog(state, Date.now(), fn, get);
  assert.equal(record.count, 0, "DB read errors must not trigger paging");
  assert.equal(state.consecutiveStale, 1, "must not advance on read error");
});
