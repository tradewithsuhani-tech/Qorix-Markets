import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Trophy, Star, Users, TrendingUp, Crown, Flame,
  Rocket, Diamond, Globe, Award, ChevronRight, Zap, Medal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReferralEntry = {
  id: number;
  fullName: string;
  referralCode: string;
  referralCount: number;
  totalEarnings: number;
};

type InvestorEntry = {
  id: number;
  fullName: string;
  investmentAmount: number;
  isActive: boolean;
  weeklyProfit: number;
};

type Badge = {
  id: string;
  label: string;
  desc: string;
  earned: boolean;
  icon: string;
};

type Rewards = {
  points: number;
  badges: Badge[];
  stats: {
    totalProfit: number;
    referralCount: number;
    daysSinceStart: number;
    weeklyRank: number | null;
    referralRank: number | null;
  };
  nextMilestone: Badge | null;
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
function authFetch<T>(url: string): Promise<T> {
  const token = localStorage.getItem("qorix_token");
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function maskName(name: string, currentId: number, rowId: number) {
  if (rowId === currentId) return name + " (You)";
  if (!name) return "Anonymous";
  const parts = name.split(" ");
  return parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");
}

const RANK_COLORS = [
  "from-yellow-400/20 to-amber-600/10 border-yellow-500/25 text-yellow-400",
  "from-slate-300/20 to-slate-500/10 border-slate-400/25 text-slate-300",
  "from-amber-600/20 to-orange-700/10 border-amber-700/25 text-amber-600",
];

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-black text-base">🥇</span>;
  if (rank === 2) return <span className="text-slate-300 font-black text-base">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-base">🥉</span>;
  return <span className="text-muted-foreground text-xs font-bold w-6 text-center">#{rank}</span>;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TABS = [
  { id: "weekly", label: "Top Investors", icon: TrendingUp },
  { id: "rewards", label: "Promotions", icon: Star },
];

// ---------------------------------------------------------------------------
// Referral Leaderboard tab
// ---------------------------------------------------------------------------
function ReferralLeaderboard({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery<{ leaderboard: ReferralEntry[]; myRank: number | null }>({
    queryKey: ["leaderboard-referrals"],
    queryFn: () => authFetch("/api/leaderboard/referrals"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) return <LeaderboardSkeleton />;

  const list = data?.leaderboard ?? [];

  return (
    <div className="space-y-2">
      {/* My rank pill */}
      {data?.myRank && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
          <span className="text-xs text-blue-300">Your referral rank</span>
          <span className="text-sm font-bold text-blue-400">#{data.myRank}</span>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="No referrers yet"
          sub="Be the first to build your network"
        />
      ) : (
        list.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
              entry.id === userId
                ? "bg-blue-500/8 border-blue-500/20"
                : "bg-white/[0.025] border-white/6 hover:bg-white/[0.04]"
            )}
          >
            <div className="w-7 flex items-center justify-center shrink-0">
              <RankMedal rank={i + 1} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {maskName(entry.fullName, userId, entry.id)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {entry.referralCount} referral{entry.referralCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-emerald-400">
                +${parseFloat(String(entry.totalEarnings)).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">earned</div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly investors tab
// ---------------------------------------------------------------------------
function WeeklyLeaderboard({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery<{ leaderboard: InvestorEntry[]; myRank: number | null }>({
    queryKey: ["leaderboard-weekly"],
    queryFn: () => authFetch("/api/leaderboard/investors/weekly"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) return <LeaderboardSkeleton />;

  const list = data?.leaderboard ?? [];

  return (
    <div className="space-y-2">
      {data?.myRank ? (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
          <span className="text-xs text-blue-300">Your weekly rank</span>
          <span className="text-sm font-bold text-blue-400">#{data.myRank}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-white/3 border border-white/8">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-xs text-muted-foreground">Activate investment to appear here</span>
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No activity this week"
          sub="Profits are counted Monday–Sunday"
        />
      ) : (
        list.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
              entry.id === userId
                ? "bg-blue-500/8 border-blue-500/20"
                : "bg-white/[0.025] border-white/6 hover:bg-white/[0.04]"
            )}
          >
            <div className="w-7 flex items-center justify-center shrink-0">
              <RankMedal rank={i + 1} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {maskName(entry.fullName, userId, entry.id)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                ${parseFloat(String(entry.investmentAmount)).toLocaleString()} invested
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-emerald-400">
                +${parseFloat(String(entry.weeklyProfit)).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">this week</div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rewards tab
// ---------------------------------------------------------------------------
const BADGE_ICONS: Record<string, React.ElementType> = {
  "🚀": Rocket, "💎": Diamond, "🤝": Users, "🔥": Flame,
  "🌐": Globe, "⭐": Star, "🏆": Trophy, "👑": Crown,
};

function RewardsTab({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery<Rewards>({
    queryKey: ["rewards", userId],
    queryFn: () => authFetch("/api/leaderboard/rewards"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) return <LeaderboardSkeleton rows={5} />;

  const badges = data?.badges ?? [];
  const earnedBadges = badges.filter((b) => b.earned);
  const points = data?.points ?? 0;

  return (
    <div className="space-y-3">
      {/* Intro / explainer */}
      <div className="px-3.5 py-3 rounded-xl bg-gradient-to-br from-blue-500/[0.08] to-violet-500/[0.05] border border-blue-500/15">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <Star className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white mb-1">How Promotions work</div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Trade, invite friends, and stay active to earn{" "}
              <span className="text-blue-300 font-medium">XP points</span> and unlock{" "}
              <span className="text-blue-300 font-medium">badges</span>. Each badge is a milestone — collect them all to climb the weekly leaderboard and unlock bonus rewards.
            </p>
          </div>
        </div>
      </div>

      {/* Points card */}
      <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Total XP Points</div>
            <div className="text-2xl font-black text-white">{points.toLocaleString()}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="text-emerald-400 font-medium">{earnedBadges.length}/{badges.length}</span>
          badges earned
          {data?.stats.weeklyRank && (
            <>
              <span className="text-white/20 mx-1">·</span>
              <Medal className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">Rank #{data.stats.weeklyRank} this week</span>
            </>
          )}
        </div>
      </div>

      {/* Next milestone */}
      {data?.nextMilestone && (
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 flex items-center gap-3">
          <span className="text-xl">{data.nextMilestone.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white">Next: {data.nextMilestone.label}</div>
            <div className="text-[10px] text-muted-foreground">{data.nextMilestone.desc}</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Badge grid */}
      <div className="grid grid-cols-4 gap-2">
        {badges.map((badge) => (
          <motion.div
            key={badge.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
              badge.earned
                ? "bg-white/[0.06] border-white/15"
                : "bg-white/[0.015] border-white/5 opacity-40 grayscale"
            )}
            title={badge.desc}
          >
            <span className="text-xl leading-none">{badge.icon}</span>
            <span className="text-[9px] text-muted-foreground leading-tight font-medium">{badge.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Stats row */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Profit", value: `$${parseFloat(String(data.stats.totalProfit)).toFixed(0)}` },
            { label: "Referrals", value: String(data.stats.referralCount) },
            { label: "Days Active", value: String(data.stats.daysSinceStart) },
          ].map((s) => (
            <div key={s.label} className="text-center py-2 px-1 rounded-xl bg-white/[0.025] border border-white/6">
              <div className="text-sm font-bold text-white">{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton & Empty
// ---------------------------------------------------------------------------
function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="py-8 flex flex-col items-center gap-1.5 text-center">
      <span className="text-3xl">{icon}</span>
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground/60">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------
export function GrowthPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("weekly");

  if (!user) return null;

  return (
    <div className="glass-card-glow rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Growth & Rankings</h2>
              <p className="text-[10px] text-muted-foreground">Leaderboards · Promotions</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/20 text-yellow-400 bg-yellow-500/8">
            Live
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-white/[0.03] rounded-xl p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <Icon style={{ width: 12, height: 12 }} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "referrals" && <ReferralLeaderboard userId={user.id} />}
            {activeTab === "weekly" && <WeeklyLeaderboard userId={user.id} />}
            {activeTab === "rewards" && <RewardsTab userId={user.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
