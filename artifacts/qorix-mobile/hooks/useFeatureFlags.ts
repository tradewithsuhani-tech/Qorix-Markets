/**
 * useFeatureFlags — Remote feature flag fetch for Qorix mobile
 *
 * Fetches GET /api/v1/feature-flags from the Qorix backend and caches
 * the result for 60 seconds. Defaults to all flags enabled (fail-open)
 * so that network errors or slow responses never disable features.
 *
 * Usage:
 *   const { flags, loading } = useFeatureFlags();
 *   if (!flags.p2p) return null; // hide P2P section
 */

import { useEffect, useRef, useState } from "react";
import { QORIX_API_BASE } from "@/lib/apiClient";

export type FlagKey =
  | "p2p"
  | "quiz"
  | "signal_trading"
  | "referral"
  | "inr_withdraw"
  | "usdt_deposit"
  | "bot_trading"
  | "leaderboard";

export type FeatureFlags = Record<FlagKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  p2p: true,
  quiz: true,
  signal_trading: true,
  referral: true,
  inr_withdraw: true,
  usdt_deposit: true,
  bot_trading: true,
  leaderboard: true,
};

const TTL_MS = 60_000;

let cachedFlags: FeatureFlags | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<FeatureFlags> | null = null;

async function loadFlags(token?: string): Promise<FeatureFlags> {
  if (cachedFlags && Date.now() < cacheExpiresAt) {
    return cachedFlags;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${QORIX_API_BASE}/v1/feature-flags`, {
        headers,
      });
      if (!res.ok) return DEFAULT_FLAGS;
      const json = await res.json();
      if (!json.success || !json.data) return DEFAULT_FLAGS;
      const flags: FeatureFlags = { ...DEFAULT_FLAGS, ...json.data };
      cachedFlags = flags;
      cacheExpiresAt = Date.now() + TTL_MS;
      return flags;
    } catch {
      return DEFAULT_FLAGS;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function invalidateFeatureFlagsCache(): void {
  cachedFlags = null;
  cacheExpiresAt = 0;
}

export function useFeatureFlags(token?: string): {
  flags: FeatureFlags;
  loading: boolean;
} {
  const [flags, setFlags] = useState<FeatureFlags>(
    cachedFlags && Date.now() < cacheExpiresAt ? cachedFlags : DEFAULT_FLAGS
  );
  const [loading, setLoading] = useState(
    !(cachedFlags && Date.now() < cacheExpiresAt)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetch_ = async () => {
      const result = await loadFlags(token);
      if (!cancelled) {
        setFlags(result);
        setLoading(false);
      }
    };

    fetch_();
    intervalRef.current = setInterval(fetch_, TTL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token]);

  return { flags, loading };
}
