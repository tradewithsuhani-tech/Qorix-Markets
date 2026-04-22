import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Shield, Upload, CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type KycStatus = "not_submitted" | "pending" | "approved" | "rejected";

interface KycInfo {
  kycStatus: KycStatus;
  kycDocumentType: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string | null;
}

const DOC_TYPES = [
  { id: "passport", label: "Passport" },
  { id: "national_id", label: "National ID" },
  { id: "drivers_license", label: "Driver's License" },
];

const MAX_BYTES = 4 * 1024 * 1024;

function StatusBadge({ status }: { status: KycStatus }) {
  const cfg = {
    not_submitted: { icon: FileText, text: "Not Submitted", cls: "bg-white/5 text-muted-foreground border-white/10" },
    pending: { icon: Clock, text: "Under Review", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    approved: { icon: CheckCircle2, text: "Verified", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { icon: XCircle, text: "Rejected", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.text}
    </span>
  );
}

export default function KycPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [docType, setDocType] = useState("passport");
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontName, setFrontName] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backName, setBackName] = useState<string | null>(null);

  const requiresBack = docType === "national_id" || docType === "drivers_license";

  const { data: info, isLoading } = useQuery<KycInfo>({
    queryKey: ["kyc-status"],
    queryFn: () => authFetch("/api/kyc/status"),
    refetchInterval: 30000,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!frontPreview) throw new Error("Please upload the front side of the document");
      if (requiresBack && !backPreview) throw new Error("Please also upload the back side of the document");
      return authFetch("/api/kyc/submit", {
        method: "POST",
        body: JSON.stringify({
          documentType: docType,
          documentUrl: frontPreview,
          documentUrlBack: backPreview,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "KYC submitted", description: "We'll review within 24 hours." });
      setFrontPreview(null);
      setFrontName(null);
      setBackPreview(null);
      setBackName(null);
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
    },
    onError: (e: any) =>
      toast({ title: "Submission failed", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  const handleFile = (f: File, side: "front" | "back") => {
    if (f.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max 4MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Upload an image (JPG / PNG)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (side === "front") {
        setFrontPreview(reader.result as string);
        setFrontName(f.name);
      } else {
        setBackPreview(reader.result as string);
        setBackName(f.name);
      }
    };
    reader.readAsDataURL(f);
  };

  if (!user) return null;

  const status = info?.kycStatus ?? "not_submitted";
  const canSubmit = status === "not_submitted" || status === "rejected";

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-5 max-w-2xl mx-auto"
      >
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Identity Verification</h1>
            {!isLoading && <StatusBadge status={status} />}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Required to enable withdrawals. Documents are encrypted and reviewed within 24 hours.
          </p>
        </div>

        {status === "approved" && (
          <div className="glass-card rounded-2xl p-5 border-emerald-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-emerald-300">Identity verified</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Approved on {info?.kycReviewedAt ? format(new Date(info.kycReviewedAt), "PPP") : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="glass-card rounded-2xl p-5 border-amber-500/20">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-amber-300">Under review</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Submitted{" "}
                  {info?.kycSubmittedAt ? format(new Date(info.kycSubmittedAt), "PPP p") : "recently"}. We typically
                  respond within 24 hours.
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "rejected" && info?.kycRejectionReason && (
          <div className="glass-card rounded-2xl p-5 border-rose-500/20">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-rose-300">Previous submission rejected</div>
                <div className="text-sm text-muted-foreground mt-0.5">{info.kycRejectionReason}</div>
                <div className="text-xs text-muted-foreground/70 mt-1">Please resubmit clearer documents below.</div>
              </div>
            </div>
          </div>
        )}

        {canSubmit && (
          <div className="glass-card rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold">Submit Document</h2>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Document Type</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {DOC_TYPES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDocType(d.id)}
                    className={`px-2 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      docType === d.id
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                        : "bg-white/[0.03] border-white/8 text-muted-foreground hover:bg-white/[0.06]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* FRONT */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                  Front Side <span className="text-rose-400">*</span>
                </label>
                <label className="mt-2 flex flex-col items-center justify-center gap-1.5 px-3 py-6 rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer transition-colors min-h-[160px]">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "front")}
                  />
                  {frontPreview ? (
                    <>
                      <img src={frontPreview} alt="front preview" className="max-h-28 rounded-lg" />
                      <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{frontName}</span>
                      <span className="text-[10px] text-blue-400">Click to change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Upload front</span>
                      <span className="text-[10px] text-muted-foreground">JPG / PNG · Max 4MB</span>
                    </>
                  )}
                </label>
              </div>

              {/* BACK */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                  Back Side {requiresBack ? <span className="text-rose-400">*</span> : <span className="text-muted-foreground/60 normal-case">(optional)</span>}
                </label>
                <label className="mt-2 flex flex-col items-center justify-center gap-1.5 px-3 py-6 rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer transition-colors min-h-[160px]">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "back")}
                  />
                  {backPreview ? (
                    <>
                      <img src={backPreview} alt="back preview" className="max-h-28 rounded-lg" />
                      <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{backName}</span>
                      <span className="text-[10px] text-blue-400">Click to change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Upload back</span>
                      <span className="text-[10px] text-muted-foreground">
                        {requiresBack ? "JPG / PNG · Max 4MB" : "Skip for passport"}
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <button
              onClick={() => submit.mutate()}
              disabled={!frontPreview || (requiresBack && !backPreview) || submit.isPending}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              {submit.isPending ? "Submitting…" : "Submit for Review"}
            </button>

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              By submitting, you confirm the document is authentic and belongs to you. Submitting forged documents will
              result in permanent account closure.
            </p>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
