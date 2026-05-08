import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Shield, Star, Clock, Copy, Check, AtSign, DollarSign, Hash,
  AlertTriangle, CheckCircle2, ArrowRight, Info, AlertCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { P2P_AGENTS } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

type CopyKey = "upi" | "amount" | "ref";

const generateRef = (agentId: string, amount: number) => {
  const seed = agentId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const mix = (seed * 7919 + Date.now() + Math.floor(Math.random() * 36 ** 3)) >>> 0;
  return `QX-${mix.toString(36).toUpperCase().slice(-6).padStart(6, "X")}`;
};

export default function DepositUpiPayPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const agentId = params.get("agentId") ?? "";
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const agent = useMemo(() => P2P_AGENTS.find((a) => a.id === agentId), [agentId]);
  const refCode = useMemo(() => (agent ? generateRef(agent.id, numAmount) : ""), [agent, numAmount]);
  const upiUri = useMemo(() => {
    if (!agent) return "";
    const pn = encodeURIComponent(agent.name);
    const tn = encodeURIComponent(`Qorix ${refCode}`);
    return `upi://pay?pa=${agent.upiId}&pn=${pn}&am=${numAmount}&cu=INR&tn=${tn}`;
  }, [agent, numAmount, refCode]);

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
    if (!agent) return;
    navigate(`/deposit/verify?agentId=${agent.id}&amount=${numAmount}`);
  };

  if (!agent) {
    return (
      <Layout>
        <div className="max-w-md mx-auto pt-24 px-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold">Invalid payment session</h2>
          <p className="text-sm text-muted-foreground">We couldn't find this agent. Please go back and pick again.</p>
          <button
            onClick={() => navigate("/deposit")}
            className="mt-2 px-8 h-12 rounded-xl bg-emerald-500 text-white font-bold"
          >
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
              style={{ backgroundColor: agent.avatarColor + "33", borderColor: agent.avatarColor + "66", color: agent.avatarColor }}
            >
              {agent.initial}
            </div>
            {agent.online && <div className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0b1220]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{agent.name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <Star className="w-3 h-3 text-emerald-400" />
              <span>{agent.rating.toFixed(2)}</span>
              <span>·</span>
              <Clock className="w-3 h-3" />
              <span>{agent.responseTime}</span>
            </div>
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
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              { l: "PhonePe", c: "#22D3EE", b: "rgba(34,211,238,0.15)", bo: "rgba(34,211,238,0.4)" },
              { l: "GPay", c: "#60A5FA", b: "rgba(66,133,244,0.15)", bo: "rgba(66,133,244,0.4)" },
              { l: "Paytm", c: "#38BDF8", b: "rgba(0,186,242,0.15)", bo: "rgba(0,186,242,0.4)" },
              { l: "BHIM", c: "#FBBF24", b: "rgba(245,158,11,0.15)", bo: "rgba(245,158,11,0.4)" },
            ].map((x) => (
              <span key={x.l} className="px-2 py-1 rounded border text-[10px] font-bold tracking-wider"
                style={{ color: x.c, backgroundColor: x.b, borderColor: x.bo }}>
                {x.l}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-px bg-white/10" />
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground">OR PAY USING UPI ID</div>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 divide-y divide-white/5">
          <DetailRow icon={<AtSign className="w-3.5 h-3.5 text-emerald-400" />} label="UPI ID" value={agent.upiId} ck="upi" copied={copied} onCopy={copy} mono />
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
          Funds held in escrow · Released only after agent confirms · 0% fees
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
