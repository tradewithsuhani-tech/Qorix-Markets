/**
 * Feature Flags — shared cache + DB lookup layer
 *
 * Feature flags are stored in system_settings with keys like
 * `feature.p2p`, `feature.quiz`, etc. The value is the string "true"
 * or "false". Default is true (fail-open), so a missing row means ON.
 *
 * TTL: 30s in-process. On admin write the cache is invalidated immediately
 * via `invalidateFeatureFlagsCache()` so the next request re-reads from DB.
 */

import { db, systemSettingsTable } from "@workspace/db";
import { like } from "drizzle-orm";
import { TTLCache } from "./cache/ttl-cache";

export const FLAG_KEYS = [
  "p2p",
  "quiz",
  "signal_trading",
  "referral",
  "inr_withdraw",
  "usdt_deposit",
  "bot_trading",
  "leaderboard",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export type FeatureFlags = Record<FlagKey, boolean>;

export const FEATURE_FLAG_LABELS: Record<FlagKey, string> = {
  p2p: "P2P Trading",
  quiz: "Quiz / Qorixplay",
  signal_trading: "Signal Trading",
  referral: "Referral Program",
  inr_withdraw: "INR Withdrawal",
  usdt_deposit: "USDT / Crypto Deposit",
  bot_trading: "Bot Trading Terminal",
  leaderboard: "Leaderboard",
};

const DEFAULTS: FeatureFlags = {
  p2p: true,
  quiz: true,
  signal_trading: true,
  referral: true,
  inr_withdraw: true,
  usdt_deposit: true,
  bot_trading: true,
  leaderboard: true,
};

const cache = new TTLCache<FeatureFlags>(30_000);
const CACHE_KEY = "feature-flags";

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const { value } = await cache.getOrCompute(CACHE_KEY, async () => {
    const rows = await db
      .select()
      .from(systemSettingsTable)
      .where(like(systemSettingsTable.key, "feature.%"));

    const map: Record<string, string> = {};
    for (const row of rows) {
      const shortKey = row.key.slice("feature.".length);
      map[shortKey] = row.value;
    }

    const flags = { ...DEFAULTS };
    for (const k of FLAG_KEYS) {
      if (k in map) {
        flags[k] = map[k] !== "false";
      }
    }
    return flags;
  });
  return value;
}

export function invalidateFeatureFlagsCache(): void {
  cache.invalidate(CACHE_KEY);
}
