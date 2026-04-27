import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Save,
  Loader2,
  Crown,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { GRANTABLE_MODULES } from "@/lib/admin-modules";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API = (p: string) => `${BASE_URL}api${p}`;

interface SubAdminRow {
  id: number;
  email: string | null;
  fullName: string | null;
  adminRole: "super" | "sub" | "user" | null;
  isAdmin: boolean;
  isFrozen: boolean;
  isDisabled: boolean;
  createdAt: string;
  modules: string[] | null;
  permissionsUpdatedAt: string | null;
}

export default function AdminSubAdminsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = useAdminPermissions();

  const { data, isLoading } = useQuery<{ admins: SubAdminRow[] }>({
    queryKey: ["admin-sub-admins"],
    queryFn: () => authFetch(API("/admin/sub-admins")),
    enabled: perms.isSuper,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<SubAdminRow | null>(null);

  const createMutation = useMutation({
    mutationFn: (body: { email: string; modules: string[] }) =>
      authFetch(API("/admin/sub-admins"), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sub-admins"] });
      toast({ title: "Sub-admin added" });
      setCreateOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; modules: string[] }) =>
      authFetch(API(`/admin/sub-admins/${vars.id}`), {
        method: "PATCH",
        body: JSON.stringify({ modules: vars.modules }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sub-admins"] });
      toast({ title: "Permissions updated" });
      setEditFor(null);
    },
    onError: (e: any) =>
      toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(API(`/admin/sub-admins/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sub-admins"] });
      toast({ title: "Sub-admin removed" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  if (perms.isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  if (!perms.isSuper) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Super Admin only</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Only the super admin can manage sub-admins and their access.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-violet-500" />
              Sub-Admins
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Grant or revoke access to specific admin modules.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium flex items-center gap-2"
            data-testid="button-add-sub-admin"
          >
            <UserPlus className="w-4 h-4" />
            Add Sub-Admin
          </button>
        </motion.div>

        <div className="rounded-xl border border-white/5 glass-nav overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : !data?.admins?.length ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No admins yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Admin</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Modules</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.admins.map((a) => {
                  const isSuper = a.adminRole === "super";
                  return (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="p-3">
                        <div className="font-medium">{a.fullName || a.email || `User #${a.id}`}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="p-3">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-400">
                            <Crown className="w-3 h-3" /> Super
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-violet-500/15 text-violet-400">
                            <Users className="w-3 h-3" /> Sub
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isSuper ? (
                          <span className="text-xs text-muted-foreground italic">All modules</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {(a.modules ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">None granted</span>
                            ) : (
                              (a.modules ?? []).map((m) => (
                                <span
                                  key={m}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium"
                                >
                                  {m}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!isSuper && (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => setEditFor(a)}
                              className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25"
                              data-testid={`button-edit-${a.id}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${a.email} as sub-admin?`)) {
                                  deleteMutation.mutate(a.id);
                                }
                              }}
                              className="px-2 py-1 rounded bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25"
                              data-testid={`button-remove-${a.id}`}
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {createOpen && (
        <PermissionsDialog
          title="Add Sub-Admin"
          submitLabel="Add Sub-Admin"
          showEmail
          loading={createMutation.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(email, modules) => createMutation.mutate({ email, modules })}
        />
      )}

      {editFor && (
        <PermissionsDialog
          title={`Edit Permissions — ${editFor.email}`}
          submitLabel="Save Permissions"
          initialModules={editFor.modules ?? []}
          loading={updateMutation.isPending}
          onCancel={() => setEditFor(null)}
          onSubmit={(_email, modules) =>
            updateMutation.mutate({ id: editFor.id, modules })
          }
        />
      )}
    </Layout>
  );
}

function PermissionsDialog({
  title,
  submitLabel,
  showEmail = false,
  initialModules = [],
  loading,
  onCancel,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  showEmail?: boolean;
  initialModules?: string[];
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (email: string, modules: string[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [modules, setModules] = useState<string[]>(initialModules);

  function toggle(slug: string) {
    setModules((prev) =>
      prev.includes(slug) ? prev.filter((m) => m !== slug) : [...prev, slug],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl glass-nav border border-white/10 max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Tick the modules this admin should have access to. Whatever you tick,
            they'll see + can act on. Unticked modules stay completely hidden.
          </p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {showEmail && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">User email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full mt-1 px-3 py-2 rounded bg-black/30 border border-white/10 text-sm"
                data-testid="input-email"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                User must already exist on the platform — this only promotes them.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                Module permissions ({modules.length}/{GRANTABLE_MODULES.length})
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setModules(GRANTABLE_MODULES.map((m) => m.slug))}
                  className="text-blue-400 hover:underline"
                >
                  All
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setModules([])}
                  className="text-blue-400 hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GRANTABLE_MODULES.map((m) => {
                const checked = modules.includes(m.slug);
                return (
                  <label
                    key={m.slug}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded border cursor-pointer transition-colors",
                      checked
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/10 bg-black/20 hover:border-white/20",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.slug)}
                      className="mt-0.5"
                      data-testid={`checkbox-module-${m.slug}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{m.slug}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm bg-white/5 hover:bg-white/10"
            data-testid="button-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(email.trim(), modules)}
            disabled={loading || (showEmail && !email.trim())}
            className="px-4 py-2 rounded text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 flex items-center gap-2"
            data-testid="button-submit"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Suppress unused import warning when ADMIN_MODULES is referenced from
// elsewhere — keep the import so the constant stays in the bundle path.
void ADMIN_MODULES;
