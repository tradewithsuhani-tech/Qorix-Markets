import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { User as UserIcon, Mail, Calendar, Shield, Crown, Copy, CheckCircle2, LogOut, Volume2, VolumeX, ShieldCheck, ChevronRight, Clock, XCircle, Send, ExternalLink, Loader2, Unlink } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from "@/lib/notification-sound";
import { format } from "date-fns";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { VipBadge, VipCard } from "@/components/vip-badge";
import type { VipInfo } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TelegramAlertsCard } from "@/components/telegram-alerts-card";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <div className={`px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8 text-sm font-medium ${mono ? "font-mono tracking-wider" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const { data: kyc } = useQuery<{ kycStatus: string }>({
    queryKey: ["kyc-status"],
    queryFn: () => authFetch("/api/kyc/status"),
    staleTime: 30000,
  });

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      // Preview the sound when turning ON
      playNotificationSound("generic");
      toast({ title: "Notification sound enabled" });
    } else {
      toast({ title: "Notification sound muted" });
    }
  };

  if (!user) return null;

  const vip = summary?.vip;
  const vipTier = (vip?.tier ?? "none") as "none" | "silver" | "gold" | "platinum";
  const accountId = `QORIX-${user.id.toString().padStart(6, "0")}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(accountId).then(() => {
      setCopied(true);
      toast({ title: "Copied!", description: "Account ID copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6 max-w-2xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Account Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your profile and preferences.</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
          {/* Avatar banner */}
          <div className="h-20 bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.2),transparent_70%)]" />
          </div>

          <div className="px-5 pb-5 -mt-8 space-y-5">
            <div className="flex items-end gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg border-2 border-background shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">{user.fullName}</h2>
                  {!isLoading && <VipBadge tier={vipTier} size="sm" />}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Mail style={{ width: 13, height: 13 }} />
                  {user.email}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon style={{ width: 11, height: 11 }} /> Account ID
                </label>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8 hover:bg-white/[0.07] hover:border-white/15 transition-all group"
                >
                  <span className="font-mono text-sm font-semibold tracking-wider">{accountId}</span>
                  {copied
                    ? <CheckCircle2 style={{ width: 14, height: 14 }} className="text-emerald-400" />
                    : <Copy style={{ width: 13, height: 13 }} className="text-muted-foreground group-hover:text-white transition-colors" />
                  }
                </button>
              </div>

              <InfoRow
                label="Member Since"
                value={format(new Date(user.createdAt), "MMMM dd, yyyy")}
              />
            </div>
          </div>
        </motion.div>

        {/* Security */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Shield style={{ width: 15, height: 15 }} />
            </div>
            <h3 className="font-semibold">Security</h3>
          </div>

          <div className="space-y-2">
            {[
              { label: "Password", sub: "Last changed: Never", action: "Update" },
              { label: "Two-Factor Auth", sub: "Adds extra login protection", action: "Enable" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
                <div>
                  <div className="text-sm font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{row.sub}</div>
                </div>
                <button className="btn btn-ghost text-xs px-3 py-1.5">{row.action}</button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* KYC */}
        <motion.div variants={item}>
          <Link href="/kyc">
            <a className="block glass-card rounded-2xl p-4 hover:border-blue-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
                  <ShieldCheck style={{ width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Identity Verification (KYC)
                    {kyc?.kycStatus === "approved" && (
                      <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 style={{ width: 10, height: 10 }} /> Verified
                      </span>
                    )}
                    {kyc?.kycStatus === "pending" && (
                      <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock style={{ width: 10, height: 10 }} /> Under Review
                      </span>
                    )}
                    {kyc?.kycStatus === "rejected" && (
                      <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle style={{ width: 10, height: 10 }} /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {kyc?.kycStatus === "approved"
                      ? "Withdrawals enabled"
                      : "Required to enable withdrawals"}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </a>
          </Link>
        </motion.div>

        {/* VIP Card */}
        {isLoading ? (
          <motion.div variants={item}>
            <div className="skeleton-shimmer h-48 rounded-2xl" />
          </motion.div>
        ) : vip ? (
          <motion.div variants={item} className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Crown style={{ width: 16, height: 16 }} className="text-amber-400" />
              VIP Membership
            </h2>
            <VipCard vip={vip as VipInfo} investmentAmount={summary?.activeInvestment ?? 0} />
          </motion.div>
        ) : null}

        {/* Telegram Alerts */}
        <motion.div variants={item}>
          <TelegramAlertsCard />
        </motion.div>

        {/* Preferences */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
              {soundOn ? <Volume2 style={{ width: 15, height: 15 }} /> : <VolumeX style={{ width: 15, height: 15 }} />}
            </div>
            <h3 className="font-semibold">Preferences</h3>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-sm font-medium">Notification Sound</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Play a chime when a new alert arrives.
              </div>
            </div>
            <button
              onClick={toggleSound}
              role="switch"
              aria-checked={soundOn}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0 ${
                soundOn ? "bg-blue-500" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                  soundOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
              <LogOut style={{ width: 15, height: 15 }} />
            </div>
            <h3 className="font-semibold">Sign Out</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll be logged out of this device. You can sign back in anytime with your email and password.
          </p>
          {!showLogoutConfirm ? (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-semibold text-sm transition-all"
            >
              <LogOut style={{ width: 15, height: 15 }} />
              Logout
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-white text-center">Are you sure you want to logout?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
}
