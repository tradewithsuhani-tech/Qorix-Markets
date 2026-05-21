import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Info, Wallet, Lock } from "lucide-react";

type P2pWallet = { availableBalance: number; frozenBalance: number; escrowBalance: number };
type PaymentMethod = { id: number; type: string; displayName: string };

const PAYMENT_METHOD_OPTIONS = ["UPI", "BANK", "IMPS", "NEFT", "RTGS"];

export default function P2PCreateAdPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [type, setType] = useState<"BUY" | "SELL">("SELL");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [minLimit, setMinLimit] = useState("");
  const [maxLimit, setMaxLimit] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<P2pWallet | null>(null);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    Promise.all([
      authFetch<P2pWallet>("/api/p2p/wallet"),
      authFetch<PaymentMethod[]>("/api/p2p/payment-methods"),
    ]).then(([w, pm]) => { setWallet(w); setPayMethods(pm); }).catch(() => {});
  }, []);

  const isSell = type === "SELL";
  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(quantity) || 0;
  const totalFiat = priceNum * qtyNum;

  const canAfford = !isSell || (wallet && wallet.availableBalance >= qtyNum);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMethods.length === 0) {
      toast({ title: "Select at least one payment method", variant: "destructive" }); return;
    }
    if (!canAfford) {
      toast({ title: "Insufficient P2P balance", description: "Fund your P2P wallet first", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      await authFetch("/api/p2p/ads", {
        method: "POST",
        body: JSON.stringify({
          type,
          price: priceNum,
          quantity: qtyNum,
          minLimit: parseFloat(minLimit),
          maxLimit: parseFloat(maxLimit),
          paymentMethods: selectedMethods,
          terms: terms.trim() || undefined,
        }),
      });
      toast({ title: "Ad posted successfully!" });
      navigate("/p2p");
    } catch (err: any) {
      toast({ title: err.message || "Failed to post ad", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleMethod(m: string) {
    setSelectedMethods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Back */}
        <button onClick={() => navigate("/p2p")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5">
          <ArrowLeft size={16} /> Back to P2P
        </button>

        <h1 className="text-xl font-bold text-white mb-1">Post a P2P Ad</h1>
        <p className="text-slate-400 text-sm mb-6">List your USDT for buy or sell on the marketplace.</p>

        {/* Type Toggle */}
        <div className="glass-card rounded-xl p-1 flex mb-5">
          {(["SELL", "BUY"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                type === t
                  ? t === "SELL"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-500"
              }`}
            >
              {t === "SELL" ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
              {t} USDT
            </button>
          ))}
        </div>

        {/* Wallet Balance (for SELL) */}
        {isSell && wallet && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm ${canAfford ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
            <Wallet size={15} className={canAfford ? "text-emerald-400" : "text-red-400"} />
            <span className="text-slate-400">P2P Available:</span>
            <span className={`font-bold ${canAfford ? "text-emerald-400" : "text-red-400"}`}>{wallet.availableBalance.toFixed(4)} USDT</span>
            {!canAfford && qtyNum > 0 && (
              <span className="text-red-400 text-xs ml-auto">Insufficient balance</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset (fixed for now) */}
          <div className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-300">₮</div>
            <div>
              <div className="text-white font-semibold">USDT (TRC20)</div>
              <div className="text-slate-500 text-xs">Tether • Tron network</div>
            </div>
          </div>

          {/* Price */}
          <Field label="Price per USDT (₹ INR)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input
                required type="number" min="1" step="0.01"
                placeholder="e.g. 88.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40"
              />
            </div>
          </Field>

          {/* Quantity */}
          <Field label="Total USDT quantity" required>
            <div className="relative">
              <input
                required type="number" min="1" step="0.01"
                placeholder="e.g. 500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full pr-16 pl-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">USDT</span>
            </div>
            {totalFiat > 0 && (
              <div className="text-xs text-slate-500 mt-1">≈ ₹{totalFiat.toLocaleString("en-IN", { maximumFractionDigits: 0 })} total value</div>
            )}
          </Field>

          {/* Min/Max limits */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min order (₹)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input
                  required type="number" min="1"
                  placeholder="500"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40"
                />
              </div>
            </Field>
            <Field label="Max order (₹)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input
                  required type="number" min="1"
                  placeholder="50000"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40"
                />
              </div>
            </Field>
          </div>

          {/* Payment Methods */}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
              Accepted Payment Methods <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    selectedMethods.includes(m)
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Terms */}
          <Field label="Terms (optional)">
            <textarea
              rows={3}
              placeholder="Any conditions for the trade (e.g. only verified accounts, payment within 10 min)..."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40 resize-none"
            />
            <div className="text-xs text-slate-600 mt-1 text-right">{terms.length}/500</div>
          </Field>

          {/* Info banner for SELL */}
          {isSell && (
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
              <Lock size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>When you post a SELL ad, <strong className="text-amber-300">{qtyNum > 0 ? `${qtyNum} USDT` : "your USDT"}</strong> will be locked from your P2P available balance into frozen balance until the ad is cancelled or completed.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canAfford}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
              isSell
                ? "bg-red-500 hover:bg-red-400 disabled:opacity-50"
                : "bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
            }`}
          >
            {loading ? "Posting..." : `Post ${type} Ad`}
          </button>
        </form>
      </div>
    </Layout>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
