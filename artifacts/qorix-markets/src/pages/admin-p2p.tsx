import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowUpDown, Activity, ListChecks, AlertTriangle, Pause, Play, X, Loader2, Search, Wallet, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";

interface Overview {
  ads: { total: number; active: number; paused: number };
  orders: { total: number; pending: number; paid: number; disputed: number; completedToday: number; volume24hUsdt: string; volume24hInr: string };
  escrowHeldUsdt: string;
  openDisputes: number;
}
interface AdRow {
  id: number; userId: number; type: string; asset: string;
  price: string; quantity: string; filledQuantity: string;
  minLimit: string; maxLimit: string; status: string;
  createdAt: string; userEmail: string | null; userName: string | null;
}
interface OrderRow {
  id: number; adId: number; buyerId: number; sellerId: number;
  fiatAmount: string; usdtAmount: string; price: string;
  status: string; paymentMethod: string | null;
  createdAt: string; paidAt: string | null; completedAt: string | null;
}

const ORDER_STATUSES = ["all", "pending", "paid", "completed", "cancelled", "disputed"];
const AD_STATUSES = ["all", "active", "paused", "completed", "cancelled"];

function num(v: string | number | null | undefined) { return Number(v ?? 0); }

function StatCard({ label, value, hint, color = "blue", icon: Icon }: any) {
  const colors: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-500/0 border-blue-500/20 text-blue-300",
    emerald: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/20 text-emerald-300",
    orange: "from-orange-500/10 to-orange-500/0 border-orange-500/20 text-orange-300",
    purple: "from-purple-500/10 to-purple-500/0 border-purple-500/20 text-purple-300",
  };
  return (
    <div className={`bg-gradient-to-b ${colors[color]} border rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={13} />}
        <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      </div>
      <div className="text-white text-lg font-bold">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function AdminP2pPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "ads" | "orders">("overview");
  const [adStatus, setAdStatus] = useState("all");
  const [adType, setAdType] = useState("all");
  const [adSearch, setAdSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");

  const { data: overview, isLoading: ovLoading } = useQuery<Overview>({
    queryKey: ["admin-p2p-overview"],
    queryFn: () => authFetch(`/api/admin/p2p/overview`),
    refetchInterval: 30000,
    enabled: tab === "overview",
  });

  const { data: adsData, isLoading: adsLoading } = useQuery<{ ads: AdRow[] }>({
    queryKey: ["admin-p2p-ads", adStatus, adType, adSearch],
    queryFn: () => {
      const p = new URLSearchParams({ status: adStatus, type: adType });
      if (adSearch.trim()) p.set("search", adSearch.trim());
      return authFetch(`/api/admin/p2p/ads?${p.toString()}`);
    },
    enabled: tab === "ads",
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: OrderRow[] }>({
    queryKey: ["admin-p2p-orders", orderStatus, orderSearch],
    queryFn: () => {
      const p = new URLSearchParams({ status: orderStatus });
      if (orderSearch.trim()) p.set("search", orderSearch.trim());
      return authFetch(`/api/admin/p2p/orders?${p.toString()}`);
    },
    enabled: tab === "orders",
  });

  const adAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "pause" | "resume" | "disable" }) =>
      authFetch(`/api/admin/p2p/ads/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
    onSuccess: (_d, vars) => {
      toast({ title: `Ad ${vars.action === "pause" ? "paused" : vars.action === "resume" ? "resumed" : "disabled"}` });
      qc.invalidateQueries({ queryKey: ["admin-p2p-ads"] });
      qc.invalidateQueries({ queryKey: ["admin-p2p-overview"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err?.message || "Action failed", variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center"><ArrowUpDown className="text-blue-400" size={20} /></div>
            <div>
              <h1 className="text-white font-bold text-xl">P2P Operations</h1>
              <p className="text-slate-500 text-xs">Monitor ads, orders and escrow across the marketplace</p>
            </div>
          </div>
          <Link href="/admin/p2p-disputes">
            <button className="px-3 py-2 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-semibold flex items-center gap-1.5">
              <AlertTriangle size={13} />Disputes{overview && overview.openDisputes > 0 ? ` (${overview.openDisputes})` : ""}
            </button>
          </Link>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-white/[0.06]">
          {([
            { id: "overview", label: "Overview", icon: Activity },
            { id: "ads", label: "Ads", icon: ListChecks },
            { id: "orders", label: "Orders", icon: TrendingUp },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          ovLoading || !overview ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="Active Ads" value={overview.ads.active} hint={`${overview.ads.paused} paused · ${overview.ads.total} total`} color="blue" icon={ListChecks} />
                <StatCard label="Orders Pending" value={overview.orders.pending} hint={`${overview.orders.paid} paid awaiting confirm`} color="orange" icon={Activity} />
                <StatCard label="Open Disputes" value={overview.openDisputes} hint={overview.orders.disputed + " disputed orders"} color="orange" icon={AlertTriangle} />
                <StatCard label="Escrow Held" value={`${num(overview.escrowHeldUsdt).toFixed(2)} USDT`} hint="In active escrow" color="purple" icon={Wallet} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <StatCard label="Completed (24h)" value={overview.orders.completedToday} color="emerald" icon={TrendingUp} />
                <StatCard label="Volume 24h (USDT)" value={num(overview.orders.volume24hUsdt).toFixed(2)} color="emerald" icon={TrendingUp} />
                <StatCard label="Volume 24h (INR)" value={`₹${Math.round(num(overview.orders.volume24hInr)).toLocaleString("en-IN")}`} color="emerald" icon={TrendingUp} />
              </div>
            </div>
          )
        )}

        {/* ADS */}
        {tab === "ads" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1">
                {AD_STATUSES.map(s => (
                  <button key={s} onClick={() => setAdStatus(s)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${adStatus === s ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {["all", "BUY", "SELL"].map(t => (
                  <button key={t} onClick={() => setAdType(t)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${adType === t ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={adSearch} onChange={e => setAdSearch(e.target.value)}
                  placeholder="Ad ID or User ID…"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
              </div>
            </div>

            {adsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : !adsData?.ads?.length ? (
              <div className="text-center py-10 text-slate-500 text-sm bg-white/[0.02] border border-white/[0.05] rounded-xl">No ads.</div>
            ) : (
              <div className="overflow-x-auto bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">ID</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Advertiser</th>
                      <th className="text-right px-3 py-2 font-medium">Price</th>
                      <th className="text-right px-3 py-2 font-medium">Available</th>
                      <th className="text-right px-3 py-2 font-medium">Limits (INR)</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {adsData.ads.map(a => {
                      const remaining = num(a.quantity) - num(a.filledQuantity);
                      return (
                        <tr key={a.id} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-slate-300">#{a.id}</td>
                          <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.type === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{a.type}</span></td>
                          <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate">{a.userName || `User #${a.userId}`}<br /><span className="text-[10px] text-slate-600">{a.userEmail}</span></td>
                          <td className="px-3 py-2 text-right text-white">₹{num(a.price).toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{remaining.toFixed(2)} / {num(a.quantity).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-slate-400">₹{num(a.minLimit).toLocaleString("en-IN")} – ₹{num(a.maxLimit).toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            a.status === "active" ? "bg-emerald-500/15 text-emerald-300" :
                            a.status === "paused" ? "bg-amber-500/15 text-amber-300" :
                            a.status === "cancelled" ? "bg-red-500/15 text-red-300" :
                            "bg-slate-500/15 text-slate-300"
                          }`}>{a.status}</span></td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {a.status === "active" && (
                                <button disabled={adAction.isPending}
                                  onClick={() => adAction.mutate({ id: a.id, action: "pause" })}
                                  title="Pause"
                                  className="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 disabled:opacity-40">
                                  <Pause size={12} />
                                </button>
                              )}
                              {a.status === "paused" && (
                                <button disabled={adAction.isPending}
                                  onClick={() => adAction.mutate({ id: a.id, action: "resume" })}
                                  title="Resume"
                                  className="p-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 disabled:opacity-40">
                                  <Play size={12} />
                                </button>
                              )}
                              {(a.status === "active" || a.status === "paused") && (
                                <button disabled={adAction.isPending}
                                  onClick={() => { if (confirm(`Disable ad #${a.id}? This cannot be undone.`)) adAction.mutate({ id: a.id, action: "disable" }); }}
                                  title="Disable permanently"
                                  className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 disabled:opacity-40">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab === "orders" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1 flex-wrap">
                {ORDER_STATUSES.map(s => (
                  <button key={s} onClick={() => setOrderStatus(s)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium ${orderStatus === s ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Order/Ad/Buyer/Seller ID…"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
              </div>
            </div>

            {ordersLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : !ordersData?.orders?.length ? (
              <div className="text-center py-10 text-slate-500 text-sm bg-white/[0.02] border border-white/[0.05] rounded-xl">No orders.</div>
            ) : (
              <div className="overflow-x-auto bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Order</th>
                      <th className="text-left px-3 py-2 font-medium">Parties</th>
                      <th className="text-right px-3 py-2 font-medium">USDT</th>
                      <th className="text-right px-3 py-2 font-medium">Fiat</th>
                      <th className="text-right px-3 py-2 font-medium">Price</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {ordersData.orders.map(o => (
                      <tr key={o.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-300">#{o.id}<br /><span className="text-[10px] text-slate-600">Ad #{o.adId}</span></td>
                        <td className="px-3 py-2 text-slate-300">B:#{o.buyerId}<br />S:#{o.sellerId}</td>
                        <td className="px-3 py-2 text-right text-white">{num(o.usdtAmount).toFixed(4)}</td>
                        <td className="px-3 py-2 text-right text-white">₹{num(o.fiatAmount).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right text-slate-400">₹{num(o.price).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          o.status === "completed" ? "bg-emerald-500/15 text-emerald-300" :
                          o.status === "pending" ? "bg-amber-500/15 text-amber-300" :
                          o.status === "paid" ? "bg-blue-500/15 text-blue-300" :
                          o.status === "disputed" ? "bg-orange-500/15 text-orange-300" :
                          "bg-slate-500/15 text-slate-300"
                        }`}>{o.status}</span></td>
                        <td className="px-3 py-2 text-slate-400 text-[10px]">{format(new Date(o.createdAt), "MMM d HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
