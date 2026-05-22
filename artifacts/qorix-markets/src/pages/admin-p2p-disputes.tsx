import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Scale, Clock, CheckCircle2, XCircle, RefreshCw, X, Loader2, MessageSquare, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface DisputeRow {
  id: number;
  orderId: number;
  openedByUserId: number;
  openerRole: "buyer" | "seller";
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  buyerId: number | null;
  sellerId: number | null;
  usdtAmount: string | null;
  fiatAmount: string | null;
  orderStatus: string | null;
}

interface DisputeDetail {
  dispute: {
    id: number; orderId: number; openedByUserId: number; openerRole: string;
    reason: string; description: string | null; evidenceUrl: string | null;
    status: string; resolutionNote: string | null;
    resolvedByAdminId: number | null; resolvedAt: string | null; createdAt: string;
  };
  order: {
    id: number; buyerId: number; sellerId: number;
    fiatAmount: string; usdtAmount: string; price: string;
    status: string; paymentProofUrl: string | null;
    paymentMethod: string | null; paymentRef: string | null;
    createdAt: string; paidAt: string | null;
  } | null;
  ad: { id: number; type: string; userId: number } | null;
  messages: { id: number; senderId: number; message: string; isSystem: boolean; createdAt: string }[];
  users: { id: number; email: string; fullName: string }[];
  // Phase 8 — multi-file evidence attached after dispute creation, from both parties.
  evidence?: {
    id: number; uploaderRole: "buyer" | "seller"; uploadedByUserId: number;
    fileType: string; fileData: string; caption: string | null; createdAt: string;
  }[];
}

const TABS = [
  { id: "open", label: "Open", icon: Clock },
  { id: "resolved_release", label: "Released", icon: CheckCircle2 },
  { id: "resolved_refund", label: "Refunded", icon: RefreshCw },
  { id: "rejected", label: "Rejected", icon: XCircle },
];

export default function AdminP2pDisputesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("open");
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [resolveAction, setResolveAction] = useState<"release" | "refund" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [imgViewer, setImgViewer] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ disputes: DisputeRow[] }>({
    queryKey: ["admin-p2p-disputes", tab],
    queryFn: () => authFetch(`/api/admin/p2p/disputes?status=${tab}`),
    refetchInterval: 20000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<DisputeDetail>({
    queryKey: ["admin-p2p-dispute-detail", viewingId],
    queryFn: () => authFetch(`/api/admin/p2p/disputes/${viewingId}`),
    enabled: !!viewingId,
    staleTime: 0, gcTime: 0,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: string; note: string }) =>
      authFetch(`/api/admin/p2p/disputes/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action, note: note || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Dispute resolved" });
      qc.invalidateQueries({ queryKey: ["admin-p2p-disputes"] });
      setViewingId(null); setResolveAction(null); setNote("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err?.message || "Could not resolve", variant: "destructive" }),
  });

  const userById = (id: number) => detail?.users.find(u => u.id === id);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center"><Scale className="text-orange-400" size={20} /></div>
          <div>
            <h1 className="text-white font-bold text-xl">P2P Disputes</h1>
            <p className="text-slate-500 text-xs">Review and resolve buyer ↔ seller appeals</p>
          </div>
        </motion.div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-orange-500/15 text-orange-300 border border-orange-500/30" : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
              }`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data?.disputes?.length ? (
          <div className="text-center py-12 text-slate-500 text-sm bg-white/[0.02] border border-white/[0.05] rounded-2xl">
            No disputes in this category.
          </div>
        ) : (
          <div className="grid gap-2">
            {data.disputes.map(d => (
              <button key={d.id} onClick={() => setViewingId(d.id)}
                className="text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl p-3 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">Dispute #{d.id}</span>
                      <span className="text-[10px] text-slate-500">Order #{d.orderId}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        d.openerRole === "buyer" ? "bg-blue-500/15 text-blue-300" : "bg-purple-500/15 text-purple-300"
                      }`}>{d.openerRole}</span>
                    </div>
                    <p className="text-slate-300 text-xs truncate">{d.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white text-sm font-semibold">{Number(d.usdtAmount ?? 0).toFixed(2)} USDT</div>
                    <div className="text-[10px] text-slate-500">₹{Number(d.fiatAmount ?? 0).toLocaleString("en-IN")}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{format(new Date(d.createdAt), "MMM d, HH:mm")}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {viewingId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={() => { if (!resolveAction) setViewingId(null); }}>
          <div className="bg-[#0d1424] border border-white/10 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0d1424] border-b border-white/10 px-5 py-3 flex items-center justify-between z-10">
              <h2 className="text-white font-bold">Dispute #{viewingId}</h2>
              <button onClick={() => { setViewingId(null); setResolveAction(null); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            {detailLoading || !detail ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    detail.dispute.status === "open" ? "bg-orange-500/15 text-orange-300" :
                    detail.dispute.status === "resolved_release" ? "bg-emerald-500/15 text-emerald-300" :
                    detail.dispute.status === "resolved_refund" ? "bg-blue-500/15 text-blue-300" :
                    "bg-slate-500/15 text-slate-300"
                  }`}>{detail.dispute.status}</span>
                  <span className="text-[10px] text-slate-500">Opened {format(new Date(detail.dispute.createdAt), "MMM d yyyy, HH:mm")}</span>
                </div>

                {/* Parties */}
                {detail.order && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-2.5">
                      <div className="text-[10px] text-blue-300 uppercase tracking-wide">Buyer</div>
                      <div className="text-white text-sm font-medium truncate">{userById(detail.order.buyerId)?.fullName || `User #${detail.order.buyerId}`}</div>
                      <div className="text-slate-500 text-[10px] truncate">{userById(detail.order.buyerId)?.email}</div>
                    </div>
                    <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2.5">
                      <div className="text-[10px] text-purple-300 uppercase tracking-wide">Seller</div>
                      <div className="text-white text-sm font-medium truncate">{userById(detail.order.sellerId)?.fullName || `User #${detail.order.sellerId}`}</div>
                      <div className="text-slate-500 text-[10px] truncate">{userById(detail.order.sellerId)?.email}</div>
                    </div>
                  </div>
                )}

                {/* Order summary */}
                {detail.order && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-[10px] text-slate-500 uppercase">USDT</div><div className="text-white text-sm font-bold">{Number(detail.order.usdtAmount).toFixed(4)}</div></div>
                    <div><div className="text-[10px] text-slate-500 uppercase">Fiat</div><div className="text-white text-sm font-bold">₹{Number(detail.order.fiatAmount).toLocaleString("en-IN")}</div></div>
                    <div><div className="text-[10px] text-slate-500 uppercase">Price</div><div className="text-white text-sm font-bold">₹{Number(detail.order.price).toLocaleString("en-IN")}</div></div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Reason ({detail.dispute.openerRole})</div>
                  <div className="text-white text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">{detail.dispute.reason}</div>
                </div>

                {detail.dispute.description && (
                  <div>
                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Description</div>
                    <div className="text-slate-300 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap">{detail.dispute.description}</div>
                  </div>
                )}

                {/* Evidence + payment proof */}
                <div className="grid grid-cols-2 gap-2">
                  {detail.order?.paymentProofUrl && (
                    <button onClick={() => setImgViewer(detail.order!.paymentProofUrl!)}
                      className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg p-3 flex items-center gap-2 text-left">
                      <ImageIcon size={16} className="text-blue-400" />
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium">Buyer payment proof</div>
                        <div className="text-slate-500 text-[10px]">Click to view</div>
                      </div>
                    </button>
                  )}
                  {detail.dispute.evidenceUrl && (
                    <button onClick={() => setImgViewer(detail.dispute.evidenceUrl!)}
                      className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg p-3 flex items-center gap-2 text-left">
                      <ImageIcon size={16} className="text-orange-400" />
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium">Dispute evidence</div>
                        <div className="text-slate-500 text-[10px]">Click to view</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* Phase 8 — both-party evidence gallery (attached AFTER dispute creation). */}
                {detail.evidence && detail.evidence.length > 0 && (
                  <div>
                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <ImageIcon size={12} /> Evidence attachments ({detail.evidence.length})
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.evidence.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setImgViewer(e.fileData)}
                          className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg overflow-hidden text-left"
                          title={e.caption ?? ""}
                        >
                          <img
                            src={e.fileData}
                            alt={`Evidence #${e.id}`}
                            className="w-full h-20 object-cover group-hover:opacity-90"
                          />
                          <div className="p-1.5">
                            <div className={`text-[10px] font-bold uppercase ${e.uploaderRole === "buyer" ? "text-blue-300" : "text-purple-300"}`}>
                              {e.uploaderRole}
                            </div>
                            {e.caption && (
                              <div className="text-slate-400 text-[10px] truncate">{e.caption}</div>
                            )}
                            <div className="text-slate-600 text-[9px]">
                              {format(new Date(e.createdAt), "MMM d HH:mm")}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat */}
                <div>
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <MessageSquare size={12} />Chat history ({detail.messages.length})
                  </div>
                  <div className="bg-black/30 border border-white/[0.06] rounded-lg p-2 max-h-48 overflow-y-auto space-y-1.5">
                    {detail.messages.length === 0 ? (
                      <div className="text-slate-600 text-xs text-center py-4">No messages</div>
                    ) : detail.messages.map(m => {
                      const sender = userById(m.senderId);
                      return (
                        <div key={m.id} className="text-xs">
                          <span className={`font-semibold ${m.isSystem ? "text-slate-500" : detail.order && m.senderId === detail.order.buyerId ? "text-blue-300" : "text-purple-300"}`}>
                            {m.isSystem ? "System" : (sender?.fullName || `User #${m.senderId}`)}:
                          </span>{" "}
                          <span className="text-slate-300">{m.message}</span>
                          <span className="text-slate-600 text-[9px] ml-1">{format(new Date(m.createdAt), "HH:mm")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resolution (if already resolved) */}
                {detail.dispute.status !== "open" && (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
                    <div className="text-emerald-300 text-xs font-semibold uppercase tracking-wide mb-1">Resolution</div>
                    <div className="text-white text-sm">{detail.dispute.status.replace("resolved_", "").replace("_", " ")}</div>
                    {detail.dispute.resolutionNote && <div className="text-slate-400 text-xs mt-1 whitespace-pre-wrap">{detail.dispute.resolutionNote}</div>}
                    {detail.dispute.resolvedAt && <div className="text-slate-600 text-[10px] mt-1">{format(new Date(detail.dispute.resolvedAt), "MMM d yyyy, HH:mm")} · by Admin #{detail.dispute.resolvedByAdminId}</div>}
                  </div>
                )}

                {/* Resolve actions */}
                {detail.dispute.status === "open" && (
                  <>
                    {!resolveAction ? (
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button onClick={() => setResolveAction("release")}
                          className="py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          Release to Buyer
                        </button>
                        <button onClick={() => setResolveAction("refund")}
                          className="py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                          Refund Seller
                        </button>
                        <button onClick={() => setResolveAction("reject")}
                          className="py-2.5 rounded-xl bg-slate-500/15 hover:bg-slate-500/25 border border-slate-500/30 text-slate-300 text-xs font-semibold">
                          Reject Appeal
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 space-y-3 bg-white/[0.03] border border-white/10 rounded-xl p-3">
                        <div className="text-sm text-white">
                          Confirm action: <span className="font-bold text-orange-300">{resolveAction.toUpperCase()}</span>
                          <p className="text-slate-400 text-xs mt-1">
                            {resolveAction === "release" && "USDT will be credited to the buyer's Funding Wallet. Order → completed."}
                            {resolveAction === "refund" && "Escrow returned, ad quantity restored. Order → cancelled."}
                            {resolveAction === "reject" && "Order returns to 'paid' state. Seller can confirm normally."}
                          </p>
                        </div>
                        <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 1000))}
                          rows={3} placeholder="Internal note / explanation for both parties (optional)…"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/40" />
                        <div className="flex gap-2">
                          <button onClick={() => { setResolveAction(null); setNote(""); }}
                            className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 text-xs font-medium hover:bg-white/10">Back</button>
                          <button disabled={resolveMut.isPending}
                            onClick={() => resolveMut.mutate({ id: detail.dispute.id, action: resolveAction, note })}
                            className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-40">
                            {resolveMut.isPending ? <Loader2 size={12} className="animate-spin inline" /> : "Confirm Resolution"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image viewer */}
      {imgViewer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setImgViewer(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setImgViewer(null)} className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm">Close ×</button>
            <img src={imgViewer} alt="Evidence" className="w-full max-h-[85vh] object-contain rounded-2xl border border-white/10" />
          </div>
        </div>
      )}
    </Layout>
  );
}
