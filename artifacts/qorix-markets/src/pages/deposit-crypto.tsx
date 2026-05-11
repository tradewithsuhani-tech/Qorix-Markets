import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetDepositAddress } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Copy, Check, ArrowRight, Shield, AlertTriangle, Loader2,
  Clock, CheckCircle2, History,
} from "lucide-react";
import QRCode from "qrcode";
import { CRYPTO_METHODS } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";
import { useInrRate } from "@/hooks/use-inr-rate";

export default function DepositCryptoPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") ?? "usdt").toLowerCase();
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;
  const isUsdt = id === "usdt";
  const FX_RATE = useInrRate();

  const { data: depAddr, isLoading: depLoading } = useGetDepositAddress({
    query: { enabled: isUsdt, staleTime: 5 * 60 * 1000 },
  });

  const baseCrypto = CRYPTO_METHODS.find((c) => c.id === id) ?? CRYPTO_METHODS[0];
  const crypto = useMemo(() => {
    const a = depAddr as { address?: string; network?: string } | undefined;
    return isUsdt && a?.address
      ? { ...baseCrypto, address: a.address, network: a.network ?? baseCrypto.network }
      : baseCrypto;
  }, [baseCrypto, depAddr, isUsdt]);

  const amountInr = numAmount * FX_RATE;
  const [copied, setCopied] = useState<"address" | "tag" | null>(null);
  const [sent, setSent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crypto.address) return;
    QRCode.toCanvas(canvas, crypto.address, {
      width: 172,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    }).catch((err) => {
      console.error("[deposit] QR render failed", err);
    });
  }, [crypto.address, depLoading]);

  const copy = async (text: string, kind: "address" | "tag") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  if (sent) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-5 pt-10 pb-28 flex flex-col items-center text-center">
          <div className="relative w-24 h-24 flex items-center justify-center mb-5">
            <span className="absolute inset-0 rounded-full border border-emerald-500/15 animate-ping" style={{ animationDuration: "2.5s" }} />
            <span className="absolute inset-2 rounded-full border border-emerald-500/25" />
            <span className="absolute inset-5 rounded-full border border-emerald-500/40" />
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Clock className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          <div className="text-[11px] tracking-[0.28em] font-bold text-emerald-400 mb-2">MONITORING BLOCKCHAIN</div>
          <h2 className="text-2xl font-bold text-white mb-2">Tracking your deposit</h2>
          <p className="text-[13px] text-white/55 leading-relaxed max-w-xs">
            Your transfer is being monitored on-chain. Balance will update automatically within a few minutes of the first blockchain confirmation.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] divide-y divide-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-white/50">Network</span>
              <span className="text-[12px] font-semibold text-white">{crypto.network}</span>
            </div>
            {numAmount > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] text-white/50">Amount sent</span>
                <span className="text-[12px] font-semibold text-white">{numAmount} {crypto.label}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-white/50">Address</span>
              <span className="text-[11px] font-mono text-white/80">
                {crypto.address.slice(0, 8)}…{crypto.address.slice(-6)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] text-white/50">Confirmations needed</span>
              <span className="text-[12px] font-semibold text-emerald-400">1</span>
            </div>
          </div>

          <div className="mt-4 w-full rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 flex items-start gap-2 text-left">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11.5px] text-amber-100/85 leading-snug">
              Do <b>not</b> close this app. Keep it open or check your wallet balance in a few minutes. If balance doesn't update within 30 minutes, contact support.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
            <button
              onClick={() => navigate("/deposit")}
              className="py-3.5 rounded-2xl border border-white/15 bg-white/[0.04] text-white font-semibold text-sm hover:bg-white/[0.08] transition-all"
            >
              Back to Deposit
            </button>
            <a
              href={`https://tronscan.org/#/address/${crypto.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_28px_-6px_rgba(16,185,129,0.65)] transition-all flex items-center justify-center gap-1.5"
            >
              <History className="w-4 h-4" />
              Check on Tronscan
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold">Deposit {crypto.label}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Send {numAmount > 0 ? `${numAmount} ${crypto.label}` : crypto.label} to the address below.
            {numAmount > 0 && ` Your wallet will credit ₹${Math.round(amountInr).toLocaleString("en-IN")} after on-chain confirmation.`}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3.5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full border flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: crypto.color + "22", borderColor: crypto.color + "55", color: crypto.color }}
            >
              {crypto.symbol}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold truncate">Send {crypto.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">{crypto.network}</div>
            </div>
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-bold tracking-wider"
              style={{ backgroundColor: crypto.color + "22", borderColor: crypto.color + "55", color: crypto.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: crypto.color }} /> LIVE
            </span>
          </div>

          {numAmount > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
              <div>
                <div className="text-[10px] tracking-wide text-muted-foreground">Send Amount</div>
                <div className="text-[15px] font-bold mt-0.5">
                  {numAmount} <span style={{ color: crypto.color }}>{crypto.label}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-right">
                <div className="text-[10px] tracking-wide text-muted-foreground">You Receive</div>
                <div className="text-[15px] font-bold text-emerald-400 mt-0.5">
                  ₹{Math.round(amountInr).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-2.5 py-1">
            <div className="relative bg-white p-3 rounded-2xl">
              <canvas ref={canvasRef} width={172} height={172} className="block" />
              {isUsdt && depLoading && (
                <div className="absolute inset-0 rounded-2xl bg-white/90 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isUsdt && depLoading ? "Generating your unique address..." : "Scan with your wallet app"}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-muted-foreground mb-1.5">Wallet Address</div>
            <button
              onClick={() => copy(crypto.address, "address")}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl border bg-white/5 px-3 py-2.5 hover:bg-white/10 transition-colors",
                copied === "address" ? "border-emerald-500" : "border-white/10"
              )}
              data-testid="copy-address"
            >
              <span className="flex-1 min-w-0 text-xs font-medium truncate text-left font-mono tracking-tight">
                {crypto.address.length > 20
                  ? `${crypto.address.slice(0, 10)}……${crypto.address.slice(-8)}`
                  : crypto.address}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                {copied === "address" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "address" ? "Copied" : "Copy"}
              </span>
            </button>
          </div>

          {crypto.tag && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">
                Destination Tag <span className="text-rose-400">(Required)</span>
              </div>
              <button
                onClick={() => copy(crypto.tag!, "tag")}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl border bg-white/5 px-3 py-2.5 hover:bg-white/10 transition-colors",
                  copied === "tag" ? "border-emerald-500" : "border-white/10"
                )}
              >
                <span className="flex-1 min-w-0 text-xs font-medium text-left">{crypto.tag}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  {copied === "tag" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "tag" ? "Copied" : "Copy"}
                </span>
              </button>
            </div>
          )}

          <div className="flex items-start gap-2 px-2.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted-foreground">
              Send only <span className="text-foreground font-bold">{crypto.label}</span> via{" "}
              <span className="text-foreground font-bold">{crypto.network}</span>. Sending any other asset or using a different network will result in permanent loss.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="text-[11px] text-muted-foreground">
            Funded via on-chain transfer · Verified after 1 confirmation · Auto-converted to INR
          </div>
        </div>

        <button
          onClick={() => setSent(true)}
          disabled={isUsdt && (depLoading || !crypto.address)}
          className={cn(
            "w-full h-14 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "shadow-[0_6px_24px_-6px_rgba(16,185,129,0.55)]"
          )}
          style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff" }}
          data-testid="button-sent"
        >
          <CheckCircle2 className="w-5 h-5" />
          I've sent the {crypto.label}
        </button>
      </div>
    </Layout>
  );
}
