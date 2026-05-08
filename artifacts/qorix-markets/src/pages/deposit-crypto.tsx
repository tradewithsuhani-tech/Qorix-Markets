import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetDepositAddress } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Copy, Check, ArrowRight, Shield, AlertTriangle, Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { CRYPTO_METHODS, FX_RATE } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";

export default function DepositCryptoPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") ?? "usdt").toLowerCase();
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;
  const isUsdt = id === "usdt";

  const { data: depAddr, isLoading: depLoading } = useGetDepositAddress({
    query: { enabled: isUsdt, staleTime: 5 * 60 * 1000 },
  });

  const baseCrypto = CRYPTO_METHODS.find((c) => c.id === id) ?? CRYPTO_METHODS[0];
  const crypto = useMemo(() => {
    const a: any = depAddr;
    return isUsdt && a?.address
      ? { ...baseCrypto, address: a.address, network: a.network ?? baseCrypto.network }
      : baseCrypto;
  }, [baseCrypto, depAddr, isUsdt]);

  const amountInr = numAmount * FX_RATE;
  const [copied, setCopied] = useState<"address" | "tag" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && crypto.address) {
      QRCode.toCanvas(canvasRef.current, crypto.address, {
        width: 172,
        margin: 1,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      }).catch(() => {});
    }
  }, [crypto.address]);

  const copy = async (text: string, kind: "address" | "tag") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

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
            Your wallet will credit ₹{Math.round(amountInr).toLocaleString("en-IN")} after on-chain confirmation.
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
            {isUsdt && depLoading ? (
              <div className="w-[196px] h-[196px] rounded-2xl bg-white/5 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="bg-white p-3 rounded-2xl">
                <canvas ref={canvasRef} />
              </div>
            )}
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
              <span className="flex-1 min-w-0 text-xs font-medium truncate text-left">{crypto.address}</span>
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
      </div>
    </Layout>
  );
}
