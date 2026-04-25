import { cn } from "@/lib/utils";
import type { VipInfo } from "@workspace/api-client-react";

type VipTier = "none" | "silver" | "gold" | "platinum";

const TIER_CONFIG: Record<VipTier, {
  label: string;
  gradient: string;
  border: string;
  text: string;
  dotClass: string;
  dotColor: string;
  progressColor: string;
}> = {
  none: {
    label: "Standard",
    gradient: "from-slate-500/20 to-slate-600/20",
    border: "border-slate-500/30",
    text: "text-slate-400",
    dotClass: "bg-slate-400",
    dotColor: "#94a3b8",
    progressColor: "#94a3b8",
  },
  silver: {
    label: "Silver",
    gradient: "from-slate-300/20 to-slate-400/20",
    border: "border-slate-400/40",
    text: "text-slate-300",
    dotClass: "bg-slate-300",
    dotColor: "#cbd5e1",
    progressColor: "#cbd5e1",
  },
  gold: {
    label: "Gold",
    gradient: "from-amber-400/20 to-yellow-500/20",
    border: "border-amber-400/40",
    text: "text-amber-300",
    dotClass: "bg-amber-400",
    dotColor: "#fbbf24",
    progressColor: "#fbbf24",
  },
  platinum: {
    label: "Platinum",
    gradient: "from-cyan-400/20 to-violet-500/20",
    border: "border-cyan-400/40",
    text: "text-cyan-300",
    dotClass: "bg-cyan-400",
    dotColor: "#22d3ee",
    progressColor: "#22d3ee",
  },
};

interface VipBadgeProps {
  tier: VipTier;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function VipBadge({ tier, size = "sm", className }: VipBadgeProps) {
  if (tier === "none") return null;
  const cfg = TIER_CONFIG[tier];

  const sizeClasses = {
    xs: "text-[9px] px-1.5 py-0.5 gap-1",
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  const tooltip = {
    silver: "Silver — Lower withdrawal fee (entry tier)",
    gold: "Gold — Better returns + reduced fees",
    platinum: "Platinum — Maximum benefits, lowest fees",
  }[tier];

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center rounded-full font-bold tracking-wide uppercase border shadow-sm cursor-help",
        `bg-gradient-to-r ${cfg.gradient}`,
        cfg.border,
        cfg.text,
        sizeClasses,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)} />
      {cfg.label}
    </span>
  );
}

interface VipCardProps {
  vip: VipInfo;
  investmentAmount?: number;
}

export function VipCard({ vip, investmentAmount = 0 }: VipCardProps) {
  const tier = (vip.tier ?? "none") as VipTier;
  const cfg = TIER_CONFIG[tier];

  const tiers: Array<{ tier: VipTier; label: string; min: number; profitBonus: number; fee: number }> = [
    { tier: "silver",   label: "Silver",   min: 500,   profitBonus: 0.2,  fee: 1.5 },
    { tier: "gold",     label: "Gold",     min: 2000,  profitBonus: 0.35, fee: 1.0 },
    { tier: "platinum", label: "Platinum", min: 10000, profitBonus: 0.5,  fee: 0.5 },
  ];

  const currentBonus = tiers.find((t) => t.tier === tier)?.profitBonus;

  const progressToNext = vip.nextTier
    ? Math.min(100, (investmentAmount / vip.nextTier.minAmount) * 100)
    : 100;

  // Compact min-amount label (e.g. $10,000 → $10K) so tier rows never wrap
  // on narrow screens like iPhone SE (375px).
  const fmtMin = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toString().replace(/\.0$/, "")}K` : `$${n}`;

  return (
    <div className={cn(
      "rounded-2xl border p-4 sm:p-5 bg-gradient-to-br",
      cfg.gradient,
      cfg.border,
    )}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1">Membership</div>
          <div className={cn("text-xl sm:text-2xl font-bold tracking-tight truncate", cfg.text)}>
            {cfg.label}
          </div>
        </div>
        <VipBadge tier={tier} size="md" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
        <div className="bg-black/20 rounded-xl p-2.5 sm:p-3 border border-white/5">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Profit Bonus</div>
          <div className={cn("text-base sm:text-lg font-bold", cfg.text)}>
            {tier === "none" || currentBonus === undefined ? "—" : `+${currentBonus}%`}
          </div>
        </div>
        <div className="bg-black/20 rounded-xl p-2.5 sm:p-3 border border-white/5">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Withdrawal Fee</div>
          <div className={cn("text-base sm:text-lg font-bold", cfg.text)}>
            {(vip.withdrawalFee * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {vip.nextTier && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Progress to{" "}
              <span className={cn("font-semibold", TIER_CONFIG[(vip.nextTier.tier as VipTier)].text)}>
                {vip.nextTier.label}
              </span>
            </span>
            <span className="text-xs font-bold text-white">
              ${vip.nextTier.amountNeeded.toLocaleString()} more
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-black/40 overflow-hidden border border-white/10 shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${progressToNext}%`,
                background: `linear-gradient(90deg, #60a5fa 0%, #3b82f6 60%, ${TIER_CONFIG[(vip.nextTier.tier as VipTier)].progressColor} 100%)`,
                boxShadow: `0 0 12px ${TIER_CONFIG[(vip.nextTier.tier as VipTier)].progressColor}99, 0 0 4px #60a5fa`,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
              style={{
                width: `${progressToNext}%`,
                background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%)",
              }}
            />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/80 text-right">
            {progressToNext.toFixed(0)}% complete
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">All Tiers</div>
        {tiers.map((t) => {
          const isActive = t.tier === tier;
          const tierCfg = TIER_CONFIG[t.tier];
          return (
            <div
              key={t.tier}
              className={cn(
                "grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 sm:gap-x-3 px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs border transition-all",
                isActive
                  ? cn("bg-black/20 border-white/10", tierCfg.text, "font-semibold")
                  : "text-muted-foreground border-transparent"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActive ? tierCfg.dotClass : "bg-white/20")} />
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="truncate">{t.label}</span>
                <span className="text-muted-foreground/60 text-[10px] sm:text-[11px] whitespace-nowrap">
                  {fmtMin(t.min)}+
                </span>
              </div>
              <span className="whitespace-nowrap tabular-nums">+{t.profitBonus}%</span>
              <span className="whitespace-nowrap tabular-nums text-muted-foreground/80">
                {t.fee}% fee
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
