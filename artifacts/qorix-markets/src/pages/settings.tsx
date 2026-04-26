import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion, type Variants } from "framer-motion";
import { User as UserIcon, Mail, Calendar, Shield, Crown, Copy, CheckCircle2, LogOut, Volume2, VolumeX, ShieldCheck, ChevronRight, Clock, XCircle, Send, ExternalLink, Loader2, Unlink, Eye, EyeOff, AlertTriangle, KeyRound, X } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from "@/lib/notification-sound";
import { format, formatDistanceToNow } from "date-fns";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { VipBadge, VipCard } from "@/components/vip-badge";
import type { VipInfo } from "@workspace/api-client-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TelegramAlertsCard } from "@/components/telegram-alerts-card";
import { TwoFactorCard } from "@/components/two-factor-card";

interface SecurityStatus {
  passwordChangedAt: string | null;
  withdrawalLockHours: number;
  withdrawalLockedUntil: string | null;
  withdrawalLocked: boolean;
  serverTime: string;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

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
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const { data: kyc } = useQuery<{ kycStatus: string }>({
    queryKey: ["kyc-status"],
    queryFn: () => authFetch("/api/kyc/status"),
    staleTime: 30000,
  });
  const { data: security } = useQuery<SecurityStatus>({
    queryKey: ["auth-security-status"],
    queryFn: () => authFetch<SecurityStatus>("/api/auth/security-status"),
    staleTime: 30_000,
  });

  // ── Change password modal state ───────────────────────────────────────────
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const pwStrength = useMemo(() => {
    if (!pwNew) return { score: 0, label: "" };
    let score = 0;
    if (pwNew.length >= 8) score++;
    if (pwNew.length >= 12) score++;
    if (/[A-Z]/.test(pwNew) && /[a-z]/.test(pwNew)) score++;
    if (/\d/.test(pwNew)) score++;
    if (/[^A-Za-z0-9]/.test(pwNew)) score++;
    const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
    return { score, label: labels[Math.min(score, labels.length - 1)] };
  }, [pwNew]);

  const closePwModal = () => {
    setShowPwModal(false);
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setShowCurrent(false);
    setShowNew(false);
    setPwError(null);
  };

  const changePassword = useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string }) =>
      authFetch<{
        success: boolean;
        message: string;
        passwordChangedAt: string;
        withdrawalLockedUntil: string;
        withdrawalLockHours: number;
      }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (res) => {
      toast({
        title: "Password updated",
        description: `For your security, withdrawals are paused for the next ${res.withdrawalLockHours} hours. We've also emailed you a confirmation.`,
      });
      queryClient.invalidateQueries({ queryKey: ["auth-security-status"] });
      closePwModal();
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Could not update password. Please try again.";
      setPwError(msg);
    },
  });

  const submitPasswordChange = () => {
    setPwError(null);
    if (!pwCurrent) {
      setPwError("Please enter your current password.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("New password must be at least 8 characters long.");
      return;
    }
    if (pwNew.length > 128) {
      setPwError("New password must be at most 128 characters long.");
      return;
    }
    if (pwNew === pwCurrent) {
      setPwError("New password must be different from your current password.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    changePassword.mutate({ currentPassword: pwCurrent, newPassword: pwNew });
  };

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

          {/* Active 24h withdrawal lock banner (after a recent password change) */}
          {security?.withdrawalLocked && security.withdrawalLockedUntil && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <div className="font-semibold">Withdrawals paused for security</div>
                <div className="text-amber-200/80 mt-0.5">
                  Your password was changed recently. Withdrawals will re-enable{" "}
                  {formatDistanceToNow(new Date(security.withdrawalLockedUntil), { addSuffix: true })}.
                  Deposits and trading continue as normal.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
              <div className="min-w-0 pr-3">
                <div className="text-sm font-medium">Password</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {security?.passwordChangedAt
                    ? `Last changed: ${format(new Date(security.passwordChangedAt), "MMM d, yyyy")}`
                    : "Last changed: Never"}
                </div>
              </div>
              <button
                onClick={() => setShowPwModal(true)}
                className="btn btn-ghost text-xs px-3 py-1.5 shrink-0"
              >
                Update
              </button>
            </div>

            <TwoFactorCard />
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

      {/* ── Change Password Modal ──────────────────────────────────────────── */}
      {showPwModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 pb-28 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !changePassword.isPending) closePwModal(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="glass-card rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 max-h-[calc(100vh-8rem)] sm:max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                  <KeyRound style={{ width: 16, height: 16 }} />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Update Password</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose a strong, unique password.</p>
                </div>
              </div>
              <button
                onClick={closePwModal}
                disabled={changePassword.isPending}
                className="p-1.5 -m-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-200/90">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                For your security, withdrawals will be paused for{" "}
                <span className="font-semibold">{security?.withdrawalLockHours ?? 24} hours</span>{" "}
                after this change. Deposits and trading continue as normal.
              </p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); submitPasswordChange(); }}
              className="space-y-3"
            >
              {/* Current password */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    className="field-input pr-10"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-white"
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password"
                    className="field-input pr-10"
                    placeholder="At least 8 characters"
                    minLength={8}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-white"
                    aria-label={showNew ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwNew && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={
                          "h-full transition-all " +
                          (pwStrength.score <= 1
                            ? "bg-rose-500 w-1/5"
                            : pwStrength.score === 2
                            ? "bg-amber-500 w-2/5"
                            : pwStrength.score === 3
                            ? "bg-yellow-400 w-3/5"
                            : pwStrength.score === 4
                            ? "bg-emerald-400 w-4/5"
                            : "bg-emerald-500 w-full")
                        }
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      {pwStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm new password */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Confirm new password
                </label>
                <input
                  type={showNew ? "text" : "password"}
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="field-input"
                  placeholder="Re-enter new password"
                  minLength={8}
                  maxLength={128}
                />
                {pwConfirm && pwNew && pwConfirm !== pwNew && (
                  <p className="text-[11px] text-rose-400 mt-1">Passwords do not match.</p>
                )}
              </div>

              {pwError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pwError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closePwModal}
                  disabled={changePassword.isPending}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePassword.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {changePassword.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
