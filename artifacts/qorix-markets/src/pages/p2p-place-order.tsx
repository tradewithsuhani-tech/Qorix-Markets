import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, TrendingUp, TrendingDown, AlertCircle,
  Loader2, ShieldCheck, Clock,
} from "lucide-react";

type SellerMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null; ifsc: string | null;
};

type AdDetail = {
  id: number; userId: number; type: "BUY" | "SELL"; price: number;
  quantity: number; remainingQuantity: number;
  minLimit: number; maxLimit: number;
  paymentMethods: string[]; sellerPaymentMethods: SellerMethod[];
  terms: string | null; status: string; advertiserName: string;
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
          <p className="text-slate-400 text-sm">Loading ad details…</p>
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
          <Link href="/p2p"><button className="text-emerald-400 text-xs hover:underline">← Back to marketplace</button></Link>
        </div>
      </Layout>
    );
  }

  const isSell = ad.type === "SELL"; // seller is selling USDT, buyer pays INR
  const fiatNum = parseFloat(fiatAmount) || 0;
  const usdtCalc = fiatNum > 0 ? fiatNum / ad.price : 0;
  const isValidAmount = fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && usdtCalc <= ad.remainingQuantity;
  const selectedMethod = ad.sellerPaymentMethods.find((m) => m.id === selectedMethodId);

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
      toast({ title: "Order placed! Pay within 15 minutes." });
      navigate(`/p2p/orders/${res.order.id}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to place order", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/p2p">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              {isSell ? "Buy USDT" : "Sell USDT"}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">from {ad.advertiserName}</p>
          </div>
        </div>

        {/* Ad summary card */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isSell ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                {isSell ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-red-400" />}
              </div>
              <span className={`font-bold text-sm ${isSell ? "text-emerald-400" : "text-red-400"}`}>
                {ad.type} Ad
              </span>
            </div>
            <span className="text-xs text-slate-500">Ad #{ad.id}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">Price</div>
              <div className="text-white font-bold">₹{ad.price.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">Available</div>
              <div className="text-white font-bold">{ad.remainingQuantity.toFixed(4)} USDT</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">Limits</div>
              <div className="text-white font-bold">₹{ad.minLimit.toLocaleString()}–{ad.maxLimit.toLocaleString()}</div>
            </div>
          </div>
          {ad.terms && (
            <p className="text-xs text-slate-500 border-t border-white/[0.05] pt-2">{ad.terms}</p>
          )}
        </div>

        {/* Order form */}
        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">Place Order</h2>

          {/* INR Amount */}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
              Amount (₹) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input
                required type="number" min={ad.minLimit} max={ad.maxLimit} step="1"
                placeholder={`₹${ad.minLimit.toLocaleString()} – ₹${ad.maxLimit.toLocaleString()}`}
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                className={`w-full pl-8 pr-3 py-2.5 bg-black/30 border rounded-xl text-white text-sm outline-none transition-colors ${
                  fiatNum > 0 && !isValidAmount ? "border-red-500/50" : "border-white/10 focus:border-emerald-400/40"
                }`}
              />
            </div>
            {/* Quick-fill buttons */}
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={() => setFiatAmount(String(ad.minLimit))}
                className="flex-1 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                Min ₹{ad.minLimit.toLocaleString()}
              </button>
              <button type="button" onClick={() => setFiatAmount(String(Math.min(ad.maxLimit, ad.remainingQuantity * ad.price)))}
                className="flex-1 py-1 rounded-lg text-[11px] font-semibold text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all">
                Max ₹{Math.min(ad.maxLimit, Math.floor(ad.remainingQuantity * ad.price)).toLocaleString()}
              </button>
            </div>

            {fiatNum > 0 && (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">≈ {usdtCalc.toFixed(6)} USDT</span>
                </div>
                {fiatNum < ad.minLimit && (
                  <div className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
                    <AlertCircle size={12} /> Minimum order is ₹{ad.minLimit.toLocaleString("en-IN")}
                  </div>
                )}
                {fiatNum > ad.maxLimit && (
                  <div className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
                    <AlertCircle size={12} /> Maximum order is ₹{ad.maxLimit.toLocaleString("en-IN")}
                  </div>
                )}
                {usdtCalc > ad.remainingQuantity && (
                  <div className="flex items-center gap-2 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-red-400">
                    <AlertCircle size={12} /> Exceeds available USDT ({ad.remainingQuantity.toFixed(4)})
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment method selection */}
          {ad.sellerPaymentMethods.length > 0 && (
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
                Pay via (seller's accepted methods)
              </label>
              <div className="space-y-2">
                {ad.sellerPaymentMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethodId(m.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      selectedMethodId === m.id
                        ? "bg-emerald-500/10 border-emerald-500/40"
                        : "bg-white/[0.03] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                      selectedMethodId === m.id ? "border-emerald-400 bg-emerald-400" : "border-slate-600"
                    }`}>
                      {selectedMethodId === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{m.displayName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">{m.type}</span>
                      </div>
                      {m.upiId && <div className="text-slate-400 text-xs mt-0.5">{m.upiId}</div>}
                      {m.bankName && (
                        <div className="text-slate-400 text-xs mt-0.5">
                          {m.bankName} · {m.accountHolder}
                          {m.accountNumber ? ` · ****${m.accountNumber.slice(-4)}` : ""}
                        </div>
                      )}
                      {m.ifsc && <div className="text-slate-500 text-[11px] mt-0.5 font-mono">IFSC: {m.ifsc}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timer notice */}
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 text-xs text-slate-400">
            <Clock size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <span>After placing the order, you have <strong className="text-amber-300">15 minutes</strong> to complete the payment and mark it as paid.</span>
          </div>

          {/* Escrow notice */}
          <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 text-xs text-slate-400">
            <ShieldCheck size={13} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>USDT is held in escrow by Qorix Markets and released only after the seller confirms your payment.</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !isValidAmount || fiatNum === 0}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 ${
              isSell ? "bg-emerald-500 hover:bg-emerald-400" : "bg-red-500 hover:bg-red-400"
            }`}
          >
            {submitting ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Placing…</span>
              : `Place ${isSell ? "Buy" : "Sell"} Order · ₹${fiatNum > 0 ? fiatNum.toLocaleString("en-IN") : "—"}`
            }
          </button>
        </form>
      </div>
    </Layout>
  );
}
