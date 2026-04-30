import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

// ─── Why this file exists ────────────────────────────────────────────────────
//
// `/api/chat/llm-reply` has two unmocked-OpenAI cost guardrails:
//
//   1. `llmReplyLimiter` — Redis-backed per-USER limiter (30 calls / hour).
//      Past the threshold the request is rejected with HTTP 429 and a
//      structured body the frontend uses to render the chat-side fallback
//      (`{ error, code: "llm_rate_limited", fallbackReply }`).
//
//   2. `SESSION_DAILY_TOKEN_BUDGET` — once a single chat session has spent
//      ≥ 200 000 OpenAI tokens for the current UTC day, the route bypasses
//      the LLM entirely and serves the rule-tree fallback (`quickOptions`
//      grid + `llmDisabled: true`). The counter resets on UTC date
//      rollover via `llmBudgetDate`.
//
// Both gates are critical: a runaway client can otherwise burn the LLM
// integration credit unbounded. The original 4xx wire shape is also part
// of the contract the chat web client matches against — flipping `code`
// or losing `fallbackReply` would break the chat UI's graceful-degradation
// banner. This suite locks both down.
//
// We deliberately do NOT set the AI_INTEGRATIONS_OPENAI_* env vars in this
// test, so `isLLMAvailable()` returns false and every successful request
// returns the polite "Let me hand you over to our human team…" fallback
// fast — no real OpenAI traffic, no flakiness from network. The
// budget-gate test still proves the per-session counter wins (it pre-sets
// `llmTokensUsed` so the gate would fire even if LLM were available).

const { default: app } = await import("../../app");
const { db, pool } = await import("@workspace/db");
const {
  usersTable,
  chatSessionsTable,
  chatMessagesTable,
} = await import("@workspace/db/schema");
const { eq } = await import("drizzle-orm");
const { getRedisConnection } = await import("../redis");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

// authMiddleware verifies JWTs against SESSION_SECRET; tests fall back to
// the same dev default the middleware uses if the env var is unset.
const JWT_SECRET = process.env["SESSION_SECRET"] || "qorix-markets-secret";

const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const EMAIL = `chat-llm-reply-${RUN_TAG}@test.local`;

// Same Redis key prefix the limiter constructs in routes/chat.ts:
//   `${PREFIX_NAMESPACE}${name}:${keyGenerator(req)}`
// PREFIX_NAMESPACE = "qorix:ratelimit:" and keyGenerator returns
// `u:${userId}`. We pre/post-clear it so consecutive test-suite runs (in
// dev or CI) start from a clean window even though the limiter window is
// 1h wide.
const LIMITER_REDIS_KEY = (uid: number) => `qorix:ratelimit:chat-llm-reply:u:${uid}`;

let server: Server;
let baseUrl = "";
let userId = 0;
let token = "";

before(async () => {
  // Seed a real user — authMiddleware re-reads the row on every request
  // and 401s if it's missing or disabled.
  const [user] = await db
    .insert(usersTable)
    .values({
      email: EMAIL,
      passwordHash: "x",
      fullName: "Chat LLM Reply Test User",
      sponsorId: 0,
      referralCode: `CLR-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  userId = user!.id;

  token = jwt.sign({ userId, isAdmin: false }, JWT_SECRET);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // Make sure no leftover counter from a prior run sits in Redis.
  try {
    await getRedisConnection().del(LIMITER_REDIS_KEY(userId));
  } catch {
    // Best-effort. The limiter is `passOnStoreError: true` so a Redis
    // outage in the test env wouldn't break the suite — it would just
    // exercise the fallback "no limiting" path. Either way, surfacing a
    // delete error here would mask the real test signal.
  }
});

after(async () => {
  try {
    await teardownHttpServer(server);
  } finally {
    try {
      // Drop the Redis counter we built up so the next test run starts clean.
      try {
        await getRedisConnection().del(LIMITER_REDIS_KEY(userId));
      } catch {
        // see note in `before`
      }
      // Sessions cascade-delete messages via FK ON DELETE CASCADE, but be
      // explicit so a partial-failure path still leaves the dev DB clean.
      const sessions = await db
        .select({ id: chatSessionsTable.id })
        .from(chatSessionsTable)
        .where(eq(chatSessionsTable.userId, userId));
      for (const s of sessions) {
        await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, s.id));
      }
      await db.delete(chatSessionsTable).where(eq(chatSessionsTable.userId, userId));
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    } finally {
      await teardownRedis();
      await pool.end();
    }
  }
});

async function createSession(): Promise<number> {
  const [s] = await db
    .insert(chatSessionsTable)
    .values({ userId })
    .returning({ id: chatSessionsTable.id });
  return s!.id;
}

async function postLlmReply(sessionId: number, content: string): Promise<Response> {
  return fetch(`${baseUrl}/api/chat/llm-reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, content }),
  });
}

// ─── Per-session token budget gate ──────────────────────────────────────────

test("/chat/llm-reply: per-session token budget cuts over to rule-tree fallback", async () => {
  const sessionId = await createSession();

  // Pre-spend the entire daily budget on TODAY's date so the route's
  // `tokensUsedToday >= SESSION_DAILY_TOKEN_BUDGET` branch fires and the
  // LLM is bypassed entirely. Using a fresh `new Date()` for
  // `llmBudgetDate` keeps `isStaleBudgetDate()` false — otherwise the
  // counter would auto-reset to 0 and the gate wouldn't trip.
  await db
    .update(chatSessionsTable)
    .set({ llmTokensUsed: 200_000, llmBudgetDate: new Date() })
    .where(eq(chatSessionsTable.id, sessionId));

  const res = await postLlmReply(sessionId, "Hello, walk me through this.");
  assert.equal(res.status, 200, "budget-exceeded path must still respond 200 with fallback");

  const body = (await res.json()) as {
    reply: { content: string } | null;
    quickOptions: Array<{ label: string; value: string }> | null;
    llmDisabled: boolean;
    cta: unknown;
  };

  assert.ok(body.reply, "reply payload must be present");
  // Same fallback string the route serves when the LLM is unavailable.
  assert.match(
    body.reply!.content,
    /human team|expert/i,
    "fallback reply text must match the documented FALLBACK_REPLY copy",
  );
  assert.ok(body.quickOptions, "quickOptions array must be present in fallback path");
  assert.deepEqual(
    [...body.quickOptions!.map((o) => o.value)].sort(),
    ["expert", "how_to_start", "investment_guide", "main_menu"].sort(),
    "fallback quick-options must mirror the documented rule-tree set",
  );
  assert.equal(
    body.llmDisabled,
    true,
    "llmDisabled must be true once the per-session daily token budget is hit",
  );
  assert.equal(body.cta, null, "no CTA when the LLM didn't run");

  // Counter must NOT have been incremented — proves the LLM call was
  // skipped (otherwise the route would have added the call's tokensUsed
  // to the running total).
  const [row] = await db
    .select({ llmTokensUsed: chatSessionsTable.llmTokensUsed })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.id, sessionId));
  assert.equal(
    row!.llmTokensUsed,
    200_000,
    "per-session token counter must stay frozen when the budget gate fires",
  );

  // Persistence side-effects we DO expect: both the user message and the
  // assistant fallback message land in chat_messages so the admin and the
  // resumable session render correctly.
  const msgs = await db
    .select({ senderType: chatMessagesTable.senderType, content: chatMessagesTable.content })
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, sessionId))
    .orderBy(chatMessagesTable.createdAt);
  assert.equal(msgs.length, 2, "exactly the user turn + the assistant fallback are persisted");
  assert.equal(msgs[0]!.senderType, "user");
  assert.equal(msgs[1]!.senderType, "bot");
  assert.match(msgs[1]!.content, /human team|expert/i);
});

// ─── Per-user 30/hr LLM rate limiter ────────────────────────────────────────

test("/chat/llm-reply: per-user limiter returns 429 + fallbackReply payload past threshold", async () => {
  // Use a session in budget-exceeded state so each accepted call returns
  // fast through the fallback path (no real LLM traffic, no flakiness).
  // The limiter still counts EVERY accepted request — that's the whole
  // point: the limiter cap is independent of whether the LLM ran.
  const sessionId = await createSession();
  await db
    .update(chatSessionsTable)
    .set({ llmTokensUsed: 200_000, llmBudgetDate: new Date() })
    .where(eq(chatSessionsTable.id, sessionId));

  // Defensive reset in case the previous test (or a stray dev request)
  // already pushed the counter towards the cap.
  try {
    await getRedisConnection().del(LIMITER_REDIS_KEY(userId));
  } catch {
    // see note in `before`
  }

  // First 30 calls: under the cap, should all succeed with the fallback shape.
  for (let i = 0; i < 30; i++) {
    const res = await postLlmReply(sessionId, `under-cap-${i}`);
    assert.equal(
      res.status,
      200,
      `call #${i + 1} of 30 must succeed (under the 30/hr cap); got ${res.status}`,
    );
    // Drain the body so node:test doesn't keep the response object pinned.
    await res.arrayBuffer();
  }

  // 31st call: limiter must reject with the documented 429 wire shape.
  const res = await postLlmReply(sessionId, "over-cap");
  assert.equal(res.status, 429, "31st call must trip the 30/hr per-user limiter");

  const body = (await res.json()) as {
    error?: string;
    code?: string;
    fallbackReply?: string;
  };
  assert.equal(
    body.code,
    "llm_rate_limited",
    "wire-contract: response body.code must stay `llm_rate_limited` so the chat client can render the documented banner",
  );
  assert.ok(
    typeof body.fallbackReply === "string" && body.fallbackReply.length > 0,
    "wire-contract: response must carry a non-empty fallbackReply for the chat to render",
  );
  assert.match(
    body.fallbackReply!,
    /human|expert/i,
    "fallbackReply must point the user at the human-team / expert path",
  );
  assert.ok(
    typeof body.error === "string" && body.error.length > 0,
    "the human-readable `error` summary must also be set so admin logs read sensibly",
  );

  // Standard `RateLimit-*` headers (express-rate-limit `standardHeaders: true`)
  // are how the frontend can soft-disable the input box before the next
  // call — assert the limiter is actually wired, not just emitting bodies.
  assert.ok(
    res.headers.get("ratelimit-remaining") !== null ||
      res.headers.get("retry-after") !== null,
    "limiter must expose either standard RateLimit-Remaining or Retry-After so the client can back off",
  );
});
