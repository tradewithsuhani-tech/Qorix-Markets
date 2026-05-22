import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle, Loader2, BadgeCheck, ChevronRight, RefreshCw } from "lucide-react";

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
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </Layout>
    );
  }

  if (!ad || ad.status !== "active") {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-3">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-slate-300 text-sm font-medium">Ad not found or no longer active</p>
          <button onClick={() => navigate("/p2p")} className="text-emerald-400 text-xs hover:underline">← Back to marketplace</button>
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
    ? fiatNum < ad.minLimit
      ? `Minimum ₹${ad.minLimit.toLocaleString("en-IN")}`
      : fiatNum > maxFiat
        ? `Maximum ₹${maxFiat.toLocaleString("en-IN")}`
        : `Exceeds available ${ad.remainingQuantity.toFixed(2)} USDT`
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
          paymentMethod: selectedMethod?.type ?? selectedMethod?.displayName ?? undefined,
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

  return (
    <Layout>
      <div className="max-w-xl mx-auto flex flex-col min-h-[calc(100vh-4rem)]">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate("/p2p")} className="text-white p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-white font-semibold text-base">
              {isBuying ? "Buy USDT" : "Sell USDT"}
            </h1>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span className="text-slate-400 text-xs">Price ₹{ad.price.toLocaleString("en-IN")}</span>
              <RefreshCw size={11} className="text-slate-500" />
            </div>
          </div>
          <div className="w-7" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-3 px-4 pb-6">

          {/* Amount input card */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div>
              <span className="text-slate-400 text-sm font-medium">By INR</span>
              <div className="h-0.5 w-6 bg-yellow-400 mt-1 rounded-full" />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={ad.minLimit}
                max={maxFiat}
                step="1"
                placeholder="0"
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                className="flex-1 bg-transparent text-white text-4xl font-light outline-none placeholder:text-slate-700 w-0"
              />
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-400 text-sm font-medium">INR</span>
                <button
                  type="button"
                  onClick={() => setFiatAmount(String(maxFiat))}
                  className="text-yellow-400 text-sm font-bold"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-500 text-xs">
                Limit &nbsp;₹{ad.minLimit.toLocaleString("en-IN")} – ₹{maxFiat.toLocaleString("en-IN")} INR
              </p>
              {amountError && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {amountError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-slate-400 text-sm">You Receive</span>
              <span className="text-white font-semibold text-sm">
                {usdtCalc > 0 ? usdtCalc.toFixed(4) : "0"} USDT
              </span>
            </div>
          </div>

          {/* Payment method */}
          {ad.sellerPaymentMethods.length > 0 && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              {ad.sellerPaymentMethods.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethodId(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                    i > 0 ? "border-t border-white/[0.06]" : ""
                  } ${selectedMethodId === m.id ? "bg-white/[0.04]" : ""}`}
                >
                  <div className={`w-1 self-stretch rounded-full ${selectedMethodId === m.id ? "bg-emerald-400" : "bg-white/10"}`} />
                  <span className="flex-1 text-white text-sm font-medium">{m.displayName || m.type}</span>
                  {selectedMethodId === m.id && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Advertiser's Info */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">Advertiser's Info</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold text-sm">{ad.advertiserName[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-semibold text-sm">{ad.advertiserName.toUpperCase()}</span>
                  {ad.isVerifiedMerchant && <BadgeCheck size={15} className="text-emerald-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span>{ad.tradesCount} trades</span>
                  <span>·</span>
                  <span className="text-emerald-500">{ad.completionRate}%</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-600 shrink-0" />
            </div>
            {ad.terms && (
              <p className="text-slate-500 text-xs leading-relaxed border-t border-white/[0.06] pt-3">{ad.terms}</p>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Place Order CTA */}
          <button
            type="submit"
            disabled={submitting || !isValidAmount || fiatNum === 0}
            className="w-full py-4 rounded-2xl font-bold text-base text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Placing…</span>
              : "Place Order"
            }
          </button>
        </form>
      </div>
    </Layout>
  );
}
