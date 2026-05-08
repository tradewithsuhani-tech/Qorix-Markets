import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Check, Shield, Wallet, PlusCircle, Copy, Download, AtSign, Building2 } from "lucide-react";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { maskAddress } from "@/components/address-display";
import { clearWithdrawSuccess, readWithdrawSuccess, type WithdrawSuccessPayload } from "@/lib/withdraw-flow-state";

type Key = "address" | "upi" | "acct" | "ref";

function formatNow(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

export default function WithdrawSuccessPage() {
  const [, navigate] = useLocation();

  // Read the receipt payload from sessionStorage (written by the OTP step)
  // and snapshot it into local state. Keeping the data out of the URL
  // prevents PII (UPI ID / bank A-C / IFSC) from leaking into history,
  // referrer headers, screenshots, and analytics.
  const [data, setData] = useState<WithdrawSuccessPayload | null>(null);
  useEffect(() => {
    const d = readWithdrawSuccess();
    if (!d) {
      navigate("/wallet");
      return;
    }
    setData(d);
    // Clear straight away so re-loading the route or navigating back
    // doesn't show a stale receipt.
    clearWithdrawSuccess();
  }, [navigate]);

  const txnTime = useMemo(() => formatNow(data?.createdAt), [data?.createdAt]);

  const [copied, setCopied] = useState<Key | null>(null);
  const copy = async (text: string, k: Key) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 1400);
  };

  if (!data) return null;

  const isUsdt = data.currency === "usdt";
  const usdAmount = data.amount ?? 0;
  const netAmount = data.netAmount ?? usdAmount;
  const inrAmount = data.amountInr ?? 0;
  const usdtEquiv = data.amountUsdt ?? 0;
  const rateUsed = data.rateUsed ?? 0;
  const reference = isUsdt
    ? `WD-${data.id || Date.now().toString().slice(-6)}`
    : `WT-${String(data.id || "").padStart(6, "0")}`;

  const handleDownload = () => {
    if (isUsdt) {
      downloadReceiptPdf({
        kind: "withdrawal",
        reference,
        status: "pending",
        statusLabel: "Pending Approval",
        headlineLabel: "WITHDRAWAL REQUESTED",
        amountInr: 0,
        amountUsdt: netAmount,
        method: "USDT (TRC20)",
        beneficiary: data.walletAddress ?? null,
        createdAt: data.createdAt,
        utrLabel: "Reference",
      });
    } else {
      const beneficiary =
        data.payoutMethod === "upi"
          ? data.upiId ?? ""
          : `${data.accountHolder ?? ""} · ${data.bankName || "Bank"}`;
      downloadReceiptPdf({
        kind: "withdrawal",
        reference,
        status: "pending",
        statusLabel: "Pending Approval",
        headlineLabel: "WITHDRAWAL REQUESTED",
        amountInr: inrAmount,
        amountUsdt: usdtEquiv || null,
        rateUsed: rateUsed || null,
        method: data.payoutMethod === "upi" ? "UPI" : "Bank Account · NEFT/IMPS",
        beneficiary,
        ifsc: data.payoutMethod === "bank" ? data.ifsc ?? null : null,
        createdAt: data.createdAt,
        utrLabel: "Reference",
      });
    }
  };

  const Icon = isUsdt ? Wallet : data.payoutMethod === "upi" ? AtSign : Building2;
  const methodLabel = isUsdt
    ? "USDT (TRC20)"
    : data.payoutMethod === "upi"
      ? "UPI"
      : "Bank Account";
  const methodColor = isUsdt ? "#f59e0b" : "#10b981";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Hero */}
        <div className="flex flex-col items-center gap-5 pt-3">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="absolute inset-0 rounded-full border border-emerald-500/20"
            />
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 }}
              className="absolute inset-3.5 rounded-full border border-emerald-500/35"
            />
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/40"
            >
              <Check className="w-11 h-11 text-white" strokeWidth={3} />
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.3 }}
            className="text-center space-y-1.5"
          >
            <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">WITHDRAWAL SUBMITTED</div>
            <div className="text-4xl font-bold tracking-tight">
              {isUsdt ? `$${netAmount.toFixed(2)}` : `₹${inrAmount.toLocaleString("en-IN")}`}
            </div>
            <div className="text-[13px] text-muted-foreground">
              Pending review · Funds arrive within 24 hrs after approval
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.45 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-xs font-semibold flex-1">Verified by Qorix · Reviewed within 24 hrs</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 space-y-3">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">TRANSACTION DETAILS</div>

            <Row label="Method">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                  style={{ backgroundColor: methodColor + "22", borderColor: methodColor + "66", color: methodColor }}
                >
                  <Icon className="w-3 h-3" />
                </div>
                <span className="text-[13px] font-semibold truncate">{methodLabel}</span>
              </div>
            </Row>
            <Divider />

            <Row label="Amount">
              <span className="text-[13px] font-bold text-emerald-400">
                {isUsdt
                  ? `− $${usdAmount.toFixed(2)}`
                  : `− ₹${inrAmount.toLocaleString("en-IN")}`}
              </span>
            </Row>

            {isUsdt && netAmount !== usdAmount && (
              <>
                <Divider />
                <Row label="You'll Receive">
                  <span className="text-[13px] font-bold text-emerald-400">${netAmount.toFixed(2)} USD</span>
                </Row>
              </>
            )}

            {!isUsdt && usdtEquiv > 0 && (
              <>
                <Divider />
                <Row label="USDT Debited">
                  <span className="text-[13px] font-bold text-amber-400">${usdtEquiv.toFixed(2)}</span>
                </Row>
                {rateUsed > 0 && (
                  <>
                    <Divider />
                    <Row label="Rate">
                      <span className="text-[13px] font-mono">1 USDT = ₹{rateUsed.toFixed(2)}</span>
                    </Row>
                  </>
                )}
              </>
            )}

            {isUsdt && data.source && (
              <>
                <Divider />
                <Row label="From">
                  <span className="text-[13px] font-semibold">
                    {data.source === "main" ? "Main Balance" : "Profit Balance"}
                  </span>
                </Row>
              </>
            )}

            {isUsdt && data.walletAddress && (
              <>
                <Divider />
                <button
                  onClick={() => copy(data.walletAddress!, "address")}
                  className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
                  data-testid="copy-address"
                >
                  <span className="text-xs font-medium text-muted-foreground shrink-0">To Address</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold font-mono truncate" title={data.walletAddress}>
                      {maskAddress(data.walletAddress)}
                    </span>
                    {copied === "address"
                      ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                      : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  </span>
                </button>
              </>
            )}

            {!isUsdt && data.payoutMethod === "upi" && data.upiId && (
              <>
                <Divider />
                <button
                  onClick={() => copy(data.upiId!, "upi")}
                  className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
                  data-testid="copy-upi"
                >
                  <span className="text-xs font-medium text-muted-foreground">UPI ID</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold font-mono truncate">{data.upiId}</span>
                    {copied === "upi" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  </span>
                </button>
              </>
            )}

            {!isUsdt && data.payoutMethod === "bank" && data.accountNumber && (
              <>
                <Divider />
                <button
                  onClick={() => copy(`${data.accountNumber} · ${data.ifsc}`, "acct")}
                  className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
                  data-testid="copy-acct"
                >
                  <span className="text-xs font-medium text-muted-foreground shrink-0">Account · IFSC</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold font-mono truncate">
                      ****{data.accountNumber.slice(-4)} · {data.ifsc}
                    </span>
                    {copied === "acct" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  </span>
                </button>
                {data.accountHolder && (
                  <>
                    <Divider />
                    <Row label="Holder">
                      <span className="text-[13px] font-semibold truncate">{data.accountHolder}</span>
                    </Row>
                  </>
                )}
              </>
            )}

            <Divider />
            <button
              onClick={() => copy(reference, "ref")}
              className="w-full flex items-center justify-between gap-3 hover:opacity-70 transition-opacity"
              data-testid="copy-ref"
            >
              <span className="text-xs font-medium text-muted-foreground">Reference</span>
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-bold tracking-wider truncate">#{reference}</span>
                {copied === "ref" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
              </span>
            </button>
            <Divider />
            <Row label="Date & Time">
              <span className="text-[13px] font-semibold">{txnTime}</span>
            </Row>
            <Divider />
            <Row label="Status">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] font-bold tracking-wide text-amber-400">Pending Approval</span>
              </span>
            </Row>
          </div>

          <button
            onClick={() => navigate("/wallet")}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 transition-colors"
            data-testid="button-wallet"
          >
            <Wallet className="w-4 h-4" />
            Back to Wallet
          </button>

          <button
            onClick={() => navigate("/withdraw")}
            className="w-full h-12 rounded-xl border border-emerald-500/40 bg-white/5 hover:bg-white/10 text-emerald-400 font-bold flex items-center justify-center gap-2 transition-colors"
            data-testid="button-another"
          >
            <PlusCircle className="w-4 h-4" />
            Make Another Withdrawal
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

          <div className="w-full text-center text-[11px] text-muted-foreground">
            Download Receipt ·{" "}
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 text-sky-400 font-semibold hover:underline"
              data-testid="link-download-receipt"
            >
              <Download className="w-3 h-3" />
              Click here
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
