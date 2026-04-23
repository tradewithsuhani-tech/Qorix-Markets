import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  publicId?: string;
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
// Top-3 medal styles (used inline in the unified list)
// ---------------------------------------------------------------------------
type TopRankStyle = {
  ringGrad: string;
  avatarFill: string;
  rowBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  Icon: React.ElementType;
  iconColor: string;
};

const TOP_RANK: Record<1 | 2 | 3, TopRankStyle & { accentBar: string; glow: string }> = {
  1: {
    ringGrad: "from-yellow-300 via-amber-400 to-yellow-600",
    avatarFill: "bg-[linear-gradient(135deg,#fde047,#f59e0b_55%,#b45309)]",
    rowBg: "bg-[linear-gradient(to_right,rgba(250,204,21,0.22),rgba(250,204,21,0.06)_55%,transparent)]",
    border: "border-yellow-400/40",
    badgeBg: "bg-yellow-400/25 border-yellow-300/60 shadow-[0_0_14px_rgba(250,204,21,0.45)]",
    badgeText: "text-yellow-200",
    Icon: Crown,
    iconColor: "text-yellow-200",
    accentBar: "bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600",
    glow: "shadow-[inset_4px_0_0_rgba(250,204,21,0.85),0_0_22px_-8px_rgba(250,204,21,0.55)]",
  },
  2: {
    ringGrad: "from-slate-100 via-slate-300 to-slate-500",
    avatarFill: "bg-[linear-gradient(135deg,#f8fafc,#cbd5e1_55%,#64748b)]",
    rowBg: "bg-[linear-gradient(to_right,rgba(203,213,225,0.18),rgba(203,213,225,0.04)_55%,transparent)]",
    border: "border-slate-300/35",
    badgeBg: "bg-slate-200/22 border-slate-100/50 shadow-[0_0_12px_rgba(226,232,240,0.35)]",
    badgeText: "text-white",
    Icon: Trophy,
    iconColor: "text-white",
    accentBar: "bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500",
    glow: "shadow-[inset_4px_0_0_rgba(226,232,240,0.85),0_0_18px_-8px_rgba(226,232,240,0.45)]",
  },
  3: {
    ringGrad: "from-cyan-100 via-sky-300 to-slate-400",
    avatarFill: "bg-[linear-gradient(135deg,#ecfeff,#7dd3fc_55%,#475569)]",
    rowBg: "bg-[linear-gradient(to_right,rgba(125,211,252,0.18),rgba(125,211,252,0.04)_55%,transparent)]",
    border: "border-sky-300/35",
    badgeBg: "bg-sky-300/22 border-sky-200/55 shadow-[0_0_12px_rgba(125,211,252,0.4)]",
    badgeText: "text-sky-100",
    Icon: Medal,
    iconColor: "text-sky-100",
    accentBar: "bg-gradient-to-b from-cyan-200 via-sky-300 to-slate-400",
    glow: "shadow-[inset_4px_0_0_rgba(125,211,252,0.85),0_0_18px_-8px_rgba(125,211,252,0.45)]",
  },
};

/**
 * "Next update in MM:SS" ticking countdown shown beneath the leaderboard CTA.
 * Loops every 5 minutes and triggers an actual refetch on rollover so the
 * urgency is real, not theatre.
 */
function NextUpdateCountdown({ onRollover }: { onRollover?: () => void }) {
  const CYCLE = 5 * 60; // seconds
  const [remaining, setRemaining] = useState(CYCLE);
  // Hold the latest callback in a ref so the interval doesn't get torn down
  // and recreated on every parent re-render — that was freezing the timer.
  const cbRef = useRef(onRollover);
  useEffect(() => {
    cbRef.current = onRollover;
  }, [onRollover]);
  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          cbRef.current?.();
          return CYCLE;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(remaining / 60).toString().padStart(2, "0");
  const s = (remaining % 60).toString().padStart(2, "0");
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-emerald-300/80">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Next update in <span className="tabular-nums text-emerald-300">{m}:{s}</span>
    </div>
  );
}

/**
 * Floating "Rahul just earned $320" toast that pops in/out at the top-right of
 * the leaderboard tab. Adds a real-action heartbeat so the board doesn't feel
 * static. Names + amounts are randomised on each cycle.
 */
const ACTIVITY_NAMES = [
  "Rahul", "Priya", "Arjun", "Vikram", "Anjali",
  "Karthik", "Sneha", "Rohan", "Aditya", "Neha",
  "Kabir", "Ishaan", "Meera", "Riya", "Aryan",
];
function FloatingActivityToast() {
  const [item, setItem] = useState<{ name: string; amount: number; key: number } | null>(null);
  useEffect(() => {
    let mounted = true;
    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    const cycle = () => {
      if (!mounted) return;
      const name = ACTIVITY_NAMES[Math.floor(Math.random() * ACTIVITY_NAMES.length)];
      const amount = Math.floor(80 + Math.random() * 620);
      setItem({ name, amount, key: Date.now() });
      hideTimer = setTimeout(() => {
        if (!mounted) return;
        setItem(null);
        showTimer = setTimeout(cycle, 2200 + Math.random() * 1800);
      }, 3200);
    };
    showTimer = setTimeout(cycle, 1200);
    return () => {
      mounted = false;
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  return (
    <div className="pointer-events-none absolute right-1 -top-1 z-20 sm:right-2 sm:-top-2">
      <AnimatePresence>
        {item && (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: 24, y: -4, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.94 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/35 bg-slate-950/85 backdrop-blur-md shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55)]"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-white whitespace-nowrap">
              {item.name} just earned{" "}
              <span className="text-emerald-400 font-bold tabular-nums">+${item.amount}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tiny "updated Xs ago / just now" text that ticks every second so the LIVE
 * pill above it actually feels alive instead of being a static badge.
 */
function UpdatedAgo() {
  const [, forceTick] = useState(0);
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.floor((Date.now() - mountedAt.current) / 1000);
  const label =
    seconds < 5
      ? "updated just now"
      : seconds < 60
      ? `updated ${seconds}s ago`
      : `updated ${Math.floor(seconds / 60)}m ago`;
  return (
    <span className="text-[9.5px] text-emerald-400/70 font-medium tracking-wide tabular-nums">
      {label}
    </span>
  );
}

function CountUp({
  value,
  prefix = "",
  duration = 1.4,
  className,
}: {
  value: number;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  const prev = useRef(0);
  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: "easeOut",
      from: prev.current,
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
}


// ---------------------------------------------------------------------------
// Weekly investors tab
// ---------------------------------------------------------------------------
function WeeklyLeaderboard({ userId }: { userId: number }) {
  const { data, isLoading, refetch } = useQuery<{ leaderboard: InvestorEntry[]; myRank: number | null }>({
    queryKey: ["leaderboard-weekly"],
    queryFn: () => authFetch("/api/leaderboard/investors/weekly"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) return <LeaderboardSkeleton />;

  const list = data?.leaderboard ?? [];
  // Aggregate FOMO stat — total weekly profit earned by the top investors.
  const topPool = list.slice(0, 10).reduce(
    (sum, e) => sum + (parseFloat(String(e.weeklyProfit)) || 0),
    0,
  );
  // Top-1 profit drives the loss-aversion "you're missing $X" line.
  const top1Profit = list[0]
    ? parseFloat(String(list[0].weeklyProfit)) || 0
    : 0;
  // Find the user's own profit for this week (if they're on the board).
  const myEntry = list.find((e) => e.id === userId);
  const myProfit = myEntry ? parseFloat(String(myEntry.weeklyProfit)) || 0 : 0;
  const isActive = !!data?.myRank;
  const missingAmount = Math.max(0, top1Profit - myProfit);

  return (
    <div className="relative space-y-2">
      <FloatingActivityToast />
      {/* FOMO headline — total earned by top investors this week */}
      {list.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative mb-3 overflow-hidden rounded-2xl border border-emerald-400/25 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(16,185,129,0.18),transparent_60%),linear-gradient(to_bottom,rgba(6,78,59,0.45),rgba(2,6,23,0.85))] px-4 py-3 sm:px-5 sm:py-4"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-400/40">
              <Flame className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300/80">
                This week so far
              </div>
              <div className="text-[15px] sm:text-[16px] font-extrabold text-white leading-tight">
                Top investors made{" "}
                <CountUp
                  value={topPool}
                  prefix="$"
                  className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent"
                />
                <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">+</span>
                <span className="hidden sm:inline text-white/70 font-semibold"> · join them today</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Personal FOMO — Your Position card with Top #1 comparison */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className={cn(
          "relative mb-3 overflow-hidden rounded-2xl border px-4 py-3.5",
          isActive
            ? "border-blue-400/30 bg-[linear-gradient(to_right,rgba(59,130,246,0.18),rgba(99,102,241,0.06)_60%,transparent)]"
            : "border-rose-400/30 bg-[linear-gradient(to_right,rgba(244,63,94,0.18),rgba(244,63,94,0.04)_60%,transparent)]",
        )}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/60">
          Your Position
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/45">Rank</div>
            <div className={cn(
              "text-[19px] font-black tabular-nums leading-none mt-0.5",
              isActive ? "text-blue-300" : "text-rose-300",
            )}>
              {data?.myRank ? `#${data.myRank}` : "#—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/45">Your profit</div>
            {myProfit > 0 ? (
              <CountUp
                value={myProfit}
                prefix="+$"
                className="text-[19px] font-black tabular-nums leading-none mt-0.5 text-emerald-400 inline-block"
              />
            ) : (
              <div className="text-[19px] font-black tabular-nums leading-none mt-0.5 text-rose-300">
                $0
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-yellow-300/70">Top #1 profit</div>
            {top1Profit > 0 ? (
              <CountUp
                value={top1Profit}
                prefix="$"
                className="text-[19px] font-black tabular-nums leading-none mt-0.5 bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent inline-block"
              />
            ) : (
              <div className="text-[19px] font-black tabular-nums leading-none mt-0.5 text-white/40">
                —
              </div>
            )}
          </div>
        </div>
        {!isActive && missingAmount > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-rose-400/20 flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <div className="text-[12.5px] font-bold text-rose-200 leading-tight">
              You're missing{" "}
              <span className="text-rose-300">
                ${missingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{" "}
              <span className="text-rose-200/80 font-semibold">opportunity this week</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Single primary CTA — "Start Earning Now" */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mb-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(16,185,129,0.14),transparent_60%),linear-gradient(to_bottom,rgba(15,23,42,0.95),rgba(2,6,23,0.95))] px-5 py-5 sm:px-6 sm:py-6 text-center"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

        <div className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
          You're just one step away from{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
            top investors
          </span>
        </div>

        <a
          href="/invest"
          className="group relative mt-4 inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-green-500 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.7)] hover:shadow-[0_10px_28px_-4px_rgba(16,185,129,0.95)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
          data-testid="link-leaderboard-cta-start-trading"
        >
          Start Earning Now
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <NextUpdateCountdown onRollover={() => refetch()} />
      </motion.div>
      {list.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No activity this week"
          sub="Profits are counted Monday–Sunday"
        />
      ) : (
        <>
          <div className="rounded-xl border border-white/8 overflow-hidden bg-slate-950/30">
            {/* table header */}
            <div className="grid grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/8 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <div>Rank</div>
              <div>Name</div>
              <div>User ID</div>
              <div className="text-right">Trading Fund</div>
              <div className="text-right">P&amp;L</div>
              <div className="text-right">Payout</div>
            </div>

            {/* table rows */}
            <div className="divide-y divide-white/5">
              {list.map((entry, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const top = isTop3 ? TOP_RANK[rank as 1 | 2 | 3] : null;
                const isMine = entry.id === userId;
                const displayName = entry.publicId ? entry.fullName : maskName(entry.fullName, userId, entry.id);
                const initial = (displayName?.trim()?.[0] ?? "T").toUpperCase();
                const profit = parseFloat(String(entry.weeklyProfit));
                const tradingFund = parseFloat(String(entry.investmentAmount));
                const payout = profit * 0.7;
                const userIdDisplay = entry.publicId ?? `Q${String(entry.id).padStart(4, "0")}**${String(entry.id).slice(-1)}`;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.025 }}
                    className={cn(
                      "relative grid grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 items-center transition-colors",
                      isTop3 ? "py-4" : "py-2.5",
                      isMine
                        ? "bg-blue-500/8 hover:bg-blue-500/12"
                        : top
                        ? cn(top.rowBg, top.glow, "hover:brightness-125")
                        : "hover:bg-white/[0.03]",
                    )}
                  >
                    {/* Rank — medal icon for top 3, # for rest */}
                    <div className="flex items-center justify-center">
                      {top ? (
                        <div className={cn("flex items-center justify-center rounded-full border-2", top.badgeBg, rank === 1 ? "w-10 h-10" : "w-9 h-9")}>
                          <top.Icon className={cn(rank === 1 ? "w-5 h-5" : "w-4 h-4", top.iconColor)} />
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">#{rank}</span>
                      )}
                    </div>

                    {/* Name (avatar + name) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white",
                          top ? top.avatarFill : "bg-gradient-to-br from-blue-500/80 to-indigo-600/80",
                          top ? "ring-2 ring-white/25" : "ring-1 ring-white/10",
                          rank === 1 ? "w-11 h-11 text-base" : isTop3 ? "w-10 h-10 text-sm" : "w-7 h-7 text-xs",
                        )}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-white",
                            rank === 1 ? "text-[17px] font-black tracking-tight drop-shadow-[0_1px_8px_rgba(250,204,21,0.35)]"
                              : isTop3 ? "text-[15px] font-extrabold"
                              : "text-[13px] font-semibold",
                          )}
                        >
                          {displayName}
                        </span>
                        {isMine && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-[1px] rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 shrink-0">
                            You
                          </span>
                        )}
                      </div>
                    </div>

                    {/* User ID */}
                    <div className="text-[11px] font-mono text-slate-500 tracking-wider truncate">
                      {userIdDisplay}
                    </div>

                    {/* Trading Fund */}
                    <div className={cn(
                      "text-right tabular-nums",
                      rank === 1 ? "text-[16px] font-extrabold text-white"
                        : isTop3 ? "text-[15px] font-bold text-slate-100"
                        : "text-[12px] font-semibold text-slate-300",
                    )}>
                      ${tradingFund.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>

                    {/* P&L */}
                    <div className={cn(
                      "text-right tabular-nums text-emerald-400",
                      rank === 1 ? "text-[17px] font-black drop-shadow-[0_1px_8px_rgba(52,211,153,0.4)]"
                        : isTop3 ? "text-[16px] font-extrabold"
                        : "text-[13px] font-bold",
                    )}>
                      +${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    {/* Payout */}
                    <div className={cn(
                      "text-right tabular-nums",
                      rank === 1 ? "text-[16px] font-extrabold text-amber-200 drop-shadow-[0_1px_8px_rgba(250,204,21,0.4)]"
                        : isTop3 ? "text-[15px] font-bold text-amber-300"
                        : "text-[12px] font-semibold text-amber-300",
                    )}>
                      ${payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
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
          <div className="flex flex-col items-end gap-0.5">
            <span className="live-pill live-pill--green inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] px-2.5 py-1 rounded-full border border-emerald-400/50 text-emerald-300 bg-gradient-to-r from-emerald-500/15 via-green-500/12 to-emerald-500/15">
              <span className="live-pill-dot" />
              <span className="live-pill-text">LIVE</span>
            </span>
            <UpdatedAgo />
          </div>
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
