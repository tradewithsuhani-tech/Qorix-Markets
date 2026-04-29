#!/usr/bin/env node
/**
 * Quiz load smoke — simulates N concurrent users joining a quiz, opening
 * an SSE stream, and answering each question as it arrives.
 *
 * Usage:
 *   QUIZ_ID=42 USERS=50 BASE=http://localhost:8080 ADMIN_TOKEN=… USER_TOKENS_FILE=tokens.txt \
 *     node artifacts/api-server/scripts/quiz-load-test.mjs
 *
 *   * USER_TOKENS_FILE: newline-separated JWTs (one per simulated user). KYC
 *     gating is enforced server-side, so each token must belong to a KYC-
 *     approved test user. Generate this file ahead of time from your dev DB.
 *
 * What it measures:
 *   * SSE connect time per user (p50/p95/max)
 *   * Time from `question_started` arrival → `submit_answer` round-trip
 *   * Total answers accepted vs. rejected (`too_late` / `kyc_required` / etc.)
 *   * Final leaderboard size and top-3 winners (logged once)
 *
 * Why a script instead of a vitest: real SSE behavior matters (HTTP/1.1
 * concurrency limits, proxy buffering, heartbeat) and is awkward inside a
 * unit test runner. This script can be pointed at staging or prod-like envs.
 *
 * Notes:
 *   - We use the global `EventSource` available in Node 22. If your runtime
 *     doesn't expose it, `npm i undici` and swap to `undici`'s `EventSource`.
 *   - Answers are picked uniformly at random. We do not try to "win".
 *   - The script exits when the SSE stream emits `quiz_ended` or after a hard
 *     timeout (default 5 minutes).
 */

import { readFile } from "node:fs/promises";

const BASE = process.env.BASE ?? "http://localhost:8080";
const QUIZ_ID = parseInt(process.env.QUIZ_ID ?? "0", 10);
const USERS = parseInt(process.env.USERS ?? "20", 10);
const HARD_TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS ?? "300000", 10);
const TOKENS_FILE = process.env.USER_TOKENS_FILE;

if (!QUIZ_ID || !TOKENS_FILE) {
  console.error("QUIZ_ID and USER_TOKENS_FILE are required");
  process.exit(1);
}

const tokens = (await readFile(TOKENS_FILE, "utf8"))
  .split("\n").map((s) => s.trim()).filter(Boolean);
if (tokens.length < USERS) {
  console.error(`Need at least ${USERS} tokens, got ${tokens.length} in ${TOKENS_FILE}`);
  process.exit(1);
}

function p(arr, q) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q));
  return sorted[idx];
}

class Sim {
  constructor(token, idx) {
    this.token = token;
    this.idx = idx;
    this.connectMs = null;
    this.answerLatencies = [];
    this.accepted = 0;
    this.rejected = 0;
    this.errors = [];
    this.es = null;
  }

  async join() {
    const res = await fetch(`${BASE}/api/quiz/${QUIZ_ID}/join`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
    });
    if (!res.ok && res.status !== 409) {
      this.errors.push(`join ${res.status}`);
    }
  }

  start(onEnded) {
    const t0 = Date.now();
    const url = `${BASE}/api/quiz/${QUIZ_ID}/stream?token=${encodeURIComponent(this.token)}`;
    const es = new EventSource(url);
    this.es = es;

    es.addEventListener("hello", () => {
      this.connectMs = Date.now() - t0;
    });

    es.addEventListener("question_started", (ev) => {
      const env = JSON.parse(ev.data);
      const p = env.payload;
      const ans = Math.floor(Math.random() * p.options.length);
      const sentAt = Date.now();
      fetch(`${BASE}/api/quiz/${QUIZ_ID}/answer`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify({ questionId: p.questionId, selectedOption: ans }),
      }).then(async (res) => {
        const dt = Date.now() - sentAt;
        if (res.ok) {
          this.accepted += 1;
          this.answerLatencies.push(dt);
        } else {
          this.rejected += 1;
          const body = await res.text().catch(() => "");
          this.errors.push(`answer ${res.status}: ${body.slice(0, 80)}`);
        }
      }).catch((err) => {
        this.rejected += 1;
        this.errors.push(`answer-throw ${String(err).slice(0, 80)}`);
      });
    });

    es.addEventListener("quiz_ended", (ev) => {
      es.close();
      onEnded(JSON.parse(ev.data).payload);
    });

    es.onerror = () => {
      // Let EventSource auto-reconnect; just log once.
      if (!this.connectMs) this.errors.push("connect-error");
    };
  }

  close() { try { this.es?.close(); } catch { /* noop */ } }
}

const sims = Array.from({ length: USERS }, (_, i) => new Sim(tokens[i], i));

console.log(`[load] joining ${USERS} users to quiz ${QUIZ_ID} on ${BASE}…`);
await Promise.all(sims.map((s) => s.join()));

console.log(`[load] opening SSE streams…`);
let endedPayload = null;
const endedAt = new Promise((resolve) => {
  for (const s of sims) s.start((p) => { if (!endedPayload) { endedPayload = p; resolve(); } });
});

const timeout = new Promise((resolve) => setTimeout(resolve, HARD_TIMEOUT_MS));
await Promise.race([endedAt, timeout]);

// Give in-flight answers a moment to settle.
await new Promise((r) => setTimeout(r, 1500));
for (const s of sims) s.close();

const connectMs = sims.map((s) => s.connectMs).filter((x) => typeof x === "number");
const allLatencies = sims.flatMap((s) => s.answerLatencies);
const totalAccepted = sims.reduce((a, s) => a + s.accepted, 0);
const totalRejected = sims.reduce((a, s) => a + s.rejected, 0);
const errors = sims.flatMap((s) => s.errors);

console.log("\n[load] ── results ─────────────────────────────");
console.log(`users:               ${USERS}`);
console.log(`connected (hello):   ${connectMs.length}`);
console.log(`connect ms p50/p95:  ${p(connectMs, 0.5)} / ${p(connectMs, 0.95)} (max ${p(connectMs, 1)})`);
console.log(`answer latency p50:  ${p(allLatencies, 0.5)} ms`);
console.log(`answer latency p95:  ${p(allLatencies, 0.95)} ms (max ${p(allLatencies, 1)})`);
console.log(`answers accepted:    ${totalAccepted}`);
console.log(`answers rejected:    ${totalRejected}`);
if (errors.length) {
  const grouped = {};
  for (const e of errors) grouped[e] = (grouped[e] ?? 0) + 1;
  console.log("errors:");
  for (const [k, v] of Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${v}× ${k}`);
  }
}
if (endedPayload) {
  console.log(`participants:        ${endedPayload.participants}`);
  console.log("winners:");
  for (const w of endedPayload.winners) {
    console.log(`  #${w.rank} ${w.displayName} — score ${w.finalScore} — ${w.prizeAmount} ${w.prizeCurrency}`);
  }
} else {
  console.log("(quiz did not end within timeout)");
}

process.exit(endedPayload ? 0 : 2);
