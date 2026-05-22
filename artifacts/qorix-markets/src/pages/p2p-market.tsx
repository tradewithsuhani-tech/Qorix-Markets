import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowUpDown,
  Plus, ChevronRight, Wallet, AlertCircle, Filter, Clock, ThumbsUp,
  ShieldCheck,
} from "lucide-react";
import { MerchantProfileModal } from "@/components/p2p-merchant-profile-modal";

type Ad = {
  id: number; userId: number; type: "BUY" | "SELL"; asset: string;
  fiatCurrency: string; price: number; quantity: number; minLimit: number;
  maxLimit: number; paymentMethods: string[]; terms: string | null;
  timeLimit: number; remainingQuantity: number; advertiserName: string;
  tradesCount: number; completionRate: number; createdAt: string;
  isVerifiedMerchant?: boolean; kycVerified?: boolean;
  avgReleaseSeconds?: number | null; avgRating?: number | null; ratingCount?: number;
};

type FundingWallet = { tradingBalance: string | number };

const PAYMENT_METHODS = ["All", "UPI", "BANK", "IMPS", "NEFT", "Fast Pay"];

function AdRow({ ad, tab }: { ad: Ad; tab: "BUY" | "SELL" }) {
  const [, navigate] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const isBuy = tab === "BUY";
  // Clicking the advertiser identity opens the trust profile instead of
  // navigating into the order flow. Matches Binance P2P UX.
  const openProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileOpen(true);
  };
  return (
    <>
    <div
      className="glass-card rounded-xl p-4 active:scale-[0.99] transition-transform cursor-pointer border border-white/[0.06] hover:border-white/[0.1]"
      onClick={() => navigate(tab === "BUY" ? `/p2p/order/${ad.id}` : `/p2p/sell/${ad.id}`)}
    >
      {/* Top row: advertiser + time limit */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0" onClick={openProfile}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${isBuy ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-red-500/15 text-red-400 border-red-500/20"}`}>
            {ad.advertiserName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm truncate">{ad.advertiserName}</span>
              {ad.isVerifiedMerchant && (
                <ShieldCheck size={12} className="text-emerald-400 shrink-0" aria-label="Verified Merchant" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-slate-500 text-[11px]">{ad.tradesCount} trades</span>
              <span className="text-slate-700">·</span>
              <span className="text-emerald-500 text-[11px] flex items-center gap-0.5">
                <ThumbsUp size={9} />{ad.completionRate}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-500 text-[11px]">
          <Clock size={11} />
          <span>{ad.timeLimit}m</span>
          {ad.terms && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-medium ml-0.5">T&amp;C</span>
          )}
        </div>
      </div>

      {/* Price + CTA row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-extrabold tabular-nums ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
              ₹{ad.price.toLocaleString("en-IN")}
            </span>
            <span className="text-slate-500 text-xs">/USDT</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
            <span>Limit <span className="text-slate-300">₹{ad.minLimit.toLocaleString()}–₹{ad.maxLimit.toLocaleString()}</span></span>
            <span>Avail <span className="text-slate-300">{ad.remainingQuantity.toFixed(2)} USDT</span></span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {ad.paymentMethods.map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.07] font-medium">{m}</span>
            ))}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(tab === "BUY" ? `/p2p/order/${ad.id}` : `/p2p/sell/${ad.id}`); }}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all active:scale-95 min-w-[72px] ${
            isBuy ? "bg-emerald-500 active:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25" : "bg-red-500 active:bg-red-400 text-white shadow-lg shadow-red-500/20"
          }`}
        >
          {isBuy ? "Buy" : "Sell"}
        </button>
      </div>
    </div>
    {profileOpen && (
      <MerchantProfileModal userId={ad.userId} onClose={() => setProfileOpen(false)} />
    )}
    </>
  );
}

export default function P2PMarketPage() {
  const [tab, setTab] = useState<"BUY" | "SELL">("BUY");
  const [ads, setAds] = useState<Ad[]>([]);
  const [wallet, setWallet] = useState<FundingWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pm = paymentFilter !== "All" ? `&paymentMethod=${encodeURIComponent(paymentFilter)}` : "";
      const [adsData, walletData] = await Promise.all([
        authFetch<Ad[]>(`/api/p2p/ads?type=${tab === "BUY" ? "SELL" : "BUY"}${pm}`),
        authFetch<FundingWallet>("/api/wallet"),
      ]);
      setAds(adsData);
      setWallet(walletData);
    } catch (err: any) {
      // Silently show empty state instead of a scary toast — the UI already
      // renders "No active ads right now" when the array is empty. A red
      // error banner on every refresh feels broken even when the server is
      // just warming up or there genuinely are zero ads.
      console.error("P2P market load error:", err?.message || err);
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [tab, paymentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header — compact on mobile, title shown in top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {wallet && (
              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                <div className="w-5 h-5 bg-emerald-500/15 rounded-lg flex items-center justify-center shrink-0">
                  <Wallet size={11} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider leading-none mb-0.5">Balance</div>
                  <div className="text-white font-bold text-xs tabular-nums">{parseFloat(String(wallet.tradingBalance)).toFixed(2)} USDT</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 glass-card rounded-xl text-slate-400 active:bg-white/10 transition-colors" aria-label="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <Link href="/p2p/orders">
              <button className="flex items-center gap-1 px-3 py-2 glass-card rounded-xl text-slate-300 text-xs font-medium">
                Orders <ChevronRight size={12} />
              </button>
            </Link>
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-black text-xs font-bold transition-colors">
                <Plus size={13} /> Post Ad
              </button>
            </Link>
          </div>
        </div>

        {/* Main card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* BUY / SELL tabs */}
          <div className="flex">
            {(["BUY", "SELL"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative flex-1 py-3.5 text-sm font-bold transition-all ${
                  tab === t
                    ? t === "BUY" ? "text-emerald-400" : "text-red-400"
                    : "text-slate-500"
                }`}
              >
                {t} USDT
                {tab === t && (
                  <span className={`absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full ${t === "BUY" ? "bg-emerald-400" : "bg-red-400"}`} />
                )}
              </button>
            ))}
          </div>
          <div className="h-px bg-white/[0.06]" />

          {/* Filter row */}
          <div className="px-3 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Filter size={12} className="text-slate-500 shrink-0" />
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} onClick={() => setPaymentFilter(m)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    paymentFilter === m
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-500 border border-white/[0.06]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-white/[0.04]" />

          <div className="p-3 space-y-2.5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 h-32 animate-pulse" />
              ))
            ) : ads.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <AlertCircle size={24} className="text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">No ads available</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {paymentFilter !== "All" ? `No ${tab} ads accepting ${paymentFilter}` : "No active ads right now"}
                  </p>
                </div>
                {paymentFilter !== "All"
                  ? <button onClick={() => setPaymentFilter("All")} className="text-emerald-400 text-xs px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">Clear filter</button>
                  : <Link href="/p2p/create-ad"><button className="text-emerald-400 text-xs px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">Be the first to post →</button></Link>
                }
              </div>
            ) : (
              ads.map((ad) => <AdRow key={ad.id} ad={ad} tab={tab} />)
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-slate-500 glass-card rounded-xl p-3.5">
          <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-500/60" />
          <span>P2P trades are secured by escrow. USDT is held until you confirm receipt of payment. Never pay outside the platform.</span>
        </div>
      </div>
    </Layout>
  );
}
