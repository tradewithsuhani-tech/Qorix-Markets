import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pause, Play, Trash2, AlertCircle,
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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/25",
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
      // Toggle bumps updatedAt server-side — refetch so optimistic-lock stays in sync.
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
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/p2p">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">My Ads</h1>
            <p className="text-slate-400 text-xs mt-0.5">Manage your P2P listings</p>
          </div>
          <button
            onClick={fetchAds}
            className="p-2 rounded-xl glass-card text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <Link href="/p2p/create-ad">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all">
              <Plus size={13} /> New Ad
            </button>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <AlertCircle size={30} className="text-slate-600" />
            <p className="text-slate-500 text-sm font-medium">No ads posted yet</p>
            <p className="text-slate-600 text-xs">Create your first P2P listing</p>
            <Link href="/p2p/create-ad">
              <button className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 transition-all">
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
              return (
                <div key={ad.id} className="glass-card rounded-xl p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${ad.type === "SELL" ? "bg-red-500/15" : "bg-emerald-500/15"}`}>
                        {ad.type === "SELL"
                          ? <TrendingDown size={14} className="text-red-400" />
                          : <TrendingUp size={14} className="text-emerald-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${ad.type === "SELL" ? "text-red-400" : "text-emerald-400"}`}>
                            {ad.type} USDT
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${STATUS_STYLES[ad.status] ?? ""}`}>
                            {ad.status}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          #{ad.id} · {new Date(ad.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {canManage(ad) && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit */}
                        <button
                          disabled={isActing}
                          onClick={() => setEditingAd(ad)}
                          title="Edit ad"
                          className="p-2 rounded-lg glass-card text-slate-400 hover:text-electric-400 hover:bg-electric-500/10 disabled:opacity-40 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Pause / Resume */}
                        <button
                          disabled={isActing}
                          onClick={() => handleToggle(ad.id)}
                          title={ad.status === "active" ? "Pause ad" : "Resume ad"}
                          className="p-2 rounded-lg glass-card text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors"
                        >
                          {ad.status === "active"
                            ? <Pause size={14} />
                            : <Play size={14} />
                          }
                        </button>

                        {/* Delete / Confirm */}
                        {isDeletingThis ? (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={isActing}
                              onClick={() => handleDelete(ad.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 disabled:opacity-40 transition-all"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2.5 py-1.5 rounded-lg glass-card text-slate-400 text-xs hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={isActing}
                            onClick={() => setConfirmDelete(ad.id)}
                            title="Cancel ad"
                            className="p-2 rounded-lg glass-card text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-slate-500 mb-0.5">Price</div>
                      <div className="text-white font-bold">₹{ad.price.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-slate-500 mb-0.5">Remaining</div>
                      <div className="text-white font-bold">{ad.remainingQuantity.toFixed(2)} <span className="text-slate-500 font-normal">USDT</span></div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <div className="text-slate-500 mb-0.5">Limits</div>
                      <div className="text-white font-bold">₹{ad.minLimit.toLocaleString("en-IN")}–{ad.maxLimit.toLocaleString("en-IN")}</div>
                    </div>
                  </div>

                  {/* Order pipeline pills — visible only when there's activity */}
                  {(ad.activeOrdersCount > 0 || ad.completedOrdersCount > 0) && (
                    <div className="flex items-center gap-2 text-[11px]">
                      {ad.activeOrdersCount > 0 && (
                        <Link href="/p2p/orders">
                          <button className="flex items-center gap-1 px-2 py-1 rounded-full bg-electric-500/15 border border-electric-500/25 text-electric-300 font-bold hover:bg-electric-500/25 transition-colors">
                            <Activity size={11} />
                            {ad.activeOrdersCount} live
                          </button>
                        </Link>
                      )}
                      {ad.completedOrdersCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                          <CheckCircle2 size={11} />
                          {ad.completedOrdersCount} done · {ad.completedRevenueUsdt.toFixed(2)} USDT
                        </span>
                      )}
                    </div>
                  )}

                  {/* Fill bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Filled {ad.filledQuantity.toFixed(2)} / {ad.quantity.toFixed(2)} USDT</span>
                      <span>{fillPct}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ad.type === "SELL" ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Payment methods */}
                  {ad.paymentMethods.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ad.paymentMethods.map((m, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-bold">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Terms */}
                  {ad.terms && (
                    <p className="text-xs text-slate-500 border-t border-white/[0.05] pt-2">{ad.terms}</p>
                  )}
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
            // Server rejected because someone else moved the row first.
            // Refetch authoritative state and force the user to retry from scratch.
            setEditingAd(null);
            fetchAds();
          }}
        />
      )}
    </Layout>
  );
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────
// Pre-filled with the ad's current values. Sends only fields that actually
// changed so the server-side audit trail stays clean. Includes the
// `expectedUpdatedAt` for optimistic-lock — if a fill or another edit
// landed in between, the server returns 409 and we refetch.

const COMMON_METHODS = ["UPI", "BANK", "IMPS"] as const;

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
    // Build a diff against the original — sending unchanged fields is harmless
    // but wastes audit-trail bytes and obscures what the merchant actually edited.
    const body: Record<string, unknown> = { expectedUpdatedAt: ad.updatedAt };
    const pNum = parseFloat(price);
    const qNum = parseFloat(quantity);
    const minNum = parseFloat(minLimit);
    const maxNum = parseFloat(maxLimit);

    if (!isFinite(pNum) || pNum <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    if (!isFinite(qNum) || qNum <= 0) { toast({ title: "Invalid quantity", variant: "destructive" }); return; }
    if (!isFinite(minNum) || minNum <= 0) { toast({ title: "Invalid min limit", variant: "destructive" }); return; }
    if (!isFinite(maxNum) || maxNum <= 0) { toast({ title: "Invalid max limit", variant: "destructive" }); return; }
    if (minNum >= maxNum) { toast({ title: "Min limit must be less than max", variant: "destructive" }); return; }
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
      // authFetch surfaces server's `code` if present — treat 409/stale as
      // a refresh-required signal rather than a generic error.
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Edit Ad #{ad.id}</h2>
            <p className="text-slate-500 text-xs mt-0.5">{ad.type} USDT</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <Field label="Price (₹ per USDT)">
          <input
            type="number" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-base"
          />
        </Field>

        <Field
          label="Quantity (USDT)"
          hint={
            ad.type === "SELL"
              ? "Increasing locks more from Funding Wallet · decreasing returns the freed USDT"
              : `Already filled: ${ad.filledQuantity.toFixed(2)} USDT`
          }
        >
          <input
            type="number" step="0.01" value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="input-base"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min limit (₹)">
            <input
              type="number" step="1" value={minLimit}
              onChange={(e) => setMinLimit(e.target.value)}
              className="input-base"
            />
          </Field>
          <Field label="Max limit (₹)">
            <input
              type="number" step="1" value={maxLimit}
              onChange={(e) => setMaxLimit(e.target.value)}
              className="input-base"
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
                  className={`text-xs px-3 py-1.5 rounded-full border font-bold transition-colors ${
                    on
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
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
            className="input-base resize-none"
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl glass-card text-slate-300 text-sm font-bold hover:text-white disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 0.75rem;
          padding: 0.6rem 0.8rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }
        .input-base:focus { border-color: rgba(56,189,248,0.5); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}
