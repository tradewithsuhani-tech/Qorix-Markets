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
  Activity,
  TrendingUp,
  Timer,
  CheckSquare,
  Check,
  X,
  Bookmark,
  Plus,
  MessageCircle,
  Bot,
  Shield,
  User,
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
// Task #145 Batch I — server-derived auto-tag. Temperature is computed
// server-side via shared SQL CASE expression (see chat.ts
// temperatureSql). The frontend treats it as opaque.
type LeadTemperature = "hot" | "warm" | "cold";
type TemperatureFilter = "all" | LeadTemperature;

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
  // Batch I auto-tag — server-derived from intent + engagement +
  // recency + conversion state. Filter via ?temperature query param.
  temperature: LeadTemperature;
}

interface LeadAuditEvent {
  id: number;
  adminEmail: string | null;
  action: "chat_lead_contacted" | "chat_lead_note";
  summary: string | null;
  metadata: string | null;
  createdAt: string;
}

// Batch N — conversation transcript for the lead's session. Read-only
// admin view of the actual chat the guest had with the bot before
// dropping their email. senderType matches the chat_messages enum.
interface ChatMessage {
  id: number;
  senderType: "user" | "bot" | "admin" | string;
  senderId: number | null;
  content: string;
  createdAt: string;
}

interface LeadTotals {
  all: number;
  pending: number;
  sent: number;
  converted: number;
  unsubscribed: number;
  hot: number;
  warm: number;
  cold: number;
}

// Task #145 Batch H — analytics strip. Returned by GET
// /admin/chat-leads/analytics. Cohort view (last 7 days, bucketed by
// capture date) + per-intent + channel breakdown + 30d totals.
interface DailyRow {
  date: string;
  captured: number;
  sent: number;
  converted: number;
  unsubscribed: number;
}
interface IntentRow {
  intent: string;
  total: number;
  sent: number;
  converted: number;
  unsubscribed: number;
  conversionPct: number;
}
interface ChannelRow {
  channel: string;
  count: number;
}
interface AnalyticsResponse {
  daily: DailyRow[];
  perIntent: IntentRow[];
  channels: ChannelRow[];
  totals30d: {
    captured: number;
    sent: number;
    converted: number;
    unsubscribed: number;
    conversionPct: number;
    avgHoursToConvert: number | null;
  };
  // Batch I — pipeline composition over the last 30 days using the
  // same hot/warm/cold heuristic as the listing.
  temperature30d?: { hot: number; warm: number; cold: number };
}

// Task #145 Batch K — saved views. A view is a named (status,
// temperature) tuple that operators can pin to one click. Presets are
// built-in and undeletable; user views are persisted in localStorage
// so they survive across sessions on the same device. Storage is
// per-admin-per-browser by design — we don't want one operator's
// "Cold > 30d, ready to delete" view leaking onto another operator's
// dashboard. Server-side persistence would need a new table; leaving
// that for if/when ops actually ask for cross-device sync.
interface SavedView {
  id: string;
  name: string;
  status: LeadStatus;
  temperature: TemperatureFilter;
  preset?: boolean;
}

const VIEWS_STORAGE_KEY = "qorix.chat-leads.views";

const PRESET_VIEWS: SavedView[] = [
  { id: "preset:hot-pending", name: "Hot · pending", status: "pending", temperature: "hot", preset: true },
  { id: "preset:warm-sent", name: "Warm · sent", status: "sent", temperature: "warm", preset: true },
  { id: "preset:cold-pending", name: "Cold · pending", status: "pending", temperature: "cold", preset: true },
  { id: "preset:hot-converted", name: "Won (hot)", status: "converted", temperature: "hot", preset: true },
];

// URL-state helpers. Mount reads ?status= and ?temperature= so views
// are linkable/bookmarkable; subsequent changes write back via
// replaceState (no history pollution — this is a filter not a nav).
function readUrlFilters(): { status: LeadStatus; temperature: TemperatureFilter } {
  if (typeof window === "undefined") return { status: "all", temperature: "all" };
  const params = new URLSearchParams(window.location.search);
  const s = params.get("status");
  const t = params.get("temperature");
  const validStatus: LeadStatus[] = ["all", "pending", "sent", "converted", "unsubscribed"];
  const validTemp: TemperatureFilter[] = ["all", "hot", "warm", "cold"];
  return {
    status: validStatus.includes(s as LeadStatus) ? (s as LeadStatus) : "all",
    temperature: validTemp.includes(t as TemperatureFilter) ? (t as TemperatureFilter) : "all",
  };
}
function writeUrlFilters(status: LeadStatus, temperature: TemperatureFilter) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (status === "all") params.delete("status");
  else params.set("status", status);
  if (temperature === "all") params.delete("temperature");
  else params.set("temperature", temperature);
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

const TEMPERATURE_BADGE: Record<
  LeadTemperature,
  { label: string; tone: string; dot: string }
> = {
  hot: {
    label: "Hot",
    tone: "text-rose-300 bg-rose-500/15 border-rose-500/30",
    dot: "bg-rose-400",
  },
  warm: {
    label: "Warm",
    tone: "text-amber-300 bg-amber-500/15 border-amber-500/30",
    dot: "bg-amber-400",
  },
  cold: {
    label: "Cold",
    tone: "text-sky-300 bg-sky-500/15 border-sky-500/30",
    dot: "bg-sky-400",
  },
};

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
  // Batch K — initial state restored from the URL so links/bookmarks
  // (e.g. /admin/chats?status=pending&temperature=hot) load straight
  // into the right view.
  const [status, setStatus] = useState<LeadStatus>(() => readUrlFilters().status);
  const [temperature, setTemperature] = useState<TemperatureFilter>(
    () => readUrlFilters().temperature,
  );
  const [leads, setLeads] = useState<ChatLead[]>([]);
  const [totals, setTotals] = useState<LeadTotals>({
    all: 0,
    pending: 0,
    sent: 0,
    converted: 0,
    unsubscribed: 0,
    hot: 0,
    warm: 0,
    cold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  // Batch J — bulk select. Selection is keyed by lead id and survives
  // refetch (set is filtered to currently-visible ids on render so
  // stale ids drop out automatically without breaking 'select all').
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<ContactChannel>("email");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // Batch K — saved views (localStorage) + inline rename state.
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savingViewName, setSavingViewName] = useState<string | null>(null);

  // Load saved views once on mount. Wrapped in try/catch in case the
  // user blocked localStorage (private mode, some Safari setups) — we
  // simply degrade to "presets only".
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEWS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedViews(
          parsed.filter(
            (v: any): v is SavedView =>
              v && typeof v.id === "string" && typeof v.name === "string",
          ),
        );
      }
    } catch {
      /* ignore — degrade gracefully */
    }
  }, []);

  // Push filter changes back into the URL so the current view is
  // shareable. Runs after every filter mutation.
  useEffect(() => {
    writeUrlFilters(status, temperature);
  }, [status, temperature]);

  function persistViews(next: SavedView[]) {
    setSavedViews(next);
    try {
      localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function applyView(v: SavedView) {
    setStatus(v.status);
    setTemperature(v.temperature);
    setExpandedId(null);
  }
  function deleteView(id: string) {
    persistViews(savedViews.filter((v) => v.id !== id));
  }
  function commitNewView() {
    const name = (savingViewName ?? "").trim().slice(0, 60);
    if (!name) {
      setSavingViewName(null);
      return;
    }
    // Don't allow duplicate names.
    const exists = [...PRESET_VIEWS, ...savedViews].some(
      (v) => v.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setSavingViewName(null);
      return;
    }
    persistViews([
      ...savedViews,
      { id: `user:${Date.now()}`, name, status, temperature, preset: false },
    ]);
    setSavingViewName(null);
  }

  async function load(opts: { showSpinner?: boolean } = {}) {
    if (opts.showSpinner) setRefreshing(true);
    try {
      const params = new URLSearchParams({ status });
      if (temperature !== "all") params.set("temperature", temperature);
      const data = await authFetch(`/api/admin/chat-leads?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotals(
        data.totals ?? {
          all: 0,
          pending: 0,
          sent: 0,
          converted: 0,
          unsubscribed: 0,
          hot: 0,
          warm: 0,
          cold: 0,
        },
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
    // nothing visible. Re-armed whenever a filter changes.
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, temperature]);

  // Analytics is independent of the status filter — it always covers
  // the same trailing windows (7d daily / 30d aggregates). Polled at
  // 60s instead of 15s because the underlying numbers change much
  // more slowly than the live leads list.
  async function loadAnalytics() {
    try {
      const data = await authFetch(`/api/admin/chat-leads/analytics`);
      setAnalytics(data);
    } catch {
      // Soft-fail: leaving the strip collapsed/blank is fine, the rest
      // of the page still works without analytics.
    }
  }
  useEffect(() => {
    loadAnalytics();
    const t = setInterval(loadAnalytics, 60000);
    return () => clearInterval(t);
  }, []);

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
  // CSV" while on Pending downloads only pending leads. When `ids` is
  // provided (Batch J bulk-export), selection takes priority over the
  // status filter and the server uses ?ids= to scope the output.
  async function handleExportCsv(ids?: number[]) {
    setExportingCsv(true);
    try {
      const params = new URLSearchParams({ status });
      if (ids && ids.length > 0) params.set("ids", ids.join(","));
      const res = await fetch(`/api/admin/chat-leads/export.csv?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        ids && ids.length > 0
          ? `qorix-chat-leads-selection-${new Date().toISOString().slice(0, 10)}.csv`
          : `qorix-chat-leads-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
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

  // Batch J helpers — selection toggles + bulk submit.
  const visibleIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleIds.length > 0 && !allVisibleSelected;

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setBulkPickerOpen(false);
    setBulkNote("");
    setBulkError(null);
  }

  async function handleBulkMarkContacted() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkSubmitting(true);
    setBulkError(null);
    try {
      const res = await authFetch(`/api/admin/chat-leads/bulk/contacted`, {
        method: "POST",
        body: JSON.stringify({
          ids,
          channel: bulkChannel,
          note: bulkNote.trim() || undefined,
        }),
      });
      // Server returns { count, requested } — surface partial-success
      // (stale ids dropped) as a soft warning rather than an error.
      if (typeof res?.count === "number" && typeof res?.requested === "number" && res.count < res.requested) {
        setBulkError(`Logged ${res.count} of ${res.requested} (others may have been deleted).`);
      }
      clearSelection();
      void load();
    } catch (err: any) {
      setBulkError(typeof err?.message === "string" ? err.message : "Bulk mark-contacted failed");
    } finally {
      setBulkSubmitting(false);
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
      {/* Analytics strip (Batch H) */}
      <AnalyticsStrip
        analytics={analytics}
        open={analyticsOpen}
        onToggle={() => setAnalyticsOpen((v) => !v)}
      />

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
          {/* Temperature filter — separate visual lane (dot prefix) so
              it doesn't compete with the status chips above for
              attention. Combined with status filter on the server. */}
          <div className="flex items-center gap-1 mr-1">
            {(["all", "hot", "warm", "cold"] as const).map((k) => {
              const active = temperature === k;
              const badge = k === "all" ? null : TEMPERATURE_BADGE[k];
              const count = k === "all" ? totals.all : totals[k];
              return (
                <button
                  key={k}
                  onClick={() => {
                    setTemperature(k);
                    setExpandedId(null);
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                    active
                      ? badge
                        ? badge.tone
                        : "bg-white/10 border-white/20 text-white/85"
                      : "bg-white/5 border-white/10 text-white/45 hover:bg-white/10",
                  )}
                  title={k === "all" ? "All leads (any temperature)" : `${badge!.label} leads`}
                >
                  {badge ? (
                    <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
                  ) : (
                    <Activity className="w-3 h-3" />
                  )}
                  {k === "all" ? "Any" : badge!.label}
                  <span className="text-[10px] opacity-60">· {count}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => handleExportCsv()}
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

      {/* Batch K — saved views row. Sits between the filter toolbar
          and the bulk action bar / leads list. Active view auto-
          highlights when current (status, temperature) matches.
          Presets are pinned first; user views follow with a delete
          button on hover. "+ Save current" inline-renames into a
          tiny input. */}
      {(() => {
        const allViews = [...PRESET_VIEWS, ...savedViews];
        const activeView = allViews.find(
          (v) => v.status === status && v.temperature === temperature,
        );
        const canSave = !activeView; // no point saving a duplicate of an existing view
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/35 mr-1">
              <Bookmark className="w-3 h-3" />
              Views
            </div>
            {allViews.map((v) => {
              const active = activeView?.id === v.id;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "group relative flex items-center gap-1 rounded-md text-[11px] border transition",
                    active
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-100"
                      : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10",
                  )}
                >
                  <button
                    onClick={() => applyView(v)}
                    className="flex items-center gap-1 px-2 py-1"
                    title={`Apply: status=${v.status}, temp=${v.temperature}`}
                  >
                    {v.preset ? (
                      <Bookmark className="w-3 h-3 opacity-60" />
                    ) : (
                      <Bookmark className="w-3 h-3 text-amber-300/80" />
                    )}
                    {v.name}
                  </button>
                  {!v.preset && (
                    <button
                      onClick={() => deleteView(v.id)}
                      className="pr-1.5 pl-0.5 py-1 text-white/30 hover:text-rose-300 transition opacity-0 group-hover:opacity-100"
                      title="Delete view"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Save / cancel inline rename */}
            {savingViewName === null ? (
              <button
                onClick={() => setSavingViewName("")}
                disabled={!canSave}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition",
                  canSave
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/20"
                    : "bg-white/5 border-white/10 text-white/30 cursor-not-allowed",
                )}
                title={
                  canSave
                    ? "Save the current filter combo as a named view"
                    : "Already saved as: " + (activeView?.name ?? "")
                }
              >
                <Plus className="w-3 h-3" />
                Save current
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={savingViewName}
                  onChange={(e) => setSavingViewName(e.target.value.slice(0, 60))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitNewView();
                    if (e.key === "Escape") setSavingViewName(null);
                  }}
                  placeholder="Name this view"
                  className="px-2 py-1 rounded-md text-[11px] bg-white/5 border border-emerald-500/30 text-white/85 placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50"
                  style={{ width: 140 }}
                />
                <button
                  onClick={commitNewView}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-emerald-200 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={() => setSavingViewName(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/55 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {(status !== "all" || temperature !== "all") && (
              <button
                onClick={() => {
                  setStatus("all");
                  setTemperature("all");
                  setExpandedId(null);
                }}
                className="ml-1 px-2 py-1 rounded-md text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition"
                title="Clear all filters"
              >
                Reset filters
              </button>
            )}
          </div>
        );
      })()}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg px-3 py-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30">
          {error}
        </div>
      )}

      {/* Batch J — bulk action bar. Mounts when ≥1 lead selected.
          Renders inline (not floating) so it pushes the leads list
          down rather than overlapping rows; collapsed by default and
          expands a channel picker + note input when "Mark contacted"
          is tapped (two-stage confirm to avoid accidental bulk audits). */}
      {selectedIds.size > 0 && (
        <div
          className="rounded-2xl px-4 py-3 flex flex-col gap-3"
          style={{
            background: "rgba(56,132,255,0.06)",
            border: "1px solid rgba(56,132,255,0.25)",
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-blue-100">
              <CheckSquare className="w-4 h-4 text-blue-300" />
              <span className="font-medium">{selectedIds.size}</span>
              <span className="text-blue-100/65">selected</span>
              {selectedIds.size > 200 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  Capped at 200 per action
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setBulkPickerOpen((v) => !v)}
                disabled={bulkSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-100 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 transition disabled:opacity-40"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Mark contacted
              </button>
              <button
                onClick={() => handleExportCsv(Array.from(selectedIds))}
                disabled={exportingCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-200 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition disabled:opacity-40"
              >
                {exportingCsv ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export selected
              </button>
              <button
                onClick={clearSelection}
                disabled={bulkSubmitting}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/55 bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {bulkPickerOpen && (
            <div className="flex flex-col gap-2 pt-1" style={{ borderTop: "1px solid rgba(56,132,255,0.18)" }}>
              <div className="flex items-center gap-1.5 flex-wrap pt-2">
                <span className="text-[11px] text-white/45 mr-1">Channel:</span>
                {CHANNEL_OPTIONS.map((c) => {
                  const Icon = c.icon;
                  const active = bulkChannel === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setBulkChannel(c.key)}
                      disabled={bulkSubmitting}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition",
                        active
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-100"
                          : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10",
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value.slice(0, 1000))}
                placeholder="Optional note attached to every audit entry (1000 chars)"
                rows={2}
                disabled={bulkSubmitting}
                className="w-full rounded-lg px-3 py-2 text-xs text-white/85 bg-white/5 border border-white/10 placeholder:text-white/25 focus:outline-none focus:border-blue-500/40 resize-none disabled:opacity-40"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleBulkMarkContacted}
                  disabled={bulkSubmitting || selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-100 bg-blue-500/25 border border-blue-500/45 hover:bg-blue-500/35 transition disabled:opacity-40"
                >
                  {bulkSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirm — log {Math.min(selectedIds.size, 200)} audit{selectedIds.size === 1 ? "" : "s"}
                </button>
                <span className="text-[11px] text-white/35">
                  Writes one audit row per lead via {bulkChannel}.
                </span>
              </div>
              {bulkError && (
                <p className="text-[11px] text-rose-300/85">{bulkError}</p>
              )}
            </div>
          )}
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
          <div className="col-span-3 flex items-center gap-2">
            {/* Batch J — select-all-visible. Indeterminate when partial.
                Click is contained here (no row expand to dodge). */}
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = someVisibleSelected;
              }}
              onChange={toggleAllVisible}
              disabled={visibleIds.length === 0}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={
                allVisibleSelected
                  ? "Clear selection on this page"
                  : `Select all ${visibleIds.length} visible leads`
              }
            />
            <span>Email · name</span>
          </div>
          <div className="col-span-2">Captured</div>
          <div className="col-span-2">Followup</div>
          <div className="col-span-2">Outreach</div>
          <div className="col-span-1">Intent</div>
          <div className="col-span-1">Temp</div>
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
              const tempBadge = TEMPERATURE_BADGE[lead.temperature] ?? TEMPERATURE_BADGE.cold;

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
                      {/* Batch J — per-row selection. stopPropagation
                          so the checkbox click doesn't bubble up and
                          toggle the row's expand state. */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-blue-500 cursor-pointer shrink-0"
                        title={selectedIds.has(lead.id) ? "Deselect" : "Select"}
                      />
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

                    <div className="col-span-1">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded border text-[10px] font-medium",
                          intentBadge.tone,
                        )}
                      >
                        {intentBadge.label}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium",
                          tempBadge.tone,
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", tempBadge.dot)} />
                        {tempBadge.label}
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
  // Batch N — conversation transcript. Lazy-loaded in parallel with the
  // audit feed when the row first opens. Errors render inline so a
  // missing/failed transcript never blocks the rest of the panel.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

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

  async function loadTimeline() {
    try {
      const data = await authFetch(`/api/admin/chat-leads/${lead.id}/timeline`);
      setMessages(data.messages ?? []);
      setTimelineError(null);
    } catch (err: any) {
      setTimelineError(typeof err?.message === "string" ? err.message : "Failed to load transcript");
    } finally {
      setLoadingTimeline(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setLoadingTimeline(true);
    // Fire both fetches in parallel — they're independent and the panel
    // renders progressively as each resolves.
    loadEvents();
    loadTimeline();
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

      {/*
        Batch N — full-width conversation transcript.
        Spans both columns on md+ so message bubbles get enough room.
        User msgs anchor right (sky), bot msgs anchor left (slate),
        admin msgs anchor left (purple) so the operator can tell at a
        glance who said what.
      */}
      <div className="md:col-span-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" />
            Conversation transcript
          </p>
          {!loadingTimeline && messages.length > 0 && (
            <span className="text-[10px] text-white/25">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {loadingTimeline ? (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading transcript…
          </div>
        ) : timelineError ? (
          <div className="rounded-md px-2.5 py-1.5 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30">
            {timelineError}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-white/30">No messages in this session.</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1 rounded-md bg-white/[0.02] border border-white/[0.05] p-2.5">
            {messages.map((m) => {
              const isUser = m.senderType === "user";
              const isAdmin = m.senderType === "admin";
              const Icon = isUser ? User : isAdmin ? Shield : Bot;
              const senderLabel = isUser ? "Guest" : isAdmin ? "Admin" : "Bot";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    isUser ? "self-end items-end" : "self-start items-start",
                  )}
                >
                  <div className="flex items-center gap-1 mb-0.5 text-[10px] text-white/35">
                    <Icon
                      className={cn(
                        "w-2.5 h-2.5",
                        isUser
                          ? "text-sky-300/70"
                          : isAdmin
                            ? "text-purple-300/70"
                            : "text-white/40",
                      )}
                    />
                    <span>{senderLabel}</span>
                    <span className="text-white/25">·</span>
                    <span>{format(new Date(m.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words border",
                      isUser
                        ? "bg-sky-500/15 border-sky-500/25 text-sky-100/90"
                        : isAdmin
                          ? "bg-purple-500/15 border-purple-500/25 text-purple-100/90"
                          : "bg-white/[0.04] border-white/[0.08] text-white/80",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Task #145 Batch H — collapsible analytics strip rendered above the
// funnel cards on the Leads tab. Header is always visible and shows
// the headline conversion% + avg-time-to-convert; the expanded body
// reveals an inline 7-day sparkline, per-intent breakdown cards, and
// channel-pill chips. Pure presentational — driven entirely by the
// `analytics` prop fetched once a minute by the parent.
function AnalyticsStrip({
  analytics,
  open,
  onToggle,
}: {
  analytics: AnalyticsResponse | null;
  open: boolean;
  onToggle: () => void;
}) {
  if (!analytics) {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-2 text-xs text-white/40"
        style={{ background: "#0a0d18", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Activity className="w-3.5 h-3.5" />
        Loading analytics…
      </div>
    );
  }

  const { totals30d, daily, perIntent, channels, temperature30d } = analytics;
  const avgHrs = totals30d.avgHoursToConvert;
  const avgLabel =
    avgHrs === null
      ? "—"
      : avgHrs < 1
        ? `${Math.round(avgHrs * 60)}m`
        : avgHrs < 48
          ? `${avgHrs.toFixed(1)}h`
          : `${Math.round(avgHrs / 24)}d`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#0a0d18", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition"
      >
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Analytics · last 30 days
          </p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-sm text-white/85">
              <span className="font-semibold text-emerald-300">
                {totals30d.conversionPct}%
              </span>
              <span className="text-white/40"> conversion</span>
            </span>
            <span className="text-white/15">·</span>
            <span className="text-sm text-white/55 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              avg <span className="text-white/85 font-medium">{avgLabel}</span> to convert
            </span>
            <span className="text-white/15">·</span>
            <span className="text-sm text-white/55">
              {totals30d.captured} captured · {totals30d.converted} won
            </span>
          </div>
        </div>
        <div className="hidden md:block shrink-0 mr-2">
          <Sparkline daily={daily} />
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                  Last 7 days · capture cohort
                </p>
                <SparklineLarge daily={daily} />
                <div className="flex items-center gap-3 mt-2 text-[10px] text-white/45">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-white/40" />
                    Captured
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" />
                    Converted
                  </span>
                </div>
              </div>

              <div className="md:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Conversion by intent
                </p>
                {perIntent.length === 0 ? (
                  <p className="text-xs text-white/30">No leads in window.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {perIntent.slice(0, 6).map((row) => {
                      const badge = INTENT_BADGE[row.intent] ?? INTENT_BADGE.other!;
                      const maxPct = Math.max(
                        1,
                        ...perIntent.map((r) => r.conversionPct),
                      );
                      const barPct = (row.conversionPct / maxPct) * 100;
                      return (
                        <div key={row.intent} className="text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded border text-[10px] font-medium",
                                badge.tone,
                              )}
                            >
                              {badge.label}
                            </span>
                            <span className="text-white/55">
                              <span className="text-white/80 font-medium">
                                {row.conversionPct}%
                              </span>
                              <span className="text-white/30">
                                {" "}
                                · {row.converted}/{row.total}
                              </span>
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full bg-emerald-400/70"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="md:col-span-1 flex flex-col gap-3">
                {temperature30d && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                      Pipeline · 30d
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["hot", "warm", "cold"] as const).map((k) => {
                        const b = TEMPERATURE_BADGE[k];
                        return (
                          <span
                            key={k}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border font-medium",
                              b.tone,
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", b.dot)} />
                            {b.label}
                            <span className="opacity-60">· {temperature30d[k]}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                    Outreach channels · 30d
                  </p>
                  {channels.length === 0 ? (
                    <p className="text-xs text-white/30">
                      No "Mark contacted" actions logged yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {channels.map((c) => (
                        <span
                          key={c.channel}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-white/65"
                        >
                          <span className="capitalize">{c.channel}</span>
                          <span className="text-white/35"> · {c.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">
                      Followup sent
                    </p>
                    <p className="text-sm font-medium text-sky-300 mt-0.5">
                      {totals30d.sent}
                      <span className="text-white/30 text-[10px] font-normal">
                        {" "}
                        / {totals30d.captured}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-md px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">
                      Unsubscribed
                    </p>
                    <p className="text-sm font-medium text-white/70 mt-0.5">
                      {totals30d.unsubscribed}
                      <span className="text-white/30 text-[10px] font-normal">
                        {" "}
                        / {totals30d.captured}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline header sparkline — captured (white/35) + converted (emerald)
// drawn as two polylines on a 7-point grid. Self-scaling on max value.
// Used in the always-visible header bar so the trend is glance-able.
function Sparkline({ daily }: { daily: DailyRow[] }) {
  const w = 96;
  const h = 28;
  const pad = 2;
  const max = Math.max(1, ...daily.map((d) => d.captured));
  const stepX = daily.length > 1 ? (w - pad * 2) / (daily.length - 1) : 0;
  const toY = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const linePath = (key: keyof Pick<DailyRow, "captured" | "converted">) =>
    daily
      .map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${toY(d[key])}`)
      .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path
        d={linePath("captured")}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.25}
      />
      <path
        d={linePath("converted")}
        fill="none"
        stroke="rgb(52,211,153)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

// Larger version of the same sparkline used inside the expanded panel.
// Adds dotted baseline + per-point hover titles. Lightweight: no
// chart lib pulled in for one widget.
function SparklineLarge({ daily }: { daily: DailyRow[] }) {
  const w = 280;
  const h = 80;
  const pad = 6;
  const max = Math.max(1, ...daily.map((d) => Math.max(d.captured, d.converted)));
  const stepX = daily.length > 1 ? (w - pad * 2) / (daily.length - 1) : 0;
  const toY = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const linePath = (key: keyof Pick<DailyRow, "captured" | "converted">) =>
    daily
      .map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${toY(d[key])}`)
      .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="rgba(255,255,255,0.05)"
        strokeDasharray="2 3"
      />
      <path
        d={linePath("captured")}
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.5}
      />
      <path
        d={linePath("converted")}
        fill="none"
        stroke="rgb(52,211,153)"
        strokeWidth={2}
      />
      {daily.map((d, i) => {
        const x = pad + i * stepX;
        return (
          <g key={d.date}>
            <circle cx={x} cy={toY(d.captured)} r={2} fill="rgba(255,255,255,0.55)">
              <title>{`${d.date} · ${d.captured} captured`}</title>
            </circle>
            <circle cx={x} cy={toY(d.converted)} r={2.5} fill="rgb(52,211,153)">
              <title>{`${d.date} · ${d.converted} converted`}</title>
            </circle>
          </g>
        );
      })}
      {[0, Math.floor(daily.length / 2), daily.length - 1].map((i) => {
        if (!daily[i]) return null;
        const x = pad + i * stepX;
        return (
          <text
            key={`lbl-${i}`}
            x={x}
            y={h - 0.5}
            fontSize={8}
            fill="rgba(255,255,255,0.3)"
            textAnchor={i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle"}
          >
            {daily[i]!.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
