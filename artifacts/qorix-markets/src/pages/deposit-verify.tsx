import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Hash, Check, AlertCircle, UploadCloud, Plus, X,
  Shield, Loader2,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { BANKS, P2P_AGENTS } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const getApiUrl = (path: string) =>
  `${BASE_URL}api${path.startsWith("/") ? path : `/${path}`}`;

interface PaymentMethod {
  id: number;
  type: "upi" | "bank";
  displayName: string;
  merchantName?: string | null;
  isAvailable?: boolean;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
}

const UTR_MIN = 12;
const UTR_MAX = 22;
const MAX_SCREENSHOTS = 3;

export default function DepositVerifyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const methodIdParam = Number(params.get("methodId") ?? "0");
  const agentId = params.get("agentId") ?? "";
  const bankId = params.get("bankId") ?? "";
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  // Fetch real merchant methods (capacity-aware) so we can both display the
  // right payee and submit with a real paymentMethodId.
  const { data: methodsResp } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "capacity", String(numAmount)],
    queryFn: () => authFetch(getApiUrl(`/payment-methods?amount=${numAmount}`)),
    enabled: numAmount > 0,
  });
  const realMethods = methodsResp?.methods ?? [];
  const realMethod = useMemo(
    () => realMethods.find((m) => m.id === methodIdParam) ?? null,
    [realMethods, methodIdParam],
  );

  const payee = useMemo(() => {
    if (realMethod) {
      const name = realMethod.merchantName ?? realMethod.displayName ?? "Merchant";
      return {
        kind: "merchant" as const,
        id: String(realMethod.id),
        shortName: name,
        color: "#10B981",
        initial: name.charAt(0).toUpperCase(),
        statusSub: `Submit UTR & screenshot from your ${realMethod.type === "upi" ? "UPI" : "bank"} payment`,
        verifyingLabel: name,
        type: realMethod.type,
      };
    }
    if (agentId) {
      const a = P2P_AGENTS.find((x) => x.id === agentId);
      if (a) return {
        kind: "agent" as const, id: a.id, shortName: a.name, color: a.avatarColor,
        initial: a.initial, statusSub: "Submit UTR & screenshot from your UPI app",
        verifyingLabel: a.name, type: "upi" as const,
      };
    }
    if (bankId) {
      const b = BANKS.find((x) => x.id === bankId);
      if (b) return {
        kind: "bank" as const, id: b.id, shortName: b.shortName, color: b.color,
        initial: b.initial, statusSub: `Submit UTR & screenshot from ${b.shortName} transfer`,
        verifyingLabel: b.shortName, type: "bank" as const,
      };
    }
    return null;
  }, [realMethod, agentId, bankId]);

  const [utr, setUtr] = useState("");
  const [utrError, setUtrError] = useState<string | null>(null);
  const [shots, setShots] = useState<Array<{ id: string; uri: string; b64: string }>>([]);
  const [pickError, setPickError] = useState<string | null>(null);

  const utrTrimmed = utr.trim();
  const utrValid = new RegExp(`^[A-Z0-9]{${UTR_MIN},${UTR_MAX}}$`).test(utrTrimmed);
  const remaining = MAX_SCREENSHOTS - shots.length;
  const formValid = utrValid && shots.length > 0;

  const onUtrChange = (v: string) => {
    setUtr(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, UTR_MAX));
    if (utrError) setUtrError(null);
  };

  const compress = (file: File): Promise<{ b64: string; uri: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read error"));
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onerror = () => reject(new Error("bad image"));
        img.onload = () => {
          const max = 1600;
          let { width, height } = img;
          if (width > max || height > max) {
            const r = Math.min(max / width, max / height);
            width = Math.round(width * r);
            height = Math.round(height * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("no ctx"));
          ctx.drawImage(img, 0, 0, width, height);
          const out = canvas.toDataURL("image/jpeg", 0.78);
          resolve({ b64: out, uri: out });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPickError(null);
    try {
      const arr = Array.from(files).slice(0, remaining);
      const stamp = Date.now();
      const out: typeof shots = [];
      for (let i = 0; i < arr.length; i++) {
        const r = await compress(arr[i]);
        out.push({ id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`, ...r });
      }
      setShots((p) => [...p, ...out]);
    } catch {
      setPickError("Couldn't read image. Please try a different file.");
    }
  };

  const remove = (id: string) => setShots((p) => p.filter((s) => s.id !== id));

  const combineProofs = async (b64s: string[]): Promise<string> => {
    if (b64s.length === 0) return "";
    if (b64s.length === 1) return b64s[0];
    const imgs = await Promise.all(
      b64s.map(
        (b) => new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = b;
        })
      )
    );
    const w = Math.max(...imgs.map((i) => i.width));
    const h = imgs.reduce((s, i) => s + (i.height * w) / i.width, 0);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return b64s[0];
    let y = 0;
    for (const img of imgs) {
      const sh = (img.height * w) / img.width;
      ctx.drawImage(img, 0, y, w, sh);
      y += sh;
    }
    return canvas.toDataURL("image/jpeg", 0.78);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!payee) throw new Error("Invalid session");
      // Prefer the real method the user selected upstream. Fallback to first
      // available method matching the payee's type only for legacy decorative
      // agent/bank flows.
      const matched = realMethod
        ?? realMethods.find((m) => m.type === payee.type && (m.isAvailable !== false))
        ?? realMethods.find((m) => m.isAvailable !== false)
        ?? realMethods[0];
      if (!matched) throw new Error("No payment merchant available right now. Please try again in a minute.");
      const orderNo = `QX${Date.now().toString().slice(-7)}`;
      const utrWithMeta = `${utrTrimmed} | ${orderNo}`;
      const proofImageBase64 = await combineProofs(shots.map((s) => s.b64));
      return authFetch(getApiUrl("/inr-deposits"), {
        method: "POST",
        body: JSON.stringify({
          paymentMethodId: matched.id,
          amountInr: String(numAmount),
          utr: utrWithMeta,
          proofImageBase64,
        }),
      });
    },
    onSuccess: () => {
      const sp = new URLSearchParams({
        amount: String(numAmount),
        utr: utrTrimmed,
      });
      if (payee?.kind === "merchant") {
        sp.set("merchantName", payee.shortName);
        sp.set("methodType", payee.type);
        if (realMethod?.upiId) sp.set("upiId", realMethod.upiId);
        if (realMethod?.accountNumber) sp.set("accountNumber", realMethod.accountNumber);
        if (realMethod?.ifsc) sp.set("ifsc", realMethod.ifsc);
      } else if (payee?.kind === "agent") sp.set("agentId", payee.id);
      else if (payee?.kind === "bank") sp.set("bankId", payee.id);
      navigate(`/deposit/success?${sp.toString()}`);
    },
    onError: (e: any) => {
      toast({
        title: "Submission failed",
        description: e?.message ?? "Could not submit deposit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!utrValid) {
      setUtrError(`UTR must be ${UTR_MIN}–${UTR_MAX} alphanumeric characters`);
      return;
    }
    if (shots.length === 0) return;
    submit.mutate();
  };

  if (!payee) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold">Invalid payment session</h2>
          <p className="text-sm text-muted-foreground">
            We couldn't find this payment. Please go back and start your deposit again.
          </p>
          <button onClick={() => navigate("/deposit")} className="mt-2 px-8 h-12 rounded-xl bg-emerald-500 text-white font-bold">
            Back to Deposit
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            disabled={submit.isPending}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-40"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">VERIFY PAYMENT</div>
            <div className="text-xl font-bold mt-0.5">Confirm ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10">
          <div
            className="w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: payee.color + "22", borderColor: payee.color + "66", color: payee.color }}
          >
            {payee.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Awaiting verification</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{payee.statusSub}</div>
          </div>
        </div>

        {/* UTR */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-bold tracking-wide">UTR / Transaction Reference</label>
            <div className="text-[10px] text-muted-foreground">{utrTrimmed.length}/{UTR_MAX}</div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2.5 px-3.5 h-12 rounded-xl border bg-white/5",
              utrError ? "border-rose-500" : utrValid ? "border-emerald-500/50" : "border-white/10"
            )}
          >
            <Hash className={cn("w-4 h-4", utrValid ? "text-emerald-400" : "text-muted-foreground")} />
            <input
              value={utr}
              onChange={(e) => onUtrChange(e.target.value)}
              placeholder="e.g. 240501234567 or N12345678901234"
              maxLength={UTR_MAX}
              disabled={submit.isPending}
              className="flex-1 bg-transparent text-[15px] font-bold tracking-wider outline-none placeholder:text-muted-foreground/60 placeholder:font-normal placeholder:tracking-normal"
              data-testid="input-utr"
            />
            {utrValid && <Check className="w-4 h-4 text-emerald-400" />}
          </div>
          {utrError ? (
            <div className="text-[11px] font-semibold text-rose-400">{utrError}</div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              Find UTR in your bank app's transaction history ({UTR_MIN}–{UTR_MAX} chars, IMPS/NEFT/RTGS).
            </div>
          )}
        </div>

        {/* Screenshots */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-bold tracking-wide">Payment Screenshot</label>
            <div className="text-[10px] text-muted-foreground">{shots.length}/{MAX_SCREENSHOTS}</div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            {shots.map((s) => (
              <div key={s.id} className="relative w-24 h-24 rounded-2xl overflow-hidden border-[1.5px] border-emerald-500/45 bg-black">
                <img src={s.uri} alt="proof" className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-emerald-500 border-[1.5px] border-[#0b1220] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <button
                  onClick={() => remove(s.id)}
                  disabled={submit.isPending}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 border-[1.5px] border-[#0b1220] flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {remaining > 0 && (
              <label
                className={cn(
                  "w-24 h-24 rounded-2xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10",
                  pickError ? "border-rose-500/55" : "border-emerald-500/45"
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onPickFiles(e.target.files)}
                  disabled={submit.isPending}
                  className="hidden"
                  data-testid="input-screenshot"
                />
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl border flex items-center justify-center",
                    pickError ? "bg-rose-500/15 border-rose-500/40" : "bg-emerald-500/15 border-emerald-500/40"
                  )}
                >
                  {pickError ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : shots.length === 0 ? (
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Plus className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className={cn("text-[11px] font-bold tracking-wide", pickError ? "text-rose-400" : "")}>
                  {pickError ? "Retry" : shots.length === 0 ? "Upload" : "Add more"}
                </div>
              </label>
            )}
          </div>
          {pickError ? (
            <div className="text-[11px] font-semibold text-rose-400">{pickError}</div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              Up to {MAX_SCREENSHOTS} images · PNG or JPG · Max 5 MB each · Show full transaction
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="text-[11px] text-muted-foreground">
            Verified within 2 mins · Auto-credited on UTR match · 24/7 support if delayed
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!formValid || submit.isPending}
          className={cn(
            "w-full h-14 rounded-xl flex items-center justify-center gap-2.5 font-bold transition-colors",
            formValid && !submit.isPending
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-white/5 text-muted-foreground"
          )}
          data-testid="button-submit"
        >
          {submit.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying with {payee.verifyingLabel}…
            </>
          ) : !utrValid ? (
            "Enter UTR to continue"
          ) : shots.length === 0 ? (
            "Upload screenshot to continue"
          ) : (
            "Submit for Verification"
          )}
        </button>
      </div>
    </Layout>
  );
}
