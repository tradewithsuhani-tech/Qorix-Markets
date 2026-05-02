import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, CheckCircle, Clock, User, Sparkles,
  RefreshCw, UserCheck, X, Circle, TrendingUp, Target, Filter, Zap, DollarSign,
  Settings as SettingsIcon, MessagesSquare, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth-fetch";
import AdminChatSettings from "@/components/admin-chat-settings";
import AdminChatLeads from "@/components/admin-chat-leads";

type AdminChatsTab = "conversations" | "settings" | "leads";

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
  detectedIntent: string | null;
  language: string | null;
  engagementScore: number;
  profile: Record<string, unknown> | null;
  ctaShownCount: number;
  ctaClickedCount: number;
  convertedAt: string | null;
  llmReplyCount: number;
}

interface Message {
  id: number;
  sessionId: number;
  senderType: "user" | "bot" | "admin";
  senderId: number | null;
  content: string;
  createdAt: string;
}

interface ConversionEvent {
  id: number;
  sessionId: number;
  eventType: "cta_shown" | "cta_clicked" | "deposit_page_visited" | "deposit_completed";
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Captured lead row attached to a session (Task #145 Batch E). Most
// authed sessions have `null` here; only guest sessions that hit the
// inline lead form populate it. When present, the responder gets to
// see the visitor's email/name so they can address them by name.
interface SessionLead {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  followUpSentAt: string | null;
  followUpAttempts: number;
  unsubscribedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

const INTENT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  beginner:        { label: "Beginner",        color: "text-sky-300",     bg: "bg-sky-500/15 border-sky-500/30" },
  advanced:        { label: "Advanced",        color: "text-violet-300",  bg: "bg-violet-500/15 border-violet-500/30" },
  skeptic:         { label: "Skeptic",         color: "text-amber-300",   bg: "bg-amber-500/15 border-amber-500/30" },
  price_sensitive: { label: "Price-sensitive", color: "text-yellow-300",  bg: "bg-yellow-500/15 border-yellow-500/30" },
  ready_to_invest: { label: "Ready to invest", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  support:         { label: "Support",         color: "text-slate-300",   bg: "bg-slate-500/15 border-slate-500/30" },
  other:           { label: "Other",           color: "text-white/50",    bg: "bg-white/5 border-white/10" },
};

type FilterKey = "all" | "converted" | "engaged_no_click" | "skeptic" | "needs_expert";

const FILTERS: Array<{ key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "all",              label: "All",                       icon: Filter },
  { key: "needs_expert",     label: "Needs Expert",              icon: UserCheck },
  { key: "converted",        label: "Converted",                 icon: DollarSign },
  { key: "engaged_no_click", label: "High engagement, no click", icon: Zap },
  { key: "skeptic",          label: "Skeptics",                  icon: Target },
];

function SessionInsightStrip({
  session,
  events,
  lead,
}: {
  session: Session;
  events: ConversionEvent[];
  lead: SessionLead | null;
}) {
  const intent = session.detectedIntent ?? "other";
  const intentBadge = INTENT_BADGE[intent] ?? INTENT_BADGE.other!;
  const profile = session.profile ?? {};
  const profileEntries = Object.entries(profile).filter(([, v]) => {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  const recentEvents = events.slice(0, 6);

  return (
    <div
      className="px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-3 flex-wrap text-[11px]"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <span
        className={cn(
          "px-2 py-0.5 rounded border font-medium",
          intentBadge.color,
          intentBadge.bg,
        )}
      >
        {intentBadge.label}
      </span>
      {session.language && (
        <span className="text-white/40">
          <span className="text-white/25">lang:</span> {session.language}
        </span>
      )}
      <span className="text-white/40 flex items-center gap-1">
        <Zap className="w-3 h-3" />
        engagement <span className="text-white/70 font-medium">{session.engagementScore}</span>
      </span>
      <span className="text-white/40">
        AI replies <span className="text-white/70 font-medium">{session.llmReplyCount}</span>
      </span>
      <span className="text-white/40">
        CTA <span className="text-white/70 font-medium">{session.ctaShownCount}</span>
        {" / clicked "}
        <span className="text-white/70 font-medium">{session.ctaClickedCount}</span>
      </span>
      {session.convertedAt ? (
        <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-medium flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Converted {format(new Date(session.convertedAt), "MMM d")}
        </span>
      ) : (
        <span className="text-white/30">Not yet converted</span>
      )}
      {/* Captured lead pill — visible only when a guest visitor handed
          over their email via the in-chat form. Includes followup state
          so the human responder knows whether the SES nudge already went
          out before they pick up the conversation. */}
      {lead && (
        <span
          className="px-2 py-0.5 rounded border font-medium flex items-center gap-1 max-w-[260px]"
          title={lead.email + (lead.name ? ` · ${lead.name}` : "")}
          style={{
            background: "rgba(56,189,248,0.10)",
            borderColor: "rgba(56,189,248,0.30)",
            color: "rgb(125,211,252)",
          }}
        >
          <span aria-hidden>✉</span>
          <span className="truncate">{lead.email}</span>
          {lead.name && <span className="text-sky-200/60 truncate">· {lead.name}</span>}
          {lead.followUpSentAt ? (
            <span className="text-[10px] text-sky-200/60 shrink-0">· sent</span>
          ) : (
            <span className="text-[10px] text-amber-300/80 shrink-0">· pending</span>
          )}
        </span>
      )}

      {profileEntries.length > 0 && (
        <details className="ml-auto group">
          <summary className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer list-none">
            Profile · {profileEntries.length}
          </summary>
          <div className="mt-2 w-full text-[10px] text-white/60 space-y-0.5 max-w-[260px]">
            {profileEntries.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <span className="text-white/35 shrink-0">{k}:</span>
                <span className="truncate">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {recentEvents.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer list-none">
            Events · {events.length}
          </summary>
          <div className="mt-2 w-full text-[10px] text-white/55 space-y-0.5 max-w-[260px]">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <span className="text-white/30 shrink-0">
                  {format(new Date(e.createdAt), "MMM d, h:mm a")}
                </span>
                <span className="truncate">{e.eventType}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// XSS hardening: chat messages on the admin surface include LLM output and
// raw end-user input — both attacker-controlled. Escape HTML-significant
// characters before applying the markdown substitutions so any injected
// `<script>`/event-handler/iframe payloads render as inert text.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseMarkdown(text: string) {
  text = escapeHtml(text);
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
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [lead, setLead] = useState<SessionLead | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  // Top-level tab: "conversations" (default — existing list/detail UI) or
  // "settings" (Task 145 Batch C — AI prompt + model + CTA copy editor).
  const [tab, setTab] = useState<AdminChatsTab>("conversations");
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
      const { messages: data, events: eventList, session, lead: leadRow } = await apiGet(
        `/admin/chats/${sessionId}/messages`,
      );
      setMessages(data);
      setEvents(eventList ?? []);
      setLead(leadRow ?? null);
      // Refresh the selected session with the latest server-side enrichments
      // (intent, engagement, conversion stamp) so the detail-panel header
      // doesn't go stale during a long support reply.
      if (session) {
        setSelectedSession((prev) => (prev && prev.id === session.id ? { ...prev, ...session } : prev));
      }
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
    setLead(null);
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
  const baseOrderedSessions = [...expertSessions, ...activeSessions, ...resolvedSessions];

  // Filter view — supports the four operationally-useful audience cuts the
  // human team asks for ("who needs me?", "who converted?", "who almost
  // did?", "who's pushing back?"). The "all" key skips filtering entirely.
  const orderedSessions = baseOrderedSessions.filter((s) => {
    switch (filter) {
      case "needs_expert":
        return s.status === "expert_requested";
      case "converted":
        return Boolean(s.convertedAt);
      case "engaged_no_click":
        // High intent / engagement but never clicked the CTA — these are the
        // hand-off candidates: warm leads who need a human nudge.
        return s.engagementScore >= 4 && s.ctaShownCount > 0 && s.ctaClickedCount === 0 && !s.convertedAt;
      case "skeptic":
        return s.detectedIntent === "skeptic";
      case "all":
      default:
        return true;
    }
  });

  const filterCounts: Record<FilterKey, number> = {
    all: baseOrderedSessions.length,
    needs_expert: baseOrderedSessions.filter((s) => s.status === "expert_requested").length,
    converted: baseOrderedSessions.filter((s) => Boolean(s.convertedAt)).length,
    engaged_no_click: baseOrderedSessions.filter(
      (s) => s.engagementScore >= 4 && s.ctaShownCount > 0 && s.ctaClickedCount === 0 && !s.convertedAt,
    ).length,
    skeptic: baseOrderedSessions.filter((s) => s.detectedIntent === "skeptic").length,
  };

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
              {/* Tab toggle: conversations vs settings */}
              <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
                <button
                  onClick={() => setTab("conversations")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    tab === "conversations"
                      ? "bg-blue-600/25 text-blue-200"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  <MessagesSquare className="w-3.5 h-3.5" />
                  Conversations
                </button>
                <button
                  onClick={() => setTab("leads")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    tab === "leads"
                      ? "bg-blue-600/25 text-blue-200"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Leads
                </button>
                <button
                  onClick={() => setTab("settings")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    tab === "settings"
                      ? "bg-blue-600/25 text-blue-200"
                      : "text-white/50 hover:text-white/80",
                  )}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  AI Settings
                </button>
              </div>
              {tab === "conversations" && expertSessions.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-xs text-amber-400 font-medium">{expertSessions.length} need expert</span>
                </div>
              )}
              {tab === "conversations" && (
                <button
                  onClick={loadSessions}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white/50" />
                </button>
              )}
            </div>
          </div>
        </div>

        {tab === "settings" ? (
          <AdminChatSettings />
        ) : tab === "leads" ? (
          <div className="px-4 pb-4">
            <AdminChatLeads />
          </div>
        ) : (
        <>
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
            {/* Filter chips */}
            <div className="px-2 py-2 border-b border-white/[0.05] flex flex-wrap gap-1">
              {FILTERS.map(({ key, label, icon: Icon }) => {
                const active = filter === key;
                const count = filterCounts[key];
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors",
                      active
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-200"
                        : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70",
                    )}
                    title={label}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                    <span className={cn("ml-0.5", active ? "text-blue-300" : "text-white/30")}>
                      {count}
                    </span>
                  </button>
                );
              })}
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
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {session.convertedAt && (
                                  <DollarSign className="w-3 h-3 text-emerald-400" aria-label="Converted" />
                                )}
                                <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                              </div>
                            </div>
                            <p className="text-[10px] text-white/40 truncate">{session.userEmail || "—"}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className={cn("text-[9px] font-medium", cfg.color)}>{cfg.label}</span>
                              {session.detectedIntent && INTENT_BADGE[session.detectedIntent] && (
                                <span
                                  className={cn(
                                    "text-[9px] font-medium px-1.5 py-px rounded border",
                                    INTENT_BADGE[session.detectedIntent]!.color,
                                    INTENT_BADGE[session.detectedIntent]!.bg,
                                  )}
                                >
                                  {INTENT_BADGE[session.detectedIntent]!.label}
                                </span>
                              )}
                              {session.engagementScore > 0 && (
                                <span className="text-[9px] text-white/40 flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5" />
                                  {session.engagementScore}
                                </span>
                              )}
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

                {/* Session insight strip — intent, language, engagement, CTA stats,
                    conversion stamp, latent profile + recent conversion events. Gives
                    the human responder full context at a glance before replying. */}
                <SessionInsightStrip session={selectedSession} events={events} lead={lead} />

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
        </>
        )}
      </div>
    </Layout>
  );
}
