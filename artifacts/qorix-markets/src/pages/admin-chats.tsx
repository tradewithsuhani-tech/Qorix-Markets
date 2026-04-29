import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, CheckCircle, Clock, User, Sparkles,
  RefreshCw, UserCheck, X, Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth-fetch";

async function apiGet(path: string) {
  return authFetch(`/api${path}`);
}

async function apiPost(path: string, body: object) {
  return authFetch(`/api${path}`, { method: "POST", body: JSON.stringify(body) });
}

interface Session {
  id: number;
  userId: number;
  status: "active" | "expert_requested" | "resolved";
  expertRequested: boolean;
  lastMessageAt: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface Message {
  id: number;
  sessionId: number;
  senderType: "user" | "bot" | "admin";
  senderId: number | null;
  content: string;
  createdAt: string;
}

function parseMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/20" },
  expert_requested: { label: "Needs Expert", color: "text-amber-400", dot: "bg-amber-400", border: "border-amber-500/30" },
  resolved: { label: "Resolved", color: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/20" },
};

export default function AdminChatsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  async function loadSessions() {
    try {
      const { sessions: data } = await apiGet("/admin/chats");
      setSessions(data);
    } catch { } finally {
      setLoading(false);
    }
  }

  async function loadMessages(sessionId: number) {
    try {
      const { messages: data } = await apiGet(`/admin/chats/${sessionId}/messages`);
      setMessages(data);
    } catch { }
  }

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id);
      const timer = setInterval(() => loadMessages(selectedSession.id), 5000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [selectedSession]);

  async function handleSelectSession(session: Session) {
    setSelectedSession(session);
    setMessages([]);
    await loadMessages(session.id);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  async function handleReply() {
    if (!reply.trim() || !selectedSession || sending) return;
    const content = reply.trim();
    setReply("");
    setSending(true);
    try {
      await apiPost(`/admin/chats/${selectedSession.id}/reply`, { content });
      await loadMessages(selectedSession.id);
      await loadSessions();
    } catch { } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    if (!selectedSession || resolving) return;
    setResolving(true);
    try {
      await apiPost(`/admin/chats/${selectedSession.id}/resolve`, {});
      await loadSessions();
      setSelectedSession(prev => prev ? { ...prev, status: "resolved" } : null);
    } catch { } finally {
      setResolving(false);
    }
  }

  const expertSessions = sessions.filter(s => s.status === "expert_requested");
  const activeSessions = sessions.filter(s => s.status === "active");
  const resolvedSessions = sessions.filter(s => s.status === "resolved");
  const orderedSessions = [...expertSessions, ...activeSessions, ...resolvedSessions];

  return (
    <Layout>
      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Support Chats</h1>
                <p className="text-xs text-white/40">{sessions.length} total conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {expertSessions.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-xs text-amber-400 font-medium">{expertSessions.length} need expert</span>
                </div>
              )}
              <button
                onClick={loadSessions}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white/50" />
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-3 px-4 pb-4 min-h-0">
          {/* Sessions List */}
          <div
            className="w-72 flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
            style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="px-3 py-2.5 border-b border-white/[0.05]">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : orderedSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <MessageCircle className="w-8 h-8 text-white/10" />
                  <p className="text-xs text-white/30">No conversations yet</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {orderedSessions.map((session) => {
                    const cfg = STATUS_CONFIG[session.status];
                    const isSelected = selectedSession?.id === session.id;
                    return (
                      <motion.button
                        key={session.id}
                        onClick={() => handleSelectSession(session)}
                        whileHover={{ x: 2 }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all duration-150",
                          isSelected
                            ? "bg-blue-600/15 border border-blue-500/25"
                            : "bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06]"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/30 to-violet-600/30 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-white truncate">
                                {session.userName || `User #${session.userId}`}
                              </p>
                              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                            </div>
                            <p className="text-[10px] text-white/40 truncate">{session.userEmail || "—"}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={cn("text-[9px] font-medium", cfg.color)}>{cfg.label}</span>
                              <span className="text-[9px] text-white/20">·</span>
                              <span className="text-[9px] text-white/30">
                                {format(new Date(session.lastMessageAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Chat View */}
          <div
            className="flex-1 flex flex-col rounded-2xl min-w-0"
            style={{ background: "#0a0d18", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {!selectedSession ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-blue-500/10 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-blue-400/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white/30">Select a conversation</p>
                  <p className="text-xs text-white/20 mt-1">Choose from the list on the left</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/30 to-violet-600/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {selectedSession.userName || `User #${selectedSession.userId}`}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[selectedSession.status].dot)} />
                        <p className={cn("text-[11px] font-medium", STATUS_CONFIG[selectedSession.status].color)}>
                          {STATUS_CONFIG[selectedSession.status].label}
                        </p>
                        <span className="text-[11px] text-white/30">· {selectedSession.userEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedSession.status !== "resolved" && (
                      <button
                        onClick={handleResolve}
                        disabled={resolving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {resolving ? "Resolving…" : "Mark Resolved"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const isUser = msg.senderType === "user";
                      const isAdmin = msg.senderType === "admin";
                      const isBot = msg.senderType === "bot";

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn("flex gap-2", isUser ? "justify-start" : "justify-start")}
                        >
                          {/* Avatar */}
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                            isUser
                              ? "bg-gradient-to-br from-blue-600/30 to-blue-800/30 border border-blue-500/20"
                              : isAdmin
                                ? "bg-gradient-to-br from-emerald-600/30 to-teal-600/30 border border-emerald-500/20"
                                : "bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-violet-500/20"
                          )}>
                            {isUser ? (
                              <User className="w-3.5 h-3.5 text-blue-400" />
                            ) : isAdmin ? (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={cn(
                                "text-[10px] font-semibold",
                                isUser ? "text-blue-400" : isAdmin ? "text-emerald-400" : "text-violet-400"
                              )}>
                                {isUser ? (selectedSession.userName || "User") : isAdmin ? "You (Expert)" : "Qorix Assistant"}
                              </span>
                              <span className="text-[10px] text-white/25">
                                {format(new Date(msg.createdAt), "h:mm a")}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm",
                                isUser
                                  ? "bg-blue-600/10 border border-blue-500/15 text-blue-100/90 rounded-tl-sm"
                                  : isAdmin
                                    ? "bg-emerald-600/10 border border-emerald-500/15 text-emerald-100/90 rounded-tl-sm"
                                    : "bg-violet-600/10 border border-violet-500/15 text-white/70 rounded-tl-sm"
                              )}
                            >
                              <p
                                className="leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center h-20">
                      <p className="text-xs text-white/20">No messages yet</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Box */}
                {selectedSession.status !== "resolved" ? (
                  <div
                    className="flex-shrink-0 p-3"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600/30 to-teal-600/30 flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                      </div>
                      <input
                        ref={inputRef}
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                        placeholder="Type your reply as an expert…"
                        className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
                      />
                      <motion.button
                        onClick={handleReply}
                        disabled={!reply.trim() || sending}
                        whileTap={{ scale: 0.9 }}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          reply.trim()
                            ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                            : "bg-white/5 text-white/20"
                        )}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                    <p className="text-[10px] text-white/20 mt-1.5 text-center">
                      Your reply will appear in the user's chat instantly
                    </p>
                  </div>
                ) : (
                  <div className="flex-shrink-0 p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Conversation resolved</span>
                    </div>
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
