import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle, Loader2, BadgeCheck, ChevronRight, ShieldCheck, Clock } from "lucide-react";

type SellerMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null; ifsc: string | null;
};

type AdDetail = {
  id: number; userId: number; type: "BUY" | "SELL"; price: number;
  quantity: number; remainingQuantity: number;
  minLimit: number; maxLimit: number; timeLimit: number;
  paymentMethods: string[]; sellerPaymentMethods: SellerMethod[];
  terms: string | null; status: string; advertiserName: string;
  tradesCount: number; completionRate: number; isVerifiedMerchant: boolean;
};

const METHOD_COLORS: Record<string, string> = {
  UPI: "from-purple-500 to-purple-600",
  BANK: "from-blue-500 to-blue-600",
  IMPS: "from-orange-500 to-orange-600",
  NEFT: "from-cyan-500 to-cyan-600",
  default: "from-emerald-500 to-emerald-600",
};

export default function P2PPlaceOrderPage() {
  const [, params] = useRoute<{ id: string }>("/p2p/order/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const adId = parseInt(params?.id ?? "0");

  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adId) return;
    authFetch<AdDetail>(`/api/p2p/ads/${adId}`)
      .then((data) => {
        setAd(data);
        if (data.sellerPaymentMethods.length > 0) {
          setSelectedMethodId(data.sellerPaymentMethods[0]!.id);
        }
      })
      .catch(() => toast({ title: "Failed to load ad details", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [adId]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Loader2 size={24} className="text-emerald-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Loading trade details…</p>
        </div>
      </Layout>
    );
  }

  if (!ad || ad.status !== "active") {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <p className="text-slate-300 text-sm font-medium">Ad not found or no longer active</p>
          <button onClick={() => navigate("/p2p")} className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors">← Back to marketplace</button>
        </div>
      </Layout>
    );
  }

  const isBuying = ad.type === "SELL";
  const fiatNum = parseFloat(fiatAmount) || 0;
  const usdtCalc = fiatNum > 0 ? fiatNum / ad.price : 0;
  const maxFiat = Math.min(ad.maxLimit, Math.floor(ad.remainingQuantity * ad.price));
  const isValidAmount = fiatNum >= ad.minLimit && fiatNum <= maxFiat && usdtCalc <= ad.remainingQuantity;
  const selectedMethod = ad.sellerPaymentMethods.find((m) => m.id === selectedMethodId);

  const amountError = fiatNum > 0 && !isValidAmount
    ? fiatNum < ad.minLimit ? `Min ₹${ad.minLimit.toLocaleString("en-IN")}`
      : fiatNum > maxFiat ? `Max ₹${maxFiat.toLocaleString("en-IN")}`
        : `Only ${ad.remainingQuantity.toFixed(2)} USDT left`
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAmount) return;
    setSubmitting(true);
    try {
      const res = await authFetch<{ success: boolean; order: { id: number } }>("/api/p2p/orders", {
        method: "POST",
        body: JSON.stringify({
          adId: ad!.id,
          fiatAmount: fiatNum,
          paymentMethod: selectedMethod ? String(selectedMethod.id) : undefined,
        }),
      });
      toast({ title: `Order placed! Pay within ${ad!.timeLimit} minutes.` });
      navigate(`/p2p/orders/${res.order.id}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to place order", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const accentColor = isBuying ? "emerald" : "red";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto flex flex-col" style={{ minHeight: "calc(100dvh - 4rem)" }}>

        {/* ── Header ─────────────────────────────────── */}
        <div className="relative flex items-center justify-center px-4 py-5">
          <button onClick={() => navigate("/p2p")}
            className="absolute left-4 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors">
            <ArrowLeft size={17} />
          </button>
          <div className="text-center">
            <h1 className={`text-lg font-bold ${isBuying ? "text-emerald-400" : "text-red-400"}`}>
              {isBuying ? "Buy USDT" : "Sell USDT"}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 flex items-center justify-center gap-1">
              Price&nbsp;
              <span className="text-white font-semibold">₹{ad.price.toLocaleString("en-IN")}</span>
              <span className="text-slate-600">/ USDT</span>
            </p>
          </div>
        </div>

        {/* Desktop 2-column wrapper */}
        <div className="md:grid md:gap-5 md:items-start md:px-4 md:pb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* Left col: Advertiser info + terms */}
        <div className="hidden md:block glass-card rounded-2xl p-5 space-y-4">
          {/* Advertiser */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base ${isBuying ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                {ad.advertiserName[0]?.toUpperCase()}
              </div>
              {ad.isVerifiedMerchant && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <BadgeCheck size={10} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wide">{ad.advertiserName.toUpperCase()}</span>
                {ad.isVerifiedMerchant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">VERIFIED</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{ad.tradesCount} trades</span>
                <span>·</span>
                <span className={ad.completionRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{ad.completionRate}% completion</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-slate-400">{ad.timeLimit} min to pay</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-400">Escrow protected</span>
            </div>
          </div>

          {/* Advertiser's Terms */}
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Advertiser's Terms</p>
            {ad.terms ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-slate-400 text-xs leading-relaxed">{ad.terms}</p>
              </div>
            ) : (
              <p className="text-slate-600 text-xs italic">No special terms.</p>
            )}
          </div>

          {/* Limit info */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Available</span>
              <span className="text-white font-semibold">{ad.remainingQuantity.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Order Limit</span>
              <span className="text-white font-semibold">₹{ad.minLimit.toLocaleString()} – ₹{ad.maxLimit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Price</span>
              <span className={`font-bold ${isBuying ? "text-emerald-400" : "text-red-400"}`}>₹{ad.price.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Right col (or full-width on mobile): Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-3 px-4 md:px-0 pb-6 md:pb-0">

          {/* ── Amount Card ─────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1117]">
            {/* Subtle top gradient accent */}
            <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${isBuying ? "from-emerald-500/0 via-emerald-400 to-emerald-500/0" : "from-red-500/0 via-red-400 to-red-500/0"}`} />

            <div className="p-5 space-y-4">
              {/* Label */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">Pay with</p>
                  <p className="text-white font-semibold text-sm mt-0.5">Indian Rupee (INR)</p>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isBuying ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {isBuying ? "BUY" : "SELL"}
                </div>
              </div>

              {/* Big amount input */}
              <div className="flex items-center gap-3">
                <span className="text-slate-600 text-3xl font-light shrink-0">₹</span>
                <input
                  type="number" min={ad.minLimit} max={maxFiat} step="1"
                  placeholder="0"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className="flex-1 bg-transparent text-white text-4xl font-light outline-none placeholder:text-slate-700 w-0 tabular-nums"
                />
                <button type="button" onClick={() => setFiatAmount(String(maxFiat))}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isBuying ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20"}`}>
                  MAX
                </button>
              </div>

              {/* Limit row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Limit&nbsp;&nbsp;₹{ad.minLimit.toLocaleString("en-IN")} – ₹{maxFiat.toLocaleString("en-IN")}
                </span>
                {fiatNum > 0 && <span className="text-slate-600">{usdtCalc.toFixed(4)} USDT</span>}
              </div>

              {/* Error */}
              {amountError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={12} className="shrink-0" /> {amountError}
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-white/[0.06]" />

              {/* You Receive */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">You Receive</span>
                <div className="text-right">
                  <span className={`text-xl font-bold tabular-nums ${fiatNum > 0 && isValidAmount ? (isBuying ? "text-emerald-400" : "text-red-400") : "text-slate-600"}`}>
                    {usdtCalc > 0 ? usdtCalc.toFixed(4) : "0.0000"}
                  </span>
                  <span className="text-slate-500 text-sm ml-1.5">USDT</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick amounts ───────────────────────── */}
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((pct) => {
              const val = Math.round((maxFiat - ad.minLimit) * pct / 100 + ad.minLimit);
              return (
                <button key={pct} type="button" onClick={() => setFiatAmount(String(val))}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] hover:text-white transition-all">
                  {pct}%
                </button>
              );
            })}
          </div>

          {/* ── Payment Method ──────────────────────── */}
          {ad.sellerPaymentMethods.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Payment Method</p>
              </div>
              {ad.sellerPaymentMethods.map((m, i) => {
                const grad = METHOD_COLORS[m.type.toUpperCase()] ?? METHOD_COLORS.default;
                const isSelected = selectedMethodId === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setSelectedMethodId(m.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all ${i > 0 ? "border-t border-white/[0.05]" : ""} ${isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                    <div className={`w-1 h-9 rounded-full bg-gradient-to-b ${isSelected ? grad : "bg-white/10"} transition-all`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{m.displayName || m.type}</p>
                      {m.upiId && <p className="text-slate-500 text-xs mt-0.5">{m.upiId}</p>}
                      {m.bankName && <p className="text-slate-500 text-xs mt-0.5">{m.bankName}{m.accountNumber ? ` · ****${m.accountNumber.slice(-4)}` : ""}</p>}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? `border-${accentColor}-400 bg-${accentColor}-400` : "border-slate-700"}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Advertiser Card ─────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4 space-y-3.5">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Advertiser's Info</p>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base ${isBuying ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                  {ad.advertiserName[0]?.toUpperCase()}
                </div>
                {ad.isVerifiedMerchant && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <BadgeCheck size={10} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-bold text-sm tracking-wide">{ad.advertiserName.toUpperCase()}</span>
                  {ad.isVerifiedMerchant && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold">VERIFIED</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="text-slate-500">{ad.tradesCount} trades</span>
                  <span className="text-slate-700">·</span>
                  <span className={ad.completionRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{ad.completionRate}% completion</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-700 shrink-0" />
            </div>

            {ad.terms && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3">
                <p className="text-slate-400 text-xs leading-relaxed">{ad.terms}</p>
              </div>
            )}
          </div>

          {/* ── Info strip ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-slate-500">{ad.timeLimit} min to pay</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-500">Escrow protected</span>
            </div>
          </div>

          <div className="flex-1" />

          {/* ── CTA Button ──────────────────────────── */}
          <button type="submit" disabled={submitting || !isValidAmount || fiatNum === 0}
            className={`relative w-full py-4 rounded-2xl font-bold text-base text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isBuying
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-[0_0_32px_rgba(16,185,129,0.5)]"
                : "bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_24px_rgba(239,68,68,0.35)] hover:shadow-[0_0_32px_rgba(239,68,68,0.5)]"
            }`}>
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Placing Order…</span>
              : fiatNum > 0 && isValidAmount
                ? `Place Order · ₹${fiatNum.toLocaleString("en-IN")} → ${usdtCalc.toFixed(4)} USDT`
                : "Place Order"
            }
          </button>
        </form>
        </div>{/* end grid */}
      </div>{/* end max-w-4xl */}
    </Layout>
  );
}
