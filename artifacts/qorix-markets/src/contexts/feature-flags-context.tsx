import { createContext, useContext, type ReactNode } from "react";
import {
  useFeatureFlags,
  type FlagKey,
  type FeatureFlags,
} from "@/hooks/use-feature-flags";

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

const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FLAGS);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const flags = useFeatureFlags();
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFlag(key: FlagKey): boolean {
  return useContext(FeatureFlagsContext)[key] ?? true;
}

export function useAllFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
