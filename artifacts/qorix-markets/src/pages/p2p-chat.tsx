import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import {
  MessageCircle, ArrowLeft, Send, Loader2, RefreshCw,
  ChevronRight, Clock, CheckCheck,
} from "lucide-react";

type Order = {
  id: number; status: string; role: "buyer" | "seller";
  adType: "BUY" | "SELL"; fiatAmount: number; usdtAmount: number;
  createdAt: string;
};

type ChatMsg = {
  id: number; senderId: number | null; message: string;
  isSystem: boolean; isOwn: boolean; senderName: string; createdAt: string;
};

type Thread = Order & {
  counterpartyLabel: string;
  lastMsg?: string;
  lastMsgTime?: string;
  unread: number;
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function statusColor(status: string) {
  if (status === "pending") return "bg-amber-500/15 text-amber-400";
  if (status === "paid") return "bg-blue-500/15 text-blue-400";
  if (status === "completed") return "bg-emerald-500/15 text-emerald-400";
  return "bg-slate-500/15 text-slate-400";
}

export default function P2PChatPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load all orders as threads
  useEffect(() => {
    setThreadsLoading(true);
    authFetch<Order[]>("/api/p2p/orders/my")
      .then((orders) => {
        const t: Thread[] = orders.map((o) => ({
          ...o,
          counterpartyLabel: o.role === "buyer" ? "Seller" : "Buyer",
          unread: 0,
        }));
        setThreads(t);
      })
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
  }, []);

  // Load messages for selected order
  const loadMessages = useCallback(async (orderId: number) => {
    setMsgsLoading(true);
    try {
      const data = await authFetch<ChatMsg[]>(`/api/p2p/orders/${orderId}/messages`);
      setMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch {
      setMessages([]);
    } finally {
      setMsgsLoading(false);
    }
  }, []);

  const selectThread = (t: Thread) => {
    setSelected(t);
    setMessages([]);
    setChatMsg("");
    setMobileView("chat");
    loadMessages(t.id);
    // Update last message preview in thread list
    setThreads((prev) => prev.map((x) => x.id === t.id ? { ...x, unread: 0 } : x));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !chatMsg.trim() || sending) return;
    setSending(true);
    try {
      const msg = await authFetch<ChatMsg>(`/api/p2p/orders/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMsg.trim() }),
      });
      setMessages((prev) => [...prev, msg]);
      setThreads((prev) => prev.map((t) =>
        t.id === selected.id
          ? { ...t, lastMsg: chatMsg.trim(), lastMsgTime: new Date().toISOString() }
          : t
      ));
      setChatMsg("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const isActive = selected && !["completed", "cancelled"].includes(selected.status);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4 px-1">
          {mobileView === "chat" && (
            <button
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
              onClick={() => setMobileView("list")}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-400" />
            {mobileView === "chat" && selected ? `Order #${selected.id}` : "Chats"}
          </h1>
        </div>

        {/* ── 2-col layout ─────────────────────────────────────────── */}
        <div className="flex gap-4 h-[calc(100vh-12rem)]">

          {/* ── Left: Thread list ──────────────────────────────────── */}
          <div className={`${mobileView === "chat" ? "hidden" : "flex"} md:flex flex-col w-full md:w-80 shrink-0 glass-card rounded-2xl overflow-hidden border border-white/[0.08]`}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-white font-semibold text-sm">All Orders</span>
              <span className="text-slate-500 text-xs">{threads.length} conversations</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {threadsLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 px-6 text-center">
                  <MessageCircle size={32} />
                  <p className="text-sm">No order conversations yet</p>
                  <Link href="/p2p">
                    <span className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                      Go to P2P Market <ChevronRight size={11} />
                    </span>
                  </Link>
                </div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectThread(t)}
                    className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${selected?.id === t.id ? "bg-white/[0.05]" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-bold text-sm ${t.role === "buyer" ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-500/15 text-violet-400"}`}>
                        {t.counterpartyLabel[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-white text-sm font-semibold truncate">{t.counterpartyLabel}</span>
                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-bold ${statusColor(t.status)}`}>{t.status}</span>
                          </div>
                          <span className="text-slate-600 text-[10px] shrink-0">{timeAgo(t.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-slate-500 text-xs truncate">
                            {t.lastMsg ?? `Order #${t.id} · ₹${t.fiatAmount.toLocaleString("en-IN")}`}
                          </p>
                          {t.unread > 0 && (
                            <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 ml-1">
                              {t.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right: Chat panel ──────────────────────────────────── */}
          <div className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-1 flex-col glass-card rounded-2xl overflow-hidden border border-white/[0.08] min-w-0`}>
            {!selected ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
                <MessageCircle size={40} />
                <div className="text-center">
                  <p className="text-sm text-slate-500">Select a conversation</p>
                  <p className="text-xs text-slate-600 mt-1">to start chatting</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${selected.role === "buyer" ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-500/15 text-violet-400"}`}>
                      {selected.counterpartyLabel[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">{selected.counterpartyLabel}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${statusColor(selected.status)}`}>{selected.status}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Clock size={9} />
                        Order #{selected.id} · ₹{selected.fiatAmount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadMessages(selected.id)}
                      className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                    >
                      <RefreshCw size={12} />
                    </button>
                    <Link href={`/p2p/orders/${selected.id}`}>
                      <span className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors">
                        View Order <ChevronRight size={11} />
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={20} className="animate-spin text-slate-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                      <MessageCircle size={28} />
                      <p className="text-xs">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.isOwn ? "justify-end" : m.isSystem ? "justify-center" : "justify-start"}`}>
                        {m.isSystem ? (
                          <span className="text-[11px] text-slate-500 px-3 py-1 rounded-full bg-slate-800/60 max-w-xs text-center">
                            {m.message}
                          </span>
                        ) : (
                          <div className={`max-w-[72%] flex flex-col gap-0.5 ${m.isOwn ? "items-end" : "items-start"}`}>
                            {!m.isOwn && (
                              <span className="text-[10px] text-slate-500 px-1">{m.senderName}</span>
                            )}
                            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${m.isOwn ? "bg-emerald-500/20 text-emerald-100 rounded-tr-sm" : "bg-white/[0.08] text-slate-200 rounded-tl-sm"}`}>
                              {m.message}
                            </div>
                            <div className={`flex items-center gap-1 px-1 ${m.isOwn ? "flex-row-reverse" : ""}`}>
                              <span className="text-[10px] text-slate-600">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {m.isOwn && <CheckCheck size={11} className="text-slate-600" />}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                {isActive ? (
                  <form onSubmit={sendMessage} className="px-4 py-3 border-t border-white/[0.06] flex gap-2 items-end">
                    <input
                      value={chatMsg}
                      onChange={(e) => setChatMsg(e.target.value)}
                      placeholder="Enter message here…"
                      maxLength={500}
                      className="flex-1 bg-black/30 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/40 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!chatMsg.trim() || sending}
                      className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                ) : (
                  <div className="px-4 py-3 border-t border-white/[0.06] text-center text-xs text-slate-600">
                    Order is {selected.status} — chat is read-only
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
