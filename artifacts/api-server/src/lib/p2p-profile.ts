// P2P Merchant Trust Profile aggregation + 5-minute Redis-backed cache.
//
// Heavy aggregate (4 SQL queries; group-bys across p2p_orders + p2p_ratings
// + user lookup). We render this on the ads list (one card per ad) and on
// every order detail page, so we cache per-user under a small TTL and
// punch-through on order/rating mutations to keep numbers fresh.
import { db, p2pOrdersTable, p2pRatingsTable, usersTable } from "@workspace/db";
import { and, eq, sql, or, gte } from "drizzle-orm";
import { RedisCache } from "./cache/redis-cache";
import { TTLCache } from "./cache/ttl-cache";
import { getRedisConnection } from "./redis";

export type MerchantProfile = {
  userId: number;
  displayName: string;          // first-name + ***
  memberSinceMonths: number;    // months since signup
  kycVerified: boolean;
  isVerifiedMerchant: boolean;  // Binance-style trust badge
  totalCompletedAllTime: number;
  totalOrders30d: number;
  completedOrders30d: number;
  completionRate30d: number;    // percent 0..100
  totalVolumeUsdt30d: number;
  avgReleaseSeconds: number | null; // null when no completed orders
  avgRating: number | null;     // 1..5
  ratingCount: number;
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes — short enough for live trading UX

const cache = new RedisCache<MerchantProfile>({
  getRedis: getRedisConnection,
  namespace: "p2p-profile",
  ttlMs: TTL_MS,
  fallback: new TTLCache<MerchantProfile>(TTL_MS),
});

// Trust criteria — mirrors Binance P2P "Verified Merchant" intent.
// All four must hold:
//   * KYC approved
//   * >= 30 completed orders all-time
//   * >= 90 % completion rate over the last 30 days
//   * avg release time <= 10 minutes (release = seller confirm after paid)
// These thresholds are intentionally not configurable yet — once the
// product matures we can move them to system_settings.
const VERIFIED_MIN_COMPLETED = 30;
const VERIFIED_MIN_COMPLETION_PCT = 90;
const VERIFIED_MAX_RELEASE_SECONDS = 10 * 60;

async function compute(userId: number): Promise<MerchantProfile> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 4-way parallel aggregate — single round trip is enough headroom for
  // an ad list page that may request 20 profiles back to back, since the
  // cache absorbs repeats.
  const [allTime, last30d, releaseAgg, ratingAgg, userRow] = await Promise.all([
    // All-time completed count — used for the "X trades completed" badge
    // and the verified-merchant gate.
    db.select({
      completed: sql<number>`count(*) filter (where ${p2pOrdersTable.status} = 'completed')::int`,
    }).from(p2pOrdersTable).where(or(
      eq(p2pOrdersTable.buyerId, userId),
      eq(p2pOrdersTable.sellerId, userId),
    )),
    // 30d totals — drives completion rate + volume figures.
    db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${p2pOrdersTable.status} = 'completed')::int`,
      volumeUsdt: sql<string>`coalesce(sum(${p2pOrdersTable.usdtAmount}) filter (where ${p2pOrdersTable.status} = 'completed'), 0)::text`,
    }).from(p2pOrdersTable).where(and(
      or(eq(p2pOrdersTable.buyerId, userId), eq(p2pOrdersTable.sellerId, userId)),
      gte(p2pOrdersTable.createdAt, thirtyDaysAgo),
    )),
    // Avg release time = paidAt → completedAt for orders where THIS user
    // was the seller (release is a seller action). Bound to 30d to keep
    // the figure responsive to recent behaviour.
    db.select({
      avgSeconds: sql<string | null>`extract(epoch from avg(${p2pOrdersTable.completedAt} - ${p2pOrdersTable.paidAt}))::text`,
    }).from(p2pOrdersTable).where(and(
      eq(p2pOrdersTable.sellerId, userId),
      eq(p2pOrdersTable.status, "completed"),
      gte(p2pOrdersTable.completedAt, thirtyDaysAgo),
    )),
    // Ratings received as the counterparty — all-time (small table; no
    // need to bound).
    db.select({
      avg: sql<string | null>`avg(${p2pRatingsTable.rating})::text`,
      count: sql<number>`count(*)::int`,
    }).from(p2pRatingsTable).where(eq(p2pRatingsTable.toUserId, userId)),
    db.select({
      fullName: usersTable.fullName,
      createdAt: usersTable.createdAt,
      kycStatus: usersTable.kycStatus,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
  ]);

  const u = userRow[0];
  // Privacy: only first name + *** is exposed (matches existing
  // advertiserName masking in /p2p/ads list).
  const displayName = u
    ? ((u.fullName as string) || "User").split(" ")[0] + "***"
    : "User***";
  const memberSinceMonths = u?.createdAt
    ? Math.max(0, Math.floor((Date.now() - u.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 0;
  const kycVerified = u?.kycStatus === "approved";

  const totalCompletedAllTime = allTime[0]?.completed ?? 0;
  const total30 = last30d[0]?.total ?? 0;
  const completed30 = last30d[0]?.completed ?? 0;
  const volume30 = parseFloat(last30d[0]?.volumeUsdt ?? "0");
  const completionRate30d = total30 > 0
    ? Math.round((completed30 / total30) * 100)
    : 100;
  const avgSecondsRaw = releaseAgg[0]?.avgSeconds;
  const avgReleaseSeconds = avgSecondsRaw ? Math.round(parseFloat(avgSecondsRaw)) : null;
  const avgRatingRaw = ratingAgg[0]?.avg;
  const avgRating = avgRatingRaw ? Math.round(parseFloat(avgRatingRaw) * 10) / 10 : null;
  const ratingCount = ratingAgg[0]?.count ?? 0;

  const isVerifiedMerchant = !!(
    kycVerified
    && totalCompletedAllTime >= VERIFIED_MIN_COMPLETED
    && completionRate30d >= VERIFIED_MIN_COMPLETION_PCT
    && (avgReleaseSeconds !== null && avgReleaseSeconds <= VERIFIED_MAX_RELEASE_SECONDS)
  );

  return {
    userId,
    displayName,
    memberSinceMonths,
    kycVerified,
    isVerifiedMerchant,
    totalCompletedAllTime,
    totalOrders30d: total30,
    completedOrders30d: completed30,
    completionRate30d,
    totalVolumeUsdt30d: volume30,
    avgReleaseSeconds,
    avgRating,
    ratingCount,
  };
}

export async function getMerchantProfile(userId: number): Promise<MerchantProfile> {
  const { value } = await cache.getOrCompute(`u:${userId}`, () => compute(userId));
  return value;
}

/**
 * Batch fetch — used by the ads-list endpoint so we don't N+1 the cache.
 * Cache hits are O(1); misses fall back to compute().
 *
 * On a cold cache an /p2p/ads request can ask for ~20–50 distinct advertiser
 * profiles in one shot. Each miss fans out into 5 aggregate queries against
 * Neon (~25-35ms RTT each), so an unbounded Promise.all could open 250+
 * concurrent DB ops and tip a single Fly instance over its pg pool. Cap
 * concurrency at 5 so the worst-case cold burst is bounded.
 */
const MAX_CONCURRENT_PROFILE_COMPUTES = 5;

export async function getMerchantProfiles(
  userIds: number[],
): Promise<Map<number, MerchantProfile>> {
  const uniq = [...new Set(userIds)];
  const map = new Map<number, MerchantProfile>();
  // Simple sliding-window pool — no extra dep, ~10 lines of code.
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= uniq.length) return;
      const id = uniq[i];
      const p = await getMerchantProfile(id);
      map.set(id, p);
    }
  }
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_PROFILE_COMPUTES, uniq.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return map;
}

/**
 * Punch-through invalidation for both parties of an order or rating.
 * Called from /confirm, /cancel, /rate, expiry cron, and admin dispute
 * resolve — cheap (single Redis DEL each) and keeps the trust numbers
 * honest immediately after a trade settles.
 */
export async function invalidateMerchantProfile(userId: number): Promise<void> {
  await cache.invalidate(`u:${userId}`);
}

export async function invalidateMerchantProfiles(userIds: number[]): Promise<void> {
  await Promise.all([...new Set(userIds)].map(invalidateMerchantProfile));
}
