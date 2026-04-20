import { useGetReferral, useGetReferredUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Users, DollarSign, Award, CheckCircle2, Gift, TrendingUp,
  Link2, QrCode, Share2, MessageCircle, Send, Twitter, Facebook,
  Megaphone, Zap, Shield, Globe, ChevronRight, Sparkles, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

const TALKING_POINTS = [
  {
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "100% Automated & Safe",
    desc: "Your investment is managed by a professional algorithm. No manual trading required — just deposit and watch your money grow.",
  },
  {
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "Daily Profit Distribution",
    desc: "Profits are distributed every single day. You can withdraw anytime — no lock-in periods or hidden fees.",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    title: "Start With Any Amount",
    desc: "No minimum barrier to entry. Whether it's $100 or $100,000 — the system works equally well for everyone.",
  },
  {
    icon: Star,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    title: "VIP Tier Rewards",
    desc: "The more you invest, the higher your VIP tier — unlocking better profit rates and exclusive partner commissions.",
  },
  {
    icon: Globe,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    title: "USDT — Global & Stable",
    desc: "Built on USDT (TRC20) — the world's most trusted stablecoin. No currency risk, instant deposits, and global access.",
  },
  {
    icon: Sparkles,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    title: "You Earn Too — 5% Referral",
    desc: "Every person you invite earns you 5% of their profits automatically. The bigger your network, the more you earn monthly.",
  },
];

const SHARE_TEMPLATES = [
  {
    platform: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/25",
    hoverBg: "hover:bg-green-500/15",
    getUrl: (link: string) =>
      `https://wa.me/?text=${encodeURIComponent(`🚀 I'm earning daily profits on Qorix Markets — the automated USDT investment platform!\n\nJoin using my link and start growing your money today:\n${link}\n\n✅ Fully automated | ✅ Daily payouts | ✅ No lock-in`)}`,
  },
  {
    platform: "Telegram",
    icon: Send,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    hoverBg: "hover:bg-sky-500/15",
    getUrl: (link: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`🚀 Join Qorix Markets — automated USDT investing with daily profits! Use my referral link to sign up.`)}`,
  },
  {
    platform: "Twitter / X",
    icon: Twitter,
    color: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/25",
    hoverBg: "hover:bg-slate-500/15",
    getUrl: (link: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🤑 Making daily passive income with @QorixMarkets — automated USDT trading, zero hassle.\n\nJoin with my link: ${link} #USDT #PassiveIncome #Crypto`)}`,
  },
  {
    platform: "Facebook",
    icon: Facebook,
    color: "text-blue-500",
    bg: "bg-blue-600/10",
    border: "border-blue-600/25",
    hoverBg: "hover:bg-blue-600/15",
    getUrl: (link: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
  },
];

export default function ReferralPage() {
  const { data: referral, isLoading } = useGetReferral();
  const { data: users, isLoading: usersLoading } = useGetReferredUsers();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"link" | "code">("link");

  const referralCode = referral?.referralCode ?? "";
  const referralLink = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : "";

  const displayValue = activeTab === "link" ? referralLink : referralCode;

  const handleCopy = () => {
    if (!displayValue) return;
    navigator.clipboard.writeText(displayValue);
    toast({
      title: "Copied!",
      description: activeTab === "link" ? "Partner link copied to clipboard." : "Partner code copied to clipboard.",
    });
  };

  const handleShare = (getUrl: (link: string) => string) => {
    if (!referralLink) return;
    window.open(getUrl(referralLink), "_blank", "noopener,noreferrer");
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

        {/* Stats + Partner Link Row */}
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

          {/* Partner Link / Code Card */}
          <div className="glass-card-glow p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-primary/15 text-primary">
                <Award style={{ width: 15, height: 15 }} />
              </div>
              <div>
                <div className="font-semibold text-sm">Your Partner Invite</div>
                <div className="text-xs text-muted-foreground">5% of referrals' profits</div>
              </div>
            </div>

            {/* Tab toggle */}
            <div className="flex gap-1.5 p-1 bg-black/30 rounded-xl border border-white/8">
              <button
                onClick={() => setActiveTab("link")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "link"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <Link2 style={{ width: 11, height: 11 }} />
                Partner link
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === "code"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <QrCode style={{ width: 11, height: 11 }} />
                Partner code
              </button>
            </div>

            {isLoading ? (
              <div className="skeleton-shimmer h-12 rounded-xl" />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/8"
                >
                  <span className={cn(
                    "flex-1 px-3 font-bold truncate",
                    activeTab === "link"
                      ? "text-blue-400 text-[11px] font-mono"
                      : "font-mono tracking-[0.15em] text-base text-white"
                  )}>
                    {displayValue || "—"}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_16px_rgba(59,130,246,0.4)] shrink-0"
                  >
                    <Copy style={{ width: 14, height: 14 }} />
                  </button>
                </motion.div>
              </AnimatePresence>
            )}

            <div className="space-y-1 pt-0.5">
              {[
                { label: "Commission", value: "5% of profits" },
                { label: "Credited", value: "Automatically" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Share on Social Media */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Share & Grow Your Network</span>
            <span className="ml-auto text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full uppercase tracking-wide">+5% per referral</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Share your link on social media — the bigger your network, the more you earn monthly.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {SHARE_TEMPLATES.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.platform}
                  onClick={() => handleShare(s.getUrl)}
                  disabled={!referralLink}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all",
                    s.bg, s.border, s.hoverBg,
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("w-5 h-5", s.color)} />
                  <span className="text-xs font-semibold text-white">{s.platform}</span>
                </button>
              );
            })}
          </div>

          {/* Copy-ready caption */}
          <div className="rounded-xl bg-black/30 border border-white/8 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ready-to-use caption</span>
              <button
                onClick={() => {
                  const caption = `🚀 I'm earning daily passive income with Qorix Markets — the automated USDT investment platform!\n\nJoin using my referral link and start growing your money today:\n${referralLink}\n\n✅ Fully automated trading\n✅ Daily profit payouts\n✅ Withdraw anytime\n✅ Starts from any amount\n\nDon't miss out! 💰`;
                  navigator.clipboard.writeText(caption);
                  toast({ title: "Caption copied!", description: "Paste it anywhere you want to share." });
                }}
                disabled={!referralLink}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
              >
                <Copy style={{ width: 10, height: 10 }} />
                Copy caption
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              🚀 I'm earning daily passive income with Qorix Markets — the automated USDT investment platform!<br />
              ✅ Fully automated · ✅ Daily payouts · ✅ Withdraw anytime<br />
              <span className="text-blue-400 truncate block mt-1">{referralLink || "Your link appears here after loading..."}</span>
            </p>
          </div>
        </motion.div>

        {/* Why People Should Join — talking points */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">What to Tell Your Network</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Use these points to convince friends and family why Qorix Markets is worth joining.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TALKING_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  key={point.title}
                  className={cn("flex gap-3 p-3.5 rounded-xl border transition-all", point.bg, point.border)}
                >
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", point.bg, "border", point.border)}>
                    <Icon className={cn("w-4 h-4", point.color)} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white mb-0.5">{point.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{point.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Gift style={{ width: 14, height: 14 }} className="text-primary" />
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { n: "1", title: "Share Your Link", desc: "Send your partner link or code to anyone on any platform.", color: "bg-blue-500/20 text-blue-400" },
              { n: "2", title: "They Sign Up", desc: "They create an account using your referral link or code.", color: "bg-purple-500/20 text-purple-400" },
              { n: "3", title: "They Invest", desc: "Once they deposit and activate an investment plan.", color: "bg-amber-500/20 text-amber-400" },
              { n: "4", title: "You Earn 5%", desc: "You receive 5% of their profits automatically every month.", color: "bg-emerald-500/20 text-emerald-400" },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 sm:text-center">
                <div className={cn("w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0", step.color)}>
                  {step.n}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-white">{step.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:block sm:absolute sm:hidden" />
                )}
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
              <p className="text-xs opacity-50 mt-1">Share your link above to start building your network.</p>
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
