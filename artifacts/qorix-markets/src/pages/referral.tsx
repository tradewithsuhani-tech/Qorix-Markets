import { useGetReferral, useGetReferredUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Users, DollarSign, Link2, Hash, TrendingUp, CheckCircle2,
  ArrowRight, MessageSquare, Send, Twitter, Facebook, ExternalLink,
  BarChart3, Shield, Zap, Globe, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } };

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
    <div className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
      <div className="skeleton-shimmer w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
        <div className="skeleton-shimmer h-2.5 w-40 rounded" />
      </div>
      <div className="skeleton-shimmer h-3 w-16 rounded" />
    </div>
  );
}

const PLATFORM_BENEFITS = [
  { icon: BarChart3, label: "Automated trading", detail: "Professional desk active 24/7" },
  { icon: Zap, label: "Daily profit distribution", detail: "Credited to your wallet every day" },
  { icon: Shield, label: "Capital protection system", detail: "Drawdown ceiling locked per account" },
  { icon: Globe, label: "USDT (TRC20) settlement", detail: "Stable, borderless, instant" },
];

const CHANNELS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    color: "#25D366",
    getUrl: (link: string, code: string) =>
      `https://wa.me/?text=${encodeURIComponent(
        `I've been using Qorix Markets — an automated USDT investment platform that distributes daily profits.\n\nUse my partner code *${code}* or sign up directly:\n${link}\n\nNo manual trading involved. Worth exploring.`
      )}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: Send,
    color: "#229ED9",
    getUrl: (link: string, code: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
        `Qorix Markets — automated USDT investing with daily profit payouts. Partner code: ${code}`
      )}`,
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: Twitter,
    color: "#E7E9EA",
    getUrl: (link: string, code: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `Currently using Qorix Markets for automated USDT investing — daily profits, no manual trading. Partner code: ${code} ${link} #USDT #PassiveIncome`
      )}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    color: "#1877F2",
    getUrl: (link: string, _code: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
  },
];

const MESSAGE_TEMPLATES = [
  {
    id: "casual",
    label: "Casual",
    buildText: (code: string, link: string) =>
      `Hey! I've been investing on Qorix Markets and earning daily profits from automated USDT trading. Really straightforward — you just deposit and the platform handles everything.\n\nJoin with my code: ${code}\nOr use my link: ${link}`,
  },
  {
    id: "professional",
    label: "Professional",
    buildText: (code: string, link: string) =>
      `I wanted to share Qorix Markets with you — an automated investment platform built on USDT that distributes daily trading profits. It uses a professional trading desk with built-in capital protection tiers.\n\nPartner referral code: ${code}\nRegistration link: ${link}`,
  },
];

export default function ReferralPage() {
  const { data: referral, isLoading } = useGetReferral();
  const { data: users, isLoading: usersLoading } = useGetReferredUsers();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"link" | "code">("link");
  const [templateId, setTemplateId] = useState("casual");

  const referralCode = referral?.referralCode ?? "";
  const referralLink = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : "";
  const displayValue = activeTab === "link" ? referralLink : referralCode;

  const handleCopy = (value?: string) => {
    const text = value ?? displayValue;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleShare = (getUrl: (link: string, code: string) => string) => {
    if (!referralLink) return;
    window.open(getUrl(referralLink, referralCode), "_blank", "noopener,noreferrer");
  };

  const activeTemplate = MESSAGE_TEMPLATES.find(t => t.id === templateId)!;
  const templateText = referralCode ? activeTemplate.buildText(referralCode, referralLink) : "";

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6 max-w-4xl"
      >
        {/* ── Header ── */}
        <motion.div variants={item}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Partner Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Invite investors, earn 5% of their monthly profits — automatically.</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Active</span>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoading ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : (
            <>
              <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-500/60 to-indigo-500/40" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Total Partners</p>
                <p className="text-3xl font-bold"><AnimatedCounter value={referral?.totalReferred || 0} decimals={0} /></p>
                <p className="text-xs text-muted-foreground mt-2">{referral?.activeReferrals || 0} actively investing</p>
              </div>

              <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/60 to-teal-500/40" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Commission Earned</p>
                <p className="text-3xl font-bold profit-text"><AnimatedCounter value={referral?.totalEarned || 0} prefix="$" /></p>
                <p className="text-xs text-muted-foreground mt-2">Paid to profit balance</p>
              </div>

              <div className="glass-card p-5 rounded-2xl relative overflow-hidden col-span-2 lg:col-span-1">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/60 to-purple-500/40" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Commission Rate</p>
                <p className="text-3xl font-bold text-violet-400">5%</p>
                <p className="text-xs text-muted-foreground mt-2">Of each referral's monthly profits</p>
              </div>
            </>
          )}
        </motion.div>

        {/* ── Partner Link & Code ── */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Your Partner Credentials</p>
              <p className="text-xs text-muted-foreground mt-0.5">Share your link or code to track referrals</p>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.07] mb-3 w-fit">
            {(["link", "code"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === tab
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {tab === "link" ? <Link2 className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                {tab === "link" ? "Partner Link" : "Partner Code"}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="skeleton-shimmer h-11 rounded-xl" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-2 bg-black/40 rounded-xl px-4 py-3 border border-white/[0.07]"
              >
                <span className={cn(
                  "flex-1 font-mono truncate",
                  activeTab === "link" ? "text-blue-400 text-xs" : "text-white text-base font-bold tracking-[0.18em]"
                )}>
                  {displayValue || "—"}
                </span>
                <button
                  onClick={() => handleCopy()}
                  disabled={!displayValue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/90 hover:bg-primary text-white text-xs font-semibold transition-all shrink-0 disabled:opacity-40"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </motion.div>
            </AnimatePresence>
          )}

          {activeTab === "link" && referralLink && (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Anyone opening this link lands directly on the registration page with your code pre-filled.
            </p>
          )}
        </motion.div>

        {/* ── Share Section ── */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
            <p className="text-sm font-semibold text-white">Share Your Partner Link</p>
            <p className="text-xs text-muted-foreground mt-0.5">Post on any platform — each signup is tracked to your account automatically.</p>
          </div>

          {/* Social channels */}
          <div className="divide-y divide-white/[0.04]">
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleShare(ch.getUrl)}
                  disabled={!referralLink}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${ch.color}18`, border: `1px solid ${ch.color}28` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: ch.color }} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-white">{ch.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          {/* Message templates */}
          <div className="px-5 py-4 border-t border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-white">Message Template</p>
              <div className="flex gap-1 p-0.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
                {MESSAGE_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                      templateId === t.id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-black/30 rounded-xl border border-white/[0.07] p-4">
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">
                {referralCode
                  ? activeTemplate.buildText(referralCode, `qorixmarkets.com/ref/${referralCode}`)
                  : "Loading your partner credentials..."}
              </p>
            </div>
            <button
              onClick={() => handleCopy(templateText)}
              disabled={!referralCode}
              className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
            >
              <Copy className="w-3 h-3" />
              Copy full message
            </button>
          </div>
        </motion.div>

        {/* ── Why Qorix + How It Works side by side ── */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Platform Overview */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-1">Platform Overview</p>
            <p className="text-xs text-muted-foreground mb-4">Key points to share with your network</p>
            <div className="space-y-3">
              {PLATFORM_BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{b.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{b.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Returns highlight */}
            <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Typical Monthly Returns</p>
              <div className="space-y-1.5">
                {[
                  { tier: "Conservative", range: "1.5% – 5%", color: "bg-blue-400" },
                  { tier: "Balanced", range: "3% – 8%", color: "bg-violet-400" },
                  { tier: "Growth", range: "5% – 10%+", color: "bg-emerald-400" },
                ].map(r => (
                  <div key={r.tier} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", r.color)} />
                      <span className="text-muted-foreground">{r.tier}</span>
                    </div>
                    <span className="font-semibold text-white">{r.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-1">How Referrals Work</p>
            <p className="text-xs text-muted-foreground mb-5">Your commission is calculated and paid automatically</p>
            <div className="space-y-0">
              {[
                {
                  n: "01",
                  title: "Share your link or code",
                  desc: "Send it via message, post it on social media, or include it in any content you create.",
                  color: "text-blue-400",
                  dot: "bg-blue-500",
                },
                {
                  n: "02",
                  title: "Your contact registers",
                  desc: "They sign up using your link — your partner code is automatically attached to their account.",
                  color: "text-violet-400",
                  dot: "bg-violet-500",
                },
                {
                  n: "03",
                  title: "They activate an investment",
                  desc: "Once they deposit and start an investment plan, they become an active referral in your network.",
                  color: "text-amber-400",
                  dot: "bg-amber-500",
                },
                {
                  n: "04",
                  title: "You earn 10% monthly",
                  desc: "On the 25th of each month, 10% of their profits are automatically credited to your profit balance.",
                  color: "text-emerald-400",
                  dot: "bg-emerald-500",
                },
              ].map((step, i, arr) => (
                <div key={step.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0", step.color, "bg-white/[0.04] border-white/[0.1]")}>
                      {step.n}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-px flex-1 my-1.5 bg-white/[0.06]" />
                    )}
                  </div>
                  <div className={cn("pb-5", i === arr.length - 1 && "pb-0")}>
                    <p className="text-xs font-semibold text-white">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Network Table ── */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Your Network</p>
              {!usersLoading && users && (
                <p className="text-xs text-muted-foreground mt-0.5">{users.length} registered partner{users.length !== 1 ? "s" : ""}</p>
              )}
            </div>
            {!usersLoading && users && users.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span>{users.filter(u => u.isActive).length} active</span>
              </div>
            )}
          </div>

          {usersLoading ? (
            <div className="divide-y divide-white/[0.04]">
              {Array.from({ length: 3 }).map((_, i) => <UserRowSkeleton key={i} />)}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-muted-foreground">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 opacity-30" />
              </div>
              <p className="text-sm font-medium text-white/40">No partners yet</p>
              <p className="text-xs text-muted-foreground mt-1">Share your link above to start building your network.</p>
              <button
                onClick={() => handleCopy(referralLink)}
                disabled={!referralLink}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-xs font-semibold transition-all disabled:opacity-40"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Partner Link
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email.replace(/(.{2})(.*)(@.*)/, "$1···$3")}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs font-mono font-semibold text-white">${u.investmentAmount.toFixed(2)}</p>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Inactive</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0 hidden sm:block tabular-nums">
                    {format(new Date(u.joinedAt), "MMM d, yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </motion.div>
    </Layout>
  );
}
