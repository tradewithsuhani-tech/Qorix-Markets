import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Shield, Copy, Check, AtSign, DollarSign, Hash,
  AlertTriangle, CheckCircle2, ArrowRight, Info, AlertCircle, Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const getApiUrl = (path: string) => `${BASE_URL}api${path}`;

type CopyKey = "upi" | "amount" | "ref";

interface PaymentMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  upiId: string | null;
  minAmount: string;
  maxAmount: string;
  merchantId?: number | null;
  merchantName?: string | null;
  isOnline?: boolean;
}

const COLORS = ["#10B981", "#14B8A6", "#06B6D4", "#3B82F6", "#22C55E", "#EC4899", "#F59E0B"];
const colorFor = (id: number) => COLORS[id % COLORS.length];

const generateRef = (methodId: number, amount: number) => {
  const seed = methodId * 7919 + Math.floor(amount);
  const mix = (seed + Date.now() + Math.floor(Math.random() * 36 ** 3)) >>> 0;
  return `QX-${mix.toString(36).toUpperCase().slice(-6).padStart(6, "X")}`;
};

export default function DepositUpiPayPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const methodId = Number(params.get("methodId") ?? "0");
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const { data, isLoading, isError } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "capacity", String(numAmount)],
    queryFn: () => authFetch(getApiUrl(`/payment-methods?amount=${numAmount}`)),
    enabled: numAmount > 0 && methodId > 0,
  });

  const method = useMemo(
    () => (data?.methods ?? []).find((m) => m.id === methodId) ?? null,
    [data, methodId],
  );

  const refCode = useMemo(
    () => (method ? generateRef(method.id, numAmount) : ""),
    [method, numAmount],
  );

  const upiUri = useMemo(() => {
    if (!method?.upiId) return "";
    const pn = encodeURIComponent(method.merchantName ?? method.displayName ?? "Qorix");
    const tn = encodeURIComponent(`Qorix ${refCode}`);
    return `upi://pay?pa=${method.upiId}&pn=${pn}&am=${numAmount}&cu=INR&tn=${tn}`;
  }, [method, numAmount, refCode]);

  const [copied, setCopied] = useState<CopyKey | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && upiUri) {
      QRCode.toCanvas(canvasRef.current, upiUri, {
        width: 188,
        margin: 1,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      }).catch(() => {});
    }
  }, [upiUri]);

  const copy = async (text: string, key: CopyKey) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const handlePaid = () => {
    if (!method) return;
    navigate(`/deposit/verify?methodId=${method.id}&amount=${numAmount}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center">
          <Loader2 className="w-7 h-7 mx-auto text-emerald-400 animate-spin" />
          <div className="text-sm text-muted-foreground mt-3">Loading merchant details…</div>
        </div>
      </Layout>
    );
  }

  if (isError || !method || !method.upiId) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold">Merchant not available</h2>
          <p className="text-sm text-muted-foreground">
            This merchant is no longer accepting payments. Please go back and pick again.
          </p>
          <button
            onClick={() => navigate(`/deposit/upi?amount=${numAmount}`)}
            className="mt-2 px-8 h-12 rounded-xl bg-emerald-500 text-white font-bold"
          >
            Pick Another Merchant
          </button>
        </div>
      </Layout>
    );
  }

  const color = colorFor(method.merchantId ?? method.id);
  const name = method.merchantName ?? method.displayName ?? "Merchant";
  const initial = name.charAt(0).toUpperCase();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">UPI PAYMENT</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5">
          <div className="relative w-11 h-11 shrink-0">
            <div
              className="w-11 h-11 rounded-full border-[1.5px] flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: color + "33", borderColor: color + "66", color }}
            >
              {initial}
            </div>
            <div
              className={cn(
                "absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-[#0b1220]",
                method.isOnline === false ? "bg-rose-500" : "bg-emerald-500"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-extrabold truncate uppercase">{name}</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-400 text-[9px] font-bold tracking-wider">
            <Shield className="w-2.5 h-2.5" /> ESCROW
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-5 flex flex-col items-center gap-3.5">
          <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">SCAN TO PAY</div>
          <div className="bg-white p-3 rounded-xl">
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-px bg-white/10" />
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground">OR PAY USING UPI ID</div>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 divide-y divide-white/5">
          <DetailRow icon={<AtSign className="w-3.5 h-3.5 text-emerald-400" />} label="UPI ID" value={method.upiId} ck="upi" copied={copied} onCopy={copy} mono />
          <DetailRow icon={<DollarSign className="w-3.5 h-3.5 text-emerald-400" />} label="Amount" value={`₹${numAmount.toLocaleString("en-IN")}`} ck="amount" copied={copied} onCopy={(_, k) => copy(String(numAmount), k)} mono />
          <DetailRow icon={<Hash className="w-3.5 h-3.5 text-emerald-400" />} label="Reference" value={refCode} ck="ref" copied={copied} onCopy={copy} mono />
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/35">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            Pay <span className="font-bold">exactly ₹{numAmount.toLocaleString("en-IN")}</span>
            {"  ·  "}
            <span className="text-muted-foreground">Add {refCode} in payment note for instant credit</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2.5">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground">HOW IT WORKS</div>
          {[
            "Scan QR or paste UPI ID in any UPI app",
            "Pay the exact amount with reference code",
            "Submit UTR + screenshot · funds credited in 2 mins",
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                {i + 1}
              </div>
              <div className="text-xs text-muted-foreground flex-1">{t}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handlePaid}
          className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 transition-colors"
          data-testid="button-paid"
        >
          <CheckCircle2 className="w-4 h-4" />
          I've Paid ₹{numAmount.toLocaleString("en-IN")}
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <Info className="w-3 h-3" />
          Funds held in escrow · Released only after merchant confirms · 0% fees
        </div>
      </div>
    </Layout>
  );
}

function DetailRow({
  icon, label, value, ck, copied, onCopy, mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ck: CopyKey;
  copied: CopyKey | null;
  onCopy: (text: string, key: CopyKey) => void;
  mono?: boolean;
}) {
  const isCopied = copied === ck;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</div>
        <div className={cn("text-sm truncate", mono ? "font-bold tracking-wider" : "font-semibold")}>{value}</div>
      </div>
      <button
        onClick={() => onCopy(value, ck)}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-bold transition-colors",
          isCopied ? "border-emerald-500 text-emerald-400" : "border-emerald-500/45 text-emerald-400 hover:bg-emerald-500/10"
        )}
        data-testid={`copy-${ck}`}
      >
        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {isCopied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
