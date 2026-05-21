import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  ShieldCheck, Loader2, Copy, MessageCircle, Send, Star, RefreshCw, QrCode, X, Upload,
} from "lucide-react";

type SellerMethod = {
  id: number; type: string; displayName: string; upiId: string | null;
  bankName: string | null; accountHolder: string | null;
  accountNumber: string | null; ifsc: string | null;
  qrCodeData: string | null;
};
type Order = {
  id: number; adId: number; buyerId: number; sellerId: number;
  fiatAmount: number; usdtAmount: number; price: number;
  paymentMethod: string | null; status: string;
  paymentDeadline: string | null; paidAt: string | null;
  completedAt: string | null; cancelledAt: string | null;
  cancelReason: string | null; paymentRef: string | null; paymentProofUrl: string | null;
  createdAt: string; role: "buyer" | "seller";
  sellerPaymentMethods: SellerMethod[];
};
type ChatMsg = { id: number; senderId: number; message: string; isSystem: boolean; createdAt: string; senderName: string; isOwn: boolean };

const BUYER_CANCEL_REASONS = [
  "I do not want to trade anymore",
  "I do not meet the advertiser's trading requirements",
  "Technical or network error with the payment platform",
  "I have not paid but clicked 'Transferred' by mistake",
  "Other reasons",
];
const SELLER_CANCEL_REASONS = [
  "Buyer is asking for extra fee",
  "Problem with my payment method receiving funds",
  "No response from the buyer",
  "My payment account is invalid or frozen",
];

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
  return <span className={expired ? "text-red-400" : "text-amber-300 font-mono font-bold text-lg"}>{remaining}</span>;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
      {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onChange(s)} className="transition-transform hover:scale-110">
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Payment Proof Modal
  const [proofOpen, setProofOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [transferConfirmed, setTransferConfirmed] = useState(false);

  // View full proof image (seller side)
  const [proofViewer, setProofViewer] = useState<string | null>(null);

  // Cancel Reason Modal
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [unpaidConfirmed, setUnpaidConfirmed] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // QR Code modal for seller payment methods
  const [qrModal, setQrModal] = useState<SellerMethod | null>(null);

  // Rating
  const [myRating, setMyRating] = useState<{ rated: boolean; rating: number | null }>({ rated: false, rating: null });
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await authFetch<Order>(`/api/p2p/orders/${orderId}`);
      setOrder(data);
    } catch { toast({ title: "Failed to load order", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [orderId]);

  const fetchMessages = useCallback(async () => {
    try { setMessages(await authFetch<ChatMsg[]>(`/api/p2p/orders/${orderId}/messages`)); } catch {}
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder(); fetchMessages();
    pollRef.current = setInterval(fetchOrder, 15000);
    chatPollRef.current = setInterval(fetchMessages, 5000);
    return () => { clearInterval(pollRef.current!); clearInterval(chatPollRef.current!); };
  }, [fetchOrder, fetchMessages]);

  useEffect(() => {
    if (order?.status === "completed") {
      authFetch<{ rated: boolean; rating: number | null }>(`/api/p2p/orders/${orderId}/myrating`)
        .then(setMyRating).catch(() => {});
    }
  }, [order?.status]);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  async function notifySeller() {
    setActionLoading("paid");
    try {
      await authFetch(`/api/p2p/orders/${orderId}/paid`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentRef: paymentRef.trim() || undefined,
          paymentProofUrl: paymentProof || undefined,
        }),
      });
      await fetchOrder();
      setProofOpen(false);
      setPaymentProof(null);
      setProofPreview(null);
      toast({ title: "Seller notified! Waiting for confirmation." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to notify seller", variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function onProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
      toast({ title: "Only JPG, PNG or WEBP images allowed", variant: "destructive" });
      e.target.value = ""; return;
    }
    if (file.size > 450 * 1024) {
      toast({ title: "Image too large (max 450KB)", variant: "destructive" });
      e.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPaymentProof(dataUrl);
      setProofPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function confirmRelease() {
    setActionLoading("confirm");
    try {
      await authFetch(`/api/p2p/orders/${orderId}/confirm`, { method: "PATCH" });
      await fetchOrder();
      toast({ title: `USDT released to buyer's wallet!` });
    } catch (err: any) {
      toast({ title: err.message || "Failed to confirm", variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function doCancel() {
    setActionLoading("cancel");
    try {
      await authFetch(`/api/p2p/orders/${orderId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ cancelReason }),
      });
      await fetchOrder();
      setCancelOpen(false);
      toast({ title: "Order cancelled." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to cancel", variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatMsg.trim() || chatSending) return;
    setChatSending(true);
    try {
      const msg = await authFetch<ChatMsg>(`/api/p2p/orders/${orderId}/messages`, {
        method: "POST", body: JSON.stringify({ message: chatMsg }),
      });
      setMessages((prev) => [...prev, msg]);
      setChatMsg("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err: any) {
      toast({ title: err.message || "Failed to send", variant: "destructive" });
    } finally { setChatSending(false); }
  }

  async function submitRating() {
    setRatingSubmitting(true);
    try {
      await authFetch(`/api/p2p/orders/${orderId}/rate`, {
        method: "POST", body: JSON.stringify({ rating: selectedRating, comment: ratingComment || undefined }),
      });
      setMyRating({ rated: true, rating: selectedRating });
      setRatingOpen(false);
      toast({ title: "Rating submitted! Thank you." });
    } catch (err: any) {
      toast({ title: err.message || "Failed to submit", variant: "destructive" });
    } finally { setRatingSubmitting(false); }
  }

  if (loading) {
    return <Layout><div className="flex flex-col items-center py-20 gap-3"><Loader2 size={28} className="text-emerald-400 animate-spin" /><p className="text-slate-400 text-sm">Loading order…</p></div></Layout>;
  }
  if (!order) {
    return <Layout><div className="flex flex-col items-center py-20 gap-3"><AlertCircle size={28} className="text-red-400" /><p className="text-slate-300">Order not found</p><Link href="/p2p/orders"><button className="text-emerald-400 text-xs hover:underline">← My Orders</button></Link></div></Layout>;
  }

  const isBuyer = order.role === "buyer";
  const payMethods = order.sellerPaymentMethods ?? [];
  const primaryMethod = payMethods[0] ?? null;
  const methodLabel = order.paymentMethod || primaryMethod?.type || "your payment method";
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const isActive = order.status !== "completed" && order.status !== "cancelled";
  const newMsgCount = messages.filter(m => !m.isOwn && !m.isSystem).length;

  return (
    <Layout>
      <div className="max-w-xl mx-auto pb-8">

        {/* ── Binance-style status header ─────────────────────────────── */}
        <div className={`px-4 pt-4 pb-4 ${
          order.status === "pending" ? "bg-amber-500/8" :
          order.status === "paid"    ? "bg-blue-500/8" :
          order.status === "completed" ? "bg-emerald-500/8" : "bg-slate-500/8"
        }`}>
          <div className="flex items-start justify-between mb-3">
            <Link href="/p2p/orders">
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={18} /></button>
            </Link>
            {order.status === "pending" && (
              <button onClick={() => setCancelOpen(true)} className="text-slate-400 text-sm hover:text-red-400 transition-colors">
                Cancel the Order
              </button>
            )}
            {!isActive && (
              <button onClick={fetchOrder} className="p-1.5 rounded-lg text-slate-400 hover:text-white"><RefreshCw size={15} /></button>
            )}
          </div>

          {order.status === "pending" && isBuyer && (
            <>
              <h1 className="text-white font-bold text-xl mb-1">
                Transfer via {methodLabel}
              </h1>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock size={14} />
                <span>Pay the seller within</span>
                {deadline && <Countdown deadline={order.paymentDeadline!} />}
              </div>
            </>
          )}
          {order.status === "pending" && !isBuyer && (
            <h1 className="text-amber-400 font-bold text-xl">Waiting for buyer's payment</h1>
          )}
          {order.status === "paid" && !isBuyer && (
            <h1 className="text-blue-400 font-bold text-xl">Buyer has sent payment</h1>
          )}
          {order.status === "paid" && isBuyer && (
            <h1 className="text-blue-400 font-bold text-xl">Waiting for seller to confirm</h1>
          )}
          {order.status === "completed" && (
            <h1 className="text-emerald-400 font-bold text-xl">Order Completed</h1>
          )}
          {order.status === "cancelled" && (
            <h1 className="text-slate-400 font-bold text-xl">Order Cancelled</h1>
          )}

          <p className="text-slate-500 text-xs mt-1.5">
            Order #{order.id} · {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        {/* ── Order summary strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] bg-black/20 text-center">
          <div className="py-3">
            <div className="text-[10px] text-slate-500 uppercase mb-0.5">{isBuyer ? "You Pay" : "You Receive"}</div>
            <div className="text-white font-bold text-sm">₹{order.fiatAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="py-3">
            <div className="text-[10px] text-slate-500 uppercase mb-0.5">USDT</div>
            <div className="text-white font-bold text-sm">{order.usdtAmount.toFixed(4)}</div>
          </div>
          <div className="py-3">
            <div className="text-[10px] text-slate-500 uppercase mb-0.5">Price</div>
            <div className="text-slate-300 font-medium text-sm">₹{order.price.toLocaleString("en-IN")}</div>
          </div>
        </div>

        {/* ── Counterparty + Chat button ───────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {isBuyer ? "S" : "B"}
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{isBuyer ? "Seller" : "Buyer"}</div>
              <div className="text-slate-500 text-[11px]">Order #{order.id}</div>
            </div>
          </div>
          <button onClick={() => { setChatOpen(!chatOpen); setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm bg-amber-400 hover:bg-amber-300 text-black transition-colors">
            <MessageCircle size={13} />
            Chat
            {newMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{newMsgCount}</span>
            )}
          </button>
        </div>

        <div className="px-4 py-5 space-y-5">

          {/* ── BUYER PENDING: Numbered payment steps ───────────────────── */}
          {isBuyer && order.status === "pending" && (
            <>
              {payMethods.length > 0 ? (
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-400 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">1</div>
                      <span className="text-white font-semibold">Transfer via {methodLabel}</span>
                    </div>
                    {payMethods.map((m) => (
                      <div key={m.id} className="ml-11 glass-card rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
                          <span className="text-white font-semibold text-sm">{m.displayName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">{m.type}</span>
                          {m.qrCodeData && (
                            <button onClick={() => setQrModal(m)}
                              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 text-[11px] font-semibold hover:bg-purple-500/25 transition-colors">
                              <QrCode size={11} /> QR
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-slate-400 text-sm">You Pay</span>
                            <div className="flex items-center gap-1">
                              <span className="text-white font-bold">₹{order.fiatAmount.toLocaleString("en-IN")}</span>
                              <CopyBtn value={String(order.fiatAmount)} />
                            </div>
                          </div>
                          {m.accountHolder && (
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-slate-400 text-sm">Name</span>
                              <div className="flex items-center gap-1">
                                <span className="text-white">{m.accountHolder}</span>
                                <CopyBtn value={m.accountHolder} />
                              </div>
                            </div>
                          )}
                          {m.upiId && (
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-slate-400 text-sm">UPI ID</span>
                              <div className="flex items-center gap-1">
                                <span className="text-white font-mono text-sm">{m.upiId}</span>
                                <CopyBtn value={m.upiId} />
                              </div>
                            </div>
                          )}
                          {m.accountNumber && (
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-slate-400 text-sm">Account No.</span>
                              <div className="flex items-center gap-1">
                                <span className="text-white font-mono text-sm">{m.accountNumber}</span>
                                <CopyBtn value={m.accountNumber} />
                              </div>
                            </div>
                          )}
                          {m.ifsc && (
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-slate-400 text-sm">IFSC</span>
                              <div className="flex items-center gap-1">
                                <span className="text-white font-mono text-sm">{m.ifsc}</span>
                                <CopyBtn value={m.ifsc} />
                              </div>
                            </div>
                          )}
                          {m.bankName && (
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-slate-400 text-sm">Bank</span>
                              <span className="text-white text-sm">{m.bankName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0 mt-0.5">2</div>
                    <p className="text-slate-400 text-sm pt-1.5">Tap the button below to upload payment proof for seller's confirmation</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-semibold">Seller has no payment method set up</p>
                    <p className="text-slate-400 text-xs mt-1">Contact via chat or cancel the order.</p>
                  </div>
                </div>
              )}

              {/* Upload Payment Proof button */}
              <button
                onClick={() => setProofOpen(true)}
                disabled={payMethods.length === 0}
                className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-base transition-all"
              >
                Upload Payment Proof
              </button>
            </>
          )}

          {/* ── BUYER PAID: waiting ──────────────────────────────────────── */}
          {isBuyer && order.status === "paid" && (
            <div className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-blue-400 shrink-0" />
                <p className="text-blue-300 text-sm font-semibold">Payment sent — waiting for seller to verify and release USDT</p>
              </div>
              {order.paymentRef && (
                <div className="ml-7 flex items-center gap-2 text-xs text-slate-400">
                  <span>Ref:</span>
                  <span className="font-mono text-white">{order.paymentRef}</span>
                  <CopyBtn value={order.paymentRef} />
                </div>
              )}
            </div>
          )}

          {/* ── SELLER PENDING: your accounts ───────────────────────────── */}
          {!isBuyer && order.status === "pending" && (
            <>
              <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-sm font-semibold">Waiting for buyer's payment</p>
                  <p className="text-slate-400 text-xs mt-1">Buyer needs to pay ₹{order.fiatAmount.toLocaleString("en-IN")} to your account.</p>
                </div>
              </div>
              {payMethods.length > 0 && (
                <div className="glass-card rounded-xl p-4 space-y-3">
                  <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                    <ShieldCheck size={15} className="text-blue-400" />
                    Your payment accounts shown to buyer
                  </h2>
                  {payMethods.map((m) => (
                    <div key={m.id} className="bg-black/20 rounded-xl overflow-hidden border border-white/[0.06]">
                      <div className="px-3 py-2 bg-white/[0.03] flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">{m.displayName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">{m.type}</span>
                      </div>
                      <div className="divide-y divide-white/[0.05]">
                        {m.upiId && <div className="flex items-center justify-between px-3 py-2 text-xs"><span className="text-slate-500">UPI ID</span><div className="flex items-center gap-1"><span className="text-white font-mono">{m.upiId}</span><CopyBtn value={m.upiId} /></div></div>}
                        {m.accountHolder && <div className="flex items-center justify-between px-3 py-2 text-xs"><span className="text-slate-500">Holder</span><span className="text-white">{m.accountHolder}</span></div>}
                        {m.accountNumber && <div className="flex items-center justify-between px-3 py-2 text-xs"><span className="text-slate-500">Account</span><div className="flex items-center gap-1"><span className="text-white font-mono">{m.accountNumber}</span><CopyBtn value={m.accountNumber} /></div></div>}
                        {m.ifsc && <div className="flex items-center justify-between px-3 py-2 text-xs"><span className="text-slate-500">IFSC</span><div className="flex items-center gap-1"><span className="text-white font-mono">{m.ifsc}</span><CopyBtn value={m.ifsc} /></div></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SELLER PAID: confirm release ─────────────────────────────── */}
          {!isBuyer && order.status === "paid" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-300 text-sm font-semibold">Buyer has marked payment as sent</p>
                  <p className="text-slate-400 text-xs mt-1">Verify ₹{order.fiatAmount.toLocaleString("en-IN")} in your account before releasing USDT.</p>
                  {order.paymentRef && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Payment Ref:</span>
                      <span className="text-white font-mono">{order.paymentRef}</span>
                      <CopyBtn value={order.paymentRef} />
                    </div>
                  )}
                  {order.paymentProofUrl && (
                    <button
                      onClick={() => setProofViewer(order.paymentProofUrl)}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-500/20"
                    >
                      <Upload size={12} /> View Payment Screenshot
                    </button>
                  )}
                </div>
              </div>
              <button disabled={!!actionLoading} onClick={confirmRelease}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold text-base transition-all flex items-center justify-center gap-2">
                {actionLoading === "confirm" ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Confirm Receipt & Release {order.usdtAmount.toFixed(4)} USDT
              </button>
            </div>
          )}

          {/* ── COMPLETED ───────────────────────────────────────────────── */}
          {order.status === "completed" && (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <p className="text-emerald-400 font-semibold">Trade completed successfully!</p>
              </div>
              {!myRating.rated ? (
                <button onClick={() => setRatingOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all">
                  <Star size={14} /> Rate this trade
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={12} className={(myRating.rating ?? 0) >= s ? "text-amber-400 fill-amber-400" : "text-slate-600"} />)}</div>
                  <span>You rated {myRating.rating}/5 — Thank you!</span>
                </div>
              )}
            </div>
          )}

          {/* ── CANCELLED ───────────────────────────────────────────────── */}
          {order.status === "cancelled" && (
            <div className="flex items-start gap-3 bg-slate-500/5 border border-slate-500/15 rounded-xl p-4">
              <XCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-400 text-sm font-semibold">Order cancelled</p>
                {order.cancelReason && <p className="text-slate-500 text-xs mt-0.5">Reason: {order.cancelReason}</p>}
              </div>
            </div>
          )}

          {/* ── Chat Panel ──────────────────────────────────────────────── */}
          {chatOpen && (
            <div className="glass-card rounded-xl overflow-hidden border border-white/[0.08]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-emerald-400" />
                  <span className="font-semibold text-sm text-white">Trade Chat</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-white text-xs">Close ✕</button>
              </div>
              <div className="h-60 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                    <MessageCircle size={22} /><p className="text-xs">No messages yet</p>
                  </div>
                ) : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : m.isSystem ? "justify-center" : "justify-start"}`}>
                    {m.isSystem
                      ? <span className="text-[11px] text-slate-500 px-3 py-1 rounded-full bg-slate-800/60">{m.message}</span>
                      : (
                        <div className={`max-w-[80%] flex flex-col gap-0.5 ${m.isOwn ? "items-end" : "items-start"}`}>
                          {!m.isOwn && <span className="text-[10px] text-slate-500 px-1">{m.senderName}</span>}
                          <div className={`px-3 py-2 rounded-2xl text-sm ${m.isOwn ? "bg-emerald-500/20 text-emerald-100 rounded-tr-sm" : "bg-white/[0.07] text-slate-200 rounded-tl-sm"}`}>{m.message}</div>
                          <span className="text-[10px] text-slate-600 px-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )
                    }
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {isActive ? (
                <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-white/[0.06]">
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Enter message here…" maxLength={500}
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40" />
                  <button type="submit" disabled={!chatMsg.trim() || chatSending}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white">
                    {chatSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              ) : (
                <div className="px-4 py-2.5 border-t border-white/[0.06] text-center text-xs text-slate-600">Order closed — chat is read-only</div>
              )}
            </div>
          )}

          <Link href="/p2p/orders"><button className="text-slate-500 text-xs hover:text-slate-300">← All Orders</button></Link>
        </div>
      </div>

      {/* ── Payment Proof Modal ──────────────────────────────────────────── */}
      {proofOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111827] w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-bold text-lg">Payment Confirmation</h2>
            <div className="space-y-3">
              <p className="text-slate-300 text-sm font-semibold">Upload Payment Proof</p>
              <input
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="UPI Transaction ID / Reference (optional)"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40"
              />

              {proofPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40">
                  <img src={proofPreview} alt="Payment proof preview" className="w-full max-h-56 object-contain" />
                  <button
                    onClick={() => { setPaymentProof(null); setProofPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500"
                    aria-label="Remove proof"
                  >×</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-white/15 hover:border-emerald-500/40 cursor-pointer text-slate-400 hover:text-emerald-300 text-sm font-medium transition">
                  <Upload size={15} />
                  Upload Screenshot (optional, max 450KB)
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onProofFile} />
                </label>
              )}
            </div>
            <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">Do not make payments from a third-party account — it may result in account suspension.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={transferConfirmed} onChange={e => setTransferConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
              <span className="text-slate-300 text-sm">I have made the transfer with my own payment account</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setProofOpen(false)} className="flex-1 py-3 rounded-xl glass-card text-slate-400 hover:text-white text-sm">Cancel</button>
              <button disabled={!transferConfirmed || actionLoading === "paid"} onClick={notifySeller}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-sm flex items-center justify-center gap-2">
                {actionLoading === "paid" ? <Loader2 size={15} className="animate-spin" /> : null}
                Transferred, Notify Seller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Proof Viewer (seller side) ──────────────────────────── */}
      {proofViewer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setProofViewer(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setProofViewer(null)} className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm flex items-center gap-1">Close ×</button>
            <img src={proofViewer} alt="Payment proof" className="w-full max-h-[80vh] object-contain rounded-2xl border border-white/10" />
          </div>
        </div>
      )}

      {/* ── Cancel Reason Modal ──────────────────────────────────────────── */}
      {cancelOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg">Select Reason to Cancel</h2>
            <p className="text-slate-500 text-xs">Tips: Frequent cancellations may affect your account reputation.</p>

            <div className="space-y-4">
              {isBuyer && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Due to buyer</p>
                  {BUYER_CANCEL_REASONS.map((r) => (
                    <label key={r} className="flex items-start gap-3 cursor-pointer py-1">
                      <input type="radio" name="cancelReason" value={r} checked={cancelReason === r}
                        onChange={e => setCancelReason(e.target.value)} className="mt-0.5 accent-amber-400 shrink-0" />
                      <span className="text-slate-300 text-sm">{r}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Due to seller</p>
                {SELLER_CANCEL_REASONS.map((r) => (
                  <label key={r} className="flex items-start gap-3 cursor-pointer py-1">
                    <input type="radio" name="cancelReason" value={r} checked={cancelReason === r}
                      onChange={e => setCancelReason(e.target.value)} className="mt-0.5 accent-amber-400 shrink-0" />
                    <span className="text-slate-300 text-sm">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer border-t border-white/[0.06] pt-4">
              <input type="checkbox" checked={unpaidConfirmed} onChange={e => setUnpaidConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-400 shrink-0" />
              <span className="text-slate-300 text-sm">I have not paid the seller / I have received the seller's refund</span>
            </label>

            <div className="flex gap-2">
              <button onClick={() => setCancelOpen(false)} className="flex-1 py-3 rounded-xl glass-card text-slate-400 hover:text-white text-sm">Back</button>
              <button disabled={!cancelReason || !unpaidConfirmed || actionLoading === "cancel"} onClick={doCancel}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-sm flex items-center justify-center gap-2">
                {actionLoading === "cancel" ? <Loader2 size={15} className="animate-spin" /> : null}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code Modal ────────────────────────────────────────────────── */}
      {qrModal && qrModal.qrCodeData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="font-bold text-gray-900">{qrModal.displayName}</p>
                <p className="text-gray-500 text-xs">{qrModal.type}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="text-center px-5 pb-2">
              <p className="font-bold text-sm uppercase tracking-wide text-purple-600">ACCEPTED HERE</p>
              <p className="text-gray-500 text-xs mt-1">Scan & Pay Using App</p>
            </div>
            <div className="px-5 pb-5">
              <img src={qrModal.qrCodeData} alt="QR Code" className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* ── Rating Modal ─────────────────────────────────────────────────── */}
      {ratingOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2"><Star size={18} className="text-amber-400" /> Rate this Trade</h2>
            <div className="flex justify-center py-2"><StarPicker value={selectedRating} onChange={setSelectedRating} /></div>
            <div className="text-center text-sm text-slate-400">{["", "Poor", "Below Average", "Average", "Good", "Excellent"][selectedRating]}</div>
            <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="Add a comment (optional)…" rows={3} maxLength={200}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setRatingOpen(false)} className="flex-1 py-2.5 rounded-xl glass-card text-slate-400 hover:text-white text-sm">Cancel</button>
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
