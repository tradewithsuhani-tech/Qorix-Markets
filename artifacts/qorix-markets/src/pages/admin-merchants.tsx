import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Loader2,
  KeyRound,
  Power,
  Store,
  X,
  Link2,
  Wallet,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function apiUrl(p: string) {
  return `${BASE_URL}api${p}`;
}

interface AdminMerchant {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdBy: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  methodCount: number;
  inrBalance: string;
  pendingHold: string;
  available: string;
}

function inr(s: string | number) {
  const n = typeof s === "number" ? s : parseFloat(s);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface UnassignedMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  upiId: string | null;
  accountNumber: string | null;
  bankName: string | null;
}

export default function AdminMerchantsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ email: "", password: "", fullName: "", phone: "" });
  const [resetFor, setResetFor] = useState<AdminMerchant | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [assignFor, setAssignFor] = useState<AdminMerchant | null>(null);
  const [topupFor, setTopupFor] = useState<AdminMerchant | null>(null);
  const [topupDelta, setTopupDelta] = useState("");
  const [topupNote, setTopupNote] = useState("");

  const { data, isLoading, error, isError } = useQuery<{ merchants: AdminMerchant[] }>({
    queryKey: ["admin-merchants"],
    queryFn: () => authFetch(apiUrl("/admin/merchants")),
  });

  const { data: unassigned } = useQuery<{ methods: UnassignedMethod[] }>({
    queryKey: ["admin-unassigned-methods"],
    queryFn: () => authFetch(apiUrl("/admin/payment-methods/unassigned")),
  });

  const create = useMutation({
    mutationFn: async () =>
      authFetch(apiUrl("/admin/merchants"), { method: "POST", body: JSON.stringify(draft) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      setCreating(false);
      setDraft({ email: "", password: "", fullName: "", phone: "" });
      toast({ title: "Merchant created" });
    },
    onError: (e) => toast({ title: "Create failed", description: String(e), variant: "destructive" }),
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      authFetch(apiUrl(`/admin/merchants/${id}`), { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      setResetFor(null);
      setNewPassword("");
      toast({ title: "Merchant updated" });
    },
    onError: (e) => toast({ title: "Update failed", description: String(e), variant: "destructive" }),
  });

  const topup = useMutation({
    mutationFn: async ({ id, delta, note }: { id: number; delta: number; note: string }) =>
      authFetch(apiUrl(`/admin/merchants/${id}/topup`), {
        method: "POST",
        body: JSON.stringify({ delta, note: note || null }),
      }),
    onSuccess: (_resp, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      setTopupFor(null);
      setTopupDelta("");
      setTopupNote("");
      toast({
        title: vars.delta >= 0 ? "Balance credited" : "Balance debited",
        description: `${vars.delta >= 0 ? "+" : ""}${inr(vars.delta)}`,
      });
    },
    onError: (e: any) => {
      const msg = e?.message ?? String(e);
      toast({ title: "Top-up failed", description: msg, variant: "destructive" });
    },
  });

  const assign = useMutation({
    mutationFn: async ({ merchantId, methodId }: { merchantId: number; methodId: number }) =>
      authFetch(apiUrl(`/admin/merchants/${merchantId}/assign-method`), {
        method: "POST",
        body: JSON.stringify({ methodId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      qc.invalidateQueries({ queryKey: ["admin-unassigned-methods"] });
      toast({ title: "Method assigned" });
    },
    onError: (e) => toast({ title: "Assign failed", description: String(e), variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Store className="h-6 w-6 text-amber-400" /> Merchants
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Operators who run their own UPI/bank methods and review user INR deposits/withdrawals.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Add merchant
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : isError ? (
          // Surface the actual API error so a 500/403/etc. doesn't masquerade
          // as the friendly "no merchants yet" empty state. We hit exactly
          // this trap once already — a bare-identifier ambiguity inside a
          // correlated subquery 500'd the endpoint and the page silently
          // showed "No merchants yet" while QOREX TRADE / SURYA BHAI /
          // BIMLESH FX were sitting in the DB the whole time.
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6 text-center">
            <div className="text-rose-300 font-medium mb-1">
              Couldn't load merchants
            </div>
            <div className="text-xs text-slate-400">
              {(error as Error)?.message ?? "Unknown error"}
            </div>
          </div>
        ) : !data?.merchants.length ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
            No merchants yet. Add your first operator above.
          </div>
        ) : (
          <div className="space-y-3">
            {data.merchants.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{m.fullName}</div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${
                        m.isActive
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {m.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{m.email} • {m.phone || "no phone"}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {m.methodCount} method{m.methodCount === 1 ? "" : "s"} •
                    {" "}Last login: {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : "never"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      title="Available capacity = balance − pending holds"
                    >
                      Available {inr(m.available)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700">
                      Balance {inr(m.inrBalance)}
                    </span>
                    {parseFloat(m.pendingHold) > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Hold {inr(m.pendingHold)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTopupFor(m);
                      setTopupDelta("");
                      setTopupNote("");
                    }}
                    className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1"
                    title="Top up or debit INR balance"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Top up
                  </button>
                  <button
                    onClick={() => setAssignFor(m)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1"
                    title="Assign payment methods"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Assign methods
                  </button>
                  <button
                    onClick={() => {
                      setResetFor(m);
                      setNewPassword("");
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1"
                    title="Reset password"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset password
                  </button>
                  <button
                    onClick={() => patch.mutate({ id: m.id, body: { isActive: !m.isActive } })}
                    className={`rounded-lg border px-3 py-1.5 text-xs flex items-center gap-1 ${
                      m.isActive
                        ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                        : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" /> {m.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create dialog */}
        {creating && (
          <Modal title="New merchant" onClose={() => setCreating(false)}>
            <div className="space-y-3">
              <Field label="Full name" value={draft.fullName} onChange={(v) => setDraft({ ...draft, fullName: v })} />
              <Field label="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
              <Field label="Phone (for voice escalation)" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
              <Field label="Password (≥ 8 chars)" value={draft.password} onChange={(v) => setDraft({ ...draft, password: v })} type="password" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCreating(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !draft.email || !draft.password || !draft.fullName}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </Modal>
        )}

        {/* Reset password dialog */}
        {resetFor && (
          <Modal title={`Reset password — ${resetFor.fullName}`} onClose={() => setResetFor(null)}>
            <Field label="New password (≥ 8 chars)" value={newPassword} onChange={setNewPassword} type="password" />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setResetFor(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => patch.mutate({ id: resetFor.id, body: { password: newPassword } })}
                disabled={patch.isPending || newPassword.length < 8}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {patch.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save new password
              </button>
            </div>
          </Modal>
        )}

        {/* Top-up dialog */}
        {topupFor && (
          <Modal title={`Top up — ${topupFor.fullName}`} onClose={() => setTopupFor(null)}>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current balance</span>
                  <span className="font-mono">{inr(topupFor.inrBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pending hold</span>
                  <span className="font-mono">{inr(topupFor.pendingHold)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                  <span className="text-emerald-300">Available</span>
                  <span className="font-mono text-emerald-300">{inr(topupFor.available)}</span>
                </div>
              </div>
              <Field
                label="Delta (₹) — positive credits, negative debits"
                value={topupDelta}
                onChange={setTopupDelta}
                type="number"
              />
              <div className="flex flex-wrap gap-1.5">
                {[10000, 25000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTopupDelta(String(v))}
                    className="text-[11px] px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  >
                    +{inr(v)}
                  </button>
                ))}
              </div>
              <Field
                label="Note (optional, for audit)"
                value={topupNote}
                onChange={setTopupNote}
              />
              {topupDelta && Number(topupDelta) !== 0 && (
                <div className="text-[11px] text-slate-400">
                  New balance after this top-up:{" "}
                  <span className="font-mono text-white">
                    {inr(parseFloat(topupFor.inrBalance) + Number(topupDelta))}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setTopupFor(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  topup.mutate({
                    id: topupFor.id,
                    delta: Number(topupDelta),
                    note: topupNote,
                  })
                }
                disabled={
                  topup.isPending ||
                  !topupDelta ||
                  !Number.isFinite(Number(topupDelta)) ||
                  Number(topupDelta) === 0
                }
                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {topup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {Number(topupDelta) < 0 ? "Debit" : "Top up"}
              </button>
            </div>
          </Modal>
        )}

        {/* Assign methods dialog */}
        {assignFor && (
          <Modal title={`Assign methods → ${assignFor.fullName}`} onClose={() => setAssignFor(null)}>
            <p className="text-xs text-slate-400 mb-3">
              These payment methods currently have no merchant owner. Pick one to hand it off.
            </p>
            {!unassigned?.methods.length ? (
              <div className="text-sm text-slate-500 py-6 text-center">
                No unassigned methods. Create new methods from the merchant's panel directly.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {unassigned.methods.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{m.displayName}</div>
                      <div className="text-xs text-slate-400">
                        {m.type === "upi" ? m.upiId : `${m.bankName ?? ""} A/C ${m.accountNumber ?? ""}`}
                      </div>
                    </div>
                    <button
                      onClick={() => assign.mutate({ merchantId: assignFor.id, methodId: m.id })}
                      disabled={assign.isPending}
                      className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium px-2 py-1 disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setAssignFor(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}
