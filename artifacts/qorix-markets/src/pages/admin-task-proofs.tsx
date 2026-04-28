import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink, AlertCircle, ClipboardCheck, Coins } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }

async function apiFetch(path: string, options: RequestInit = {}) {
  return authFetch(apiUrl(path), options);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

function isUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

export default function AdminTaskProofsPage() {
  const { toast } = useToast();
  const [proofs, setProofs] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState<Record<number, string>>({});

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/task-proofs?status=${statusFilter}`);
      setProofs(data.proofs ?? []);
      setPendingCount(data.pendingCount ?? 0);
    } catch (err: any) {
      toast({ title: "Failed to load proofs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchProofs(); }, [fetchProofs]);

  const handleApprove = async (proofId: number) => {
    setActionLoading(proofId);
    try {
      const result = await apiFetch(`/admin/task-proofs/${proofId}/approve`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote[proofId] || undefined }),
      });
      toast({ title: "Proof approved", description: `${result.pointsAwarded} points awarded to user.` });
      await fetchProofs();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (proofId: number) => {
    setActionLoading(proofId);
    try {
      await apiFetch(`/admin/task-proofs/${proofId}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote[proofId] || "Proof rejected by admin" }),
      });
      toast({ title: "Proof rejected" });
      await fetchProofs();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-violet-400" /> Task Proof Review
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingCount} pending review{pendingCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={fetchProofs}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                statusFilter === s
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/20",
              )}
            >
              {s}
              {s === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-black text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        ) : proofs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No {statusFilter} proofs found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proofs.map((proof) => (
              <motion.div
                key={proof.id}
                layout
                className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(expandedId === proof.id ? null : proof.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{proof.taskTitle}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[proof.status] ?? "")}>
                          {proof.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {proof.userName} · {proof.userEmail}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(proof.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Coins className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-400">{proof.taskPoints} pts</span>
                    </div>
                  </div>
                </div>

                {expandedId === proof.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="border-t border-white/8 p-4 space-y-3"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Proof ({proof.proofType})</p>
                      {isUrl(proof.proofContent) ? (
                        <a
                          href={proof.proofContent}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-400 text-sm hover:underline break-all"
                        >
                          {proof.proofContent}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm bg-white/5 rounded-lg p-3 break-words">{proof.proofContent}</p>
                      )}
                    </div>

                    {proof.status === "pending" && (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Admin note (optional)..."
                          value={adminNote[proof.id] ?? ""}
                          onChange={(e) => setAdminNote((prev) => ({ ...prev, [proof.id]: e.target.value }))}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(proof.id)}
                            disabled={actionLoading === proof.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {actionLoading === proof.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReject(proof.id)}
                            disabled={actionLoading === proof.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {proof.adminNote && (
                      <div className="bg-white/5 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Admin note: <span className="text-foreground">{proof.adminNote}</span></p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
