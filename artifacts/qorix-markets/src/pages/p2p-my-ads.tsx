import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pause, Play, Trash2, AlertCircle,
  TrendingUp, TrendingDown, RefreshCw, Pencil, X, Activity, CheckCircle2,
} from "lucide-react";

type MyAd = {
  id: number;
  type: "BUY" | "SELL";
  status: "active" | "paused" | "completed" | "cancelled";
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  terms: string | null;
  createdAt: string;
  updatedAt: string;
  activeOrdersCount: number;
  completedOrdersCount: number;
  completedRevenueUsdt: number;
};

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  active:    { pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" },
  paused:    { pill: "bg-amber-500/15 text-amber-400 border-amber-500/25",       dot: "bg-amber-400" },
  completed: { pill: "bg-blue-500/15 text-blue-400 border-blue-500/25",          dot: "bg-blue-400" },
  cancelled: { pill: "bg-red-500/15 text-red-400 border-red-500/25",             dot: "bg-red-400" },
};

export default function P2PMyAdsPage() {
  const { toast } = useToast();
  const [ads, setAds] = useState<MyAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [editingAd, setEditingAd] = useState<MyAd | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch<MyAd[]>("/api/p2p/ads/my");
      setAds(data);
    } catch {
      toast({ title: "Failed to load your ads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  async function handleToggle(id: number) {
    setActionId(id);
    try {
      const res = await authFetch<{ success: boolean; status: string }>(`/api/p2p/ads/${id}/toggle`, {
        method: "PATCH",
      });
      setAds((prev) => prev.map((a) => a.id === id ? { ...a, status: res.status as MyAd["status"] } : a));
      toast({ title: res.status === "active" ? "Ad resumed" : "Ad paused" });
      fetchAds();
    } catch (err: any) {
      toast({ title: err.message || "Failed to toggle ad", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: number) {
    setActionId(id);
    setConfirmDelete(null);
    try {
      await authFetch(`/api/p2p/ads/${id}`, { method: "DELETE" });
      setAds((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Ad cancelled. Locked USDT returned to Funding Wallet." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to cancel ad", variant: "destructive" });
    } finally {
      setActionId(null);
    }
  }

  const canManage = (ad: MyAd) => ad.status !== "completed" && ad.status !== "cancelled";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-3">

        {/* Compact action bar — title is in the top bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : `${ads.length} listing${ads.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAds}
              disabled={loading}
              className="p-2 rounded-xl glass-card text-slate-400 active:bg-white/10 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors">
                <Plus size={13} /> New Ad
              </button>
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="glass-card rounded-2xl flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <AlertCircle size={28} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">No listings yet</p>
              <p className="text-slate-500 text-xs mt-0.5">Create your first P2P ad</p>
            </div>
            <Link href="/p2p/create-ad">
              <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold">
                <Plus size={14} /> Post Ad
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map((ad) => {
              const fillPct = ad.quantity > 0 ? Math.round((ad.filledQuantity / ad.quantity) * 100) : 0;
              const isActing = actionId === ad.id;
              const isDeletingThis = confirmDelete === ad.id;
              const statusStyle = STATUS_STYLES[ad.status] ?? STATUS_STYLES.cancelled;
              const isBuy = ad.type === "BUY";

              return (
                <div key={ad.id} className="glass-card rounded-2xl overflow-hidden border border-white/[0.07]">
                  {/* Colored top accent */}
                  <div className={`h-0.5 w-full ${isBuy ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-rose-400"}`} />

                  <div className="p-4 space-y-3.5">
                    {/* Top row: type + status + actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${isBuy ? "bg-emerald-500/15 border-emerald-500/20" : "bg-red-500/15 border-red-500/20"}`}>
                          {isBuy
                            ? <TrendingUp size={15} className="text-emerald-400" />
                            : <TrendingDown size={15} className="text-red-400" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-extrabold tracking-tight ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                              {ad.type} USDT
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide ${statusStyle.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              {ad.status}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            #{ad.id} · {new Date(ad.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {canManage(ad) && !isDeletingThis && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={isActing}
                            onClick={() => setEditingAd(ad)}
                            className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 active:bg-white/10 disabled:opacity-40 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            disabled={isActing}
                            onClick={() => handleToggle(ad.id)}
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center disabled:opacity-40 transition-colors ${
                              ad.status === "active"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 active:bg-amber-500/20"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 active:bg-emerald-500/20"
                            }`}
                            title={ad.status === "active" ? "Pause" : "Resume"}
                          >
                            {ad.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            disabled={isActing}
                            onClick={() => setConfirmDelete(ad.id)}
                            className="w-8 h-8 rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center text-red-400 active:bg-red-500/20 disabled:opacity-40 transition-colors"
                            title="Cancel ad"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {/* Delete confirm */}
                      {isDeletingThis && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            disabled={isActing}
                            onClick={() => handleDelete(ad.id)}
                            className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold active:bg-red-600 disabled:opacity-40 transition-all"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 rounded-xl glass-card text-slate-300 text-xs font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Price", value: `₹${ad.price.toLocaleString("en-IN")}` },
                        { label: "Remaining", value: `${ad.remainingQuantity.toFixed(2)}`, sub: "USDT" },
                        { label: "Limits", value: `₹${ad.minLimit.toLocaleString("en-IN")}`, sub: `–${ad.maxLimit.toLocaleString("en-IN")}` },
                      ].map(({ label, value, sub }) => (
                        <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-2">
                          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                          <div className="text-white font-bold text-xs leading-snug">
                            {value}
                            {sub && <span className="text-slate-500 font-normal text-[10px]"> {sub}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Fill progress */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                        <span>Filled {ad.filledQuantity.toFixed(2)} / {ad.quantity.toFixed(2)} USDT</span>
                        <span className={fillPct > 0 ? (isBuy ? "text-emerald-400" : "text-red-400") : ""}>{fillPct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isBuy ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Order activity pills */}
                    {(ad.activeOrdersCount > 0 || ad.completedOrdersCount > 0) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {ad.activeOrdersCount > 0 && (
                          <Link href="/p2p/orders">
                            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-semibold">
                              <Activity size={10} />
                              {ad.activeOrdersCount} active
                            </button>
                          </Link>
                        )}
                        {ad.completedOrdersCount > 0 && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">
                            <CheckCircle2 size={10} />
                            {ad.completedOrdersCount} done · {ad.completedRevenueUsdt.toFixed(2)} USDT
                          </span>
                        )}
                      </div>
                    )}

                    {/* Payment methods */}
                    {ad.paymentMethods.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ad.paymentMethods.map((m) => (
                          <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-slate-400 font-medium">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Terms */}
                    {ad.terms && (
                      <p className="text-[11px] text-slate-500 border-t border-white/[0.06] pt-2.5 leading-relaxed italic">
                        "{ad.terms}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingAd && (
        <EditAdModal
          ad={editingAd}
          onClose={() => setEditingAd(null)}
          onSaved={(updated) => {
            setAds((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a));
            setEditingAd(null);
          }}
          onStale={() => {
            setEditingAd(null);
            fetchAds();
          }}
        />
      )}
    </Layout>
  );
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────

const COMMON_METHODS = ["UPI", "BANK", "IMPS", "NEFT", "Fast Pay"] as const;

function EditAdModal({
  ad,
  onClose,
  onSaved,
  onStale,
}: {
  ad: MyAd;
  onClose: () => void;
  onSaved: (updated: Partial<MyAd> & { id: number }) => void;
  onStale: () => void;
}) {
  const { toast } = useToast();
  const [price, setPrice] = useState(String(ad.price));
  const [quantity, setQuantity] = useState(String(ad.quantity));
  const [minLimit, setMinLimit] = useState(String(ad.minLimit));
  const [maxLimit, setMaxLimit] = useState(String(ad.maxLimit));
  const [terms, setTerms] = useState(ad.terms ?? "");
  const [methods, setMethods] = useState<string[]>(ad.paymentMethods);
  const [saving, setSaving] = useState(false);

  function toggleMethod(m: string) {
    setMethods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  }

  async function handleSave() {
    const body: Record<string, unknown> = { expectedUpdatedAt: ad.updatedAt };
    const pNum = parseFloat(price);
    const qNum = parseFloat(quantity);
    const minNum = parseFloat(minLimit);
    const maxNum = parseFloat(maxLimit);

    if (!isFinite(pNum) || pNum <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    if (!isFinite(qNum) || qNum <= 0) { toast({ title: "Invalid quantity", variant: "destructive" }); return; }
    if (!isFinite(minNum) || minNum <= 0) { toast({ title: "Invalid min limit", variant: "destructive" }); return; }
    if (!isFinite(maxNum) || maxNum <= 0) { toast({ title: "Invalid max limit", variant: "destructive" }); return; }
    if (minNum >= maxNum) { toast({ title: "Min must be less than max", variant: "destructive" }); return; }
    if (methods.length === 0) { toast({ title: "Select at least one payment method", variant: "destructive" }); return; }

    if (pNum !== ad.price) body.price = pNum;
    if (qNum !== ad.quantity) body.quantity = qNum;
    if (minNum !== ad.minLimit) body.minLimit = minNum;
    if (maxNum !== ad.maxLimit) body.maxLimit = maxNum;
    if (terms !== (ad.terms ?? "")) body.terms = terms || null;
    const methodsChanged =
      methods.length !== ad.paymentMethods.length ||
      methods.some((m, i) => m !== ad.paymentMethods[i]);
    if (methodsChanged) body.paymentMethods = methods;

    const hasChange = Object.keys(body).filter((k) => k !== "expectedUpdatedAt").length > 0;
    if (!hasChange) { toast({ title: "Nothing to update" }); return; }

    setSaving(true);
    try {
      const res = await authFetch<{ success: boolean; ad: MyAd }>(`/api/p2p/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast({ title: "Ad updated" });
      onSaved(res.ad);
    } catch (err: any) {
      if (err?.code === "stale" || /modified by another action/i.test(err?.message ?? "")) {
        toast({
          title: "Ad changed elsewhere",
          description: "Refreshed your view — please review and try again.",
          variant: "destructive",
        });
        onStale();
        return;
      }
      toast({ title: err?.message || "Failed to update ad", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const isBuy = ad.type === "BUY";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "linear-gradient(180deg, #0e1320 0%, #090c17 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isBuy ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
              {isBuy
                ? <TrendingUp size={14} className="text-emerald-400" />
                : <TrendingDown size={14} className="text-red-400" />
              }
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Edit Ad #{ad.id}</h2>
              <p className="text-[11px] text-slate-500">{ad.type} USDT listing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Field label="Price (₹ per USDT)">
            <input
              type="number" step="0.01" value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="field-input"
              placeholder="e.g. 105"
            />
          </Field>

          <Field
            label="Quantity (USDT)"
            hint={
              ad.type === "SELL"
                ? "Increasing locks more from Funding Wallet; decreasing returns freed USDT"
                : `Already filled: ${ad.filledQuantity.toFixed(2)} USDT`
            }
          >
            <input
              type="number" step="0.01" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="field-input"
              placeholder="e.g. 100"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min limit (₹)">
              <input
                type="number" step="1" value={minLimit}
                onChange={(e) => setMinLimit(e.target.value)}
                className="field-input"
                placeholder="100"
              />
            </Field>
            <Field label="Max limit (₹)">
              <input
                type="number" step="1" value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className="field-input"
                placeholder="50000"
              />
            </Field>
          </div>

          <Field label="Payment methods">
            <div className="flex flex-wrap gap-2">
              {COMMON_METHODS.map((m) => {
                const on = methods.includes(m);
                return (
                  <button
                    type="button" key={m}
                    onClick={() => toggleMethod(m)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                      on
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-white/[0.04] border-white/10 text-slate-400"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Terms (optional)">
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3} maxLength={500}
              placeholder="e.g. Pay within 10 minutes, mention order ID in UPI note"
              className="field-input resize-none"
            />
          </Field>

          <div className="flex gap-2 pt-1 pb-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl glass-card text-slate-300 text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-black text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.99]"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}
