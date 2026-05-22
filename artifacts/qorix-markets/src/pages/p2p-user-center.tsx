import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, BadgeCheck, Mail, Phone, Star, Clock, TrendingUp,
  CheckCircle2, Plus, Trash2, Eye, EyeOff, AlertCircle, Loader2,
  ChevronRight, Users,
} from "lucide-react";

type Me = {
  id: number; fullName: string | null; email: string;
  emailVerified: boolean; kycStatus: string | null;
};

type MerchantProfile = {
  kycVerified: boolean; isVerifiedMerchant: boolean;
  totalOrders30d: number; completionRate30d: number;
  avgReleaseSeconds: number | null; avgRating: number | null;
  ratingCount: number; totalCompletedAllTime: number;
  memberSinceMonths: number;
};

type PayMethod = {
  id: number; type: string; displayName: string;
  upiId?: string | null; bankName?: string | null;
  accountHolder?: string | null; accountNumber?: string | null; ifsc?: string | null;
};

function fmtSecs(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)} min`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 px-4 py-4 border-r border-white/[0.06] last:border-r-0 text-center">
      <div className="text-white font-bold text-base leading-tight">{value}</div>
      {sub && <div className="text-slate-500 text-[10px] mt-0.5">{sub}</div>}
      <div className="text-slate-500 text-[11px] mt-1">{label}</div>
    </div>
  );
}

const TABS = ["P2P Payment Methods", "Feedback"] as const;
type Tab = typeof TABS[number];

export default function P2PUserCenterPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("P2P Payment Methods");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [peekId, setPeekId] = useState<number | null>(null);

  useEffect(() => {
    setPageLoading(true);
    authFetch<Me>("/api/auth/me")
      .then((user) => {
        setMe(user);
        return Promise.all([
          authFetch<MerchantProfile>(`/api/p2p/users/${user.id}/profile`),
          authFetch<PayMethod[]>("/api/p2p/payment-methods"),
        ]);
      })
      .then(([prof, methods]) => {
        setProfile(prof);
        setPayMethods(methods);
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, []);

  const deleteMethod = async (id: number) => {
    setDeletingId(id);
    try {
      await authFetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
      setPayMethods((prev) => prev.filter((m) => m.id !== id));
      if (peekId === id) setPeekId(null);
      toast({ title: "Payment method removed" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const initials = (me?.fullName ?? me?.email ?? "U").charAt(0).toUpperCase();
  const displayName = me?.fullName ?? me?.email?.split("@")[0] ?? "User";
  const isKyc = profile?.kycVerified ?? me?.kycStatus === "approved";
  const isMerchant = profile?.isVerifiedMerchant ?? false;

  if (pageLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">

        {/* ── Profile banner ─────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#0a1628] via-[#0d1420] to-[#0a1628]">
          {/* Top stripe */}
          <div className="h-24 bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-violet-500/10 relative">
            <div className="absolute inset-0 opacity-30"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(16,185,129,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139,92,246,0.1) 0%, transparent 50%)" }} />
          </div>

          <div className="px-6 pb-5 -mt-10">
            <div className="flex items-end justify-between gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-[#0d1420] shrink-0">
                  {initials}
                </div>
                {isMerchant && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                    <BadgeCheck size={11} className="text-black" />
                  </div>
                )}
              </div>

              {/* Become merchant CTA */}
              {!isMerchant && (
                <div className="mb-1 px-3 py-1.5 rounded-xl border border-amber-400/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 hover:border-amber-400/60 transition-colors cursor-pointer">
                  <Star size={11} /> Become Merchant
                </div>
              )}
            </div>

            {/* Name + badges */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-white font-bold text-lg">{displayName}</span>
              {isMerchant && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-semibold border border-amber-400/20">
                  <BadgeCheck size={9} /> Verified Merchant
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {me?.emailVerified && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <CheckCircle2 size={11} className="text-emerald-400" /> Email
                </span>
              )}
              {isKyc && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck size={11} className="text-emerald-400" /> KYC
                </span>
              )}
              {profile && (
                <span className="text-[11px] text-slate-600">
                  Member {profile.memberSinceMonths} month{profile.memberSinceMonths !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        {profile && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
            <div className="flex overflow-x-auto no-scrollbar">
              <StatCard
                label="30d Trades"
                value={`${profile.totalOrders30d}`}
                sub="time(s)"
              />
              <StatCard
                label="30d Completion"
                value={`${profile.completionRate30d.toFixed(1)}%`}
              />
              <StatCard
                label="Avg. Release Time"
                value={fmtSecs(profile.avgReleaseSeconds)}
              />
              <StatCard
                label="All-Time Completed"
                value={`${profile.totalCompletedAllTime}`}
              />
              <StatCard
                label="Positive Feedback"
                value={profile.avgRating ? `${profile.avgRating.toFixed(1)}` : "—"}
                sub={profile.ratingCount > 0 ? `(${profile.ratingCount})` : undefined}
              />
            </div>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                  activeTab === t ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t}
                {t === "Feedback" && profile && profile.ratingCount > 0 && (
                  <span className="ml-1.5 text-xs text-slate-500">({profile.ratingCount})</span>
                )}
                {activeTab === t && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: P2P Payment Methods ─────────────────────────────── */}
          {activeTab === "P2P Payment Methods" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-xs leading-relaxed max-w-lg">
                  Payment methods added here will be shown to buyers as options when you post a sell ad.
                  You can add up to 10 payment methods.
                </p>
                <Link href="/p2p/payment-methods">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors shrink-0 ml-4">
                    <Plus size={12} /> Add a payment method
                  </button>
                </Link>
              </div>

              {payMethods.length === 0 ? (
                <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                  <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-sm font-semibold">No payment methods yet</p>
                    <p className="text-slate-500 text-xs mt-0.5">Add at least one to post a sell ad.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {payMethods.map((m) => (
                    <div key={m.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      {/* Method header row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Type badge */}
                        <div className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          m.type === "UPI"  ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                          m.type === "IMPS" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        }`}>
                          {m.type}
                        </div>
                        <span className="text-white font-semibold text-sm flex-1 truncate">{m.displayName}</span>
                        {/* Action buttons */}
                        <button
                          onClick={() => setPeekId(peekId === m.id ? null : m.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                          title="View details"
                        >
                          {peekId === m.id ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => deleteMethod(m.id)}
                          disabled={deletingId === m.id}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          {deletingId === m.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </div>

                      {/* Expanded details */}
                      {peekId === m.id && (
                        <div className="px-4 pb-3 pt-0 border-t border-white/[0.05] space-y-2">
                          {m.type === "UPI" && m.upiId && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 text-xs uppercase tracking-wider">UPI ID</span>
                              <span className="text-white font-mono text-xs">{m.upiId}</span>
                            </div>
                          )}
                          {m.accountHolder && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 text-xs uppercase tracking-wider">Name</span>
                              <span className="text-white text-xs">{m.accountHolder}</span>
                            </div>
                          )}
                          {m.accountNumber && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 text-xs uppercase tracking-wider">Account No.</span>
                              <span className="text-white font-mono text-xs">{m.accountNumber}</span>
                            </div>
                          )}
                          {m.ifsc && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 text-xs uppercase tracking-wider">IFSC</span>
                              <span className="text-white font-mono text-xs">{m.ifsc}</span>
                            </div>
                          )}
                          {m.bankName && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 text-xs uppercase tracking-wider">Bank</span>
                              <span className="text-white text-xs">{m.bankName}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Feedback ────────────────────────────────────────── */}
          {activeTab === "Feedback" && (
            <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              {profile && profile.ratingCount > 0 ? (
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Star size={24} className="text-amber-400" />
                    <span className="text-white font-bold text-3xl">{profile.avgRating?.toFixed(1)}</span>
                  </div>
                  <p className="text-slate-400 text-sm">Based on {profile.ratingCount} review{profile.ratingCount !== 1 ? "s" : ""}</p>
                  <Link href="/p2p/orders">
                    <span className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 transition-colors">
                      View completed orders <ChevronRight size={11} />
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="text-center text-slate-600">
                  <Users size={28} className="mx-auto mb-3" />
                  <p className="text-sm">No feedback yet</p>
                  <p className="text-xs mt-1">Complete trades to receive ratings</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Quick links row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "My Ads", href: "/p2p/ads/my", icon: TrendingUp },
            { label: "All Orders", href: "/p2p/orders", icon: CheckCircle2 },
            { label: "Post New Ad", href: "/p2p/create-ad", icon: Plus },
            { label: "P2P Market", href: "/p2p", icon: ChevronRight },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer">
                <Icon size={14} className="text-emerald-400 shrink-0" />
                <span className="text-slate-300 text-sm font-medium">{label}</span>
                <ChevronRight size={12} className="text-slate-600 ml-auto" />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </Layout>
  );
}
