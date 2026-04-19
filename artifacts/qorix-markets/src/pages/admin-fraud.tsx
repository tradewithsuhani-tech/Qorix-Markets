import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Users,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  Monitor,
  GitBranch,
  Repeat2,
  Cpu,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FraudStats = {
  total: number;
  unresolved: number;
  highSeverity: number;
  mediumSeverity: number;
  flaggedUsers: number;
};

type FraudFlag = {
  id: number;
  userId: number;
  userEmail: string;
  userFullName: string;
  flagType: string;
  severity: "low" | "medium" | "high";
  details: Record<string, unknown>;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedNote: string | null;
  createdAt: string;
};

type FlaggedUser = {
  userId: number;
  email: string;
  fullName: string;
  flagCount: number;
  maxSeverity: string;
  flagTypes: string[];
  memberSince: string;
};

type LoginEvent = {
  id: number;
  userId: number;
  ipAddress: string;
  deviceFingerprint: string | null;
  eventType: string;
  userAgent: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
function authFetch<T>(url: string): Promise<T> {
  const token = localStorage.getItem("qorix_token");
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function authPost<T>(url: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem("qorix_token");
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------
const SEVERITY_CONFIG = {
  high: { label: "High", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
};

const FLAG_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
  multi_account: { label: "Multi-Account", icon: Users, desc: "Multiple accounts from same IP" },
  self_referral: { label: "Self-Referral", icon: GitBranch, desc: "Referred self via same IP" },
  referral_abuse: { label: "Referral Abuse", icon: GitBranch, desc: "Circular or abusive referral chain" },
  device_cluster: { label: "Device Cluster", icon: Cpu, desc: "Many accounts share same device" },
  rapid_cycling: { label: "Rapid Cycling", icon: Repeat2, desc: "High-frequency deposit/withdrawal" },
};

function FlagTypeBadge({ type }: { type: string }) {
  const cfg = FLAG_TYPE_CONFIG[type] ?? { label: type, icon: AlertTriangle, desc: "" };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/8 text-muted-foreground border border-white/10">
      <Icon style={{ width: 10, height: 10 }} />
      {cfg.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.bg, cfg.color)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Resolve modal
// ---------------------------------------------------------------------------
function ResolveModal({
  flag,
  onClose,
  onResolve,
}: {
  flag: FraudFlag;
  onClose: () => void;
  onResolve: (id: number, note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-[#0d1525] border border-white/10 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Resolve Flag #{flag.id}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-1.5">
          <div className="flex items-center gap-2">
            <FlagTypeBadge type={flag.flagType} />
            <SeverityBadge severity={flag.severity} />
          </div>
          <p className="text-sm text-muted-foreground">{flag.userFullName || flag.userEmail}</p>
        </div>
        <label className="block text-sm text-muted-foreground mb-2">Resolution note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Verified legitimate activity, false positive"
          className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-primary outline-none resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onResolve(flag.id, note)}
            className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl py-2.5 text-sm font-medium transition-all"
          >
            Mark Resolved
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/8 text-muted-foreground rounded-xl py-2.5 text-sm font-medium transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login events drawer
// ---------------------------------------------------------------------------
function LoginEventsDrawer({ userId, email, onClose }: { userId: number; email: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<LoginEvent[]>({
    queryKey: ["login-events", userId],
    queryFn: () => authFetch(`/api/admin/fraud/users/${userId}/events`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[#0d1525] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div>
            <h3 className="font-bold text-white">Login Events</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : !data?.length ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No login events recorded yet</div>
          ) : (
            data.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  ev.eventType === "register" ? "bg-emerald-500/15" : "bg-blue-500/15"
                )}>
                  {ev.eventType === "register" ? (
                    <Users style={{ width: 13, height: 13 }} className="text-emerald-400" />
                  ) : (
                    <Monitor style={{ width: 13, height: 13 }} className="text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-white capitalize">{ev.eventType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{ev.ipAddress}</span>
                  </div>
                  {ev.deviceFingerprint && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      Device: {ev.deviceFingerprint}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {format(parseISO(ev.createdAt), "MMM d, yyyy HH:mm")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flag row with expand
// ---------------------------------------------------------------------------
function FlagRow({
  flag,
  onResolveClick,
  onViewEvents,
}: {
  flag: FraudFlag;
  onResolveClick: (flag: FraudFlag) => void;
  onViewEvents: (userId: number, email: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const reopenMutation = useMutation({
    mutationFn: () => authPost(`/api/admin/fraud/flags/${flag.id}/reopen`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fraud-flags"] }),
  });

  const cfg = FLAG_TYPE_CONFIG[flag.flagType];

  return (
    <>
      <tr
        className={cn(
          "border-b border-white/5 transition-colors cursor-pointer",
          flag.isResolved ? "opacity-50 hover:opacity-70" : "hover:bg-white/3",
          expanded && "bg-white/[0.025]",
        )}
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            <SeverityBadge severity={flag.severity} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-white">{flag.userFullName || "—"}</div>
          <div className="text-[11px] text-muted-foreground">{flag.userEmail}</div>
        </td>
        <td className="px-4 py-3"><FlagTypeBadge type={flag.flagType} /></td>
        <td className="px-4 py-3 text-[11px] text-muted-foreground">
          {format(parseISO(flag.createdAt), "MMM d, HH:mm")}
        </td>
        <td className="px-4 py-3">
          {flag.isResolved ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3" /> Open
            </span>
          )}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onViewEvents(flag.userId, flag.userEmail)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
              title="View login events"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {flag.isResolved ? (
              <button
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all"
                title="Reopen"
              >
                <Repeat2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onResolveClick(flag)}
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                title="Resolve"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white/[0.015] border-b border-white/5">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-xs space-y-1.5">
              <div className="text-muted-foreground font-medium mb-2">
                {cfg?.desc ?? flag.flagType}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(flag.details).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-muted-foreground/70 shrink-0">{k}:</span>
                    <span className="text-white font-mono break-all">
                      {Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  </div>
                ))}
              </div>
              {flag.isResolved && flag.resolvedNote && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-emerald-300/80">
                  Note: {flag.resolvedNote}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function AdminFraudPage() {
  const qc = useQueryClient();
  const [resolveTarget, setResolveTarget] = useState<FraudFlag | null>(null);
  const [eventsTarget, setEventsTarget] = useState<{ userId: number; email: string } | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data: stats, isLoading: statsLoading } = useQuery<FraudStats>({
    queryKey: ["fraud-stats"],
    queryFn: () => authFetch("/api/admin/fraud/stats"),
    refetchInterval: 30000,
  });

  const { data: flagsData, isLoading: flagsLoading, refetch } = useQuery<{
    data: FraudFlag[];
    total: number;
  }>({
    queryKey: ["fraud-flags", statusFilter, severityFilter],
    queryFn: () =>
      authFetch(
        `/api/admin/fraud/flags?${statusFilter === "open" ? "resolved=false" : statusFilter === "resolved" ? "resolved=true" : ""}${severityFilter !== "all" ? `&severity=${severityFilter}` : ""}`,
      ),
    refetchInterval: 30000,
  });

  const { data: flaggedUsers, isLoading: usersLoading } = useQuery<FlaggedUser[]>({
    queryKey: ["fraud-flagged-users"],
    queryFn: () => authFetch("/api/admin/fraud/flagged-users"),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      authPost(`/api/admin/fraud/flags/${id}/resolve`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fraud-flags"] });
      qc.invalidateQueries({ queryKey: ["fraud-stats"] });
      qc.invalidateQueries({ queryKey: ["fraud-flagged-users"] });
      setResolveTarget(null);
    },
  });

  const flags = flagsData?.data ?? [];

  return (
    <Layout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-6 h-6 text-red-400" />
              <h1 className="text-3xl font-bold tracking-tight text-primary">Fraud Monitor</h1>
            </div>
            <p className="text-muted-foreground">Multi-account detection, referral abuse, and suspicious activity.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Total Flags",
              value: stats?.total ?? 0,
              icon: ShieldAlert,
              color: "text-white",
              bg: "border-white/10",
            },
            {
              label: "Unresolved",
              value: stats?.unresolved ?? 0,
              icon: AlertTriangle,
              color: "text-amber-400",
              bg: "border-amber-500/20 bg-amber-500/5",
            },
            {
              label: "High Severity",
              value: stats?.highSeverity ?? 0,
              icon: ShieldX,
              color: "text-red-400",
              bg: "border-red-500/20 bg-red-500/5",
            },
            {
              label: "Medium Severity",
              value: stats?.mediumSeverity ?? 0,
              icon: AlertTriangle,
              color: "text-amber-400",
              bg: "border-amber-500/15",
            },
            {
              label: "Flagged Users",
              value: stats?.flaggedUsers ?? 0,
              icon: Users,
              color: "text-violet-400",
              bg: "border-violet-500/20 bg-violet-500/5",
            },
          ].map((card) => (
            <div key={card.label} className={cn("glass-card p-5 rounded-xl border", card.bg)}>
              <div className="flex items-center gap-2 mb-3">
                <card.icon className={cn("w-4 h-4", card.color)} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              {statsLoading ? (
                <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
              ) : (
                <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
              )}
            </div>
          ))}
        </motion.div>

        {/* Two-column: Flagged Users + Detection Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Flagged Users */}
          <motion.div variants={item} className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-white/8">
              <h2 className="font-bold text-white">Most Flagged Users</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Users with the most unresolved flags</p>
            </div>
            <div className="divide-y divide-white/5">
              {usersLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : !flaggedUsers?.length ? (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No flagged users — platform looks clean</p>
                </div>
              ) : (
                flaggedUsers.map((u, idx) => (
                  <div key={u.userId} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 flex items-center justify-center text-xs font-bold text-red-400 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{u.fullName || u.email}</span>
                        <SeverityBadge severity={u.maxSeverity} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {u.flagTypes.map((t) => <FlagTypeBadge key={t} type={t} />)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">{u.flagCount}</div>
                      <div className="text-[10px] text-muted-foreground">flags</div>
                    </div>
                    <button
                      onClick={() => setEventsTarget({ userId: u.userId, email: u.email })}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
                      title="View login events"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Detection Guide */}
          <motion.div variants={item} className="glass-card rounded-xl p-5">
            <h2 className="font-bold text-white mb-4">Detection Rules</h2>
            <div className="space-y-3">
              {Object.entries(FLAG_TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{cfg.desc}</div>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 pt-3 border-t border-white/8 text-[10px] text-muted-foreground/70 leading-relaxed">
                Checks run automatically on every login and registration. Flags are de-duplicated within 24-hour windows.
              </div>
            </div>
          </motion.div>
        </div>

        {/* Flags Table */}
        <motion.div variants={item} className="glass-card rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-white">Fraud Flags</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{flagsData?.total ?? 0} total flags</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Status filter */}
              <div className="flex rounded-xl overflow-hidden border border-white/10 text-xs">
                {[
                  { value: "open", label: "Open" },
                  { value: "resolved", label: "Resolved" },
                  { value: "all", label: "All" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={cn(
                      "px-3 py-1.5 transition-colors font-medium",
                      statusFilter === opt.value
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-black/50 border border-white/10 text-xs text-muted-foreground rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/[0.03] border-b border-white/8">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Severity</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">User</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Flag Type</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Detected</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flagsLoading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground text-sm">Loading flags…</td></tr>
                ) : flags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ShieldCheck className="w-8 h-8 opacity-30" />
                        <span className="text-sm">No flags found for current filter</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  flags.map((flag) => (
                    <FlagRow
                      key={flag.id}
                      flag={flag}
                      onResolveClick={setResolveTarget}
                      onViewEvents={(userId, email) => setEventsTarget({ userId, email })}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* Modals */}
      {resolveTarget && (
        <ResolveModal
          flag={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolve={(id, note) => resolveMutation.mutate({ id, note })}
        />
      )}
      {eventsTarget && (
        <LoginEventsDrawer
          userId={eventsTarget.userId}
          email={eventsTarget.email}
          onClose={() => setEventsTarget(null)}
        />
      )}
    </Layout>
  );
}
