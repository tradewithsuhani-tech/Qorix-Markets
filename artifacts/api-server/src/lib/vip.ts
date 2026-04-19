export type VipTier = "none" | "silver" | "gold" | "platinum";

export interface VipInfo {
  tier: VipTier;
  label: string;
  profitBonus: number;
  withdrawalFee: number;
  minAmount: number;
  nextTier?: {
    tier: VipTier;
    label: string;
    minAmount: number;
    amountNeeded: number;
  };
}

const VIP_THRESHOLDS: Array<{
  tier: VipTier;
  label: string;
  minAmount: number;
  profitBonus: number;
  withdrawalFee: number;
}> = [
  { tier: "platinum", label: "Platinum", minAmount: 10000, profitBonus: 0.15, withdrawalFee: 0.005 },
  { tier: "gold",     label: "Gold",     minAmount: 2000,  profitBonus: 0.10, withdrawalFee: 0.010 },
  { tier: "silver",   label: "Silver",   minAmount: 500,   profitBonus: 0.05, withdrawalFee: 0.015 },
  { tier: "none",     label: "Standard", minAmount: 0,     profitBonus: 0.00, withdrawalFee: 0.020 },
];

export function getVipInfo(investmentAmount: number): VipInfo {
  for (let i = 0; i < VIP_THRESHOLDS.length; i++) {
    const current = VIP_THRESHOLDS[i]!;
    if (investmentAmount >= current.minAmount) {
      const next = i > 0 ? VIP_THRESHOLDS[i - 1]! : undefined;
      return {
        tier: current.tier,
        label: current.label,
        profitBonus: current.profitBonus,
        withdrawalFee: current.withdrawalFee,
        minAmount: current.minAmount,
        nextTier: next
          ? {
              tier: next.tier,
              label: next.label,
              minAmount: next.minAmount,
              amountNeeded: Math.max(0, next.minAmount - investmentAmount),
            }
          : undefined,
      };
    }
  }
  return {
    tier: "none",
    label: "Standard",
    profitBonus: 0,
    withdrawalFee: 0.02,
    minAmount: 0,
  };
}
