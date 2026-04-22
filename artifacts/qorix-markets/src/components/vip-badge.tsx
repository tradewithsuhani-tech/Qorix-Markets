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
    silver: "Silver tier — $500+ active fund · +5% profit bonus · 1.5% withdrawal fee",
    gold: "Gold tier — $2,000+ active fund · +10% profit bonus · 1.0% withdrawal fee",
    platinum: "Platinum tier — $10,000+ active fund · +15% profit bonus · 0.5% withdrawal fee",
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
    { tier: "silver",   label: "Silver",   min: 500,   profitBonus: 5,  fee: 1.5 },
    { tier: "gold",     label: "Gold",     min: 2000,  profitBonus: 10, fee: 1.0 },
    { tier: "platinum", label: "Platinum", min: 10000, profitBonus: 15, fee: 0.5 },
  ];

  const progressToNext = vip.nextTier
    ? Math.min(100, (investmentAmount / vip.nextTier.minAmount) * 100)
    : 100;

  return (
    <div className={cn(
      "rounded-2xl border p-5 bg-gradient-to-br",
      cfg.gradient,
      cfg.border,
    )}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1">Membership</div>
          <div className={cn("text-2xl font-bold tracking-tight", cfg.text)}>
            {cfg.label}
          </div>
        </div>
        <VipBadge tier={tier} size="md" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-muted-foreground mb-1">Profit Bonus</div>
          <div className={cn("text-lg font-bold", cfg.text)}>
            {tier === "none" ? "—" : `+${(vip.profitBonus * 100).toFixed(0)}%`}
          </div>
        </div>
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-muted-foreground mb-1">Withdrawal Fee</div>
          <div className={cn("text-lg font-bold", cfg.text)}>
            {(vip.withdrawalFee * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {vip.nextTier && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Progress to <span className={TIER_CONFIG[(vip.nextTier.tier as VipTier)].text}>{vip.nextTier.label}</span>
            </span>
            <span className="text-xs font-medium text-white">
              ${vip.nextTier.amountNeeded.toLocaleString()} more
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressToNext}%`, backgroundColor: cfg.progressColor }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">All Tiers</div>
        {tiers.map((t) => {
          const isActive = t.tier === tier;
          const tierCfg = TIER_CONFIG[t.tier];
          return (
            <div
              key={t.tier}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all",
                isActive
                  ? cn("bg-black/20 border-white/10", tierCfg.text, "font-semibold")
                  : "text-muted-foreground border-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isActive ? tierCfg.dotClass : "bg-white/20")} />
                <span>{t.label}</span>
                <span className="text-muted-foreground/60">(${t.min.toLocaleString()}+)</span>
              </div>
              <div className="flex items-center gap-3">
                <span>+{t.profitBonus}% profit</span>
                <span>{t.fee}% fee</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
