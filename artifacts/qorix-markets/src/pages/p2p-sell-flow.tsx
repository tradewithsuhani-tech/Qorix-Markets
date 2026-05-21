import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, QrCode, Clock, AlertCircle, Loader2,
  ShieldCheck, ThumbsUp, X, CheckCircle2,
} from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  UPI: "bg-slate-400", PHONEPE: "bg-purple-500", GPAY: "bg-blue-500",
  PAYTM: "bg-sky-400", IMPS: "bg-orange-500", NEFT: "bg-teal-500",
  RTGS: "bg-teal-600", BANK: "bg-amber-500", DIGITAL_ERUPEE: "bg-cyan-500",
};
const METHOD_LABELS: Record<string, string> = {
  UPI: "UPI", PHONEPE: "PhonePe", GPAY: "Google Pay",
  PAYTM: "Paytm", IMPS: "IMPS", NEFT: "NEFT",
  RTGS: "RTGS", BANK: "Bank Transfer", DIGITAL_ERUPEE: "Digital eRupee",
};
const ADD_METHODS = [
  { type: "DIGITAL_ERUPEE", label: "Add Digital eRupee", color: "bg-cyan-500" },
  { type: "IMPS", label: "Add IMPS", color: "bg-orange-500" },
  { type: "UPI", label: "Add UPI", color: "bg-slate-400" },
  { type: "PHONEPE", label: "Add PhonePe", color: "bg-purple-500" },
  { type: "GPAY", label: "Add Google Pay", color: "bg-blue-500" },
  { type: "PAYTM", label: "Add Paytm", color: "bg-sky-400" },
  { type: "BANK", label: "Add Bank Transfer (India)", color: "bg-amber-500" },
];

type PaymentMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null;
  ifsc: string | null; qrCodeData: string | null;
};
type AdDetail = {
  id: number; type: "BUY" | "SELL"; price: number;
  quantity: number; remainingQuantity: number;
  minLimit: number; maxLimit: number; timeLimit: number;
  terms: string | null; status: string; advertiserName: string;
  tradesCount: number; completionRate: number;
};

function MethodCard({
  method, selected, onSelect, onShowQr,
}: {
  method: PaymentMethod; selected: boolean;
  onSelect: () => void; onShowQr: () => void;
}) {
  const color = METHOD_COLORS[method.type] ?? "bg-slate-500";
  const subText = method.upiId || (method.accountNumber ? `****${method.accountNumber.slice(-4)}` : method.bankName) || "";
  return (
    <button type="button" onClick={onSelect}
      className={`w-full flex items-stretch text-left rounded-xl border overflow-hidden transition-all ${
        selected ? "border-emerald-400/60 bg-emerald-500/8" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
      }`}
    >
      {/* Colored left indicator bar */}
      <div className={`w-1 shrink-0 ${color}`} />

      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm mb-0.5">{method.displayName}</div>
            {method.accountHolder && <div className="text-slate-400 text-xs uppercase font-semibold tracking-wide">{method.accountHolder}</div>}
            {subText && <div className="text-slate-400 text-xs font-mono mt-0.5">{subText}</div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {selected && <CheckCircle2 size={16} className="text-emerald-400" />}
            {method.qrCodeData && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onShowQr(); }}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-purple-400 transition-colors">
                <QrCode size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function P2PSellFlowPage() {
  const [, params] = useRoute<{ adId: string }>("/p2p/sell/:adId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const adId = parseInt(params?.adId ?? "0");

  const [ad, setAd] = useState<AdDetail | null>(null);
  const [myMethods, setMyMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [qrModal, setQrModal] = useState<PaymentMethod | null>(null);
  const [fiatAmount, setFiatAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adId) return;
    Promise.all([
      authFetch<AdDetail>(`/api/p2p/ads/${adId}`),
      authFetch<PaymentMethod[]>("/api/p2p/payment-methods"),
    ]).then(([adData, methods]) => {
      setAd(adData);
      setMyMethods(methods.filter((m: any) => m.isActive !== false));
    }).catch(() => toast({ title: "Failed to load", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [adId]);

  const selectedMethod = myMethods.find((m) => m.id === selectedMethodId);
  const fiatNum = parseFloat(fiatAmount) || 0;
  const usdtCalc = fiatNum > 0 && ad ? fiatNum / ad.price : 0;
  const isValid = !!(ad && fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && usdtCalc <= ad.remainingQuantity && selectedMethodId);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !selectedMethod || !ad) return;
    setSubmitting(true);
    try {
      const res = await authFetch<{ success: boolean; order: { id: number } }>("/api/p2p/orders", {
        method: "POST",
        body: JSON.stringify({ adId: ad.id, fiatAmount: fiatNum, paymentMethod: selectedMethod.type }),
      });
      toast({ title: `Order placed! Buyer will pay ₹${fiatNum.toLocaleString("en-IN")} to your account.` });
      navigate(`/p2p/orders/${res.order.id}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to place order", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <Layout><div className="flex flex-col items-center py-20 gap-3"><Loader2 size={28} className="text-emerald-400 animate-spin" /><p className="text-slate-400 text-sm">Loading…</p></div></Layout>;
  }
  if (!ad || ad.status !== "active") {
    return <Layout><div className="flex flex-col items-center py-20 gap-3"><AlertCircle size={28} className="text-red-400" /><p className="text-slate-300">Ad not found or no longer active</p><Link href="/p2p"><button className="text-emerald-400 text-xs hover:underline">← Back to marketplace</button></Link></div></Layout>;
  }

  const typeColor = METHOD_COLORS[selectedMethod?.type ?? ""] ?? "bg-slate-500";
  const missingTypes = ADD_METHODS.filter((a) => !myMethods.some((m) => m.type === a.type));

  return (
    <Layout>
      <div className="max-w-xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Link href="/p2p">
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={18} /></button>
            </Link>
            <h1 className="text-white font-bold text-base">Select a payment method</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-sm">₹{ad.price.toLocaleString("en-IN")}<span className="text-slate-500 font-normal text-xs">/USDT</span></span>
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <Clock size={11} />
              <span>{ad.timeLimit} min</span>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-6">
          {/* ── My payment methods ─────────────────────────────────── */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">Select payment methods</p>
            {myMethods.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-3 glass-card rounded-xl">
                <AlertCircle size={24} className="text-slate-600" />
                <p className="text-slate-500 text-sm">No payment methods added yet</p>
                <Link href="/p2p/payment-methods">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                    <Plus size={12} /> Add Payment Method
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myMethods.map((m) => (
                  <MethodCard key={m.id} method={m} selected={selectedMethodId === m.id}
                    onSelect={() => setSelectedMethodId(m.id)}
                    onShowQr={() => setQrModal(m)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Add supported payment methods ──────────────────────── */}
          {missingTypes.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-2">Add supported payment methods</p>
              <div className="space-y-0 glass-card rounded-xl overflow-hidden divide-y divide-white/[0.04]">
                {missingTypes.map((item) => (
                  <Link key={item.type} href="/p2p/payment-methods">
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left">
                      <div className={`w-1 h-4 rounded-full ${item.color}`} />
                      <span className="text-slate-300 text-sm">{item.label}</span>
                      <Plus size={14} className="text-slate-500 ml-auto" />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Amount input ───────────────────────────────────────── */}
          <form onSubmit={placeOrder} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
                I want to receive (INR) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                <input
                  type="number" min={ad.minLimit} max={ad.maxLimit} step="1"
                  placeholder={`₹${ad.minLimit.toLocaleString()} – ₹${ad.maxLimit.toLocaleString()}`}
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2.5 bg-black/30 border rounded-xl text-white text-sm outline-none transition-colors ${
                    fiatNum > 0 && (fiatNum < ad.minLimit || fiatNum > ad.maxLimit) ? "border-red-500/50" : "border-white/10 focus:border-emerald-400/40"
                  }`}
                />
              </div>
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={() => setFiatAmount(String(ad.minLimit))}
                  className="flex-1 py-1 rounded-lg text-[11px] font-semibold text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10">
                  Min ₹{ad.minLimit.toLocaleString()}
                </button>
                <button type="button" onClick={() => setFiatAmount(String(Math.min(ad.maxLimit, Math.floor(ad.remainingQuantity * ad.price))))}
                  className="flex-1 py-1 rounded-lg text-[11px] font-semibold text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10">
                  Max ₹{Math.min(ad.maxLimit, Math.floor(ad.remainingQuantity * ad.price)).toLocaleString()}
                </button>
              </div>

              {fiatNum > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between rounded-xl bg-red-500/5 border border-red-500/15 px-3 py-2.5">
                    <span className="text-slate-400 text-xs">You Sell</span>
                    <span className="text-red-400 font-bold text-base">{usdtCalc.toFixed(6)} USDT</span>
                  </div>
                  {fiatNum < ad.minLimit && (
                    <div className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
                      <AlertCircle size={12} /> Minimum is ₹{ad.minLimit.toLocaleString("en-IN")}
                    </div>
                  )}
                  {fiatNum > ad.maxLimit && (
                    <div className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
                      <AlertCircle size={12} /> Maximum is ₹{ad.maxLimit.toLocaleString("en-IN")}
                    </div>
                  )}
                  {usdtCalc > ad.remainingQuantity && (
                    <div className="flex items-center gap-2 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-red-400">
                      <AlertCircle size={12} /> Exceeds available ({ad.remainingQuantity.toFixed(4)} USDT)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected method summary */}
            {selectedMethod && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] px-4 py-3 bg-white/[0.02]">
                <div className={`w-1 h-8 rounded-full shrink-0 ${typeColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold">{selectedMethod.displayName}</div>
                  <div className="text-slate-400 text-xs">
                    {selectedMethod.upiId || (selectedMethod.accountNumber ? `****${selectedMethod.accountNumber.slice(-4)}` : selectedMethod.bankName) || ""}
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-bold">{METHOD_LABELS[selectedMethod.type] ?? selectedMethod.type}</span>
              </div>
            )}

            {/* Timer notice */}
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 text-xs text-slate-400">
              <Clock size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>After placing, buyer has <strong className="text-amber-300">{ad.timeLimit} minutes</strong> to pay you. Confirm receipt to release USDT.</span>
            </div>

            {/* Escrow notice */}
            <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 text-xs text-slate-400">
              <ShieldCheck size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>Your USDT is locked in escrow and only released after you confirm the buyer's payment.</span>
            </div>

            {/* Advertiser info */}
            <div className="glass-card rounded-xl p-4 space-y-2">
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Advertiser's Info</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  {ad.advertiserName[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{ad.advertiserName}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span>{ad.tradesCount} Trades</span>
                    <span>·</span>
                    <ThumbsUp size={10} className="text-emerald-500" />
                    <span className="text-emerald-500">{ad.completionRate}%</span>
                  </div>
                </div>
              </div>
              {ad.terms && (
                <div className="border-t border-white/[0.05] pt-2">
                  <p className="text-slate-300 text-xs leading-relaxed">{ad.terms}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !isValid}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-base transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {submitting ? "Placing Order…" : `Sell ${usdtCalc > 0 ? usdtCalc.toFixed(4) + " USDT" : "USDT"} · Receive ₹${fiatNum > 0 ? fiatNum.toLocaleString("en-IN") : "—"}`}
            </button>
          </form>
        </div>
      </div>

      {/* ── QR Code Modal ─────────────────────────────────────────── */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${METHOD_COLORS[qrModal.type] ?? "bg-slate-500"}`} />
                <span className="font-bold text-gray-900">{METHOD_LABELS[qrModal.type] ?? qrModal.type}</span>
              </div>
              <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="text-center px-5 pb-2">
              <p className="text-purple-600 font-bold text-sm uppercase tracking-wide">ACCEPTED HERE</p>
              <p className="text-gray-500 text-xs mt-1">Scan & Pay Using {METHOD_LABELS[qrModal.type] ?? qrModal.type} App</p>
            </div>
            <div className="px-5 pb-5">
              <img src={qrModal.qrCodeData!} alt="QR Code" className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
