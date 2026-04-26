import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  IdCard,
  Home,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type KycStatus = "not_submitted" | "pending" | "approved" | "rejected";

interface KycInfo {
  email: string;
  fullName: string;
  // Lv.1
  kycPersonalStatus: KycStatus;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  kycPersonalSubmittedAt: string | null;
  // Lv.2
  kycStatus: KycStatus;
  kycDocumentType: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string | null;
  // Lv.3
  kycAddressStatus: KycStatus;
  addressLine1: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressCountry: string | null;
  addressPostalCode: string | null;
  kycAddressSubmittedAt: string | null;
  kycAddressReviewedAt: string | null;
  kycAddressRejectionReason: string | null;
}

const DOC_TYPES = [
  { id: "passport", label: "Passport" },
  { id: "national_id", label: "National ID" },
  { id: "drivers_license", label: "Driver's License" },
];

const MAX_BYTES = 4 * 1024 * 1024;

function StatusPill({ status }: { status: KycStatus }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold">
        <CheckCircle2 className="w-3 h-3" />
        Verified
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[11px] font-semibold">
        <Clock className="w-3 h-3" />
        Under review
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[11px] font-semibold">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground text-[11px] font-semibold border border-white/10">
      Not started
    </span>
  );
}

function depositLimitFor(completed: number) {
  if (completed >= 3) return { label: "Unlimited", note: "Some payment methods may have their own limits" };
  if (completed === 2) return { label: "$10,000,000", note: "Boosted by identity verification" };
  if (completed === 1) return { label: "$5,000", note: "Verify identity to boost your limit" };
  return { label: "Locked", note: "Complete personal details to start" };
}

function LevelHeader({
  num,
  icon: Icon,
  title,
  subtitle,
  status,
  open,
  locked,
  onToggle,
}: {
  num: number;
  icon: any;
  title: string;
  subtitle: string;
  status: KycStatus;
  open: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={locked}
      className={`w-full text-left px-4 py-4 flex items-start gap-3 ${locked ? "opacity-60 cursor-not-allowed" : "hover:bg-white/[0.02]"} transition-colors`}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground tracking-wider">Lv.{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-[15px] truncate">{title}</h3>
          <StatusPill status={status} />
          {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
      </div>
      {!locked && (
        <div className="pt-1">
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      )}
    </button>
  );
}

function FileUpload({
  preview,
  name,
  label,
  required,
  hint,
  onFile,
}: {
  preview: string | null;
  name: string | null;
  label: string;
  required?: boolean;
  hint?: string;
  onFile: (f: File) => void;
}) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <label className="mt-2 flex flex-col items-center justify-center gap-1.5 px-3 py-5 rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer transition-colors min-h-[140px]">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {preview ? (
          <>
            <img src={preview} alt="preview" className="max-h-24 rounded-lg" />
            <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{name}</span>
            <span className="text-[10px] text-blue-400">Click to change</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Upload</span>
            <span className="text-[10px] text-muted-foreground">{hint ?? "JPG / PNG · Max 4MB"}</span>
          </>
        )}
      </label>
    </div>
  );
}

export default function KycPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openLevel, setOpenLevel] = useState<number | null>(null);

  const { data: info, isLoading } = useQuery<KycInfo>({
    queryKey: ["kyc-status"],
    queryFn: () => authFetch("/api/kyc/status"),
    refetchInterval: 30000,
  });

  // ─── Lv.1 personal form ───
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const personalSubmit = useMutation({
    mutationFn: () =>
      authFetch("/api/kyc/personal", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: phone, dateOfBirth: dob }),
      }),
    onSuccess: () => {
      toast({ title: "Personal details verified" });
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
      setOpenLevel(2);
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  // ─── Lv.2 identity ───
  const [docType, setDocType] = useState("passport");
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontName, setFrontName] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backName, setBackName] = useState<string | null>(null);
  const requiresBack = docType === "national_id" || docType === "drivers_license";

  const identitySubmit = useMutation({
    mutationFn: () =>
      authFetch("/api/kyc/submit", {
        method: "POST",
        body: JSON.stringify({ documentType: docType, documentUrl: frontPreview, documentUrlBack: backPreview }),
      }),
    onSuccess: () => {
      toast({ title: "Identity submitted", description: "Review within 24h." });
      setFrontPreview(null);
      setFrontName(null);
      setBackPreview(null);
      setBackName(null);
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  // ─── Lv.3 address ───
  const [addrLine, setAddrLine] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrCountry, setAddrCountry] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [addrDocPreview, setAddrDocPreview] = useState<string | null>(null);
  const [addrDocName, setAddrDocName] = useState<string | null>(null);

  const addressSubmit = useMutation({
    mutationFn: () =>
      authFetch("/api/kyc/address", {
        method: "POST",
        body: JSON.stringify({
          addressLine1: addrLine,
          addressCity: addrCity,
          addressState: addrState,
          addressCountry: addrCountry,
          addressPostalCode: addrZip,
          documentUrl: addrDocPreview,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Address submitted", description: "Review within 24h." });
      qc.invalidateQueries({ queryKey: ["kyc-status"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  const handleFile = (f: File, setPrev: (s: string) => void, setN: (s: string) => void) => {
    if (f.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max 4MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "JPG / PNG only", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPrev(reader.result as string);
      setN(f.name);
    };
    reader.readAsDataURL(f);
  };

  if (!user || isLoading || !info) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-10 text-center text-sm text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  const lv1 = info.kycPersonalStatus;
  const lv2 = info.kycStatus;
  const lv3 = info.kycAddressStatus;
  const completed = (lv1 === "approved" ? 1 : 0) + (lv2 === "approved" ? 1 : 0) + (lv3 === "approved" ? 1 : 0);
  const fullyVerified = completed === 3;
  const limit = depositLimitFor(completed);

  // Mask email like pr••••p1@gmail.com
  const maskedEmail = (() => {
    const e = info.email ?? "";
    const [local, dom] = e.split("@");
    if (!local || !dom) return e;
    const head = local.slice(0, 2);
    return `${head}${"•".repeat(Math.max(4, local.length - 2))}@${dom}`;
  })();
  const maskedPhone = (() => {
    if (!info.phoneNumber) return null;
    const p = info.phoneNumber;
    if (p.length < 4) return p;
    return `${p.slice(0, 3)} ••• ${p.slice(-4)}`;
  })();

  const canSubmitIdentity = lv2 === "not_submitted" || lv2 === "rejected";
  const canSubmitAddress = lv3 === "not_submitted" || lv3 === "rejected";
  const lv2Locked = lv1 !== "approved";
  const lv3Locked = lv2 !== "approved";

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-5 max-w-2xl mx-auto pb-24"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Authentication Centre</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fullyVerified
              ? `${completed}/3 standard verification completed`
              : `${completed}/3 steps complete — boost your trading limits`}
          </p>
        </div>

        {/* STATUS CARD */}
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs text-muted-foreground font-medium">Status</div>
          <div className={`text-2xl font-bold mt-1 ${fullyVerified ? "text-emerald-400" : "text-amber-400"}`}>
            {fullyVerified ? "Fully verified" : completed > 0 ? "Partially verified" : "Not verified"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{completed}/3 steps complete</div>
        </div>

        {/* DEPOSIT LIMIT CARD */}
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs text-muted-foreground font-medium">Deposit limit</div>
          <div className={`text-2xl font-bold mt-1 ${fullyVerified ? "text-emerald-400" : "text-blue-400"}`}>
            {limit.label}
          </div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{limit.note}</div>
        </div>

        {/* VERIFICATION STEPS */}
        <div>
          <h2 className="text-lg font-bold mb-3">Verification steps</h2>
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {/* Lv.1 */}
            <div>
              <LevelHeader
                num={1}
                icon={User}
                title="Personal Details Verification"
                subtitle={
                  lv1 === "approved"
                    ? `${maskedEmail}${maskedPhone ? `, ${maskedPhone}` : ""}`
                    : "Complete your profile and trade live with a $5,000 cap"
                }
                status={lv1}
                open={openLevel === 1}
                onToggle={() => setOpenLevel(openLevel === 1 ? null : 1)}
              />
              <AnimatePresence initial={false}>
                {openLevel === 1 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 space-y-4">
                      {lv1 === "approved" ? (
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                          <Field label="Full name" value={info.fullName} />
                          <Field label="Email" value={maskedEmail} />
                          <Field label="Phone" value={maskedPhone ?? "—"} />
                          <Field label="Date of birth" value={info.dateOfBirth ?? "—"} />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                              Phone number <span className="text-rose-400">*</span>
                            </label>
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+91 98765 43210"
                              className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                              Date of birth <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="date"
                              value={dob}
                              onChange={(e) => setDob(e.target.value)}
                              className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40 [color-scheme:dark]"
                            />
                          </div>
                          <button
                            disabled={!phone || !dob || personalSubmit.isPending}
                            onClick={() => personalSubmit.mutate()}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
                          >
                            {personalSubmit.isPending ? "Saving…" : "Save & Verify"}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lv.2 */}
            <div>
              <LevelHeader
                num={2}
                icon={IdCard}
                title="Identity Verification"
                subtitle={
                  lv2 === "approved"
                    ? `${info.fullName.toUpperCase()}`
                    : lv2Locked
                      ? "Complete personal details first"
                      : "Boost your limit to $10,000,000 by verifying your ID"
                }
                status={lv2}
                open={openLevel === 2}
                locked={lv2Locked && lv2 === "not_submitted"}
                onToggle={() => setOpenLevel(openLevel === 2 ? null : 2)}
              />
              <AnimatePresence initial={false}>
                {openLevel === 2 && !lv2Locked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 space-y-4">
                      {lv2 === "approved" && (
                        <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3 text-xs text-emerald-300">
                          Approved on {info.kycReviewedAt ? format(new Date(info.kycReviewedAt), "PPP") : "—"}
                        </div>
                      )}
                      {lv2 === "pending" && (
                        <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-3 text-xs text-amber-300">
                          Submitted {info.kycSubmittedAt ? format(new Date(info.kycSubmittedAt), "PPP p") : ""} — review within 24h.
                        </div>
                      )}
                      {lv2 === "rejected" && info.kycRejectionReason && (
                        <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/15 p-3 text-xs text-rose-300">
                          {info.kycRejectionReason} — please re-submit clearer documents below.
                        </div>
                      )}
                      {canSubmitIdentity && (
                        <>
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                              Document type
                            </label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {DOC_TYPES.map((d) => (
                                <button
                                  key={d.id}
                                  onClick={() => setDocType(d.id)}
                                  className={`px-2 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                                    docType === d.id
                                      ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                                      : "bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-white/[0.06]"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FileUpload
                              preview={frontPreview}
                              name={frontName}
                              label="Front Side"
                              required
                              onFile={(f) => handleFile(f, setFrontPreview, setFrontName)}
                            />
                            <FileUpload
                              preview={backPreview}
                              name={backName}
                              label="Back Side"
                              required={requiresBack}
                              hint={requiresBack ? undefined : "Skip for passport"}
                              onFile={(f) => handleFile(f, setBackPreview, setBackName)}
                            />
                          </div>
                          <button
                            disabled={!frontPreview || (requiresBack && !backPreview) || identitySubmit.isPending}
                            onClick={() => identitySubmit.mutate()}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
                          >
                            {identitySubmit.isPending ? "Submitting…" : "Submit for Review"}
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lv.3 */}
            <div>
              <LevelHeader
                num={3}
                icon={Home}
                title="Residency Address Verification"
                subtitle={
                  lv3 === "approved"
                    ? `${info.addressLine1 ?? ""}, ${info.addressCity ?? ""}, ${info.addressCountry ?? ""}`
                    : lv3Locked
                      ? "Complete identity verification first"
                      : "Go unlimited—upload proof of address for a $10,000,000 limit"
                }
                status={lv3}
                open={openLevel === 3}
                locked={lv3Locked && lv3 === "not_submitted"}
                onToggle={() => setOpenLevel(openLevel === 3 ? null : 3)}
              />
              <AnimatePresence initial={false}>
                {openLevel === 3 && !lv3Locked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 space-y-4">
                      {lv3 === "approved" && (
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                          <Field label="Address" value={info.addressLine1 ?? "—"} />
                          <Field label="City" value={info.addressCity ?? "—"} />
                          <Field label="State" value={info.addressState ?? "—"} />
                          <Field label="Country" value={info.addressCountry ?? "—"} />
                          <Field label="Postal code" value={info.addressPostalCode ?? "—"} />
                        </div>
                      )}
                      {lv3 === "pending" && (
                        <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-3 text-xs text-amber-300">
                          Address proof submitted — review within 24h.
                        </div>
                      )}
                      {lv3 === "rejected" && info.kycAddressRejectionReason && (
                        <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/15 p-3 text-xs text-rose-300">
                          {info.kycAddressRejectionReason} — please re-submit.
                        </div>
                      )}
                      {canSubmitAddress && (
                        <>
                          <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-3 text-[11px] text-blue-200 leading-relaxed">
                            Accepted proof: utility bill, bank statement, or government-issued document dated within the last 3 months and showing your name + full address.
                          </div>
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                              Address line <span className="text-rose-400">*</span>
                            </label>
                            <input
                              value={addrLine}
                              onChange={(e) => setAddrLine(e.target.value)}
                              placeholder="Apartment, building, street"
                              className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                                City <span className="text-rose-400">*</span>
                              </label>
                              <input
                                value={addrCity}
                                onChange={(e) => setAddrCity(e.target.value)}
                                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                                State <span className="text-rose-400">*</span>
                              </label>
                              <input
                                value={addrState}
                                onChange={(e) => setAddrState(e.target.value)}
                                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                                Country <span className="text-rose-400">*</span>
                              </label>
                              <input
                                value={addrCountry}
                                onChange={(e) => setAddrCountry(e.target.value)}
                                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                                Postal code <span className="text-rose-400">*</span>
                              </label>
                              <input
                                value={addrZip}
                                onChange={(e) => setAddrZip(e.target.value)}
                                className="mt-2 w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm focus:outline-none focus:border-blue-500/40"
                              />
                            </div>
                          </div>
                          <FileUpload
                            preview={addrDocPreview}
                            name={addrDocName}
                            label="Proof of address"
                            required
                            hint="Utility bill / bank statement (≤ 3 months)"
                            onFile={(f) => handleFile(f, setAddrDocPreview, setAddrDocName)}
                          />
                          <button
                            disabled={
                              !addrLine ||
                              !addrCity ||
                              !addrState ||
                              !addrCountry ||
                              !addrZip ||
                              !addrDocPreview ||
                              addressSubmit.isPending
                            }
                            onClick={() => addressSubmit.mutate()}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:brightness-110 transition-all"
                          >
                            {addressSubmit.isPending ? "Submitting…" : "Submit for Review"}
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed text-center px-4">
          <Shield className="w-3 h-3 inline -mt-0.5 mr-1" />
          Documents are encrypted and reviewed within 24 hours. Submitting forged documents will result in permanent
          account closure.
        </p>
      </motion.div>
    </Layout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
