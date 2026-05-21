import type { Response } from "express";
import IORedis from "ioredis";
import { logger } from "./logger";

const CHANNEL = "p2p:order:events";
const HEARTBEAT_MS = 25_000;
const MAX_CLIENTS_PER_ORDER = 8;

export type P2POrderEvent =
  | { type: "order.updated"; orderId: number; status: string; actorId?: number | null }
  | { type: "order.paid"; orderId: number; actorId: number }
  | { type: "order.completed"; orderId: number; actorId: number }
  | { type: "order.cancelled"; orderId: number; actorId: number | null; reason?: string | null }
  | { type: "order.disputed"; orderId: number; actorId: number; reason: string }
  | { type: "order.dispute_resolved"; orderId: number; resolution: string }
  | { type: "order.expired"; orderId: number }
  | { type: "chat.message"; orderId: number; messageId: number; senderId: number };

type Client = {
  res: Response;
  userId: number;
  orderId: number;
  heartbeat: NodeJS.Timeout;
};

// orderId -> set of clients (in-process). Multi-instance fanout is handled
// by the Redis Pub/Sub subscriber below: every Express instance subscribes
// to one channel and re-emits matching messages to its own local clients.
const clientsByOrder = new Map<number, Set<Client>>();

let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let subscribed = false;
let subscriberInitPromise: Promise<void> | null = null;

function newClient(role: "pub" | "sub"): IORedis {
  // Pub/Sub demands a dedicated TCP socket because once a client enters
  // subscriber mode it can no longer issue regular commands. We also drop
  // commandTimeout (subscriber blocks indefinitely waiting for messages)
  // and let ioredis retry forever — losing real-time briefly is acceptable
  // but a permanent dead subscriber would silently break the feature.
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const c = new IORedis(url, {
    maxRetriesPerRequest: role === "sub" ? null : 1,
    enableReadyCheck: false,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 250, 5_000),
  });
  c.on("error", (err) => logger.error({ err, role }, "[p2p-realtime] redis error"));
  return c;
}

function getPublisher(): IORedis {
  if (!publisher) publisher = newClient("pub");
  return publisher;
}

async function ensureSubscriber(): Promise<void> {
  if (subscribed) return;
  // Single-flight: concurrent first calls (e.g. several SSE clients hitting
  // /stream on a fresh process at the same time) must share one init. Without
  // this lock each caller would open its own Redis subscriber, doubling
  // fanout and leaking sockets.
  if (subscriberInitPromise) return subscriberInitPromise;
  subscriberInitPromise = (async () => {
  subscriber = newClient("sub");
  await subscriber.subscribe(CHANNEL);
  subscriber.on("message", (chan, raw) => {
    if (chan !== CHANNEL) return;
    let evt: P2POrderEvent;
    try {
      evt = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof (evt as any)?.orderId !== "number") return;
    const set = clientsByOrder.get((evt as any).orderId);
    if (!set || set.size === 0) return;
    const payload = `event: ${evt.type}\ndata: ${raw}\n\n`;
    for (const c of set) {
      try {
        c.res.write(payload);
      } catch {
        // best-effort; cleanup happens on response 'close'
      }
    }
  });
  subscribed = true;
  logger.info("[p2p-realtime] subscribed to redis channel");
  })();
  try {
    await subscriberInitPromise;
  } catch (err) {
    // Reset so a subsequent call can retry; otherwise a transient Redis
    // hiccup at boot would permanently disable realtime.
    subscriberInitPromise = null;
    throw err;
  }
}

/**
 * Publishes an event into the Redis pub/sub channel. Every API instance
 * (including this one) receives it via its subscriber and fans out to its
 * local SSE clients. Fire-and-forget: realtime is a UX enhancement layered
 * on top of HTTP polling fallback, never a source of truth.
 */
export function publishOrderEvent(evt: P2POrderEvent): void {
  // Trigger subscriber init lazily so a node that only ever publishes also
  // ends up receiving its own messages (single-instance dev) — this matters
  // because the SSE /stream route awaits ensureSubscriber() too, but a
  // publish-only test bench would otherwise never connect.
  ensureSubscriber().catch((err) =>
    logger.error({ err }, "[p2p-realtime] subscriber init failed"),
  );
  getPublisher()
    .publish(CHANNEL, JSON.stringify(evt))
    .catch((err) => logger.error({ err, evt }, "[p2p-realtime] publish failed"));
}

/**
 * Registers an SSE client for an order. Caller MUST have already verified
 * that `userId` is a party (buyer or seller) on the order. Returns a
 * cleanup function that the route can wire to `req.on('close')`.
 */
export async function addSSEClient(
  res: Response,
  orderId: number,
  userId: number,
): Promise<() => void> {
  await ensureSubscriber();

  // SSE headers — disable proxy buffering (nginx/Fly) so messages flush
  // immediately, and force chunked transfer.
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Initial ack so the EventSource transitions to "open" immediately even
  // if there are no events for a while.
  res.write(`event: ready\ndata: {"orderId":${orderId}}\n\n`);

  let set = clientsByOrder.get(orderId);
  if (!set) {
    set = new Set();
    clientsByOrder.set(orderId, set);
  }
  // Bound per-order client count to prevent a single order page open in
  // many tabs from exhausting socket memory.
  if (set.size >= MAX_CLIENTS_PER_ORDER) {
    const oldest = set.values().next().value as Client | undefined;
    if (oldest) {
      try { oldest.res.end(); } catch {}
      clearInterval(oldest.heartbeat);
      set.delete(oldest);
    }
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // socket dead — 'close' handler will clean up
    }
  }, HEARTBEAT_MS);

  const client: Client = { res, userId, orderId, heartbeat };
  set.add(client);

  return () => {
    clearInterval(heartbeat);
    const s = clientsByOrder.get(orderId);
    if (s) {
      s.delete(client);
      if (s.size === 0) clientsByOrder.delete(orderId);
    }
    try { res.end(); } catch {}
  };
}

export function getRealtimeStats(): { orders: number; clients: number } {
  let clients = 0;
  for (const s of clientsByOrder.values()) clients += s.size;
  return { orders: clientsByOrder.size, clients };
}

/** Best-effort shutdown for tests / graceful exit. */
export async function shutdownRealtime(): Promise<void> {
  for (const set of clientsByOrder.values()) {
    for (const c of set) {
      clearInterval(c.heartbeat);
      try { c.res.end(); } catch {}
    }
  }
  clientsByOrder.clear();
  if (subscriber) { try { await subscriber.quit(); } catch {} subscriber = null; }
  if (publisher) { try { await publisher.quit(); } catch {} publisher = null; }
  subscribed = false;
}
