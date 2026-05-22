import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowUpDown,
  Plus, ChevronRight, Wallet, AlertCircle, Filter, Clock, ThumbsUp,
  ShieldCheck, ClipboardList, ChevronDown, MessageCircle, UserCircle2,
  MoreHorizontal, CreditCard, LayoutList, HelpCircle,
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

type ProcessingOrder = {
  id: number; status: string; type: "BUY" | "SELL";
  fiatAmount: number; cryptoAmount: number; fiatCurrency: string;
  counterpartyName: string; createdAt: string;
};

const PAYMENT_METHODS = ["All", "UPI", "BANK", "IMPS", "NEFT", "Fast Pay"];

function AdRow({ ad, tab }: { ad: Ad; tab: "BUY" | "SELL" }) {
  const [, navigate] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const isBuy = tab === "BUY";
  const dest = tab === "BUY" ? `/p2p/order/${ad.id}` : `/p2p/sell/${ad.id}`;
  const openProfile = (e: React.MouseEvent) => { e.stopPropagation(); setProfileOpen(true); };

  return (
    <>
      {/* ── Desktop table row ────────────────────────────────────────── */}
      <div
        className="hidden md:grid items-center gap-0 border-b border-white/[0.05] hover:bg-white/[0.02] cursor-pointer transition-colors"
        style={{ gridTemplateColumns: "2.2fr 1fr 1.4fr 1.2fr auto" }}
        onClick={() => navigate(dest)}
      >
        {/* Advertiser */}
        <div className="px-4 py-3.5 flex items-center gap-3" onClick={openProfile}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
            {ad.advertiserName[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm">{ad.advertiserName}</span>
              {ad.isVerifiedMerchant && <ShieldCheck size={12} className="text-emerald-400" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
              <span>{ad.tradesCount} orders</span>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-emerald-500"><ThumbsUp size={9} />{ad.completionRate}%</span>
              <span>·</span>
              <span className="flex items-center gap-0.5"><Clock size={9} />{ad.timeLimit}m</span>
            </div>
          </div>
        </div>
        {/* Price */}
        <div className="px-4 py-3.5">
          <span className={`text-base font-bold tabular-nums ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
            ₹ {ad.price.toLocaleString("en-IN")}
          </span>
        </div>
        {/* Available / Limit */}
        <div className="px-4 py-3.5">
          <div className="text-slate-300 text-sm tabular-nums">{ad.remainingQuantity.toFixed(2)} USDT</div>
          <div className="text-slate-500 text-xs mt-0.5">₹{ad.minLimit.toLocaleString()} – ₹{ad.maxLimit.toLocaleString()}</div>
        </div>
        {/* Payment — Binance-style small badges with colored dot */}
        <div className="px-4 py-3.5 flex flex-wrap gap-1.5">
          {ad.paymentMethods.map((m) => {
            const dot = m === "UPI" ? "bg-slate-400" : m === "IMPS" ? "bg-orange-400" : m === "BANK" || m === "NEFT" ? "bg-amber-400" : "bg-emerald-400";
            return (
              <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 text-[11px] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                {m}
              </span>
            );
          })}
        </div>
        {/* Trade button */}
        <div className="px-4 py-3.5">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(dest); }}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 min-w-[80px] ${
              isBuy ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20" : "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
            }`}
          >
            {isBuy ? "Buy USDT" : "Sell USDT"}
          </button>
        </div>
      </div>

      {/* ── Mobile card ──────────────────────────────────────────────── */}
      <div
        className="md:hidden px-4 py-4 border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => navigate(dest)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5" onClick={openProfile}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {ad.advertiserName[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold text-sm">{ad.advertiserName}</span>
                {ad.isVerifiedMerchant && <ShieldCheck size={12} className="text-emerald-400" />}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1.5">
                <span>{ad.tradesCount} orders</span><span>·</span>
                <span className="text-emerald-500 flex items-center gap-0.5"><ThumbsUp size={9} />{ad.completionRate}%</span>
              </div>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(dest); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold shrink-0 transition-all active:scale-95 ${
              isBuy ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg" : "bg-red-500 text-white shadow-red-500/20 shadow-lg"
            }`}
          >
            {isBuy ? "Buy" : "Sell"}
          </button>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <span className={`text-xl font-bold tabular-nums ${isBuy ? "text-emerald-400" : "text-red-400"}`}>₹{ad.price.toLocaleString("en-IN")}</span>
            <div className="text-slate-500 text-xs mt-1">
              Limit&nbsp;<span className="text-slate-300">₹{ad.minLimit.toLocaleString()}–₹{ad.maxLimit.toLocaleString()}</span>
              &nbsp;·&nbsp;<span className="text-slate-300">{ad.remainingQuantity.toFixed(2)} USDT</span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {ad.paymentMethods.map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-slate-400">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {profileOpen && <MerchantProfileModal userId={ad.userId} onClose={() => setProfileOpen(false)} />}
    </>
  );
}

export default function P2PMarketPage() {
  const [tab, setTab] = useState<"BUY" | "SELL">("BUY");
  const [ads, setAds] = useState<Ad[]>([]);
  const [wallet, setWallet] = useState<FundingWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [processingOrders, setProcessingOrders] = useState<ProcessingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const ordersRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setFetchError(false);
    try {
      const pm = paymentFilter !== "All" ? `&paymentMethod=${encodeURIComponent(paymentFilter)}` : "";
      const [adsData, walletData] = await Promise.all([
        authFetch<Ad[]>(`/api/p2p/ads?type=${tab === "BUY" ? "SELL" : "BUY"}${pm}`),
        authFetch<FundingWallet>("/api/wallet"),
      ]);
      setAds(adsData);
      setWallet(walletData);
    } catch (err: any) {
      console.error("P2P market load error:", err?.message || err);
      setAds([]);
      setFetchError(true);
      toast({ title: "Could not load ads", description: "Tap refresh to try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, paymentFilter]);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch processing orders when dropdown opens
  const openOrders = async () => {
    setOrdersOpen((v) => {
      if (!v) {
        setOrdersLoading(true);
        authFetch<ProcessingOrder[]>("/api/p2p/orders/my?status=pending,paid&limit=5")
          .then((data) => setProcessingOrders(data))
          .catch(() => setProcessingOrders([]))
          .finally(() => setOrdersLoading(false));
      }
      return !v;
    });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ordersRef.current && !ordersRef.current.contains(e.target as Node)) setOrdersOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        {/* Row 1: Balance + primary actions */}
        <div className="flex items-center justify-between gap-2">
          {wallet ? (
            <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
              <div className="w-5 h-5 bg-emerald-500/15 rounded-lg flex items-center justify-center shrink-0">
                <Wallet size={11} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider leading-none mb-0.5">Balance</div>
                <div className="text-white font-bold text-xs tabular-nums">{parseFloat(String(wallet.tradingBalance)).toFixed(2)} USDT</div>
              </div>
            </div>
          ) : (
            <div className="h-9 w-28 glass-card rounded-xl animate-pulse" />
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => fetchData(true)} className="p-2 glass-card rounded-xl text-slate-400 active:bg-white/10 transition-colors" aria-label="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-black text-xs font-bold transition-colors active:scale-95">
                <Plus size={13} /> Post Ad
              </button>
            </Link>
          </div>
        </div>

        {/* Row 2: Secondary nav */}
        <div className="flex items-center gap-2">
          {/* Scrollable section: Chat, User Center */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
            <Link href="/p2p/chat">
              <button className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-slate-300 hover:text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0">
                <MessageCircle size={13} /> Chat
              </button>
            </Link>
            <Link href="/p2p/user-center">
              <button className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-slate-300 hover:text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0">
                <UserCircle2 size={13} /> User Center
              </button>
            </Link>
          </div>

          {/* Fixed right: Orders + More — outside overflow container so dropdowns aren't clipped */}
          <div className="flex items-center gap-2 shrink-0">

          {/* Orders dropdown */}
          <div className="relative" ref={ordersRef}>
            <button
              onClick={openOrders}
              className={`flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${ordersOpen ? "text-amber-400" : "text-slate-300 hover:text-white"}`}
            >
              <ClipboardList size={13} />
              Orders
              <ChevronDown size={11} className={`transition-transform ${ordersOpen ? "rotate-180" : ""}`} />
            </button>

            {ordersOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-white/[0.1] bg-[#0d1117] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-white font-semibold text-sm">Processing</span>
                  <Link href="/p2p/orders" onClick={() => setOrdersOpen(false)}>
                    <span className="text-amber-400 text-xs font-semibold flex items-center gap-0.5 hover:text-amber-300 transition-colors">
                      View All <ChevronRight size={11} />
                    </span>
                  </Link>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {ordersLoading ? (
                    <div className="flex flex-col gap-2 p-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
                      ))}
                    </div>
                  ) : processingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-600">
                      <ClipboardList size={28} />
                      <p className="text-xs">No active orders</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {processingOrders.map((o) => (
                        <Link key={o.id} href={`/p2p/orders/${o.id}`} onClick={() => setOrdersOpen(false)}>
                          <div className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold ${o.type === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                {o.type === "BUY" ? "B" : "S"}
                              </div>
                              <div>
                                <div className="text-white text-sm font-semibold">Order #{o.id}</div>
                                <div className="text-slate-500 text-[11px]">{o.counterpartyName}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white text-sm font-semibold">₹{o.fiatAmount.toLocaleString("en-IN")}</div>
                              <div className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${
                                o.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                                o.status === "paid" ? "bg-blue-500/15 text-blue-400" :
                                "bg-slate-500/15 text-slate-400"
                              }`}>{o.status}</div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* More dropdown */}
          <div className="relative shrink-0" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                moreOpen ? "text-white bg-white/[0.06]" : "text-slate-300 hover:text-white"
              }`}
            >
              <MoreHorizontal size={13} /> More
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 z-50 rounded-2xl border border-white/[0.08] bg-[#0d1117] shadow-2xl overflow-hidden">
                <div className="py-1">
                  {[
                    { label: "Payment Methods", href: "/p2p/payment-methods", icon: CreditCard,   desc: "Manage your pay options" },
                    { label: "My Ads",           href: "/p2p/ads/my",          icon: LayoutList,   desc: "View & manage your ads"  },
                    { label: "Post New Ad",      href: "/p2p/create-ad",       icon: Plus,         desc: "Create a buy/sell ad"    },
                    { label: "User Center",      href: "/p2p/user-center",     icon: UserCircle2,  desc: "Profile & stats"          },
                    { label: "P2P Help",         href: "/faq",                 icon: HelpCircle,   desc: "How P2P trading works"    },
                  ].map(({ label, href, icon: Icon, desc }) => (
                    <Link key={href} href={href} onClick={() => setMoreOpen(false)}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                          <Icon size={14} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white text-xs font-semibold">{label}</div>
                          <div className="text-slate-600 text-[10px] leading-tight">{desc}</div>
                        </div>
                        <ChevronRight size={11} className="text-slate-700 ml-auto shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>{/* end fixed-right */}
        </div>

        {/* Main card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* BUY / SELL tabs */}
          <div className="flex">
            {(["BUY", "SELL"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative flex-1 py-3 text-sm font-bold transition-all ${
                  tab === t
                    ? t === "BUY" ? "text-emerald-400" : "text-red-400"
                    : "text-slate-500"
                }`}
              >
                <div>{t} USDT</div>
                <div className={`text-[10px] font-normal mt-0.5 ${tab === t ? "opacity-80" : "opacity-40"}`}>
                  {t === "BUY" ? "Find sellers" : "Find buyers"}
                </div>
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

          {/* Desktop table header */}
          <div
            className="hidden md:grid border-b border-white/[0.06] bg-white/[0.01]"
            style={{ gridTemplateColumns: "2.2fr 1fr 1.4fr 1.2fr auto" }}
          >
            {["Advertisers", "Price", "Available/Order Limit", "Payment", "Trade"].map((h) => (
              <div key={h} className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</div>
            ))}
          </div>

          <div className="md:p-0 p-3 md:space-y-0 space-y-2.5">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 h-24 animate-pulse md:rounded-none md:h-16" />
              ))
            ) : fetchError ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">Could not load ads</p>
                  <p className="text-slate-500 text-xs mt-0.5">Server error — tap refresh to retry</p>
                </div>
                <button onClick={() => fetchData(true)} className="text-emerald-400 text-xs px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">Refresh</button>
              </div>
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
