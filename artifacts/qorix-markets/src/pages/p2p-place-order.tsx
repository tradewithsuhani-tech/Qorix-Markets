import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle, Loader2, BadgeCheck, ChevronRight, ShieldCheck, Clock, X, RefreshCw } from "lucide-react";

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
  const [payMethodModalOpen, setPayMethodModalOpen] = useState(false);

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 md:px-0 pb-6 md:pb-0">

          {/* Price line */}
          <div className="flex items-center gap-2 text-sm px-0.5">
            <span className="text-slate-500">Price</span>
            <span className="text-white font-semibold">₹{ad.price.toLocaleString("en-IN")} INR</span>
            <button type="button" onClick={() => {}} className="text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>

          {/* ── You Pay ─────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.1] bg-[#111827] p-4 space-y-2">
            <p className="text-slate-400 text-sm">You Pay</p>
            {fiatNum === 0 ? (
              /* Limit range display when no amount typed */
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 text-white text-xl font-semibold tabular-nums cursor-text"
                  onClick={() => document.getElementById("fiat-input")?.focus()}
                >
                  {ad.minLimit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  <span className="text-slate-500 mx-2">–</span>
                  {maxFiat.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setFiatAmount(String(maxFiat))}
                    className="text-amber-400 font-semibold text-sm hover:text-amber-300 transition-colors">All</button>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08]">
                    <span className="text-amber-400 text-sm font-bold">₹</span>
                    <span className="text-white text-sm font-semibold">INR</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Amount input when typing */
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-slate-500 text-2xl shrink-0">₹</span>
                  <input
                    id="fiat-input"
                    type="number" min={ad.minLimit} max={maxFiat} step="1"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    className="flex-1 bg-transparent text-white text-2xl font-semibold outline-none tabular-nums w-0"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setFiatAmount(String(maxFiat))}
                    className="text-amber-400 font-semibold text-sm hover:text-amber-300 transition-colors">All</button>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08]">
                    <span className="text-amber-400 text-sm font-bold">₹</span>
                    <span className="text-white text-sm font-semibold">INR</span>
                  </div>
                </div>
              </div>
            )}
            {/* Hidden input always present for form logic when showing range */}
            {fiatNum === 0 && (
              <input id="fiat-input" type="number" min={ad.minLimit} max={maxFiat} step="1"
                value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)}
                className="w-0 h-0 opacity-0 absolute" />
            )}
            {amountError && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs">
                <AlertCircle size={11} /> {amountError}
              </div>
            )}
          </div>

          {/* ── You Receive ─────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.1] bg-[#111827] p-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-slate-400 text-sm">You Receive</p>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-semibold tabular-nums ${fiatNum > 0 && isValidAmount ? "text-white" : "text-white"}`}>
                {usdtCalc > 0 && isValidAmount ? usdtCalc.toFixed(2) : "0.00"}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center">
                  <span className="text-teal-400 text-xs font-bold">₮</span>
                </div>
                <span className="text-white font-semibold">USDT</span>
              </div>
            </div>
          </div>

          {/* ── Payment Method selector ──────────────── */}
          {ad.sellerPaymentMethods.length > 0 && (
            <button type="button" onClick={() => setPayMethodModalOpen(true)}
              className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-white/[0.1] bg-[#111827] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {selectedMethod ? (
                  <>
                    <div className={`w-1 h-8 rounded-full ${
                      selectedMethod.type === "UPI" ? "bg-purple-500" :
                      selectedMethod.type === "IMPS" ? "bg-orange-500" :
                      "bg-slate-400"
                    }`} />
                    <div className="min-w-0 text-left">
                      <p className="text-white font-semibold text-sm truncate">{selectedMethod.displayName || selectedMethod.type}</p>
                      <p className="text-slate-500 text-xs truncate">
                        {selectedMethod.upiId || (selectedMethod.bankName && selectedMethod.accountNumber ? `${selectedMethod.bankName} · ****${selectedMethod.accountNumber.slice(-4)}` : selectedMethod.bankName || selectedMethod.type)}
                      </p>
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400 text-sm">Set my payment method</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center">
                  {ad.sellerPaymentMethods.length}
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
            </button>
          )}

          {/* ── Mobile-only: Advertiser card ────────── */}
          <div className="md:hidden rounded-2xl border border-white/[0.08] bg-[#111827] p-4 space-y-3">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Advertiser's Info</p>
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
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">{ad.advertiserName.toUpperCase()}</span>
                  {ad.isVerifiedMerchant && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">VERIFIED</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span>{ad.tradesCount} trades</span><span>·</span>
                  <span className={ad.completionRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{ad.completionRate}% completion</span>
                </div>
              </div>
            </div>
            {ad.terms && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                <p className="text-slate-400 text-xs leading-relaxed">{ad.terms}</p>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Clock size={11} className="text-amber-400" />
                <span className="text-xs text-slate-500">{ad.timeLimit} min</span>
              </div>
              <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <ShieldCheck size={11} className="text-emerald-400" />
                <span className="text-xs text-slate-500">Escrow</span>
              </div>
            </div>
          </div>

          {/* ── CTA Button ──────────────────────────── */}
          <button type="submit" disabled={submitting || !isValidAmount || fiatNum === 0}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isBuying
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}>
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Placing Order…</span>
              : isBuying ? "Buy USDT" : "Sell USDT"
            }
          </button>
        </form>
        </div>{/* end grid */}
      </div>{/* end max-w-4xl */}

      {/* ── Payment Method Modal ─────────────────────────────────────────── */}
      {payMethodModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1a2030] w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-white font-bold text-base">Payment Method(s)</h2>
              <button onClick={() => setPayMethodModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 pb-6 space-y-2">
              {ad.sellerPaymentMethods.map((m) => {
                const isSelected = selectedMethodId === m.id;
                const borderColor = m.type === "UPI" ? "bg-purple-500" :
                  m.type === "IMPS" ? "bg-orange-500" :
                  m.type === "NEFT" ? "bg-cyan-500" :
                  "bg-slate-400";
                return (
                  <button key={m.id} type="button"
                    onClick={() => { setSelectedMethodId(m.id); setPayMethodModalOpen(false); }}
                    className={`w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border text-left transition-all ${
                      isSelected ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}>
                    <div className={`w-1 h-10 rounded-full ${borderColor} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{m.displayName || m.type}</p>
                      {m.upiId && <p className="text-slate-400 text-xs mt-0.5">{m.upiId}</p>}
                      {m.bankName && <p className="text-slate-400 text-xs mt-0.5">{m.bankName}{m.accountNumber ? ` · ****${m.accountNumber.slice(-4)}` : ""}</p>}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                      isSelected ? "border-emerald-400 bg-emerald-400" : "border-slate-600"
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
