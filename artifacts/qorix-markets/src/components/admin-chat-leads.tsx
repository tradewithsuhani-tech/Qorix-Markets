import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";

// Task #145 Batch E — admin leads list. Surfaces every email/name captured
// by the guest chat widget so the sales team can prioritise outreach.
// Lives as a sibling tab to "Conversations" + "AI Settings" in
// `admin-chats.tsx`. Read-only for now: edits/notes/manual-followup are
// follow-up scope.

type LeadStatus = "all" | "pending" | "sent" | "converted" | "unsubscribed";

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

      {/* Filter chips + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const Icon = f.icon;
          const count = totals[f.key];
          const active = status === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
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
        <button
          onClick={() => load({ showSpinner: true })}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/55 bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </button>
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
          <div className="col-span-2">Session</div>
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

              const statusBadge = lead.unsubscribedAt
                ? { label: "Unsubscribed", tone: "text-white/45 bg-white/5 border-white/10" }
                : lead.convertedAt
                  ? { label: "Converted", tone: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" }
                  : lead.followUpSentAt
                    ? { label: "Sent", tone: "text-sky-300 bg-sky-500/15 border-sky-500/30" }
                    : { label: "Pending", tone: "text-amber-300 bg-amber-500/15 border-amber-500/30" };

              return (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div className="col-span-3 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white/85 font-medium truncate">{lead.email}</p>
                      <button
                        onClick={() => handleCopyEmail(lead)}
                        className="text-white/25 hover:text-white/60 transition shrink-0"
                        title="Copy email"
                      >
                        {copiedId === lead.id ? (
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {lead.name && <p className="text-white/40 truncate mt-0.5">{lead.name}</p>}
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
                    <p>#{lead.sessionId}</p>
                    {lead.sessionEngagementScore !== null && (
                      <p className="text-[10px] text-white/30">
                        engagement {lead.sessionEngagementScore}
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
