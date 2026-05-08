import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import {
  Check, Shield, CreditCard, PlusCircle, Copy, Download,
} from "lucide-react";
import { BANKS, P2P_AGENTS } from "@/lib/deposit-flow-data";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { cn } from "@/lib/utils";

type DetailKey = "utr" | "ref";

function formatNow(): string {
  const d = new Date();
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

export default function DepositSuccessPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;
  const utr = params.get("utr") ?? "";
  const refCode = params.get("refCode") ?? "";
  const bankId = params.get("bankId") ?? "";
  const agentId = params.get("agentId") ?? "";
  const merchantNameParam = params.get("merchantName") ?? "";
  const createdAtIso = useMemo(() => new Date().toISOString(), []);

  const bank = useMemo(() => (bankId ? BANKS.find((b) => b.id === bankId) ?? null : null), [bankId]);
  const agent = useMemo(
    () => (!bank && agentId ? P2P_AGENTS.find((a) => a.id === agentId) ?? null : null),
    [bank, agentId]
  );
  const method = useMemo(() => {
    if (bank) return { color: bank.color, initial: bank.initial, label: `${bank.shortName} · NEFT/IMPS` };
    if (agent) return { color: agent.avatarColor, initial: agent.initial, label: `${agent.name} · UPI` };
    if (merchantNameParam) return { color: "#10B981", initial: merchantNameParam.charAt(0).toUpperCase(), label: merchantNameParam };
    return null;
  }, [bank, agent, merchantNameParam]);

  const handleDownload = () => {
    const reference = refCode || (utr ? `QM-${utr.slice(-8).toUpperCase()}` : `QM-${Date.now().toString().slice(-8)}`);
    downloadReceiptPdf({
      kind: "deposit",
      reference,
      status: "pending",
      statusLabel: "Pending Verification",
      headlineLabel: "DEPOSIT SUBMITTED",
      amountInr: numAmount,
      method: method?.label ?? "INR Deposit",
      utrOrRef: utr || null,
      utrLabel: "UTR / Ref",
      createdAt: createdAtIso,
    });
  };
  const txnTime = useMemo(() => formatNow(), []);

  const [copied, setCopied] = useState<DetailKey | null>(null);
  const copy = async (text: string, key: DetailKey) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
        <div className="flex flex-col items-center gap-5 pt-3">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="absolute inset-0 rounded-full border border-emerald-500/20"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="absolute inset-3.5 rounded-full border border-emerald-500/35"
            />
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/40"
            >
              <Check className="w-11 h-11 text-white" strokeWidth={3} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.3 }}
            className="text-center space-y-1.5"
          >
            <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">TRANSACTION COMPLETE</div>
            <div className="text-4xl font-bold tracking-tight">₹{numAmount.toLocaleString("en-IN")}</div>
            <div className="text-[13px] text-muted-foreground">Submitted for verification · Credited after approval</div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.45 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-xs font-semibold flex-1">Verified by Qorix · Auto-credited on UTR match</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 space-y-3">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">TRANSACTION DETAILS</div>

            {method && (
              <>
                <Row label="Method">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-5 h-5 rounded-md border flex items-center justify-center text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: method.color + "22", borderColor: method.color + "66", color: method.color }}
                    >
                      {method.initial}
                    </div>
                    <span className="text-[13px] font-semibold truncate">{method.label}</span>
                  </div>
                </Row>
                <Divider />
              </>
            )}

            <Row label="Amount Submitted">
              <span className="text-[13px] font-bold text-emerald-400">+ ₹{numAmount.toLocaleString("en-IN")}</span>
            </Row>

            {utr && (
              <>
                <Divider />
                <button
                  onClick={() => copy(utr, "utr")}
                  className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
                  data-testid="copy-utr"
                >
                  <span className="text-xs font-medium text-muted-foreground">UTR / Ref</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold tracking-wider truncate">{utr}</span>
                    {copied === "utr" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </span>
                </button>
              </>
            )}

            {refCode && (
              <>
                <Divider />
                <button
                  onClick={() => copy(refCode, "ref")}
                  className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
                >
                  <span className="text-xs font-medium text-muted-foreground">Reference</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold tracking-wider truncate">{refCode}</span>
                    {copied === "ref" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </span>
                </button>
              </>
            )}

            <Divider />
            <Row label="Date & Time">
              <span className="text-[13px] font-semibold">{txnTime}</span>
            </Row>
            <Divider />
            <Row label="Status">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-bold tracking-wide text-emerald-400">Pending Verification</span>
              </span>
            </Row>
          </div>

          <button
            onClick={handleDownload}
            className="w-full h-12 rounded-xl border border-emerald-500/45 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center gap-2 transition-colors"
            data-testid="button-download-receipt"
          >
            <Download className="w-4 h-4" />
            Download Receipt
          </button>

          <button
            onClick={() => navigate("/wallet")}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 transition-colors"
            data-testid="button-wallet"
          >
            <CreditCard className="w-4 h-4" />
            Back to Wallet
          </button>

          <button
            onClick={() => navigate("/deposit")}
            className="w-full h-12 rounded-xl border border-emerald-500/40 bg-white/5 hover:bg-white/10 text-emerald-400 font-bold flex items-center justify-center gap-2 transition-colors"
            data-testid="button-another"
          >
            <PlusCircle className="w-4 h-4" />
            Make Another Deposit
          </button>

          <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Receipt sent to your registered email ·{" "}
            <button
              onClick={() => navigate("/contact")}
              className="text-emerald-400 font-semibold hover:underline"
              data-testid="link-support"
            >
              Need help? Contact support
            </button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Divider() { return <div className="h-px bg-white/5" />; }
