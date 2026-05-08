import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, User, Hash, Key, Building2, Copy, Check, AlertTriangle, ArrowRight,
  Loader2, AlertCircle,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const getApiUrl = (path: string) => `${BASE_URL}api${path}`;

type CopyKey = "holder" | "account" | "ifsc" | "bank" | "ref";

interface PaymentMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  minAmount: string;
  maxAmount: string;
  merchantId?: number | null;
  merchantName?: string | null;
  isOnline?: boolean;
}

const COLORS = ["#10B981", "#14B8A6", "#06B6D4", "#3B82F6", "#22C55E", "#EC4899", "#F59E0B"];
const colorFor = (id: number) => COLORS[id % COLORS.length];

const generateRef = (id: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const seed = (id * 7919 + Date.now() + Math.floor(Math.random() * 36 ** 3)) >>> 0;
  let n = seed;
  for (let i = 0; i < 6; i++) {
    out += chars[n % chars.length];
    n = Math.floor(n / chars.length) + i + 1;
  }
  return `QX-${out}`;
};

export default function DepositNetBankingDetailsPage() {
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

  const refCode = useMemo(() => (method ? generateRef(method.id) : ""), [method]);
  const [copied, setCopied] = useState<CopyKey | null>(null);

  const copy = async (text: string, key: CopyKey) => {
    const stripSpaces = key === "account" || key === "ifsc" || key === "ref";
    await navigator.clipboard.writeText(stripSpaces ? text.replace(/\s/g, "") : text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const proceed = () => {
    if (!method || numAmount <= 0) return;
    navigate(`/deposit/verify?methodId=${method.id}&amount=${numAmount}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center">
          <Loader2 className="w-7 h-7 mx-auto text-emerald-400 animate-spin" />
          <div className="text-sm text-muted-foreground mt-3">Loading bank details…</div>
        </div>
      </Layout>
    );
  }

  if (isError || !method || !method.accountNumber || !method.ifsc) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold">Bank not available</h2>
          <p className="text-sm text-muted-foreground">
            This bank account is no longer accepting payments. Please go back and pick another.
          </p>
          <button
            onClick={() => navigate(`/deposit/netbanking?amount=${numAmount}`)}
            className="mt-2 px-8 h-12 rounded-xl bg-emerald-500 text-white font-bold"
          >
            Pick Another Bank
          </button>
        </div>
      </Layout>
    );
  }

  const color = colorFor(method.merchantId ?? method.id);
  const bankLabel = method.bankName ?? method.displayName ?? "Bank";
  const initial = bankLabel.charAt(0).toUpperCase();
  const merchantLabel = method.merchantName ?? method.accountHolder ?? "Verified beneficiary";

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
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">BANK TRANSFER · NEFT/IMPS</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/5">
          <div className="relative w-11 h-11 shrink-0">
            <div
              className="w-11 h-11 rounded-xl border-[1.5px] flex items-center justify-center text-base font-bold"
              style={{ backgroundColor: color + "22", borderColor: color + "66", color }}
            >
              {initial}
            </div>
            <div className={cn(
              "absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-[#0b1220]",
              method.isOnline === false ? "bg-rose-500" : "bg-emerald-500",
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{bankLabel}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Transfer ₹{numAmount.toLocaleString("en-IN")} to {merchantLabel}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-emerald-500/15 border-emerald-500/40 text-emerald-400 text-[9px] font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground">BENEFICIARY ACCOUNT DETAILS</div>
          <DetailRow icon={<User className="w-3.5 h-3.5 text-emerald-400" />} label="Account Holder" value={method.accountHolder ?? merchantLabel} ck="holder" copied={copied} onCopy={copy} />
          <Divider />
          <DetailRow icon={<Hash className="w-3.5 h-3.5 text-emerald-400" />} label="Account Number" value={method.accountNumber!} ck="account" copied={copied} onCopy={copy} mono />
          <Divider />
          <DetailRow icon={<Key className="w-3.5 h-3.5 text-emerald-400" />} label="IFSC Code" value={method.ifsc!} ck="ifsc" copied={copied} onCopy={copy} mono />
          <Divider />
          <DetailRow icon={<Building2 className="w-3.5 h-3.5 text-emerald-400" />} label="Bank" value={bankLabel} ck="bank" copied={copied} onCopy={copy} />
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-widest text-emerald-400">TRANSFER NOTE / REFERENCE</div>
              <div className="text-base font-bold tracking-wider mt-0.5">{refCode}</div>
            </div>
            <button
              onClick={() => copy(refCode, "ref")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-bold",
                copied === "ref" ? "border-emerald-500 text-emerald-400" : "border-emerald-500/60 text-emerald-400"
              )}
              data-testid="copy-ref"
            >
              {copied === "ref" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === "ref" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Add this in the transfer remarks/note so we can match your payment instantly.
          </div>
        </div>

        <div className="flex items-start gap-2 px-2.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground">
            Transfer the <span className="text-foreground font-bold">exact amount of ₹{numAmount.toLocaleString("en-IN")}</span>. Different amount or wrong account may delay/reject crediting.
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
          {[
            `Open your bank app and add the account above as beneficiary (or use Quick Transfer).`,
            `Send exactly ₹${numAmount.toLocaleString("en-IN")} via NEFT / IMPS / RTGS with the reference code above.`,
            `Tap 'I've Paid' below — funds usually credited within 2 minutes.`,
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center text-[11px] font-bold text-emerald-400 shrink-0">
                {i + 1}
              </div>
              <div className="text-xs text-muted-foreground flex-1">{t}</div>
            </div>
          ))}
        </div>

        <button
          onClick={proceed}
          disabled={numAmount <= 0}
          className={cn(
            "w-full h-14 rounded-xl flex items-center justify-center gap-2.5 font-bold transition-colors",
            numAmount > 0 ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-white/5 text-muted-foreground"
          )}
          data-testid="button-paid"
        >
          I've Paid ₹{numAmount.toLocaleString("en-IN")}
          {numAmount > 0 && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </Layout>
  );
}

function Divider() { return <div className="h-px bg-white/5" />; }

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
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-[13px] truncate", mono ? "font-bold tracking-wider" : "font-semibold")}>{value}</div>
      </div>
      <button
        onClick={() => onCopy(value, ck)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors",
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
