import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, XCircle, Clock, Eye, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface KycUser {
  id: number;
  email: string;
  fullName: string;
  kycStatus: string;
  kycDocumentType: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string | null;
}

const TABS = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle },
];

export default function AdminKycPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [viewing, setViewing] = useState<KycUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery<{ users: KycUser[] }>({
    queryKey: ["admin-kyc-queue", tab],
    queryFn: () => authFetch(`/api/admin/kyc/queue?status=${tab}`),
    refetchInterval: 20000,
  });

  const { data: doc, isLoading: docLoading } = useQuery<{ documentUrl: string; documentType: string | null }>({
    queryKey: ["admin-kyc-doc", viewing?.id],
    queryFn: () => authFetch(`/api/admin/kyc/document/${viewing!.id}`),
    enabled: !!viewing,
    staleTime: 0,
    gcTime: 0,
  });

  const review = useMutation({
    mutationFn: ({ userId, action, reason }: { userId: number; action: "approve" | "reject"; reason?: string }) =>
      authFetch("/api/admin/kyc/review", {
        method: "POST",
        body: JSON.stringify({ userId, action, reason }),
      }),
    onSuccess: (_d, vars) => {
      toast({
        title: vars.action === "approve" ? "Approved" : "Rejected",
        description: `User #${vars.userId} updated.`,
      });
      setViewing(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-kyc-queue"] });
    },
    onError: (e: any) =>
      toast({ title: "Action failed", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  const users = data?.users ?? [];

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-5 max-w-5xl mx-auto"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">KYC Review Queue</h1>
        </div>

        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No {tab} submissions.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex items-center gap-3 hover:bg-white/[0.02]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {u.kycDocumentType ?? "—"} ·{" "}
                      {u.kycSubmittedAt ? format(new Date(u.kycSubmittedAt), "MMM d, p") : "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => setViewing(u)}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-1 hover:bg-blue-500/25"
                  >
                    <Eye className="w-3 h-3" />
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setViewing(null)}>
          <div
            className="glass-card rounded-2xl p-5 max-w-2xl w-full space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{viewing.fullName}</h3>
                <p className="text-xs text-muted-foreground">{viewing.email}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1 rounded-lg hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-white">{viewing.kycDocumentType ?? "—"}</span> · submitted{" "}
              {viewing.kycSubmittedAt ? format(new Date(viewing.kycSubmittedAt), "PPP p") : "—"}
            </div>

            {docLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm bg-white/5 rounded-xl">
                Loading document…
              </div>
            ) : doc?.documentUrl ? (
              <img
                src={doc.documentUrl}
                alt="document"
                className="w-full max-h-96 object-contain rounded-xl bg-black/30"
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm bg-white/5 rounded-xl">
                No document available
              </div>
            )}

            {viewing.kycStatus === "pending" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Rejection Reason (optional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Document is blurry, please re-upload"
                    rows={2}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ userId: viewing.id, action: "reject", reason: rejectReason })}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-sm hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ userId: viewing.id, action: "approve" })}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm hover:brightness-110 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
