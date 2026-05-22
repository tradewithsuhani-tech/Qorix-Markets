import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, CheckCircle2, XCircle,
  AlertCircle, TrendingUp, TrendingDown, RefreshCw,
} from "lucide-react";

type Order = {
  id: number; adId: number; buyerId: number; sellerId: number;
  fiatAmount: number; usdtAmount: number; price: number;
  paymentMethod: string | null; status: string;
  paymentDeadline: string | null; paidAt: string | null;
  completedAt: string | null; cancelledAt: string | null;
  createdAt: string; adType: string | null; role: "buyer" | "seller";
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending Payment", color: "text-amber-400", icon: Clock },
  paid:      { label: "Payment Sent",    color: "text-blue-400",  icon: CheckCircle2 },
  completed: { label: "Completed",       color: "text-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled",       color: "text-slate-500",  icon: XCircle },
  disputed:  { label: "In Dispute",      color: "text-red-400",    icon: AlertCircle },
};

function OrderCard({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending!;
  const Icon = cfg.icon;
  const isBuyer = order.role === "buyer";
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const now = new Date();
  const expired = deadline && now > deadline && order.status === "pending";

  return (
    <Link href={`/p2p/orders/${order.id}`}>
    <div className={`glass-card rounded-xl p-4 space-y-3 cursor-pointer transition-colors border-l-4 ${isBuyer ? "border-l-emerald-500/70" : "border-l-red-500/70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBuyer ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
            {isBuyer ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-red-400" />}
          </div>
          <div>
            <div className="text-white font-semibold text-sm capitalize">
              {isBuyer ? "Buying" : "Selling"} USDT
            </div>
            <div className="text-slate-500 text-xs">Order #{order.id} · {new Date(order.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
          <Icon size={13} />
          {expired ? "Expired" : cfg.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-slate-500 text-xs mb-0.5">USDT</div>
          <div className="text-white font-bold">{order.usdtAmount.toFixed(4)}</div>
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-0.5">Amount (₹)</div>
          <div className="text-white font-bold">₹{order.fiatAmount.toLocaleString("en-IN")}</div>
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-0.5">Rate</div>
          <div className="text-slate-300">₹{order.price.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {order.paymentMethod && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Payment:</span>
          <span className="text-slate-300 font-medium">{order.paymentMethod}</span>
        </div>
      )}

      {order.status === "pending" && deadline && !expired && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
          <Clock size={12} />
          Pay before {deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {isBuyer && " · then mark as paid"}
        </div>
      )}

      {order.status === "pending" && expired && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
          <XCircle size={12} />
          Payment deadline passed — order may be cancelled
        </div>
      )}
    </div>
    </Link>
  );
}

export default function P2POrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await authFetch<Order[]>("/api/p2p/orders/my");
      setOrders(data);
    } catch {
      if (!silent) toast({ title: "Failed to load orders", variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();

    const interval = setInterval(() => loadOrders(true), 10000);

    function onVisible() {
      if (document.visibilityState === "visible") loadOrders(true);
    }
    function onFocus() { loadOrders(true); }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">{orders.length} total orders</p>
          <button onClick={() => loadOrders()} className="p-2 rounded-xl glass-card text-slate-400 hover:text-white" aria-label="Refresh orders">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "paid", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "glass-card text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl h-32 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3 text-center">
            <AlertCircle size={32} className="text-slate-600" />
            <div>
              <p className="text-white font-semibold text-sm">No orders yet</p>
              <p className="text-slate-500 text-xs mt-1 max-w-[260px]">
                Orders appear here when you trade with someone. If you posted a SELL ad, buyers will create orders against it — check <span className="text-emerald-400">My Ads</span> to see your listings.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Link href="/p2p/ads/my">
                <button className="text-emerald-400 text-xs px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">My Ads →</button>
              </Link>
              <Link href="/p2p">
                <button className="text-slate-400 text-xs px-4 py-2 glass-card rounded-xl">Browse market</button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {filtered.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
