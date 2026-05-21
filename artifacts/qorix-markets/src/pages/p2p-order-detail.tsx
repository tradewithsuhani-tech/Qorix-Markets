import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  ShieldCheck, Loader2, TrendingUp, TrendingDown, Copy,
} from "lucide-react";

type Order = {
  id: number; adId: number; buyerId: number; sellerId: number;
  fiatAmount: number; usdtAmount: number; price: number;
  paymentMethod: string | null; status: string;
  paymentDeadline: string | null; paidAt: string | null;
  completedAt: string | null; cancelledAt: string | null;
  createdAt: string; role: "buyer" | "seller";
};

type SellerMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null; ifsc: string | null;
};

type AdDetail = { sellerPaymentMethods: SellerMethod[]; type: string; advertiserName: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending Payment", color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",    icon: Clock },
  paid:      { label: "Payment Sent",    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",      icon: CheckCircle2 },
  completed: { label: "Completed",       color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled",       color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",    icon: XCircle },
  disputed:  { label: "In Dispute",      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",        icon: AlertCircle },
};

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function tick() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setExpired(true); setRemaining("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  return (
    <span className={expired ? "text-red-400" : "text-amber-300 font-mono font-bold"}>{remaining}</span>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-slate-500 hover:text-emerald-400 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

export default function P2POrderDetailPage() {
  const [, params] = useRoute<{ id: string }>("/p2p/orders/:id");
  const { toast } = useToast();

  const orderId = parseInt(params?.id ?? "0");

  const [order, setOrder] = useState<Order | null>(null);
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await authFetch<Order>(`/api/p2p/orders/${orderId}`);
      setOrder(data);
      if (!ad) {
        const adData = await authFetch<AdDetail>(`/api/p2p/ads/${data.adId}`);
        setAd(adData);
      }
    } catch {
      toast({ title: "Failed to load order", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
    // Poll every 15s for live status updates
    pollRef.current = setInterval(fetchOrder, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  async function doAction(action: "paid" | "confirm" | "cancel") {
    setActionLoading(action);
    try {
      await authFetch(`/api/p2p/orders/${orderId}/${action}`, { method: "PATCH" });
      await fetchOrder();
      const msgs = { paid: "Payment marked! Waiting for seller to confirm.", confirm: "Payment confirmed! USDT released to buyer.", cancel: "Order cancelled." };
      toast({ title: msgs[action] });
    } catch (err: any) {
      toast({ title: err.message || `Failed to ${action}`, variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmCancelOpen(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading order…</p>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-3">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-slate-300 text-sm">Order not found</p>
          <Link href="/p2p/orders"><button className="text-emerald-400 text-xs hover:underline">← My Orders</button></Link>
        </div>
      </Layout>
    );
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending!;
  const StatusIcon = cfg.icon;
  const isBuyer = order.role === "buyer";
  const isSellAd = ad?.type === "SELL";
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const deadlineExpired = deadline && Date.now() > deadline.getTime();

  // Seller's payment methods (for buyer to pay to)
  const payMethods = ad?.sellerPaymentMethods ?? [];

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/p2p/orders">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Order #{order.id}</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {isBuyer ? "You are buying" : "You are selling"} USDT · {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button onClick={fetchOrder} className="p-2 rounded-xl glass-card text-slate-400 hover:text-white" title="Refresh">
            <Loader2 size={15} className={actionLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Status banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
          <StatusIcon size={18} className={cfg.color} />
          <div className="flex-1">
            <div className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</div>
            {order.status === "pending" && deadline && !deadlineExpired && (
              <div className="text-xs text-slate-400 mt-0.5">
                Pay within <Countdown deadline={order.paymentDeadline!} />
              </div>
            )}
            {order.status === "pending" && deadlineExpired && (
              <div className="text-xs text-red-400 mt-0.5">Payment deadline passed</div>
            )}
          </div>
        </div>

        {/* Order summary */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            {isBuyer
              ? <TrendingUp size={15} className="text-emerald-400" />
              : <TrendingDown size={15} className="text-red-400" />
            }
            <span className="text-white font-semibold text-sm">
              {isBuyer ? "Buying" : "Selling"} USDT from {ad?.advertiserName ?? "advertiser"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">You {isBuyer ? "pay" : "receive"} (₹)</div>
              <div className="text-white font-bold text-sm">₹{order.fiatAmount.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">You {isBuyer ? "get" : "give"} (USDT)</div>
              <div className="text-white font-bold text-sm">{order.usdtAmount.toFixed(4)}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">Rate</div>
              <div className="text-slate-300 font-medium">₹{order.price.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>

        {/* Payment instructions for buyer (SELL ad) */}
        {isBuyer && isSellAd && order.status === "pending" && payMethods.length > 0 && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-400" />
              Pay ₹{order.fiatAmount.toLocaleString("en-IN")} to seller
            </h2>
            <p className="text-slate-400 text-xs">Send payment to one of these accounts, then click "I've Paid".</p>
            {payMethods.map((m) => (
              <div key={m.id} className="bg-black/30 rounded-xl p-3 space-y-2 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-semibold">{m.displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">{m.type}</span>
                </div>
                {m.upiId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">UPI ID</span>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-mono font-medium">{m.upiId}</span>
                      <CopyBtn value={m.upiId} />
                    </div>
                  </div>
                )}
                {m.accountHolder && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Account Holder</span>
                    <span className="text-white font-medium">{m.accountHolder}</span>
                  </div>
                )}
                {m.accountNumber && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Account Number</span>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-mono font-medium">{m.accountNumber}</span>
                      <CopyBtn value={m.accountNumber} />
                    </div>
                  </div>
                )}
                {m.ifsc && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">IFSC</span>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-mono font-medium">{m.ifsc}</span>
                      <CopyBtn value={m.ifsc} />
                    </div>
                  </div>
                )}
                {m.bankName && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Bank</span>
                    <span className="text-white font-medium">{m.bankName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Seller waiting for payment */}
        {!isBuyer && order.status === "pending" && (
          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
            <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-semibold">Waiting for buyer's payment</p>
              <p className="text-slate-400 text-xs mt-1">The buyer needs to pay ₹{order.fiatAmount.toLocaleString("en-IN")} and mark as paid.</p>
            </div>
          </div>
        )}

        {/* Seller: payment marked, needs to confirm */}
        {!isBuyer && order.status === "paid" && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 text-sm font-semibold">Buyer has marked payment as sent</p>
              <p className="text-slate-400 text-xs mt-1">Check your bank/UPI for ₹{order.fiatAmount.toLocaleString("en-IN")}. Confirm to release {order.usdtAmount.toFixed(4)} USDT to buyer.</p>
            </div>
          </div>
        )}

        {/* Buyer: waiting for seller to confirm */}
        {isBuyer && order.status === "paid" && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <Clock size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 text-sm font-semibold">Payment marked — waiting for seller</p>
              <p className="text-slate-400 text-xs mt-1">The seller will confirm your payment and release {order.usdtAmount.toFixed(4)} USDT to your Funding Wallet.</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {/* Buyer: mark as paid */}
          {isBuyer && order.status === "pending" && (
            <button
              disabled={!!actionLoading}
              onClick={() => doAction("paid")}
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {actionLoading === "paid" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              I've Sent the Payment
            </button>
          )}

          {/* Seller: confirm payment */}
          {!isBuyer && order.status === "paid" && (
            <button
              disabled={!!actionLoading}
              onClick={() => doAction("confirm")}
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {actionLoading === "confirm" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Confirm Payment & Release {order.usdtAmount.toFixed(4)} USDT
            </button>
          )}

          {/* Cancel (pending only, both parties) */}
          {(order.status === "pending") && (
            confirmCancelOpen ? (
              <div className="flex gap-2">
                <button
                  disabled={!!actionLoading}
                  onClick={() => doAction("cancel")}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 transition-all text-sm"
                >
                  {actionLoading === "cancel" ? "Cancelling…" : "Yes, Cancel Order"}
                </button>
                <button
                  onClick={() => setConfirmCancelOpen(false)}
                  className="flex-1 py-2.5 rounded-xl glass-card text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Keep Order
                </button>
              </div>
            ) : (
              <button
                disabled={!!actionLoading}
                onClick={() => setConfirmCancelOpen(true)}
                className="w-full py-2.5 rounded-xl glass-card text-slate-400 hover:text-red-400 text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle size={15} /> Cancel Order
              </button>
            )
          )}
        </div>

        {/* Completed / cancelled info */}
        {order.status === "completed" && (
          <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <div>
              <p className="text-emerald-400 text-sm font-semibold">Trade completed!</p>
              <p className="text-slate-400 text-xs mt-0.5">{order.usdtAmount.toFixed(4)} USDT released to buyer's Funding Wallet.</p>
            </div>
          </div>
        )}

        {order.status === "cancelled" && (
          <div className="flex items-center gap-3 bg-slate-500/5 border border-slate-500/15 rounded-xl p-4">
            <XCircle size={16} className="text-slate-400" />
            <p className="text-slate-400 text-sm">Order was cancelled. Ad quantity has been restored.</p>
          </div>
        )}

        <Link href="/p2p/orders">
          <button className="text-slate-500 text-xs hover:text-slate-300 transition-colors">← All Orders</button>
        </Link>
      </div>
    </Layout>
  );
}
