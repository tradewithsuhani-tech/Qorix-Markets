import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2, Phone, Save, X, ArrowUp, ArrowDown } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function apiUrl(p: string) {
  return `${BASE_URL}api${p}`;
}

interface AdminContact {
  id: number;
  label: string | null;
  phone: string;
  email: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminEscalationContactsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ label: "", phone: "", email: "", priority: 1 });

  const { data, isLoading } = useQuery<{ contacts: AdminContact[] }>({
    queryKey: ["admin-escalation-contacts"],
    queryFn: () => authFetch(apiUrl("/admin/escalation-contacts")),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-escalation-contacts"] });

  const createMut = useMutation({
    mutationFn: () =>
      authFetch(apiUrl("/admin/escalation-contacts"), {
        method: "POST",
        body: JSON.stringify({
          label: draft.label || null,
          phone: draft.phone.trim(),
          email: draft.email.trim() || null,
          priority: Number(draft.priority) || 100,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Contact added", description: "Will be called in priority order on the next escalation." });
      setCreating(false);
      setDraft({ label: "", phone: "", email: "", priority: 1 });
      refresh();
    },
    onError: (e: Error) => toast({ title: "Could not add", description: e.message, variant: "destructive" }),
  });

  const patchMut = useMutation({
    mutationFn: (vars: { id: number; patch: Partial<AdminContact> }) =>
      authFetch(apiUrl(`/admin/escalation-contacts/${vars.id}`), {
        method: "PATCH",
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(apiUrl(`/admin/escalation-contacts/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Removed" });
      refresh();
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const contacts = data?.contacts ?? [];
  const sorted = [...contacts].sort((a, b) => a.priority - b.priority || a.id - b.id);

  function bumpPriority(id: number, delta: number) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    const next = Math.max(1, c.priority + delta);
    if (next === c.priority) return;
    patchMut.mutate({ id, patch: { priority: next } });
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Phone className="w-6 h-6 text-blue-400" />
              Escalation Contacts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              When an INR deposit or withdrawal stays pending for 15 minutes, the system calls these
              numbers in priority order. If number 1 doesn't pick up, number 2 is tried, then number
              3, and so on. The first one that answers ends the chain.
            </p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add number
            </button>
          )}
        </div>

        {creating && (
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Add escalation number</h2>
              <button
                onClick={() => setCreating(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground space-y-1">
                <span>Label (optional)</span>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="e.g. Founder, COO, Backup"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground space-y-1">
                <span>Priority (1 = called first)</span>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 1 })}
                />
              </label>
              <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
                <span>Phone (E.164 format with country code)</span>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  placeholder="+919812345678"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
                <span>Email (optional, used as fallback if call fails)</span>
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="admin@example.com"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </label>
            </div>
            <button
              disabled={createMut.isPending || !draft.phone}
              onClick={() => createMut.mutate()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass-card rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">
            No escalation numbers added yet. Add at least one so the system can reach you when a
            payment review is delayed past 15 minutes.
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/8">
            {sorted.map((c, idx) => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-500/15 text-blue-300 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white font-mono">{c.phone}</span>
                    {c.label && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                        {c.label}
                      </span>
                    )}
                    {!c.isActive && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                        disabled
                      </span>
                    )}
                  </div>
                  {c.email && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.email}</div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => bumpPriority(c.id, -1)}
                    title="Move up"
                    className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => bumpPriority(c.id, 1)}
                    title="Move down"
                    className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => patchMut.mutate({ id: c.id, patch: { isActive: !c.isActive } })}
                    title={c.isActive ? "Disable" : "Enable"}
                    className={`px-2 py-1 text-[11px] rounded ${
                      c.isActive
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-white/10 text-muted-foreground hover:bg-white/20"
                    }`}
                  >
                    {c.isActive ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${c.phone}?`)) deleteMut.mutate(c.id);
                    }}
                    title="Delete"
                    className="p-1.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground border border-white/8 rounded-lg p-3 leading-relaxed">
          <b>How the cascade works:</b> at the 15-minute mark the system rings priority 1 first.
          A call is considered <i>not received</i> if it goes unanswered, the line is busy, or it
          fails — in any of those cases the next priority is tried. The chain stops at the first
          number that picks up (voicemail also stops the chain).
        </div>
      </div>
    </Layout>
  );
}
