import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  Send,
  Ban,
  DollarSign,
  Filter,
  Copy,
  Download,
  ChevronDown,
  ChevronRight,
  Phone,
  MessageSquare,
  StickyNote,
  UserCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";

// Task #145 Batch E + G — admin leads list. Surfaces every email/name
// captured by the guest chat widget. Batch G adds an expandable per-row
// outreach panel: "Mark contacted" stamp, free-text sales notes thread,
// and a CSV export button on the toolbar. State is stored in the audit
// log (no new chat_leads columns) so the codebase ZERO-schema-change
// rule holds.

type LeadStatus = "all" | "pending" | "sent" | "converted" | "unsubscribed";
type ContactChannel = "email" | "phone" | "whatsapp" | "telegram" | "other";

interface ChatLead {
  id: number;
  sessionId: number;
  visitorId: string | null;
  email: string;
  name: string | null;
  phone: string | null;
  consent: boolean;
  followUpSentAt: string | null;
  followUpAttempts: number;
  unsubscribedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  sessionStatus: "active" | "expert_requested" | "resolved" | null;
  sessionUserId: number | null;
  sessionDetectedIntent: string | null;
  sessionEngagementScore: number | null;
  sessionConvertedAt: string | null;
  sessionLastMessageAt: string | null;
  // Batch G additions — derived from admin_audit_log so no schema bump:
  lastContactedAt: string | null;
  noteCount: number;
}

interface LeadAuditEvent {
  id: number;
  adminEmail: string | null;
  action: "chat_lead_contacted" | "chat_lead_note";
  summary: string | null;
  metadata: string | null;
  createdAt: string;
}

interface LeadTotals {
  all: number;
  pending: number;
  sent: number;
  converted: number;
  unsubscribed: number;
}

const STATUS_FILTERS: Array<{
  key: LeadStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "all", label: "All", icon: Filter },
  { key: "pending", label: "Pending", icon: Clock },
  { key: "sent", label: "Followup sent", icon: Send },
  { key: "converted", label: "Converted", icon: DollarSign },
  { key: "unsubscribed", label: "Unsubscribed", icon: Ban },
];

const INTENT_BADGE: Record<string, { label: string; tone: string }> = {
  beginner: { label: "Beginner", tone: "text-sky-300 bg-sky-500/15 border-sky-500/30" },
  advanced: { label: "Advanced", tone: "text-violet-300 bg-violet-500/15 border-violet-500/30" },
  skeptic: { label: "Skeptic", tone: "text-amber-300 bg-amber-500/15 border-amber-500/30" },
  price_sensitive: { label: "Price-sensitive", tone: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30" },
  ready_to_invest: { label: "Ready", tone: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
  support: { label: "Support", tone: "text-slate-300 bg-slate-500/15 border-slate-500/30" },
  other: { label: "Other", tone: "text-white/50 bg-white/5 border-white/10" },
};

const CHANNEL_OPTIONS: Array<{ key: ContactChannel; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "email", label: "Email", icon: Mail },
  { key: "phone", label: "Phone", icon: Phone },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "other", label: "Other", icon: UserCheck },
];

export default function AdminChatLeads() {
  const [status, setStatus] = useState<LeadStatus>("all");
  const [leads, setLeads] = useState<ChatLead[]>([]);
  const [totals, setTotals] = useState<LeadTotals>({
    all: 0,
    pending: 0,
    sent: 0,
    converted: 0,
    unsubscribed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function load(opts: { showSpinner?: boolean } = {}) {
    if (opts.showSpinner) setRefreshing(true);
    try {
      const data = await authFetch(`/api/admin/chat-leads?status=${status}`);
      setLeads(data.leads ?? []);
      setTotals(
        data.totals ?? { all: 0, pending: 0, sent: 0, converted: 0, unsubscribed: 0 },
      );
      setError(null);
    } catch (err: any) {
      setError(typeof err?.message === "string" ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // 15s poll keeps the dashboard fresh without hammering the API; the
    // followup worker only runs once a minute so faster polling buys us
    // nothing visible. Re-armed whenever the status filter changes.
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleCopyEmail(lead: ChatLead) {
    void navigator.clipboard
      .writeText(lead.email)
      .then(() => {
        setCopiedId(lead.id);
        setTimeout(() => setCopiedId((v) => (v === lead.id ? null : v)), 1200);
      })
      .catch(() => {
        // Clipboard blocked (no HTTPS / permission) — silently noop, the
        // email is selectable in the row anyway.
      });
  }

  // CSV export uses fetch with credentials so the same auth cookie /
  // header pipeline as authFetch applies; we then download the blob via
  // an in-memory anchor click. Honours the current filter so "Export
  // CSV" while on Pending downloads only pending leads.
  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const res = await fetch(`/api/admin/chat-leads/export.csv?status=${status}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qorix-chat-leads-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(typeof err?.message === "string" ? err.message : "CSV export failed");
    } finally {
      setExportingCsv(false);
    }
  }

  // Funnel headline. "Conversion" here means the lead row was stamped
  // (lead.convertedAt) — that is, a deposit closed AFTER they handed over
  // the email. We compute it client-side from totals so the whole strip
  // refreshes atomically on any filter change.
  const conversionPct = useMemo(() => {
    if (!totals.all) return 0;
    return Math.round((totals.converted / totals.all) * 100);
  }, [totals]);

  return (
    <div className="flex flex-col gap-4">
      {/* Funnel headline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total", value: totals.all, tone: "text-white/85" },
          { label: "Pending", value: totals.pending, tone: "text-amber-300" },
          { label: "Followup sent", value: totals.sent, tone: "text-sky-300" },
          { label: "Converted", value: totals.converted, tone: "text-emerald-300" },
          { label: "Conversion %", value: `${conversionPct}%`, tone: "text-violet-300" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] uppercase tracking-wider text-white/40">{card.label}</p>
            <p className={cn("text-lg font-semibold mt-0.5", card.tone)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter chips + refresh + export */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const Icon = f.icon;
          const count = totals[f.key];
          const active = status === f.key;
          return (
            <button
              key={f.key}
              onClick={() => {
                setStatus(f.key);
                setExpandedId(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                active
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-200"
                  : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
              <span className={cn("text-[10px]", active ? "text-blue-200/80" : "text-white/40")}>
                · {count}
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv || !leads.length}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exportingCsv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export CSV
          </button>
          <button
            onClick={() => load({ showSpinner: true })}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/55 bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30">
          {error}
        </div>
      )}

      {/* Leads list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#0a0d18", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="col-span-3">Email · name</div>
          <div className="col-span-2">Captured</div>
          <div className="col-span-2">Followup</div>
          <div className="col-span-2">Outreach</div>
          <div className="col-span-2">Intent</div>
          <div className="col-span-1 text-right">Status</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-400/60" />
            </div>
            <p className="text-sm text-white/40">No leads in this view yet.</p>
            <p className="text-[11px] text-white/25">
              Leads land here when guest visitors hand over their email in the chat widget.
            </p>
          </div>
        ) : (
          <div>
            {leads.map((lead) => {
              const intent = lead.sessionDetectedIntent ?? "other";
              const intentBadge = INTENT_BADGE[intent] ?? INTENT_BADGE.other!;
              const isExpanded = expandedId === lead.id;

              const statusBadge = lead.unsubscribedAt
                ? { label: "Unsubscribed", tone: "text-white/45 bg-white/5 border-white/10" }
                : lead.convertedAt
                  ? { label: "Converted", tone: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" }
                  : lead.followUpSentAt
                    ? { label: "Sent", tone: "text-sky-300 bg-sky-500/15 border-sky-500/30" }
                    : { label: "Pending", tone: "text-amber-300 bg-amber-500/15 border-amber-500/30" };

              return (
                <div key={lead.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs w-full text-left hover:bg-white/[0.02] transition"
                  >
                    <div className="col-span-3 min-w-0 flex items-center gap-1.5">
                      <span className="text-white/30 shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white/85 font-medium truncate">{lead.email}</p>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyEmail(lead);
                            }}
                            className="text-white/25 hover:text-white/60 transition shrink-0 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedId === lead.id ? (
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </span>
                        </div>
                        {lead.name && <p className="text-white/40 truncate mt-0.5">{lead.name}</p>}
                      </div>
                    </div>

                    <div className="col-span-2 text-white/50">
                      <p>{format(new Date(lead.createdAt), "MMM d, h:mm a")}</p>
                      {lead.visitorId && (
                        <p className="text-[10px] text-white/25 truncate" title={lead.visitorId}>
                          {lead.visitorId.slice(0, 10)}…
                        </p>
                      )}
                    </div>

                    <div className="col-span-2 text-white/50">
                      {lead.followUpSentAt ? (
                        <>
                          <p className="text-sky-300/80">
                            Sent {format(new Date(lead.followUpSentAt), "MMM d, h:mm a")}
                          </p>
                          {lead.followUpAttempts > 1 && (
                            <p className="text-[10px] text-white/30">
                              {lead.followUpAttempts} attempts
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-white/30">Not yet sent</p>
                      )}
                    </div>

                    <div className="col-span-2 text-white/50">
                      {lead.lastContactedAt ? (
                        <p className="text-emerald-300/80">
                          Contacted {formatDistanceToNow(new Date(lead.lastContactedAt), { addSuffix: true })}
                        </p>
                      ) : (
                        <p className="text-white/30">Not contacted</p>
                      )}
                      {lead.noteCount > 0 && (
                        <p className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                          <StickyNote className="w-3 h-3" />
                          {lead.noteCount} note{lead.noteCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded border text-[10px] font-medium",
                          intentBadge.tone,
                        )}
                      >
                        {intentBadge.label}
                      </span>
                    </div>

                    <div className="col-span-1 text-right">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap",
                          statusBadge.tone,
                        )}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <LeadOutreachPanel
                          lead={lead}
                          onMutate={() => load()}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Per-row expansion: the audit thread + actions. Lazy-loads its own
// audit feed when first opened and refetches after any mutation
// (mark-contacted / add-note) so the UI never goes stale.
function LeadOutreachPanel({
  lead,
  onMutate,
}: {
  lead: ChatLead;
  onMutate: () => void;
}) {
  const [events, setEvents] = useState<LeadAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [channel, setChannel] = useState<ContactChannel>("email");
  const [contactNote, setContactNote] = useState("");
  const [note, setNote] = useState("");

  async function loadEvents() {
    try {
      const data = await authFetch(`/api/admin/chat-leads/${lead.id}/audit`);
      setEvents(data.events ?? []);
    } catch (err: any) {
      setActionError(typeof err?.message === "string" ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function handleMarkContacted() {
    setSavingContact(true);
    setActionError(null);
    try {
      await authFetch(`/api/admin/chat-leads/${lead.id}/contacted`, {
        method: "POST",
        body: JSON.stringify({
          channel,
          note: contactNote.trim() || undefined,
        }),
      });
      setContactNote("");
      await loadEvents();
      onMutate();
    } catch (err: any) {
      setActionError(typeof err?.message === "string" ? err.message : "Failed to mark contacted");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    setActionError(null);
    try {
      await authFetch(`/api/admin/chat-leads/${lead.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote("");
      await loadEvents();
      onMutate();
    } catch (err: any) {
      setActionError(typeof err?.message === "string" ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  function parseMetadataNote(metadata: string | null): string | null {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      if (typeof parsed?.note === "string" && parsed.note.trim()) return parsed.note;
    } catch {
      /* ignore — older rows may not be JSON */
    }
    return null;
  }
  function parseChannel(metadata: string | null): string | null {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      if (typeof parsed?.channel === "string") return parsed.channel;
    } catch {
      /* ignore */
    }
    return null;
  }

  return (
    <div
      className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4"
      style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Left: actions */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
            Mark as contacted
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CHANNEL_OPTIONS.map((c) => {
              const Icon = c.icon;
              const active = channel === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setChannel(c.key)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition",
                    active
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                      : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {c.label}
                </button>
              );
            })}
          </div>
          <input
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            placeholder="Optional one-line note (e.g. asked about INR deposit)…"
            className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-emerald-500/40"
            maxLength={500}
          />
          <button
            onClick={handleMarkContacted}
            disabled={savingContact}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-40"
          >
            {savingContact ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            Mark contacted
          </button>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
            Add private note
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you learn? Strategy, follow-up date, anything the next responder should know…"
            rows={3}
            maxLength={1000}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-blue-500/40 resize-none"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-white/30">{note.length}/1000</span>
            <button
              onClick={handleAddNote}
              disabled={savingNote || !note.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/20 border border-blue-500/30 text-blue-200 hover:bg-blue-500/30 transition disabled:opacity-40"
            >
              {savingNote ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <StickyNote className="w-3.5 h-3.5" />
              )}
              Save note
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-md px-2.5 py-1.5 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30">
            {actionError}
          </div>
        )}

        {/* Lead context summary so the operator doesn't have to switch tabs */}
        <div className="rounded-md px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border border-white/[0.05]">
          <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">
            Session #{lead.sessionId}
          </p>
          {lead.phone && <p>Phone: <span className="text-white/80">{lead.phone}</span></p>}
          {lead.sessionEngagementScore !== null && (
            <p>
              Engagement: <span className="text-white/80">{lead.sessionEngagementScore}</span>
            </p>
          )}
          {lead.consent && <p className="text-emerald-300/80">Marketing consent: yes</p>}
        </div>
      </div>

      {/* Right: audit thread */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
          Outreach history
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading history…
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-white/30">No outreach activity yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
            {events.map((e) => {
              const isContact = e.action === "chat_lead_contacted";
              const ch = parseChannel(e.metadata);
              const noteText = parseMetadataNote(e.metadata) ?? e.summary;
              return (
                <div
                  key={e.id}
                  className={cn(
                    "rounded-md px-2.5 py-2 text-xs border",
                    isContact
                      ? "bg-emerald-500/[0.06] border-emerald-500/20"
                      : "bg-blue-500/[0.06] border-blue-500/20",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isContact ? (
                      <UserCheck className="w-3 h-3 text-emerald-300" />
                    ) : (
                      <StickyNote className="w-3 h-3 text-blue-300" />
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isContact ? "text-emerald-300" : "text-blue-300",
                      )}
                    >
                      {isContact ? `Contacted${ch ? ` · ${ch}` : ""}` : "Note"}
                    </span>
                    <span className="text-[10px] text-white/30 ml-auto">
                      {format(new Date(e.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {noteText && <p className="text-white/75 whitespace-pre-wrap">{noteText}</p>}
                  {e.adminEmail && (
                    <p className="text-[10px] text-white/30 mt-0.5">— {e.adminEmail}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
