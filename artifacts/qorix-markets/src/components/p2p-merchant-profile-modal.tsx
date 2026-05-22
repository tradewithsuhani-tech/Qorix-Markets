import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import {
  X, ShieldCheck, Star, Clock, TrendingUp, Award, Calendar,
} from "lucide-react";

type MerchantProfile = {
  userId: number;
  displayName: string;
  memberSinceMonths: number;
  kycVerified: boolean;
  isVerifiedMerchant: boolean;
  totalCompletedAllTime: number;
  totalOrders30d: number;
  completedOrders30d: number;
  completionRate30d: number;
  totalVolumeUsdt30d: number;
  avgReleaseSeconds: number | null;
  avgRating: number | null;
  ratingCount: number;
};

// Formats avg release time as "8 min" / "45 sec" / "—" — Binance-style
// short label that fits in the trust card pill.
function formatReleaseTime(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

function formatMemberSince(months: number): string {
  if (months < 1) return "New user";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years}y` : `${years}y ${rem}mo`;
}

export function MerchantProfileModal({
  userId, onClose,
}: {
  userId: number;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/p2p/users/${userId}/profile`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Failed")))
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError("Could not load profile"); });
    return () => { cancelled = true; };
  }, [userId]);

  // Close on Escape — matches the rest of the app's modal pattern.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Merchant Profile</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm py-6 text-center">{error}</div>
        )}

        {!error && !profile && (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-white/[0.04] rounded-xl" />
            <div className="h-24 bg-white/[0.04] rounded-xl" />
            <div className="h-32 bg-white/[0.04] rounded-xl" />
          </div>
        )}

        {profile && (
          <>
            {/* Identity row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-electric-blue/30 to-blue-500/20 flex items-center justify-center font-bold text-white text-lg">
                {profile.displayName[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-base truncate">{profile.displayName}</span>
                  {profile.isVerifiedMerchant && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      <ShieldCheck size={10} /> VERIFIED
                    </span>
                  )}
                  {!profile.isVerifiedMerchant && profile.kycVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                      <ShieldCheck size={10} /> KYC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                  <Calendar size={10} />
                  <span>Member · {formatMemberSince(profile.memberSinceMonths)}</span>
                </div>
              </div>
            </div>

            {/* Headline stats — 2x2 grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatTile
                icon={<TrendingUp size={14} className="text-emerald-400" />}
                label="Completion (30d)"
                value={`${profile.completionRate30d}%`}
                sub={`${profile.completedOrders30d}/${profile.totalOrders30d} orders`}
              />
              <StatTile
                icon={<Clock size={14} className="text-blue-400" />}
                label="Avg release"
                value={formatReleaseTime(profile.avgReleaseSeconds)}
                sub="seller confirm"
              />
              <StatTile
                icon={<Award size={14} className="text-amber-400" />}
                label="All-time trades"
                value={profile.totalCompletedAllTime.toLocaleString()}
                sub="completed"
              />
              <StatTile
                icon={<Star size={14} className="text-yellow-400" />}
                label="Rating"
                value={profile.avgRating !== null ? profile.avgRating.toFixed(1) : "—"}
                sub={`${profile.ratingCount} reviews`}
              />
            </div>

            {/* 30d volume */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 mb-4">
              <div className="text-slate-500 text-[11px] mb-1">30-day volume</div>
              <div className="text-white font-bold text-lg">
                {profile.totalVolumeUsdt30d.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                <span className="text-slate-400 text-sm font-medium">USDT</span>
              </div>
            </div>

            {/* Trust criteria hint — only show when NOT verified, so new users
                understand what unlocks the badge. Mirrors Binance UX. */}
            {!profile.isVerifiedMerchant && (
              <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-3 text-[11px] text-slate-400 leading-relaxed">
                <div className="text-blue-300 font-semibold mb-1 text-xs">Verified badge requires</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>KYC approved</li>
                  <li>30+ completed trades</li>
                  <li>≥ 90% completion rate (30d)</li>
                  <li>Avg release time ≤ 10 min</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-1 uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-white font-bold text-base leading-tight">{value}</div>
      <div className="text-slate-500 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}
