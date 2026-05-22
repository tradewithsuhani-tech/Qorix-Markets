import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Lock, Wallet, AlertCircle, CheckCircle2, Plus, Eye, EyeOff, X, Trash2 } from "lucide-react";

type FundingWallet = { tradingBalance: string | number };
type PaymentMethod = {
  id: number; type: string; displayName: string;
  upiId?: string | null; bankName?: string | null; branchName?: string | null;
  accountHolder?: string | null; accountNumber?: string | null; ifsc?: string | null;
};

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
  const [fundingWallet, setFundingWallet] = useState<FundingWallet | null>(null);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [payMethodsLoading, setPayMethodsLoading] = useState(true);
  const [peekId, setPeekId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteMethod = async (id: number) => {
    setDeletingId(id);
    try {
      await authFetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
      setPayMethods((prev) => prev.filter((m) => m.id !== id));
      setSelectedMethods((prev) => prev.filter((x) => x !== String(id)));
      if (peekId === id) setPeekId(null);
      toast({ title: "Payment method removed" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    authFetch<FundingWallet>("/api/wallet")
      .then(setFundingWallet)
      .catch(() => setFundingWallet({ tradingBalance: 0 }));
    authFetch<PaymentMethod[]>("/api/p2p/payment-methods")
      .then((m) => { setPayMethods(m); setPayMethodsLoading(false); })
      .catch(() => setPayMethodsLoading(false));
  }, []);

  const isSell = type === "SELL";
  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(quantity) || 0;
  const totalFiat = priceNum * qtyNum;

  const fundingBalance = fundingWallet ? Number(fundingWallet.tradingBalance) : 0;
  const exceedsBalance = isSell && qtyNum > 0 && qtyNum > fundingBalance;
  const canSubmit = !isSell || (fundingWallet !== null && qtyNum > 0 && qtyNum <= fundingBalance);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMethods.length === 0) {
      toast({ title: "Select at least one payment method", variant: "destructive" }); return;
    }
    if (isSell && fundingWallet === null) {
      toast({ title: "Wallet is loading, please wait", variant: "destructive" }); return;
    }
    if (isSell && exceedsBalance) {
      toast({
        title: "Insufficient Funding Wallet balance",
        description: `You have ${fundingBalance.toFixed(4)} USDT available`,
        variant: "destructive",
      }); return;
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
      toast({
        title: "Ad posted! Your USDT is held in escrow.",
        description: "Buyers will see your ad. When someone places an order, it will appear in My Orders.",
      });
      navigate("/p2p/ads/my");
    } catch (err: any) {
      toast({ title: err.message || "Failed to post ad", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

        {/* Funding Wallet Balance — always show for SELL */}
        {isSell && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm border ${
            fundingWallet === null
              ? "bg-white/[0.03] border-white/10"
              : exceedsBalance
                ? "bg-red-500/5 border-red-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
          }`}>
            <Wallet size={15} className={
              fundingWallet === null ? "text-slate-500"
              : exceedsBalance ? "text-red-400" : "text-emerald-400"
            } />
            <span className="text-slate-400">Funding Wallet:</span>
            <span className={`font-bold ${
              fundingWallet === null ? "text-slate-400"
              : exceedsBalance ? "text-red-400" : "text-emerald-400"
            }`}>
              {fundingWallet === null ? "Loading..." : `${fundingBalance.toFixed(4)} USDT`}
            </span>
            {exceedsBalance && (
              <span className="text-red-400 text-xs ml-auto">Insufficient</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset */}
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
                required type="number" min="0.01" step="0.01"
                max={isSell && fundingBalance > 0 ? fundingBalance : undefined}
                placeholder={isSell && fundingWallet === null ? "Loading..." : "e.g. 500"}
                disabled={isSell && fundingWallet === null}
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  if (isSell && fundingWallet !== null && !isNaN(num) && num > fundingBalance) {
                    setQuantity(fundingBalance > 0 ? fundingBalance.toFixed(4) : "");
                  } else {
                    setQuantity(val);
                  }
                }}
                className={`w-full pr-24 pl-4 py-2.5 bg-black/30 rounded-xl text-sm outline-none transition-colors border ${
                  isSell && fundingWallet === null
                    ? "text-slate-500 cursor-not-allowed opacity-60 border-white/5"
                    : exceedsBalance
                      ? "text-white border-red-500/50 focus:border-red-500/70"
                      : "text-white border-white/10 focus:border-emerald-400/40"
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isSell && fundingWallet !== null && fundingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuantity(fundingBalance.toFixed(4))}
                    className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded hover:bg-emerald-500/25 transition-all"
                  >
                    MAX
                  </button>
                )}
                <span className="text-slate-500 text-xs font-bold">USDT</span>
              </div>
            </div>
            {exceedsBalance && fundingWallet !== null && (
              <div className="text-xs text-red-400 mt-1">
                ⚠ Exceeds Funding Wallet ({fundingBalance.toFixed(4)} USDT available)
              </div>
            )}
            {totalFiat > 0 && !exceedsBalance && (
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Accepted Payment Methods <span className="text-red-400">*</span>
              </label>
              <Link
                href="/p2p/payment-methods"
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                <Plus size={11} /> Add New
              </Link>
            </div>

            {payMethodsLoading ? (
              <div className="text-slate-500 text-sm py-3 text-center">Loading your payment methods…</div>
            ) : payMethods.length === 0 ? (
              <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-300 text-sm font-semibold">No payment methods added</p>
                  <p className="text-slate-400 text-xs mt-0.5 mb-3">
                    You need at least one payment method before posting an ad.
                  </p>
                  <Link
                    href="/p2p/payment-methods"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                  >
                    <Plus size={12} /> Add Payment Method
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {payMethods.map((m) => {
                  const isSelected = selectedMethods.includes(String(m.id));
                  const isPeeking = peekId === m.id;
                  return (
                    <div key={m.id} className="space-y-0">
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isPeeking ? "rounded-b-none border-b-0" : ""
                        } ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-white/[0.03] border-white/10"
                        }`}
                      >
                        {/* Checkbox area — clicks toggle selection */}
                        <button
                          type="button"
                          onClick={() => {
                            const key = String(m.id);
                            setSelectedMethods((prev) =>
                              prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
                            );
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {isSelected
                            ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            : <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{m.displayName}</div>
                          </div>
                        </button>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">
                          {m.type}
                        </span>
                        {/* Eye button */}
                        <button
                          type="button"
                          onClick={() => setPeekId(isPeeking ? null : m.id)}
                          title="View account details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
                        >
                          {isPeeking ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => deleteMethod(m.id)}
                          disabled={deletingId === m.id}
                          title="Remove payment method"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Inline details panel */}
                      {isPeeking && (
                        <div className={`px-4 py-3 rounded-b-xl border border-t-0 bg-black/30 space-y-2 ${
                          isSelected ? "border-emerald-500/40" : "border-white/10"
                        }`}>
                          {m.type === "UPI" ? (
                            <Row label="UPI ID" value={m.upiId} />
                          ) : (
                            <>
                              <Row label="Account Holder" value={m.accountHolder} />
                              <Row label="Account Number" value={m.accountNumber} />
                              <Row label="IFSC Code" value={m.ifsc} mono />
                              {m.bankName && <Row label="Bank" value={m.bankName} />}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              <span>
                When you post a SELL ad, <strong className="text-amber-300">{qtyNum > 0 ? `${qtyNum} USDT` : "your USDT"}</strong> will be
                locked from your <strong className="text-amber-300">Funding Wallet</strong> until the ad is cancelled or completed.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSell && !canSubmit)}
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

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-500 text-xs shrink-0">{label}</span>
      <span className={`text-white text-xs font-medium ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
    </div>
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
