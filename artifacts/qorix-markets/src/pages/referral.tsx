import { useGetReferral, useGetReferredUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import { Copy, Users, DollarSign, Award, CheckCircle2, Gift, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

function StatSkeleton() {
  return (
    <div className="glass-card p-5 rounded-2xl space-y-2 animate-pulse">
      <div className="skeleton-shimmer h-3 w-24 rounded" />
      <div className="skeleton-shimmer h-8 w-32 rounded" />
      <div className="skeleton-shimmer h-2.5 w-20 rounded" />
    </div>
  );
}

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      <div className="skeleton-shimmer w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
        <div className="skeleton-shimmer h-2.5 w-40 rounded" />
      </div>
      <div className="skeleton-shimmer h-3 w-16 rounded" />
    </div>
  );
}

export default function ReferralPage() {
  const { data: referral, isLoading } = useGetReferral();
  const { data: users, isLoading: usersLoading } = useGetReferredUsers();
  const { toast } = useToast();

  const handleCopy = () => {
    if (referral?.referralCode) {
      navigator.clipboard.writeText(referral.referralCode);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
    }
  };

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6"
      >
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Partner Program</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Earn commissions by inviting others to Qorix Markets.</p>
        </motion.div>

        {/* Stats + Code Row */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stat Cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {isLoading ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              <>
                <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Referrals</span>
                    <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                      <Users style={{ width: 13, height: 13 }} />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold">
                    <AnimatedCounter value={referral?.totalReferred || 0} decimals={0} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{referral?.activeReferrals || 0} currently active</p>
                </div>

                <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-400 rounded-t-2xl" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Earned</span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                      <DollarSign style={{ width: 13, height: 13 }} />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold profit-text">
                    <AnimatedCounter value={referral?.totalEarned || 0} prefix="$" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Paid to profit balance</p>
                </div>
              </>
            )}
          </div>

          {/* Invite Code */}
          <div className="glass-card-glow p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <Award style={{ width: 15, height: 15 }} />
              </div>
              <div>
                <div className="font-semibold text-sm">Your Invite Code</div>
                <div className="text-xs text-muted-foreground">5% of referrals' profits</div>
              </div>
            </div>

            {isLoading ? (
              <div className="skeleton-shimmer h-12 rounded-xl" />
            ) : (
              <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/8">
                <span className="flex-1 px-3 font-mono font-bold tracking-[0.15em] text-base text-white">
                  {referral?.referralCode ?? "—"}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_16px_rgba(59,130,246,0.4)] shrink-0"
                >
                  <Copy style={{ width: 15, height: 15 }} />
                </button>
              </div>
            )}

            {/* Reward tiers */}
            <div className="space-y-1.5 pt-1">
              {[
                { label: "Level 1 bonus", value: "5% of profits" },
                { label: "Bonus credited", value: "Instantly" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Gift style={{ width: 14, height: 14 }} className="text-primary" />
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { n: "1", title: "Share Your Code", desc: "Send your unique referral code to friends." },
              { n: "2", title: "They Sign Up", desc: "They create an account using your code." },
              { n: "3", title: "You Earn 5%", desc: "Receive 5% of their trading profits automatically." },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <div className="text-xs font-semibold">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Network Table */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp style={{ width: 14, height: 14 }} className="text-primary" />
              Your Network
            </h2>
            {!usersLoading && users && (
              <span className="text-xs text-muted-foreground">{users.length} member{users.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {usersLoading ? (
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 4 }).map((_, i) => <UserRowSkeleton key={i} />)}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Users style={{ width: 28, height: 28 }} className="opacity-20 mb-3" />
              <p className="text-sm font-medium">No referrals yet</p>
              <p className="text-xs opacity-50 mt-1">Share your code to start earning.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.025] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/8 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {u.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-xs font-mono font-semibold">${u.investmentAmount.toFixed(2)}</div>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 style={{ width: 9, height: 9 }} /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Inactive</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                    {format(new Date(u.joinedAt), "MMM dd")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </motion.div>
    </Layout>
  );
}
