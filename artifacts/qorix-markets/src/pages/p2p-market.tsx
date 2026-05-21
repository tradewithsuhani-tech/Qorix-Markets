import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowUpDown,
  Plus, ChevronRight, Wallet, AlertCircle, Filter,
} from "lucide-react";

type Ad = {
  id: number; userId: number; type: "BUY" | "SELL"; asset: string;
  fiatCurrency: string; price: number; quantity: number; minLimit: number;
  maxLimit: number; paymentMethods: string[]; terms: string | null;
  remainingQuantity: number; advertiserName: string; createdAt: string;
};

type P2pWallet = { availableBalance: number; frozenBalance: number; escrowBalance: number };

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
  const [wallet, setWallet] = useState<P2pWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adsData, walletData] = await Promise.all([
        authFetch<Ad[]>(`/api/p2p/ads?type=${tab}`),
        authFetch<P2pWallet>("/api/p2p/wallet"),
      ]);
      setAds(adsData);
      setWallet(walletData);
    } catch {
      toast({ title: "Failed to load P2P data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab]);

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
            <p className="text-slate-400 text-sm mt-0.5">Buy & sell USDT directly with other users</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all">
                <Plus size={15} /> Post Ad
              </button>
            </Link>
            <button onClick={fetchData} className="p-2 rounded-xl glass-card text-slate-400 hover:text-white">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* P2P Wallet Bar */}
        {wallet && (
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-5">
            <Wallet size={16} className="text-emerald-400 shrink-0" />
            <div className="flex flex-wrap gap-6 text-sm flex-1">
              <div><span className="text-slate-500">Available</span> <span className="text-white font-bold ml-2">{wallet.availableBalance.toFixed(4)} USDT</span></div>
              <div><span className="text-slate-500">Frozen</span> <span className="text-amber-300 font-bold ml-2">{wallet.frozenBalance.toFixed(4)} USDT</span></div>
              <div><span className="text-slate-500">In Escrow</span> <span className="text-blue-300 font-bold ml-2">{wallet.escrowBalance.toFixed(4)} USDT</span></div>
            </div>
            <Link href="/p2p/payment-methods" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
              Manage <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* Quick links */}
        <div className="flex gap-2">
          <Link href="/p2p/orders">
            <button className="glass-card px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors">
              My Orders
            </button>
          </Link>
          <Link href="/p2p/ads/my">
            <button className="glass-card px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors">
              My Ads
            </button>
          </Link>
          <Link href="/p2p/payment-methods">
            <button className="glass-card px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors">
              Payment Methods
            </button>
          </Link>
        </div>

        {/* Buy/Sell Tabs */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex border-b border-white/[0.06]">
            {(["BUY", "SELL"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  tab === t
                    ? t === "BUY"
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-red-400 border-b-2 border-red-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t} USDT
              </button>
            ))}
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-5 px-4 py-2 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
            <div>Advertiser</div>
            <div>Price</div>
            <div>Available</div>
            <div>Limits</div>
            <div></div>
          </div>

          <div className="p-3 space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 h-16 animate-pulse" />
              ))
            ) : ads.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <AlertCircle size={32} className="text-slate-600" />
                <p className="text-slate-500 text-sm">No active ads right now</p>
                <Link href="/p2p/create-ad">
                  <button className="text-emerald-400 text-xs hover:underline">Be the first to post an ad →</button>
                </Link>
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
