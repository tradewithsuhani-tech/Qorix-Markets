import { useGetReferral, useGetReferredUsers, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import {
  Copy, Users, DollarSign, Award, CheckCircle2, TrendingUp,
  Star, Crown, Zap, Shield, ChevronRight, Gift, Trophy,
  ArrowRight, Info, Sparkles, Clock, CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

// Partner level definitions
const PARTNER_LEVELS = [
  {
    id: "starter",
    label: "Starter",
    icon: Star,
    color: "text-slate-400",
    borderColor: "border-slate-500/30",
    bgColor: "bg-slate-500/10",
    gradientFrom: "from-slate-500/20",
    gradientTo: "to-slate-600/10",
    commission: "0.5%",
    commissionDesc: "monthly on network investment",
    minReferrals: 0,
    minNetworkAum: 0,
    badge: null,
  },
  {
    id: "bronze",
    label: "Bronze",
    icon: Shield,
    color: "text-amber-600",
    borderColor: "border-amber-600/30",
    bgColor: "bg-amber-600/10",
    gradientFrom: "from-amber-600/20",
    gradientTo: "to-amber-700/10",
    commission: "0.75%",
    commissionDesc: "monthly on network investment",
    minReferrals: 5,
    minNetworkAum: 10000,
    badge: "Bronze",
  },
  {
    id: "silver",
    label: "Silver",
    icon: Zap,
    color: "text-slate-300",
    borderColor: "border-slate-300/30",
    bgColor: "bg-slate-300/10",
    gradientFrom: "from-slate-300/20",
    gradientTo: "to-slate-400/10",
    commission: "1.0%",
    commissionDesc: "monthly on network investment",
    minReferrals: 15,
    minNetworkAum: 50000,
    badge: "Silver",
  },
  {
    id: "gold",
    label: "Gold",
    icon: Award,
    color: "text-yellow-400",
    borderColor: "border-yellow-400/30",
    bgColor: "bg-yellow-400/10",
    gradientFrom: "from-yellow-400/20",
    gradientTo: "to-amber-500/10",
    commission: "1.25%",
    commissionDesc: "monthly on network investment",
    minReferrals: 30,
    minNetworkAum: 150000,
    badge: "Gold",
  },
  {
    id: "platinum",
    label: "Platinum",
    icon: Crown,
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
    bgColor: "bg-blue-400/10",
    gradientFrom: "from-blue-400/20",
    gradientTo: "to-indigo-500/10",
    commission: "1.5%",
    commissionDesc: "monthly on network investment",
    minReferrals: 50,
    minNetworkAum: 500000,
    badge: "Platinum",
  },
];

// Loyalty milestones
const LOYALTY_MILESTONES = [
  { id: 1, label: "Target 1", networkAum: 50000, reward: "$500 Cash", rewardAlt: "Account Credit", description: "Reach $50K total network investment" },
  { id: 2, label: "Target 2", networkAum: 200000, reward: "$2,000 Cash", rewardAlt: "Account Credit", description: "Reach $200K total network investment" },
  { id: 3, label: "Target 3", networkAum: 1000000, reward: "$10,000 Cash", rewardAlt: "Account Credit", description: "Reach $1M total network investment" },
];

function getPartnerLevel(activeReferrals: number, networkAum: number) {
  let level = PARTNER_LEVELS[0]!;
  for (const l of PARTNER_LEVELS) {
    if (activeReferrals >= l.minReferrals && networkAum >= l.minNetworkAum) {
      level = l;
    }
  }
  return level;
}

function getNextLevel(currentLevelId: string) {
  const idx = PARTNER_LEVELS.findIndex((l) => l.id === currentLevelId);
  return idx < PARTNER_LEVELS.length - 1 ? PARTNER_LEVELS[idx + 1] : null;
}

// Returns days remaining until the next commission payout (25th of current/next month)
function getDaysLeftInPeriod(): number {
  const now = new Date();
  const day = now.getDate();
  const payoutDay = 25;
  let target: Date;
  if (day < payoutDay) {
    target = new Date(now.getFullYear(), now.getMonth(), payoutDay);
  } else {
    // Past the 25th — next period ends 25th of next month
    target = new Date(now.getFullYear(), now.getMonth() + 1, payoutDay);
  }
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DaysLeftBadge({ daysLeft, size = "md" }: { daysLeft: number; size?: "sm" | "md" }) {
  const urgent = daysLeft <= 5;
  const warning = daysLeft <= 14;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        urgent
          ? "bg-red-500/15 border-red-500/30 text-red-400"
          : warning
          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
          : "bg-blue-500/15 border-blue-500/30 text-blue-400"
      )}
    >
      <Clock className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      <span>{daysLeft}d left</span>
      <ChevronRight className={size === "sm" ? "w-2.5 h-2.5 opacity-60" : "w-3 h-3 opacity-60"} />
    </motion.div>
  );
}

function ProgressBar({ value, max, colorClass = "bg-blue-500" }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn("h-full rounded-full", colorClass)}
      />
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="glass-card p-5 rounded-2xl space-y-2 animate-pulse">
      <div className="skeleton-shimmer h-3 w-24 rounded" />
      <div className="skeleton-shimmer h-8 w-32 rounded" />
      <div className="skeleton-shimmer h-2.5 w-20 rounded" />
    </div>
  );
}

export default function RewardsPage() {
  const { data: referral, isLoading: refLoading } = useGetReferral();
  const { data: users, isLoading: usersLoading } = useGetReferredUsers();
  const { data: summary } = useGetDashboardSummary();
  const { toast } = useToast();

  const activeReferrals = users?.filter((u) => u.isActive).length ?? 0;
  const totalReferrals = users?.length ?? 0;
  const networkAum = users?.reduce((sum, u) => sum + (u.investmentAmount ?? 0), 0) ?? 0;
  const totalEarned = referral?.totalEarned ?? 0;

  const currentLevel = getPartnerLevel(activeReferrals, networkAum);
  const nextLevel = getNextLevel(currentLevel.id);
  const daysLeft = getDaysLeftInPeriod();

  const handleCopy = () => {
    if (referral?.referralCode) {
      navigator.clipboard.writeText(referral.referralCode);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
    }
  };

  const LevelIcon = currentLevel.icon;

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6 max-w-4xl"
      >
        {/* Header */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Promotions</h1>
            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Partner</span>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Grow your network and unlock higher commissions and loyalty rewards.</p>
        </motion.div>

        {/* Current Level + Stats Row */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Current Level Card */}
          <div className={cn(
            "glass-card rounded-2xl p-5 relative overflow-hidden lg:col-span-1",
            `border ${currentLevel.borderColor}`
          )}>
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", currentLevel.gradientFrom, currentLevel.gradientTo)} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your Level</div>
                  <div className={cn("text-xl font-bold", currentLevel.color)}>{currentLevel.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{currentLevel.commissionDesc}</div>
                </div>
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", currentLevel.bgColor)}>
                  <LevelIcon className={cn("w-5 h-5", currentLevel.color)} />
                </div>
              </div>

              {/* Commission rate */}
              <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border mb-4", currentLevel.borderColor, currentLevel.bgColor)}>
                <TrendingUp className={cn("w-3.5 h-3.5", currentLevel.color)} />
                <span className={cn("text-lg font-bold", currentLevel.color)}>{currentLevel.commission}</span>
                <span className="text-xs text-muted-foreground">commission</span>
              </div>

              {/* Progress to next level */}
              {nextLevel ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress to {nextLevel.label}</span>
                    <DaysLeftBadge daysLeft={daysLeft} size="sm" />
                  </div>

                  {/* Active referrals progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Active referrals</span>
                      <span className="font-mono">
                        <span className="text-white">{activeReferrals}</span> / {nextLevel.minReferrals}
                      </span>
                    </div>
                    <ProgressBar value={activeReferrals} max={nextLevel.minReferrals} colorClass={cn(
                      currentLevel.id === "starter" ? "bg-amber-600" :
                      currentLevel.id === "bronze" ? "bg-slate-300" :
                      currentLevel.id === "silver" ? "bg-yellow-400" : "bg-blue-400"
                    )} />
                  </div>

                  {/* Network AUM progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Network AUM</span>
                      <span className="font-mono">
                        <span className="text-white">${networkAum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> / ${nextLevel.minNetworkAum.toLocaleString()}
                      </span>
                    </div>
                    <ProgressBar value={networkAum} max={nextLevel.minNetworkAum} colorClass={cn(
                      currentLevel.id === "starter" ? "bg-amber-600" :
                      currentLevel.id === "bronze" ? "bg-slate-300" :
                      currentLevel.id === "silver" ? "bg-yellow-400" : "bg-blue-400"
                    )} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400 font-semibold">Maximum level reached!</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            {refLoading || usersLoading ? (
              <>
                <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
              </>
            ) : (
              <>
                <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active Referrals</span>
                    <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400"><Users style={{ width: 12, height: 12 }} /></div>
                  </div>
                  <div className="text-2xl font-bold"><AnimatedCounter value={activeReferrals} decimals={0} /></div>
                  <p className="text-xs text-muted-foreground mt-1">{totalReferrals} total invited</p>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-400 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total Earned</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400"><DollarSign style={{ width: 12, height: 12 }} /></div>
                  </div>
                  <div className="text-2xl font-bold profit-text"><AnimatedCounter value={totalEarned} prefix="$" /></div>
                  <p className="text-xs text-muted-foreground mt-1">Commission paid out</p>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-violet-400 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Network AUM</span>
                    <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400"><TrendingUp style={{ width: 12, height: 12 }} /></div>
                  </div>
                  <div className="text-2xl font-bold"><AnimatedCounter value={networkAum} prefix="$" /></div>
                  <p className="text-xs text-muted-foreground mt-1">Total active investment</p>
                </div>

                {/* Referral code */}
                <div className="glass-card p-4 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-primary/15 text-primary"><Gift style={{ width: 12, height: 12 }} /></div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Your Code</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/8">
                    <span className="flex-1 px-2 font-mono font-bold tracking-widest text-sm text-white truncate">
                      {referral?.referralCode ?? "—"}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all shrink-0"
                    >
                      <Copy style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Partner Level Tiers */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white">Partner Levels</span>
            </div>
            <span className="text-xs text-muted-foreground">Commission on network investment (monthly)</span>
          </div>

          <div className="divide-y divide-white/5">
            {PARTNER_LEVELS.map((level) => {
              const isActive = level.id === currentLevel.id;
              const isPassed = PARTNER_LEVELS.indexOf(level) < PARTNER_LEVELS.indexOf(currentLevel);
              const Icon = level.icon;

              return (
                <div
                  key={level.id}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 transition-all",
                    isActive ? "bg-blue-500/5 border-l-2 border-l-blue-400" : "border-l-2 border-l-transparent"
                  )}
                >
                  {/* Level icon */}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", level.bgColor)}>
                    <Icon className={cn("w-4.5 h-4.5", level.color)} style={{ width: 18, height: 18 }} />
                  </div>

                  {/* Name + qualifications */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-bold", level.color)}>{level.label}</span>
                      {isActive && (
                        <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Current
                        </span>
                      )}
                      {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {level.minReferrals > 0
                        ? `${level.minReferrals}+ active referrals · $${(level.minNetworkAum / 1000).toFixed(0)}k+ network AUM`
                        : "No minimum — open to all partners"
                      }
                    </div>
                  </div>

                  {/* Commission */}
                  <div className="text-right shrink-0">
                    <div className={cn("text-lg font-bold", level.color)}>{level.commission}</div>
                    <div className="text-[10px] text-muted-foreground">monthly</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Loyalty Milestones */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white">Loyalty Program</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              Hit all targets to claim your reward
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Progress track */}
            <div className="relative">
              {/* Track line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/8 z-0">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000 rounded-full"
                  style={{
                    width: networkAum >= LOYALTY_MILESTONES[2]!.networkAum ? "100%"
                      : networkAum >= LOYALTY_MILESTONES[1]!.networkAum ? "66%"
                      : networkAum >= LOYALTY_MILESTONES[0]!.networkAum ? "33%"
                      : `${Math.min((networkAum / LOYALTY_MILESTONES[0]!.networkAum) * 33, 33)}%`
                  }}
                />
              </div>

              {/* Milestone dots */}
              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col items-center gap-2 text-center w-20">
                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                    networkAum >= 0 ? "bg-blue-500 border-blue-400 text-white" : "bg-white/5 border-white/15 text-muted-foreground"
                  )}>S</div>
                  <span className="text-[9px] text-muted-foreground font-medium">Start</span>
                  <span className="text-[9px] text-blue-400 font-semibold">$0</span>
                </div>

                {LOYALTY_MILESTONES.map((m, i) => {
                  const reached = networkAum >= m.networkAum;
                  return (
                    <div key={m.id} className="flex flex-col items-center gap-2 text-center w-24">
                      <div className={cn(
                        "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                        reached
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "bg-white/5 border-white/15 text-muted-foreground"
                      )}>
                        {reached ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className="text-[9px] text-muted-foreground font-medium">{m.label}</span>
                      <span className={cn("text-[9px] font-semibold", reached ? "text-emerald-400" : "text-muted-foreground")}>
                        ${m.networkAum >= 1000000 ? `${m.networkAum / 1000000}M` : `${m.networkAum / 1000}k`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Milestone reward cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {LOYALTY_MILESTONES.map((m) => {
                const reached = networkAum >= m.networkAum;
                const progress = Math.min((networkAum / m.networkAum) * 100, 100);

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl border p-4 space-y-3 transition-all",
                      reached
                        ? "bg-emerald-500/8 border-emerald-500/25"
                        : "bg-white/3 border-white/8"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", reached ? "text-emerald-400" : "text-muted-foreground")}>
                        {m.label}
                      </span>
                      {reached ? (
                        <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase">
                          Reached
                        </span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">{progress.toFixed(0)}%</span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className={cn("text-base font-bold", reached ? "text-emerald-400" : "text-white")}>{m.reward}</div>
                      <div className="text-[10px] text-muted-foreground">or {m.rewardAlt}</div>
                    </div>

                    <div className="space-y-1.5">
                      <ProgressBar
                        value={networkAum}
                        max={m.networkAum}
                        colorClass={reached ? "bg-emerald-500" : "bg-blue-500"}
                      />
                      <div className="text-[10px] text-muted-foreground">
                        {m.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Qualification criteria detail */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Qualification Criteria</span>
            {nextLevel && (
              <span className={cn("text-xs font-semibold", nextLevel.color)}>
                ({[activeReferrals >= nextLevel.minReferrals, networkAum >= nextLevel.minNetworkAum].filter(Boolean).length}/2)
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <DaysLeftBadge daysLeft={daysLeft} size="md" />
            </div>
          </div>
          {/* Period info strip */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4 pl-0.5">
            <CalendarClock className="w-3 h-3 shrink-0" />
            <span>
              Commissions paid on the <span className="text-white font-medium">25th of each month</span> — meet criteria before the deadline to level up.
            </span>
          </div>

          {nextLevel ? (
            <div className="space-y-4">
              {/* Active referrals */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Active referrals</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    <span className="text-white font-semibold">{activeReferrals}</span> / {nextLevel.minReferrals}
                  </span>
                </div>
                <ProgressBar
                  value={activeReferrals}
                  max={nextLevel.minReferrals}
                  colorClass={cn(nextLevel.color.replace("text-", "bg-"))}
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Referrals with active investments count</span>
                  <span className={cn(
                    "font-medium",
                    activeReferrals >= nextLevel.minReferrals ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {activeReferrals >= nextLevel.minReferrals ? "✓ Qualified" : `${nextLevel.minReferrals - activeReferrals} more needed`}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* Network AUM */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Network AUM</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    <span className="text-white font-semibold">${networkAum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> / ${nextLevel.minNetworkAum.toLocaleString()}
                  </span>
                </div>
                <ProgressBar
                  value={networkAum}
                  max={nextLevel.minNetworkAum}
                  colorClass={cn(nextLevel.color.replace("text-", "bg-"))}
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Total active investment across your network</span>
                  <span className={cn(
                    "font-medium",
                    networkAum >= nextLevel.minNetworkAum ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {networkAum >= nextLevel.minNetworkAum
                      ? "✓ Qualified"
                      : `$${(nextLevel.minNetworkAum - networkAum).toLocaleString(undefined, { maximumFractionDigits: 0 })} more needed`
                    }
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Crown className="w-8 h-8 text-blue-400" />
              <div className="text-sm font-semibold text-white">You've reached Platinum — the highest level!</div>
              <div className="text-xs text-muted-foreground">Enjoy the maximum 1.5% monthly commission on your entire network.</div>
            </div>
          )}
        </motion.div>

        {/* How commissions work */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">How Commissions Work</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { n: "1", title: "Invite Members", desc: "Share your unique code. Anyone who signs up becomes part of your network." },
              { n: "2", title: "They Invest", desc: "When your referrals make active investments, their AUM counts toward your level." },
              { n: "3", title: "You Earn Monthly", desc: "On the 25th of each month, your commission is automatically paid to your profit balance." },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </Layout>
  );
}
