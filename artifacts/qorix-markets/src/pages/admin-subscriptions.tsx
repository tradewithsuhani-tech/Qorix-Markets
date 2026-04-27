import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Calendar,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Save,
  X,
  Loader2,
  Server,
  Database,
  Globe,
  Code2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(p: string) {
  return `${BASE_URL}api${p}`;
}

interface Subscription {
  id: number;
  name: string;
  provider: string;
  amountUsd: string;
  billingCycle: "monthly" | "yearly" | "one-time";
  nextDueDate: string | null;
  lastPaidDate: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
}

const PROVIDER_OPTIONS = [
  { value: "fly", label: "Fly.io", icon: Server },
  { value: "neon", label: "Neon DB", icon: Database },
  { value: "replit", label: "Replit", icon: Code2 },
  { value: "domain", label: "Domain", icon: Globe },
  { value: "email", label: "Email/SMTP", icon: Mail },
  { value: "sms", label: "SMS/Voice", icon: MessageSquare },
  { value: "telegram", label: "Telegram", icon: MessageSquare },
  { value: "other", label: "Other", icon: DollarSign },
];

const CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one-time", label: "One-time" },
];

function getProviderIcon(p: string) {
  const f = PROVIDER_OPTIONS.find((o) => o.value === p);
  return f?.icon ?? DollarSign;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}

function urgencyClass(days: number | null): { pill: string; row: string; label: string } {
  if (days === null) return { pill: "bg-gray-500/15 text-gray-300 border-gray-500/30", row: "", label: "—" };
  if (days < 0) return {
    pill: "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse",
    row: "border-l-4 border-red-500",
    label: `${Math.abs(days)}d OVERDUE`,
  };
  if (days <= 3) return {
    pill: "bg-red-500/15 text-red-400 border-red-500/40",
    row: "border-l-4 border-red-500",
    label: `${days}d left`,
  };
  if (days <= 7) return {
    pill: "bg-orange-500/15 text-orange-400 border-orange-500/40",
    row: "border-l-4 border-orange-500",
    label: `${days}d left`,
  };
  if (days <= 30) return {
    pill: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    row: "border-l-4 border-amber-500",
    label: `${days}d left`,
  };
  return {
    pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    row: "",
    label: `${days}d left`,
  };
}

function emptyForm(): Partial<Subscription> {
  return {
    name: "",
    provider: "fly",
    amountUsd: "0",
    billingCycle: "monthly",
    nextDueDate: "",
    lastPaidDate: "",
    notes: "",
    isActive: true,
    sortOrder: 0,
  };
}

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Subscription> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const r = await authFetch(getApiUrl("/admin/subscriptions"));
      if (!r.ok) throw new Error("load failed");
      return (await r.json()) as { subscriptions: Subscription[] };
    },
  });
  const subs = data?.subscriptions ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Subscription>) => {
      const url = payload.id
        ? getApiUrl(`/admin/subscriptions/${payload.id}`)
        : getApiUrl("/admin/subscriptions");
      const r = await authFetch(url, {
        method: payload.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error || "save failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setEditing(null);
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(getApiUrl(`/admin/subscriptions/${id}`), { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      toast({ title: "Deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(getApiUrl(`/admin/subscriptions/${id}/mark-paid`), { method: "POST" });
      if (!r.ok) throw new Error("mark paid failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      toast({ title: "Marked as paid", description: "Next due date advanced" });
    },
    onError: (e: any) => toast({ title: "Mark-paid failed", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  // Summary stats
  const overdue = subs.filter((s) => s.isActive && (daysUntil(s.nextDueDate) ?? 99999) < 0);
  const dueWeek = subs.filter((s) => {
    if (!s.isActive) return false;
    const d = daysUntil(s.nextDueDate);
    return d !== null && d >= 0 && d <= 7;
  });
  const totalMonthly = subs
    .filter((s) => s.isActive && s.billingCycle === "monthly")
    .reduce((sum, s) => sum + parseFloat(s.amountUsd || "0"), 0);
  const totalYearly = subs
    .filter((s) => s.isActive && s.billingCycle === "yearly")
    .reduce((sum, s) => sum + parseFloat(s.amountUsd || "0"), 0);
  const monthlyEquivalent = totalMonthly + totalYearly / 12;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-amber-400" />
                Subscription Tracker
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Hosting, database, domain — track when each bill is due so nothing gets suspended.
              </p>
            </div>
            <button
              onClick={() => setEditing(emptyForm())}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition"
              data-testid="button-add-subscription"
            >
              <Plus className="w-4 h-4" /> Add Subscription
            </button>
          </div>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className={cn("p-4 rounded-lg border", overdue.length > 0 ? "bg-red-500/10 border-red-500/30" : "bg-zinc-900/60 border-zinc-800")}>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <AlertTriangle className="w-4 h-4" /> OVERDUE
            </div>
            <div className={cn("text-2xl font-bold", overdue.length > 0 ? "text-red-400" : "text-gray-500")}>
              {overdue.length}
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-zinc-900/60 border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Clock className="w-4 h-4" /> DUE THIS WEEK
            </div>
            <div className={cn("text-2xl font-bold", dueWeek.length > 0 ? "text-orange-400" : "text-gray-500")}>
              {dueWeek.length}
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-zinc-900/60 border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" /> MONTHLY BURN
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              ${monthlyEquivalent.toFixed(0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              ${totalMonthly.toFixed(0)}/mo + ${totalYearly.toFixed(0)}/yr
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-zinc-900/60 border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <CheckCircle2 className="w-4 h-4" /> ACTIVE
            </div>
            <div className="text-2xl font-bold text-white">
              {subs.filter((s) => s.isActive).length}
            </div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-lg">
            <Calendar className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400">No subscriptions tracked yet.</p>
            <p className="text-sm text-gray-500 mt-1">Add your Fly, Neon, domain, etc. to get expiry alerts.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const days = daysUntil(s.nextDueDate);
              const u = urgencyClass(days);
              const Icon = getProviderIcon(s.provider);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "p-4 bg-zinc-900/60 rounded-lg border border-zinc-800 flex items-center gap-4 flex-wrap",
                    u.row,
                    !s.isActive && "opacity-50",
                  )}
                  data-testid={`subscription-row-${s.id}`}
                >
                  <div className="p-2 bg-zinc-800 rounded">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <div className="font-medium text-white flex items-center gap-2">
                      {s.name}
                      {!s.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">PAUSED</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 capitalize">
                      {s.provider} · {s.billingCycle} · ${parseFloat(s.amountUsd || "0").toFixed(2)}
                    </div>
                    {s.notes && <div className="text-xs text-gray-500 mt-1 italic line-clamp-1">{s.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className={cn("inline-block px-2 py-1 rounded border text-xs font-semibold", u.pill)}>
                      {u.label}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {s.nextDueDate ? `Due ${s.nextDueDate}` : "No due date"}
                    </div>
                    {s.lastPaidDate && (
                      <div className="text-[10px] text-gray-600">Last paid {s.lastPaidDate}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => markPaidMutation.mutate(s.id)}
                      disabled={markPaidMutation.isPending}
                      title="Mark as paid (advances next due date)"
                      className="p-2 hover:bg-emerald-500/15 text-emerald-400 rounded transition"
                      data-testid={`button-mark-paid-${s.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditing(s)}
                      className="p-2 hover:bg-blue-500/15 text-blue-400 rounded transition"
                      data-testid={`button-edit-${s.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id);
                      }}
                      className="p-2 hover:bg-red-500/15 text-red-400 rounded transition"
                      data-testid={`button-delete-${s.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Edit/Add dialog */}
        {editing && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setEditing(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  {editing.id ? "Edit" : "Add"} Subscription
                </h2>
                <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Service Name</label>
                  <input
                    type="text"
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Fly.io API server"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                    data-testid="input-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Provider</label>
                    <select
                      value={editing.provider ?? "other"}
                      onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      data-testid="select-provider"
                    >
                      {PROVIDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cycle</label>
                    <select
                      value={editing.billingCycle ?? "monthly"}
                      onChange={(e) => setEditing({ ...editing, billingCycle: e.target.value as any })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      data-testid="select-cycle"
                    >
                      {CYCLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Amount (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editing.amountUsd ?? "0"}
                      onChange={(e) => setEditing({ ...editing, amountUsd: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      data-testid="input-amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={editing.sortOrder ?? 0}
                      onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={editing.nextDueDate ?? ""}
                      onChange={(e) => setEditing({ ...editing, nextDueDate: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                      data-testid="input-next-due"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Last Paid Date</label>
                    <input
                      type="date"
                      value={editing.lastPaidDate ?? ""}
                      onChange={(e) => setEditing({ ...editing, lastPaidDate: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Notes</label>
                  <textarea
                    value={editing.notes ?? ""}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    rows={2}
                    placeholder="Account email, login URL, who pays..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editing.isActive !== false}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  <label htmlFor="isActive" className="text-sm">Active</label>
                </div>
                <button
                  onClick={() => saveMutation.mutate(editing)}
                  disabled={saveMutation.isPending || !editing.name?.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium rounded transition"
                  data-testid="button-save"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing.id ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
