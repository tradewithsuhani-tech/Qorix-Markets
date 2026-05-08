import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, User, Hash, Key, MapPin, Copy, Check, AlertTriangle, ArrowRight,
} from "lucide-react";
import { BANKS } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

type CopyKey = "holder" | "account" | "ifsc" | "branch" | "ref";

const generateRef = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `QX-${out}`;
};

export default function DepositNetBankingDetailsPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const bankId = params.get("bankId") ?? "";
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const bank = useMemo(() => BANKS.find((b) => b.id === bankId) ?? BANKS[0], [bankId]);
  const refCode = useMemo(() => generateRef(), []);
  const [copied, setCopied] = useState<CopyKey | null>(null);

  const copy = async (text: string, key: CopyKey) => {
    const stripSpaces = key === "account" || key === "ifsc" || key === "ref";
    await navigator.clipboard.writeText(stripSpaces ? text.replace(/\s/g, "") : text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const proceed = () => {
    if (numAmount <= 0) return;
    navigate(`/deposit/verify?bankId=${bank.id}&amount=${numAmount}`);
  };

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
          <div
            className="w-11 h-11 rounded-xl border-[1.5px] flex items-center justify-center text-base font-bold shrink-0"
            style={{ backgroundColor: bank.color + "22", borderColor: bank.color + "66", color: bank.color }}
          >
            {bank.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">{bank.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Transfer ₹{numAmount.toLocaleString("en-IN")} to the account below
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-emerald-500/15 border-emerald-500/40 text-emerald-400 text-[9px] font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-3">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground">BENEFICIARY ACCOUNT DETAILS</div>
          <DetailRow icon={<User className="w-3.5 h-3.5 text-emerald-400" />} label="Account Holder" value={bank.account.accountHolder} ck="holder" copied={copied} onCopy={copy} />
          <Divider />
          <DetailRow icon={<Hash className="w-3.5 h-3.5 text-emerald-400" />} label="Account Number" value={bank.account.accountNumber} ck="account" copied={copied} onCopy={copy} mono />
          <Divider />
          <DetailRow icon={<Key className="w-3.5 h-3.5 text-emerald-400" />} label="IFSC Code" value={bank.account.ifsc} ck="ifsc" copied={copied} onCopy={copy} mono />
          <Divider />
          <DetailRow icon={<MapPin className="w-3.5 h-3.5 text-emerald-400" />} label="Branch" value={bank.account.branch} ck="branch" copied={copied} onCopy={copy} />
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
            `Open your bank app and add ${bank.shortName} account as beneficiary (or use Quick Transfer).`,
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
