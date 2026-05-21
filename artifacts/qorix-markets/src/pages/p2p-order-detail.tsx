import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  ShieldCheck, Loader2, TrendingUp, TrendingDown, Copy,
  MessageCircle, Send, Star, RefreshCw,
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
  id: number; type: string; displayName: string; upiId: string | null;
  bankName: string | null; accountHolder: string | null;
  accountNumber: string | null; ifsc: string | null;
};
type AdDetail = { sellerPaymentMethods: SellerMethod[]; type: string; advertiserName: string };
type ChatMsg = { id: number; senderId: number; message: string; isSystem: boolean; createdAt: string; senderName: string; isOwn: boolean };

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
  return <span className={expired ? "text-red-400" : "text-amber-300 font-mono font-bold"}>{remaining}</span>;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-slate-500 hover:text-emerald-400 transition-colors" title="Copy">
      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110">
          <Star size={28} className={`${(hover || value) >= s ? "text-amber-400 fill-amber-400" : "text-slate-600"} transition-colors`} />
        </button>
      ))}
    </div>
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

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rating state
  const [myRating, setMyRating] = useState<{ rated: boolean; rating: number | null }>({ rated: false, rating: null });
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

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

  const fetchMessages = useCallback(async () => {
    try {
      const data = await authFetch<ChatMsg[]>(`/api/p2p/orders/${orderId}/messages`);
      setMessages(data);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
    fetchMessages();
    pollRef.current = setInterval(fetchOrder, 15000);
    chatPollRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [fetchOrder, fetchMessages]);

  useEffect(() => {
    if (order?.status === "completed") {
      authFetch<{ rated: boolean; rating: number | null }>(`/api/p2p/orders/${orderId}/myrating`)
        .then((d) => setMyRating(d)).catch(() => {});
    }
  }, [order?.status]);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  async function doAction(action: "paid" | "confirm" | "cancel") {
    setActionLoading(action);
    try {
      await authFetch(`/api/p2p/orders/${orderId}/${action}`, { method: "PATCH" });
      await fetchOrder();
      const msgs = { paid: "Payment marked! Waiting for seller to confirm.", confirm: "USDT released to buyer's wallet!", cancel: "Order cancelled." };
      toast({ title: msgs[action] });
      if (action === "confirm") fetchMessages();
    } catch (err: any) {
      toast({ title: err.message || `Failed to ${action}`, variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmCancelOpen(false);
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatMsg.trim() || chatSending) return;
    setChatSending(true);
    try {
      const msg = await authFetch<ChatMsg>(`/api/p2p/orders/${orderId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: chatMsg }),
      });
      setMessages((prev) => [...prev, msg]);
      setChatMsg("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err: any) {
      toast({ title: err.message || "Failed to send", variant: "destructive" });
    } finally {
      setChatSending(false);
    }
  }

  async function submitRating() {
    setRatingSubmitting(true);
    try {
      await authFetch(`/api/p2p/orders/${orderId}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating: selectedRating, comment: ratingComment || undefined }),
      });
      setMyRating({ rated: true, rating: selectedRating });
      setRatingOpen(false);
      toast({ title: "Rating submitted! Thank you." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to submit", variant: "destructive" });
    } finally {
      setRatingSubmitting(false);
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
  const payMethods = ad?.sellerPaymentMethods ?? [];
  const isActive = order.status !== "completed" && order.status !== "cancelled";

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/p2p/orders">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white"><ArrowLeft size={16} /></button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Order #{order.id}</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {isBuyer ? "You are buying" : "You are selling"} USDT · {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button onClick={fetchOrder} className="p-2 rounded-xl glass-card text-slate-400 hover:text-white" title="Refresh">
            <RefreshCw size={15} className={actionLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Status banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
          <StatusIcon size={18} className={cfg.color} />
          <div className="flex-1">
            <div className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</div>
            {order.status === "pending" && deadline && !deadlineExpired && (
              <div className="text-xs text-slate-400 mt-0.5">Pay within <Countdown deadline={order.paymentDeadline!} /></div>
            )}
            {order.status === "pending" && deadlineExpired && (
              <div className="text-xs text-red-400 mt-0.5">Payment deadline passed</div>
            )}
          </div>
        </div>

        {/* Order summary */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            {isBuyer ? <TrendingUp size={15} className="text-emerald-400" /> : <TrendingDown size={15} className="text-red-400" />}
            <span className="text-white font-semibold text-sm">
              {isBuyer ? "Buying" : "Selling"} USDT {ad?.advertiserName ? `· ${ad.advertiserName}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">You {isBuyer ? "pay" : "receive"}</div>
              <div className="text-white font-bold text-sm">₹{order.fiatAmount.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">USDT amount</div>
              <div className="text-white font-bold text-sm">{order.usdtAmount.toFixed(4)}</div>
            </div>
            <div className="bg-black/20 rounded-lg p-2.5">
              <div className="text-slate-500 mb-0.5">Rate</div>
              <div className="text-slate-300 font-medium">₹{order.price.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>

        {/* Buyer payment instructions (SELL ad, pending) */}
        {isBuyer && isSellAd && order.status === "pending" && payMethods.length > 0 && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-400" />
              Pay ₹{order.fiatAmount.toLocaleString("en-IN")} to seller
            </h2>
            <p className="text-slate-400 text-xs">Send to one of these accounts, then click "I've Paid".</p>
            {payMethods.map((m) => (
              <div key={m.id} className="bg-black/30 rounded-xl p-3 space-y-2 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-semibold">{m.displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">{m.type}</span>
                </div>
                {m.upiId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">UPI ID</span>
                    <div className="flex items-center gap-1"><span className="text-white font-mono">{m.upiId}</span><CopyBtn value={m.upiId} /></div>
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
                    <span className="text-slate-500">Account No.</span>
                    <div className="flex items-center gap-1"><span className="text-white font-mono">{m.accountNumber}</span><CopyBtn value={m.accountNumber} /></div>
                  </div>
                )}
                {m.ifsc && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">IFSC</span>
                    <div className="flex items-center gap-1"><span className="text-white font-mono">{m.ifsc}</span><CopyBtn value={m.ifsc} /></div>
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

        {/* Waiting messages */}
        {!isBuyer && order.status === "pending" && (
          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
            <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-semibold">Waiting for buyer's payment</p>
              <p className="text-slate-400 text-xs mt-1">Buyer needs to pay ₹{order.fiatAmount.toLocaleString("en-IN")} and mark as paid.</p>
            </div>
          </div>
        )}
        {!isBuyer && order.status === "paid" && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 text-sm font-semibold">Buyer has marked payment as sent</p>
              <p className="text-slate-400 text-xs mt-1">Check your account for ₹{order.fiatAmount.toLocaleString("en-IN")} before confirming.</p>
            </div>
          </div>
        )}
        {isBuyer && order.status === "paid" && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <Clock size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-300 text-sm font-semibold">Waiting for seller to confirm</p>
              <p className="text-slate-400 text-xs mt-1">Seller will verify and release {order.usdtAmount.toFixed(4)} USDT to your wallet.</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {isBuyer && order.status === "pending" && (
            <button disabled={!!actionLoading} onClick={() => doAction("paid")}
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {actionLoading === "paid" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              I've Sent the Payment
            </button>
          )}
          {!isBuyer && order.status === "paid" && (
            <button disabled={!!actionLoading} onClick={() => doAction("confirm")}
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {actionLoading === "confirm" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Confirm Payment & Release {order.usdtAmount.toFixed(4)} USDT
            </button>
          )}
          {order.status === "pending" && (
            confirmCancelOpen ? (
              <div className="flex gap-2">
                <button disabled={!!actionLoading} onClick={() => doAction("cancel")}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 text-sm">
                  {actionLoading === "cancel" ? "Cancelling…" : "Yes, Cancel Order"}
                </button>
                <button onClick={() => setConfirmCancelOpen(false)}
                  className="flex-1 py-2.5 rounded-xl glass-card text-slate-400 hover:text-white text-sm">
                  Keep Order
                </button>
              </div>
            ) : (
              <button disabled={!!actionLoading} onClick={() => setConfirmCancelOpen(true)}
                className="w-full py-2.5 rounded-xl glass-card text-slate-400 hover:text-red-400 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <XCircle size={15} /> Cancel Order
              </button>
            )
          )}
        </div>

        {/* Completed info + rating */}
        {order.status === "completed" && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <p className="text-emerald-400 text-sm font-semibold">Trade completed successfully!</p>
            </div>
            {!myRating.rated ? (
              <button onClick={() => setRatingOpen(true)}
                className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all">
                <Star size={15} /> Rate this trade
              </button>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={12} className={(myRating.rating ?? 0) >= s ? "text-amber-400 fill-amber-400" : "text-slate-600"} />
                  ))}
                </div>
                <span>You rated {myRating.rating}/5 — Thank you!</span>
              </div>
            )}
          </div>
        )}

        {order.status === "cancelled" && (
          <div className="flex items-center gap-3 bg-slate-500/5 border border-slate-500/15 rounded-xl p-4">
            <XCircle size={16} className="text-slate-400" />
            <p className="text-slate-400 text-sm">Order cancelled. Ad quantity restored.</p>
          </div>
        )}

        {/* ─── Chat Panel ─────────────────────────────────────────────────── */}
        <div className="glass-card rounded-xl overflow-hidden">
          <button onClick={() => setChatOpen(!chatOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-white hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-2.5">
              <MessageCircle size={16} className="text-emerald-400" />
              <span className="font-semibold text-sm">Trade Chat</span>
              {messages.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">{messages.length}</span>
              )}
            </div>
            <span className="text-slate-500 text-xs">{chatOpen ? "▲" : "▼"}</span>
          </button>

          {chatOpen && (
            <div className="border-t border-white/[0.06]">
              {/* Messages */}
              <div className="h-64 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                    <MessageCircle size={24} />
                    <p className="text-xs">No messages yet. Say hello!</p>
                  </div>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : "justify-start"} ${m.isSystem ? "justify-center" : ""}`}>
                    {m.isSystem ? (
                      <span className="text-[11px] text-slate-500 px-3 py-1 rounded-full bg-slate-800/50">{m.message}</span>
                    ) : (
                      <div className={`max-w-[80%] ${m.isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                        {!m.isOwn && (
                          <span className="text-[10px] text-slate-500 px-1">{m.senderName}</span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm ${m.isOwn ? "bg-emerald-500/20 text-emerald-100 rounded-tr-sm" : "bg-white/[0.07] text-slate-200 rounded-tl-sm"}`}>
                          {m.message}
                        </div>
                        <span className="text-[10px] text-slate-600 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {isActive ? (
                <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-white/[0.06]">
                  <input
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={500}
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40 transition-colors"
                  />
                  <button type="submit" disabled={!chatMsg.trim() || chatSending}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white transition-all">
                    {chatSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              ) : (
                <div className="px-4 py-2.5 border-t border-white/[0.06] text-center text-xs text-slate-600">
                  This order is closed. Chat is read-only.
                </div>
              )}
            </div>
          )}
        </div>

        <Link href="/p2p/orders">
          <button className="text-slate-500 text-xs hover:text-slate-300 transition-colors">← All Orders</button>
        </Link>
      </div>

      {/* Rating Modal */}
      {ratingOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Star size={18} className="text-amber-400" /> Rate this Trade
            </h2>
            <p className="text-slate-400 text-sm">How was your experience with the counterparty?</p>
            <div className="flex justify-center py-2">
              <StarRating value={selectedRating} onChange={setSelectedRating} />
            </div>
            <div className="text-center text-sm text-slate-400">
              {["", "Poor", "Below Average", "Average", "Good", "Excellent"][selectedRating]}
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Add a comment (optional)…"
              rows={3}
              maxLength={200}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setRatingOpen(false)}
                className="flex-1 py-2.5 rounded-xl glass-card text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
              <button onClick={submitRating} disabled={ratingSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {ratingSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
