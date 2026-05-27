import { useQuery } from "@tanstack/react-query";

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

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch("/api/v1/feature-flags");
    if (!res.ok) return DEFAULT_FLAGS;
    const json = await res.json();
    if (!json.success || !json.data) return DEFAULT_FLAGS;
    return { ...DEFAULT_FLAGS, ...json.data };
  } catch {
    return DEFAULT_FLAGS;
  }
}

export function useFeatureFlags(): FeatureFlags {
  const { data } = useQuery<FeatureFlags>({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: DEFAULT_FLAGS,
  });
  return data ?? DEFAULT_FLAGS;
}
