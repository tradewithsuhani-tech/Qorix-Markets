import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pause, Play, Trash2, AlertCircle,
  TrendingUp, TrendingDown, RefreshCw,
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
    </Layout>
  );
}
