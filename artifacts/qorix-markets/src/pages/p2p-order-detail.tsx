import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  ShieldCheck, Loader2, Copy, MessageCircle, Send, Star, RefreshCw, QrCode, X, Upload,
  User, Paperclip, FileText, Image as ImageIcon,
} from "lucide-react";
import { MerchantProfileModal } from "@/components/p2p-merchant-profile-modal";
import QRCode from "qrcode";

/** Auto-generates a UPI QR code on a canvas — same as deposit-upi-pay.tsx */
function UpiQrCanvas({ upiId, amount, name, orderId, size = 192 }: {
  upiId: string; amount: number; name?: string | null; orderId: number; size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const pn = encodeURIComponent(name ?? "Seller");
    const tn = encodeURIComponent(`P2P-${orderId}`);
    const uri = `upi://pay?pa=${upiId}&pn=${pn}&am=${amount}&cu=INR&tn=${tn}`;
    QRCode.toCanvas(canvasRef.current, uri, {
      width: size,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    }).catch(() => {});
  }, [upiId, amount, name, orderId, size]);
  return <canvas ref={canvasRef} />;
}

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
type ChatMsg = { id: number; senderId: number; message: string; isSystem: boolean; createdAt: string; senderName: string; isOwn: boolean; attachmentData?: string | null; attachmentType?: string | null };

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
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [transferConfirmed, setTransferConfirmed] = useState(false);

  // View full proof image (seller side)
  const [proofViewer, setProofViewer] = useState<string | null>(null);

  // Cancel Reason Modal
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState<string | null>(null);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [unpaidConfirmed, setUnpaidConfirmed] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatAttachment, setChatAttachment] = useState<{ data: string; type: "image" | "pdf"; name: string } | null>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // QR Code modal for seller payment methods
  const [qrModal, setQrModal] = useState<SellerMethod | null>(null);

  // How to Pay modal
  const [howToPayOpen, setHowToPayOpen] = useState(false);

  // Rating
  const [myRating, setMyRating] = useState<{ rated: boolean; rating: number | null }>({ rated: false, rating: null });
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseAttemptRef = useRef(0);

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

  // Real-time stream — replaces aggressive polling. We keep a slow HTTP
  // safety-net interval so a wedged SSE connection (broken proxy, sleeping
  // tab, server restart between heartbeats) still self-heals within a
  // minute instead of looking stuck forever.
  useEffect(() => {
    if (!orderId) return;
    fetchOrder(); fetchMessages();
    pollRef.current = setInterval(fetchOrder, 60_000);
    chatPollRef.current = setInterval(fetchMessages, 60_000);

    let cancelled = false;
    const connect = async () => {
      if (cancelled) return;
      // Mint a short-lived (5 min) purpose-scoped stream token so the
      // long-lived session JWT never appears in URLs / proxy access logs.
      let streamToken: string;
      try {
        const r = await authFetch<{ token: string }>(
          `/api/p2p/orders/${orderId}/stream-token`,
          { method: "POST" },
        );
        streamToken = r.token;
      } catch {
        const attempt = Math.min(++sseAttemptRef.current, 6);
        sseRetryRef.current = setTimeout(connect, Math.min(1000 * 2 ** attempt, 30_000));
        return;
      }
      if (cancelled) return;
      try { sseRef.current?.close(); } catch {}
      const es = new EventSource(
        `/api/p2p/orders/${orderId}/stream?token=${encodeURIComponent(streamToken)}`,
      );
      sseRef.current = es;
      es.addEventListener("ready", () => { sseAttemptRef.current = 0; });
      const refetchOrder = () => { fetchOrder(); };
      const refetchChat = () => { fetchMessages(); };
      es.addEventListener("order.paid", refetchOrder);
      es.addEventListener("order.completed", refetchOrder);
      es.addEventListener("order.cancelled", refetchOrder);
      es.addEventListener("order.disputed", refetchOrder);
      es.addEventListener("order.dispute_resolved", refetchOrder);
      es.addEventListener("order.expired", refetchOrder);
      es.addEventListener("order.updated", refetchOrder);
      es.addEventListener("chat.message", refetchChat);
      es.onerror = () => {
        try { es.close(); } catch {}
        sseRef.current = null;
        // Exponential backoff, capped — avoids tight reconnect loops if the
        // backend is down or auth has truly expired.
        const attempt = Math.min(++sseAttemptRef.current, 6);
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        sseRetryRef.current = setTimeout(connect, delay);
      };
    };
    connect();

    // Token TTL is 5 min; refresh the connection well before expiry so the
    // user never sees a flap.
    const tokenRefresh = setInterval(() => { connect(); }, 4 * 60_000);

    return () => {
      cancelled = true;
      clearInterval(tokenRefresh);
      if (pollRef.current) clearInterval(pollRef.current);
      if (chatPollRef.current) clearInterval(chatPollRef.current);
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current);
      try { sseRef.current?.close(); } catch {}
      sseRef.current = null;
    };
  }, [orderId, fetchOrder, fetchMessages]);

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

  function handleChatFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const isPdf = file.type === "application/pdf";
    const isImg = file.type.startsWith("image/");
    if (!isPdf && !isImg) { toast({ title: "Only images (JPEG/PNG/WebP) or PDF files", variant: "destructive" }); return; }
    const maxBytes = isPdf ? 2 * 1024 * 1024 : 600 * 1024;
    if (file.size > maxBytes) { toast({ title: isPdf ? "PDF too large (max 2 MB)" : "Image too large (max 600 KB)", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setChatAttachment({ data: reader.result as string, type: isPdf ? "pdf" : "image", name: file.name });
    };
    reader.readAsDataURL(file);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if ((!chatMsg.trim() && !chatAttachment) || chatSending) return;
    setChatSending(true);
    try {
      const body: Record<string, string> = { message: chatMsg };
      if (chatAttachment) { body.attachmentData = chatAttachment.data; body.attachmentType = chatAttachment.type; }
      const msg = await authFetch<ChatMsg>(`/api/p2p/orders/${orderId}/messages`, {
        method: "POST", body: JSON.stringify(body),
      });
      setMessages((prev) => [...prev, msg]);
      setChatMsg("");
      setChatAttachment(null);
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
  // Counterparty for the trust card — the OTHER party's user id, so the
  // buyer sees the seller's profile and vice versa.
  const counterpartyId = isBuyer ? order.sellerId : order.buyerId;
  const counterpartyLabel = isBuyer ? "Seller" : "Buyer";
  const allPayMethods = order.sellerPaymentMethods ?? [];
  const selectedMethodId = order.paymentMethod ? parseInt(order.paymentMethod, 10) : null;
  const payMethods = selectedMethodId && !isNaN(selectedMethodId)
    ? allPayMethods.filter((m) => m.id === selectedMethodId)
    : allPayMethods;
  const primaryMethod = payMethods[0] ?? allPayMethods[0] ?? null;
  const methodLabel = primaryMethod?.type || order.paymentMethod || "your payment method";
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const isActive = order.status !== "completed" && order.status !== "cancelled";
  const newMsgCount = messages.filter(m => !m.isOwn && !m.isSystem).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-8">
      <div className="md:grid md:gap-5 md:items-start" style={{ gridTemplateColumns: "1fr 340px" }}>
      <div className="min-w-0">

        {/* ── Status header ────────────────────────────────────────────── */}
        <div className={`relative px-4 pt-4 pb-5 overflow-hidden ${
          order.status === "pending"   ? "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent" :
          order.status === "paid"      ? "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent" :
          order.status === "completed" ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" :
          order.status === "disputed"  ? "bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent" :
          "bg-gradient-to-br from-slate-500/8 to-transparent"
        }`}>
          {/* Subtle glow orb */}
          <div className={`absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none ${
            order.status === "pending" ? "bg-amber-400" :
            order.status === "paid" ? "bg-blue-400" :
            order.status === "completed" ? "bg-emerald-400" : "bg-slate-400"
          }`} />

          <div className="flex items-center justify-between mb-4">
            <Link href="/p2p/orders">
              <button className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors">
                <ArrowLeft size={16} />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              {order.status === "pending" && (
                <button onClick={() => setCancelOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-medium">
                  Cancel Order
                </button>
              )}
              {order.status === "paid" && (
                <button onClick={() => setDisputeOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors font-medium">
                  Appeal
                </button>
              )}
              {!isActive && (
                <button onClick={fetchOrder} className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors">
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Status title + countdown */}
          {order.status === "pending" && isBuyer && (
            <div className="mb-3">
              <h1 className="text-white font-bold text-2xl leading-snug">
                Pay the Seller within{" "}
                {deadline && <Countdown deadline={order.paymentDeadline!} />}
              </h1>
              <div className="text-slate-500 text-sm mt-1">Order #{order.id}</div>
            </div>
          )}
          {order.status === "pending" && !isBuyer && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Pending</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Waiting for payment</h1>
            </div>
          )}
          {order.status === "paid" && !isBuyer && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Payment Received</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Buyer has paid</h1>
            </div>
          )}
          {order.status === "paid" && isBuyer && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Confirming</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Awaiting confirmation</h1>
            </div>
          )}
          {order.status === "disputed" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Under Review</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Dispute in progress</h1>
              <DisputeEvidencePanel orderId={order.id} />
            </div>
          )}
          {order.status === "completed" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Completed</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Order Completed</h1>
            </div>
          )}
          {order.status === "cancelled" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cancelled</span>
              </div>
              <h1 className="text-white font-bold text-2xl">Order Cancelled</h1>
            </div>
          )}

          {/* Order meta + profile pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-xs">Order #{order.id}</span>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-slate-500 text-xs">{new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <button
              onClick={() => setMerchantOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] hover:border-emerald-500/30 text-slate-400 hover:text-slate-300 text-[11px] transition-colors"
            >
              <ShieldCheck size={10} className="text-emerald-400" />
              <span>View {counterpartyLabel.toLowerCase()}</span>
            </button>
          </div>
        </div>

        {/* ── Order summary strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 bg-white/[0.02] border-y border-white/[0.06]">
          <div className="py-3.5 px-4 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{isBuyer ? "You Pay" : "You Receive"}</div>
            <div className="text-white font-bold">₹{order.fiatAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="py-3.5 px-4 text-center border-x border-white/[0.06]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">USDT</div>
            <div className="text-emerald-400 font-bold">{order.usdtAmount.toFixed(4)}</div>
          </div>
          <div className="py-3.5 px-4 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Price</div>
            <div className="text-slate-300 font-semibold">₹{order.price.toLocaleString("en-IN")}</div>
          </div>
        </div>

        {/* ── Counterparty + Chat button ───────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
              isBuyer ? "bg-gradient-to-br from-violet-500 to-blue-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"
            }`}>
              {isBuyer ? "S" : "B"}
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{isBuyer ? "Seller" : "Buyer"}</div>
              <div className="text-slate-500 text-[11px]">Order #{order.id}</div>
            </div>
          </div>
          <button onClick={() => { setChatOpen(!chatOpen); setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all">
            <MessageCircle size={13} />
            Chat
            {newMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{newMsgCount}</span>
            )}
          </button>
        </div>

        <div className="px-4 py-5 space-y-5">

          {/* ── BUYER PENDING: Clean payment card ───────────────────────── */}
          {isBuyer && order.status === "pending" && (
            <>
              {payMethods.length > 0 ? payMethods.map((m) => (
                <div key={m.id} className={`rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1117]${chatOpen ? " md:hidden" : ""}`}>

                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${
                        m.type === "UPI" ? "bg-purple-600" :
                        m.type === "IMPS" ? "bg-orange-600" :
                        "bg-blue-600"
                      }`}>{m.type.charAt(0)}</div>
                      <span className="text-white font-semibold text-sm">{m.type} Payment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.qrCodeData && (
                        <button onClick={() => setQrModal(m)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-slate-400 text-[11px] font-medium hover:text-white transition-colors">
                          <QrCode size={11} /> QR Code
                        </button>
                      )}
                      <button onClick={() => setHowToPayOpen(true)}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                        How to pay?
                      </button>
                    </div>
                  </div>

                  {/* QR code — auto-generated from UPI ID (like deposit page) or fallback to uploaded image */}
                  {(m.upiId || m.qrCodeData) && (
                    <>
                      <div className="mx-4 my-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-5 flex flex-col items-center gap-3.5">
                        <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">SCAN TO PAY</div>
                        <div className="bg-white p-3 rounded-xl">
                          {m.upiId ? (
                            <UpiQrCanvas
                              upiId={m.upiId}
                              amount={order.fiatAmount}
                              name={m.accountHolder ?? m.displayName}
                              orderId={order.id}
                              size={192}
                            />
                          ) : (
                            <div className="w-48 h-48 overflow-hidden rounded-lg">
                              <img src={m.qrCodeData!} alt="QR Code" className="w-full h-full object-cover" style={{ objectPosition: "50% 55%" }} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Divider */}
                      <div className="flex items-center gap-2.5 px-4 pb-1">
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="text-[10px] font-bold tracking-widest text-slate-500">OR PAY USING UPI ID</div>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    </>
                  )}

                  {/* Payment detail rows — clean copy-button style */}
                  <div className="divide-y divide-white/[0.04]">
                    {m.accountHolder && (
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                            <User size={13} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px] uppercase tracking-wider">Account Holder</p>
                            <p className="text-white font-semibold text-sm mt-0.5">{m.accountHolder}</p>
                          </div>
                        </div>
                        <CopyBtn value={m.accountHolder} />
                      </div>
                    )}
                    {m.upiId && (
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                            <span className="text-purple-400 text-xs font-bold">@</span>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px] uppercase tracking-wider">UPI ID</p>
                            <p className="text-white font-mono text-sm mt-0.5">{m.upiId}</p>
                          </div>
                        </div>
                        <CopyBtn value={m.upiId} />
                      </div>
                    )}
                    {m.accountNumber && (
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                            <span className="text-blue-400 text-xs font-bold">#</span>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px] uppercase tracking-wider">Account No.</p>
                            <p className="text-white font-mono text-sm mt-0.5">{m.accountNumber}</p>
                          </div>
                        </div>
                        <CopyBtn value={m.accountNumber} />
                      </div>
                    )}
                    {m.ifsc && (
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                            <span className="text-cyan-400 text-xs font-bold">IF</span>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px] uppercase tracking-wider">IFSC Code</p>
                            <p className="text-white font-mono text-sm mt-0.5">{m.ifsc}</p>
                          </div>
                        </div>
                        <CopyBtn value={m.ifsc} />
                      </div>
                    )}
                    {m.bankName && (
                      <div className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                            <span className="text-amber-400 text-xs font-bold">B</span>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px] uppercase tracking-wider">Bank</p>
                            <p className="text-white text-sm mt-0.5">{m.bankName}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Amount row — always shown */}
                    <div className="flex items-center justify-between px-4 py-3.5 bg-amber-500/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                          <span className="text-amber-400 text-xs font-bold">₹</span>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[11px] uppercase tracking-wider">Amount</p>
                          <p className="text-amber-400 font-bold text-base mt-0.5">₹{order.fiatAmount.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                      <CopyBtn value={String(order.fiatAmount)} />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-semibold">Seller has no payment method set up</p>
                    <p className="text-slate-400 text-xs mt-1">Contact via chat or cancel the order.</p>
                  </div>
                </div>
              )}

              {/* 3-button action row */}
              <div className="space-y-2.5">
                <button
                  onClick={() => setProofOpen(true)}
                  disabled={payMethods.length === 0}
                  className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold text-sm transition-all active:scale-[0.98]"
                >
                  Transferred, Notify Seller
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="flex-1 py-3 rounded-xl border border-red-500/25 hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-all active:scale-[0.98]"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
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

              {/* Payment proof card */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-blue-500/15 bg-blue-500/[0.06]">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-blue-300 text-sm font-bold">Buyer has sent payment</p>
                    <p className="text-blue-400/60 text-[11px]">Check your bank / UPI before releasing</p>
                  </div>
                </div>

                {/* Amount to verify */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-blue-500/10">
                  <span className="text-slate-500 text-xs uppercase tracking-wider">Amount to verify</span>
                  <span className="text-white font-bold text-base">₹{order.fiatAmount.toLocaleString("en-IN")}</span>
                </div>

                {/* Payment Ref */}
                {order.paymentRef && (
                  <div className="px-4 py-3 flex items-center justify-between border-b border-blue-500/10">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">UTR / Ref</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">{order.paymentRef}</span>
                      <CopyBtn value={order.paymentRef} />
                    </div>
                  </div>
                )}

                {/* Screenshot proof */}
                {order.paymentProofUrl && (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Proof</span>
                    <button
                      onClick={() => setProofViewer(order.paymentProofUrl)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-semibold hover:bg-blue-500/25 transition-colors"
                    >
                      <ImageIcon size={11} /> View Screenshot
                    </button>
                  </div>
                )}

                {/* No proof warning */}
                {!order.paymentRef && !order.paymentProofUrl && (
                  <div className="px-4 py-3 flex items-center gap-2 text-amber-400/80 text-xs">
                    <AlertCircle size={12} className="shrink-0" />
                    No UTR or screenshot provided — verify manually in your bank app
                  </div>
                )}
              </div>

              {/* Checklist reminder */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 space-y-2">
                <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-1">Before releasing, confirm:</p>
                {[
                  `₹${order.fiatAmount.toLocaleString("en-IN")} received in your account`,
                  "Sender name matches the buyer",
                  "Payment is NOT from a third-party",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[9px] font-bold">✓</span>
                    </div>
                    <span className="text-slate-400 text-xs leading-snug">{item}</span>
                  </div>
                ))}
              </div>

              {/* Release button */}
              <button
                disabled={!!actionLoading}
                onClick={confirmRelease}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.99] shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {actionLoading === "confirm"
                  ? <Loader2 size={17} className="animate-spin" />
                  : <ShieldCheck size={17} />
                }
                Release {order.usdtAmount.toFixed(4)} USDT to Buyer
              </button>

              {/* Irreversible warning */}
              <p className="text-center text-[11px] text-slate-600">
                ⚠ This action is irreversible — only release after verifying receipt
              </p>
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

          {/* ── Mobile-only Chat Panel ──────────────────────────────────── */}
          {chatOpen && (
            <div className="md:hidden glass-card rounded-xl border border-white/[0.08]">
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
                          <div className={`px-3 py-2 rounded-2xl text-sm ${m.isOwn ? "bg-emerald-500/20 text-emerald-100 rounded-tr-sm" : "bg-white/[0.07] text-slate-200 rounded-tl-sm"}`}>
                            {m.message && <p>{m.message}</p>}
                            {m.attachmentType === "image" && m.attachmentData && (
                              <img src={m.attachmentData} alt="attachment" className="mt-1.5 max-w-[180px] rounded-xl object-cover cursor-pointer" onClick={() => window.open(m.attachmentData!, "_blank")} />
                            )}
                            {m.attachmentType === "pdf" && m.attachmentData && (
                              <a href={m.attachmentData} download="attachment.pdf" className="mt-1.5 flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl hover:bg-white/15 transition-colors">
                                <FileText size={14} className="text-red-400 shrink-0" /><span className="text-xs">PDF File</span>
                              </a>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-600 px-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )
                    }
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {isActive ? (
                <form onSubmit={sendChat} className="flex flex-col gap-2 p-3 border-t border-white/[0.06]">
                  {chatAttachment && (
                    <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.08]">
                      {chatAttachment.type === "image"
                        ? <img src={chatAttachment.data} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        : <FileText size={18} className="text-red-400 shrink-0" />}
                      <span className="text-xs text-slate-300 flex-1 truncate">{chatAttachment.name}</span>
                      <button type="button" onClick={() => setChatAttachment(null)} className="text-slate-500 hover:text-red-400"><X size={13} /></button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => chatFileRef.current?.click()} className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0">
                      <Paperclip size={15} />
                    </button>
                    <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Enter message here…" maxLength={500}
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40" />
                    <button type="submit" disabled={(!chatMsg.trim() && !chatAttachment) || chatSending}
                      className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white shrink-0">
                      {chatSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="px-4 py-2.5 border-t border-white/[0.06] text-center text-xs text-slate-600">Order closed — chat is read-only</div>
              )}
            </div>
          )}

          <Link href="/p2p/orders"><button className="text-slate-500 text-xs hover:text-slate-300">← All Orders</button></Link>
        </div>
      </div>

      {/* ── Desktop right-col: Chat — visible only when chatOpen ────────── */}
      <div className={chatOpen ? "hidden md:flex md:flex-col sticky top-4 glass-card rounded-2xl overflow-hidden border border-white/[0.08]" : "hidden"}>
        {/* Chat header with counterparty info */}
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
              isBuyer ? "bg-gradient-to-br from-violet-500 to-blue-600 text-white" : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
            }`}>{isBuyer ? "S" : "B"}</div>
            <div>
              <div className="text-white font-semibold text-sm">{counterpartyLabel}</div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-slate-500 text-[11px]">Online</span>
              </div>
            </div>
          </div>
          <button onClick={fetchMessages} className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500 hover:text-white">
            <RefreshCw size={13} />
          </button>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[320px] max-h-[520px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 pt-10">
              <MessageCircle size={24} /><p className="text-xs">No messages yet</p>
            </div>
          ) : messages.map((m) => (
            <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : m.isSystem ? "justify-center" : "justify-start"}`}>
              {m.isSystem
                ? <span className="text-[11px] text-slate-500 px-3 py-1 rounded-full bg-slate-800/60">{m.message}</span>
                : (
                  <div className={`max-w-[85%] flex flex-col gap-0.5 ${m.isOwn ? "items-end" : "items-start"}`}>
                    {!m.isOwn && <span className="text-[10px] text-slate-500 px-1">{m.senderName}</span>}
                    <div className={`px-3 py-2 rounded-2xl text-sm ${m.isOwn ? "bg-emerald-500/20 text-emerald-100 rounded-tr-sm" : "bg-white/[0.07] text-slate-200 rounded-tl-sm"}`}>
                      {m.message && <p>{m.message}</p>}
                      {m.attachmentType === "image" && m.attachmentData && (
                        <img src={m.attachmentData} alt="attachment" className="mt-1.5 max-w-[200px] rounded-xl object-cover cursor-pointer" onClick={() => window.open(m.attachmentData!, "_blank")} />
                      )}
                      {m.attachmentType === "pdf" && m.attachmentData && (
                        <a href={m.attachmentData} download="attachment.pdf" className="mt-1.5 flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl hover:bg-white/15 transition-colors">
                          <FileText size={14} className="text-red-400 shrink-0" /><span className="text-xs">PDF File</span>
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 px-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )
              }
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        {/* Input */}
        {isActive ? (
          <form onSubmit={sendChat} className="flex flex-col gap-2 p-3 border-t border-white/[0.06]">
            {chatAttachment && (
              <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.08]">
                {chatAttachment.type === "image"
                  ? <img src={chatAttachment.data} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  : <FileText size={18} className="text-red-400 shrink-0" />}
                <span className="text-xs text-slate-300 flex-1 truncate">{chatAttachment.name}</span>
                <button type="button" onClick={() => setChatAttachment(null)} className="text-slate-500 hover:text-red-400"><X size={13} /></button>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => chatFileRef.current?.click()} className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0" title="Attach image or PDF">
                <Paperclip size={15} />
              </button>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Enter message here…" maxLength={500}
                className="flex-1 bg-black/30 border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40" />
              <button type="submit" disabled={(!chatMsg.trim() && !chatAttachment) || chatSending}
                className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white shrink-0">
                {chatSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-4 py-2.5 border-t border-white/[0.06] text-center text-xs text-slate-600">Order closed — chat is read-only</div>
        )}
      </div>

      </div>{/* end grid */}
      </div>{/* end max-w-4xl */}

      {/* ── How to Pay Modal ─────────────────────────────────────────────── */}
      {howToPayOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            {/* Header tabs */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex gap-5">
                <span className="text-white font-bold text-base border-b-2 border-amber-400 pb-1">How to Pay</span>
                <span className="text-slate-500 text-base pb-1">Things to Note</span>
              </div>
              <button onClick={() => setHowToPayOpen(false)} className="w-7 h-7 rounded-full bg-white/[0.07] flex items-center justify-center text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            {/* Steps */}
            <div className="px-5 pb-6 space-y-5">
              {[
                { n: 1, title: "Make Your Payment", desc: `Open your ${methodLabel} app and complete the payment to the seller's account.` },
                { n: 2, title: "Save Your Payment Proof", desc: "Take a clear screenshot or save the receipt of your payment. You'll need this as proof for the next step." },
                { n: 3, title: "Confirm & Upload Proof", desc: "Tap 'Transferred, Notify Seller' and upload your payment proof to confirm your transfer." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">{n}</div>
                    {n < 3 && <div className="w-px flex-1 bg-white/[0.08] mt-2" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-white font-bold text-sm mb-1">{title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setHowToPayOpen(false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-sm hover:from-amber-300 hover:to-amber-400 transition-all">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Proof Modal ──────────────────────────────────────────── */}
      {proofOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0e1420] border border-white/[0.08] w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden">

            {/* Header strip */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/15 flex items-center justify-center">
                  <Upload size={15} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">Payment Confirmation</h2>
                  <p className="text-slate-500 text-[11px]">Provide proof of your transfer</p>
                </div>
              </div>
              <button onClick={() => setProofOpen(false)} className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors text-sm">×</button>
            </div>

            <div className="px-5 pt-4 pb-5 space-y-4">
              {/* Step 1: UTR */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Option 1 — UTR / Transaction ID
                </label>
                <div className="relative">
                  <input
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="Enter UPI Transaction ID or Reference"
                    className={`w-full bg-white/[0.04] border rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors ${
                      paymentRef.trim() ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-white/[0.08] focus:border-slate-500/50"
                    }`}
                  />
                  {paymentRef.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-emerald-400 text-xs">✓</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-slate-600 text-[11px] font-medium">OR</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Step 2: Screenshot */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Option 2 — Payment Screenshot
                </label>
                {proofPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 bg-black/30">
                    <img src={proofPreview} alt="Payment proof preview" className="w-full max-h-44 object-contain" />
                    <button
                      onClick={() => { setPaymentProof(null); setProofPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors"
                      aria-label="Remove proof"
                    >×</button>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <span className="text-emerald-400 text-[10px] font-semibold">✓ Uploaded</span>
                    </div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    paymentProof ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]"
                  }`}>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <Upload size={16} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 text-xs font-semibold">Tap to upload screenshot</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">JPG, PNG or WebP · max 450KB</p>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onProofFile} />
                  </label>
                )}
              </div>

              {/* Validation hint */}
              {!paymentRef.trim() && !paymentProof && (
                <div className="flex items-center gap-2 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle size={13} className="text-amber-400 shrink-0" />
                  <p className="text-amber-300 text-xs">Please enter a UTR number or upload a screenshot</p>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300/80 text-[11px] leading-relaxed">Do not pay from a third-party account — it may result in account suspension.</p>
              </div>

              {/* Confirm checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  transferConfirmed ? "bg-emerald-500 border-emerald-500" : "border-white/20 group-hover:border-white/40"
                }`}>
                  {transferConfirmed && <span className="text-white text-[10px] font-bold">✓</span>}
                  <input type="checkbox" checked={transferConfirmed} onChange={e => setTransferConfirmed(e.target.checked)} className="hidden" />
                </div>
                <span className="text-slate-300 text-sm leading-snug">I confirm this payment was made from my own account</span>
              </label>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setProofOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-slate-400 hover:text-white text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!transferConfirmed || actionLoading === "paid" || (!paymentRef.trim() && !paymentProof)}
                  onClick={notifySeller}
                  className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-35 disabled:cursor-not-allowed text-black font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20"
                >
                  {actionLoading === "paid" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={14} />}
                  Notify Seller
                </button>
              </div>
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

      {/* ── Dispute / Appeal Modal ───────────────────────────────────────── */}
      {disputeOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0e1420] border border-white/[0.08] w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-orange-500/15 flex items-center justify-center">
                  <AlertCircle size={17} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">Raise a Dispute</h2>
                  <p className="text-slate-500 text-[11px]">Admin will review and decide</p>
                </div>
              </div>
              <button onClick={() => setDisputeOpen(false)}
                className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Warning banner */}
              <div className="flex items-start gap-3 bg-red-500/[0.07] border border-red-500/20 rounded-2xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300/80 text-xs leading-relaxed">
                  Only raise a dispute for a genuine issue. False disputes may result in account suspension. Our team reviews chat history, payment proof, and all evidence before deciding.
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Reason <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    className={`w-full appearance-none bg-white/[0.04] border rounded-xl px-3.5 py-3 text-sm outline-none transition-colors pr-9 ${
                      disputeReason ? "border-orange-500/40 text-white" : "border-white/[0.08] text-slate-500 focus:border-white/20"
                    }`}
                  >
                    <option value="" className="bg-[#0e1420]">Select a reason…</option>
                    {isBuyer ? (
                      <>
                        <option className="bg-[#0e1420]">Seller not releasing USDT after payment</option>
                        <option className="bg-[#0e1420]">Seller asking for extra payment</option>
                        <option className="bg-[#0e1420]">Seller's payment method invalid / frozen</option>
                        <option className="bg-[#0e1420]">Other reason</option>
                      </>
                    ) : (
                      <>
                        <option className="bg-[#0e1420]">Payment not received in my account</option>
                        <option className="bg-[#0e1420]">Wrong amount received</option>
                        <option className="bg-[#0e1420]">Payment from third-party / different name</option>
                        <option className="bg-[#0e1420]">Other reason</option>
                      </>
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Description <span className="text-slate-600 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <textarea
                  value={disputeDesc}
                  onChange={e => setDisputeDesc(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Explain the issue in detail so our team can review it quickly…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-white/20 resize-none transition-colors"
                />
                <p className="text-[10px] text-slate-600 text-right">{disputeDesc.length}/1000</p>
              </div>

              {/* Evidence */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Evidence Screenshot <span className="text-slate-600 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                {disputeEvidence ? (
                  <div className="relative rounded-xl overflow-hidden border border-orange-500/25 bg-black/30">
                    <img src={disputeEvidence} alt="Evidence" className="w-full max-h-40 object-contain" />
                    <button
                      onClick={() => setDisputeEvidence(null)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >×</button>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full">
                      <span className="text-orange-300 text-[10px] font-semibold">✓ Uploaded</span>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-orange-500/30 hover:bg-orange-500/[0.03] cursor-pointer transition-all">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <Upload size={16} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 text-xs font-semibold">Tap to upload evidence</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">JPG, PNG or WebP · max 450KB</p>
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 450 * 1024) { toast({ title: "Image too large", description: "Max 450KB", variant: "destructive" }); return; }
                      const reader = new FileReader();
                      reader.onload = () => setDisputeEvidence(reader.result as string);
                      reader.readAsDataURL(f);
                    }} />
                  </label>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] flex gap-2.5 shrink-0">
              <button
                onClick={() => setDisputeOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-slate-400 hover:text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!disputeReason || disputeSubmitting}
                onClick={async () => {
                  if (!order) return;
                  setDisputeSubmitting(true);
                  try {
                    const res = await authFetch(`/api/p2p/orders/${order.id}/dispute`, {
                      method: "POST",
                      body: JSON.stringify({ reason: disputeReason, description: disputeDesc || undefined, evidenceUrl: disputeEvidence || undefined }),
                    });
                    if (res?.success) {
                      toast({ title: "Dispute raised", description: "Our team will review and contact you." });
                      setDisputeOpen(false);
                      setDisputeReason(""); setDisputeDesc(""); setDisputeEvidence(null);
                      fetchOrder();
                    } else {
                      toast({ title: "Failed", description: res?.error || "Could not raise dispute", variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Failed", description: err?.message || "Could not raise dispute", variant: "destructive" });
                  } finally { setDisputeSubmitting(false); }
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 disabled:opacity-35 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20"
              >
                {disputeSubmitting
                  ? <Loader2 size={15} className="animate-spin" />
                  : <AlertCircle size={15} />
                }
                Submit Dispute
              </button>
            </div>
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
      {qrModal && (qrModal.upiId || qrModal.qrCodeData) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-white/[0.08]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <p className="font-bold text-white">{qrModal.displayName}</p>
                <p className="text-slate-400 text-xs">{qrModal.type} Payment</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mx-4 mb-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-5 flex flex-col items-center gap-3.5">
              <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">SCAN TO PAY</div>
              <div className="bg-white p-3 rounded-xl">
                {qrModal.upiId ? (
                  <UpiQrCanvas
                    upiId={qrModal.upiId}
                    amount={order.fiatAmount}
                    name={qrModal.accountHolder ?? qrModal.displayName}
                    orderId={order.id}
                    size={220}
                  />
                ) : (
                  <div className="w-56 h-56 overflow-hidden rounded-lg">
                    <img src={qrModal.qrCodeData!} alt="QR Code" className="w-full h-full object-cover" style={{ objectPosition: "50% 55%" }} />
                  </div>
                )}
              </div>
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
      {merchantOpen && (
        <MerchantProfileModal userId={counterpartyId} onClose={() => setMerchantOpen(false)} />
      )}
    </Layout>
  );
}

// ─── Dispute Evidence Panel (Phase 8) ────────────────────────────────────────
// Self-contained card that lives on the order detail page while an order is
// disputed. Lazy-fetches the evidence list and lets EITHER party add more
// files until admin resolves. Kept local to this page (instead of a shared
// component) since this is the only consumer for now.

type DisputeEvidence = {
  id: number;
  uploaderRole: "buyer" | "seller";
  uploadedByUserId: number;
  fileType: string;
  fileData: string;
  caption: string | null;
  createdAt: string;
};

function DisputeEvidencePanel({ orderId }: { orderId: number }) {
  const { toast } = useToast();
  const [items, setItems] = useState<DisputeEvidence[]>([]);
  const [disputeStatus, setDisputeStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [staged, setStaged] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch<{ evidence: DisputeEvidence[]; disputeStatus: string | null }>(
        `/api/p2p/orders/${orderId}/dispute/evidence`,
      );
      setItems(res.evidence);
      setDisputeStatus(res.disputeStatus);
    } catch (err: any) {
      // Soft-fail — the order page itself still works; just log.
      console.error("Failed to load dispute evidence", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const canUpload = disputeStatus === "open" && items.length < 6;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 450_000) {
      // Pre-warn at ~450KB so the base64-inflated payload stays under the
      // server's 600KB cap (base64 ≈ +33%).
      toast({ title: "File too large", description: "Please use an image under ~450 KB.", variant: "destructive" });
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(f.type)) {
      toast({ title: "Unsupported format", description: "JPEG, PNG, or WebP only.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setStaged(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!staged) return;
    setUploading(true);
    try {
      const res = await authFetch<{ success: boolean; evidence: DisputeEvidence }>(
        `/api/p2p/orders/${orderId}/dispute/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileData: staged, caption: caption || undefined }),
        },
      );
      setItems((prev) => [...prev, res.evidence]);
      setStaged(null);
      setCaption("");
      setPicking(false);
      toast({ title: "Evidence added" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="mt-4 text-slate-500 text-xs">Loading evidence…</div>
    );
  }

  return (
    <div className="mt-4 text-left bg-orange-500/[0.04] border border-orange-500/15 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-orange-300 text-xs font-bold uppercase tracking-wide">
          Evidence ({items.length}/6)
        </div>
        {canUpload && !picking && (
          <button
            onClick={() => setPicking(true)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-bold hover:bg-orange-500/25 transition-colors flex items-center gap-1"
          >
            <Upload size={11} /> Add file
          </button>
        )}
      </div>

      {items.length === 0 && !picking && (
        <p className="text-slate-400 text-xs leading-relaxed">
          Add screenshots, bank statements, or chat captures to support your case.
          Both you and the other party can attach evidence until admin resolves.
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setViewer(it.fileData)}
              className="group bg-black/30 border border-white/[0.06] rounded-lg overflow-hidden text-left"
              title={it.caption ?? ""}
            >
              <img src={it.fileData} alt="" className="w-full h-16 object-cover group-hover:opacity-90" />
              <div className="px-1 py-0.5">
                <div className={`text-[9px] font-bold uppercase ${it.uploaderRole === "buyer" ? "text-blue-300" : "text-purple-300"}`}>
                  {it.uploaderRole}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {picking && (
        <div className="space-y-2 pt-1 border-t border-orange-500/15">
          {!staged ? (
            <>
              <input
                ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange} className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-lg border-2 border-dashed border-white/15 text-slate-400 text-xs hover:border-orange-500/40 hover:text-orange-300 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={14} /> Choose image (≤450 KB)
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <img src={staged} alt="Preview" className="w-full max-h-40 object-contain rounded-lg border border-white/10" />
                <button
                  onClick={() => setStaged(null)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                placeholder="Optional caption (e.g. UPI transaction screenshot)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/40"
              />
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setPicking(false); setStaged(null); setCaption(""); }}
              disabled={uploading}
              className="flex-1 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!staged || uploading}
              className="flex-1 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold hover:bg-orange-500/30 disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Submit evidence"}
            </button>
          </div>
        </div>
      )}

      {!canUpload && items.length >= 6 && (
        <p className="text-[10px] text-slate-500">Maximum 6 attachments reached.</p>
      )}
      {disputeStatus && disputeStatus !== "open" && (
        <p className="text-[10px] text-slate-500">Dispute resolved — evidence is now read-only.</p>
      )}

      {viewer && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewer(null)} className="absolute -top-9 right-0 text-white/80 hover:text-white text-sm">Close ×</button>
            <img src={viewer} alt="Evidence" className="w-full max-h-[85vh] object-contain rounded-2xl border border-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}
