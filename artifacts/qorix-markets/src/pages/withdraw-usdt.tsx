import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, AlertCircle, Wallet, ScanLine } from "lucide-react";
import { patchWithdrawState, readWithdrawState } from "@/lib/withdraw-flow-state";
import { cn } from "@/lib/utils";

// TRC20 address: starts with T + 33 base58 chars (34 total length)
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export default function WithdrawUsdtPage() {
  const [, navigate] = useLocation();
  const state = useMemo(() => readWithdrawState(), []);
  const [address, setAddress] = useState<string>(state?.walletAddress ?? "");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!state || state.currency !== "usdt" || !state.amount) {
      navigate("/withdraw");
    }
  }, [state, navigate]);

  if (!state) return null;

  const trimmed = address.trim();
  const valid = TRON_RE.test(trimmed);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text.trim());
      setTouched(true);
    } catch {}
  };

  const handleContinue = () => {
    setTouched(true);
    if (!valid) return;
    patchWithdrawState({ walletAddress: trimmed });
    navigate("/withdraw/review");
  };

  const numAmount = Number(state.amount) || 0;

  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 pt-3 pb-28">
        <div className="flex items-center gap-3 mb-1.5">
          <button
            onClick={() => navigate("/withdraw")}
            className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
            Destination Wallet
          </h1>
        </div>
        <p className="text-[13px] text-white/55 leading-relaxed mb-5 pl-12">
          ${numAmount.toFixed(2)} USDT · TRON (TRC20) network
        </p>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200 leading-relaxed">
            Only send to a <span className="font-bold">TRON (TRC20)</span> wallet. Funds sent on a different
            network will be lost permanently.
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            USDT Wallet Address (TRC20)
          </label>
          <div
            className={cn(
              "rounded-xl border bg-white/5 px-3.5 py-3 flex items-center gap-2 transition-colors",
              touched && !valid
                ? "border-rose-500/60"
                : valid
                ? "border-emerald-500/60"
                : "border-white/10"
            )}
          >
            <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); if (!touched) setTouched(true); }}
              onBlur={() => setTouched(true)}
              placeholder="T..."
              className="flex-1 bg-transparent border-0 outline-none text-sm font-mono min-w-0"
              autoComplete="off"
              spellCheck={false}
              data-testid="input-address"
            />
            <button
              onClick={handlePaste}
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80"
              data-testid="button-paste"
            >
              Paste
            </button>
          </div>
          <div className="mt-1.5 min-h-[16px] text-[11px]">
            {touched && !valid && trimmed.length > 0 && (
              <span className="text-rose-400">
                Invalid TRC20 address. Must start with “T” and be 34 characters long.
              </span>
            )}
            {touched && trimmed.length === 0 && (
              <span className="text-rose-400">Wallet address is required.</span>
            )}
            {valid && (
              <span className="text-emerald-400">Valid TRC20 address.</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[11px] text-muted-foreground space-y-1.5">
          <div className="flex items-start gap-2">
            <ScanLine className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>Double-check the address character by character before continuing.</span>
          </div>
          <div className="text-[10px] text-muted-foreground/80 ml-5">
            Tip: copy your address directly from your wallet app — never type it manually.
          </div>
        </div>

        <button
          onClick={handleContinue}
          disabled={!valid}
          className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            color: "#0b0b0b",
            boxShadow: "0 6px 22px rgba(245,158,11,0.30)",
          }}
          data-testid="button-continue"
        >
          Review Withdrawal
        </button>
      </div>
    </Layout>
  );
}
