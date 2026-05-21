import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowUpDown,
  Plus, ChevronRight, Wallet, AlertCircle, Filter, ChevronDown,
} from "lucide-react";

type Ad = {
  id: number; userId: number; type: "BUY" | "SELL"; asset: string;
  fiatCurrency: string; price: number; quantity: number; minLimit: number;
  maxLimit: number; paymentMethods: string[]; terms: string | null;
  remainingQuantity: number; advertiserName: string; createdAt: string;
};

type FundingWallet = { tradingBalance: string | number };

const PAYMENT_METHODS = ["All", "UPI", "BANK", "IMPS", "NEFT", "Fast Pay"];

function AdRow({ ad, tab }: { ad: Ad; tab: "BUY" | "SELL" }) {
  const [, navigate] = useLocation();
  const isBuy = tab === "BUY";
  return (
    <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
          {isBuy ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm truncate">{ad.advertiserName}</div>
          <div className="text-slate-500 text-xs mt-0.5">{ad.paymentMethods.join(" · ")}</div>
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-slate-500 text-xs mb-0.5">Price</div>
          <div className={`font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
            ₹{ad.price.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-0.5">Available</div>
          <div className="text-white font-medium">{ad.remainingQuantity.toFixed(2)} USDT</div>
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-0.5">Limits</div>
          <div className="text-slate-300">₹{ad.minLimit.toLocaleString()} – ₹{ad.maxLimit.toLocaleString()}</div>
        </div>
      </div>

      <button
        onClick={() => navigate(`/p2p/order/${ad.id}`)}
        className={`px-5 py-2 rounded-xl text-sm font-bold shrink-0 transition-all ${
          isBuy
            ? "bg-emerald-500 hover:bg-emerald-400 text-white"
            : "bg-red-500 hover:bg-red-400 text-white"
        }`}
      >
        {isBuy ? "Buy" : "Sell"}
      </button>
    </div>
  );
}

export default function P2PMarketPage() {
  const [tab, setTab] = useState<"BUY" | "SELL">("BUY");
  const [ads, setAds] = useState<Ad[]>([]);
  const [wallet, setWallet] = useState<FundingWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pm = paymentFilter !== "All" ? `&paymentMethod=${encodeURIComponent(paymentFilter)}` : "";
      const [adsData, walletData] = await Promise.all([
        authFetch<Ad[]>(`/api/p2p/ads?type=${tab}${pm}`),
        authFetch<FundingWallet>("/api/wallet"),
      ]);
      setAds(adsData);
      setWallet(walletData);
    } catch {
      toast({ title: "Failed to load P2P data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, paymentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowUpDown size={20} className="text-emerald-400" />
              P2P Trading
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Peer-to-peer USDT marketplace</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 glass-card rounded-xl text-slate-400 hover:text-white">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <Link href="/p2p/ads/my">
              <button className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-slate-300 hover:text-white text-xs font-medium transition-colors">
                My Ads <ChevronRight size={13} />
              </button>
            </Link>
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition-all">
                <Plus size={13} /> Post Ad
              </button>
            </Link>
          </div>
        </div>

        {/* Funding Wallet */}
        {wallet && (
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Wallet size={14} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-500">Funding Wallet</div>
              <div className="text-white font-bold text-sm">
                {parseFloat(String(wallet.tradingBalance)).toFixed(4)} USDT
              </div>
            </div>
            <Link href="/p2p/orders">
              <button className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1">
                My Orders <ChevronRight size={12} />
              </button>
            </Link>
          </div>
        )}

        {/* Main card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* BUY / SELL tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(["BUY", "SELL"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  tab === t
                    ? t === "BUY" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-red-400 border-b-2 border-red-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t} USDT
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-2">
            <Filter size={13} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 shrink-0">Pay via:</span>
            <div className="flex gap-1.5 flex-wrap">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} onClick={() => setPaymentFilter(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    paymentFilter === m
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-500 hover:text-slate-300 border border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Table header desktop */}
          <div className="hidden sm:grid grid-cols-5 px-4 py-2 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
            <div>Advertiser</div><div>Price</div><div>Available</div><div>Limits</div><div></div>
          </div>

          <div className="p-3 space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 h-16 animate-pulse" />
              ))
            ) : ads.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <AlertCircle size={32} className="text-slate-600" />
                <p className="text-slate-500 text-sm">
                  {paymentFilter !== "All" ? `No active ${tab} ads accepting ${paymentFilter}` : "No active ads right now"}
                </p>
                {paymentFilter !== "All" ? (
                  <button onClick={() => setPaymentFilter("All")} className="text-emerald-400 text-xs hover:underline">
                    Clear filter
                  </button>
                ) : (
                  <Link href="/p2p/create-ad">
                    <button className="text-emerald-400 text-xs hover:underline">Be the first to post an ad →</button>
                  </Link>
                )}
              </div>
            ) : (
              ads.map((ad) => <AdRow key={ad.id} ad={ad} tab={tab} />)
            )}
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-start gap-2 text-xs text-slate-500 glass-card rounded-xl p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>P2P trades are peer-to-peer. Qorix Markets holds USDT in escrow and releases upon confirmed payment. Never pay outside the platform.</span>
        </div>
      </div>
    </Layout>
  );
}
