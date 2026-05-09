import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetWallet } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Zap, Globe, Send, ChevronRight, CheckCircle2, Shield, Lock,
} from "lucide-react";
import { CRYPTO_METHODS } from "@/lib/deposit-flow-data";
import { cn } from "@/lib/utils";
import { useInrRate } from "@/hooks/use-inr-rate";

const INR_METHODS = [
  { id: "upi", icon: Zap, label: "UPI", sub: "Instant · No charges" },
  { id: "netbanking", icon: Globe, label: "Net Banking", sub: "Instant · Bank charges may apply" },
  { id: "imps", icon: Send, label: "IMPS / NEFT", sub: "Within 30 mins · Free" },
] as const;

export default function DepositPage() {
  const [, navigate] = useLocation();
  const { data: wallet } = useGetWallet();
  const FX_RATE = useInrRate();
  const mainBalanceUsd = Number((wallet as any)?.mainBalance) || 0;
  const balanceInr = mainBalanceUsd * FX_RATE;

  const [currency, setCurrency] = useState<"INR" | "USDT">("INR");
  const [amount, setAmount] = useState("");
  const [showAmtError, setShowAmtError] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const isCrypto = currency === "USDT";
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const minAmount = currency === "INR" ? 100 : 60;
  const hasAmount = numAmount >= minAmount;
  const symbol = currency === "INR" ? "₹" : "$";
  const quickAmounts = currency === "INR" ? [5000, 10000, 25000, 50000] : [60, 120, 300, 600];
  const amountInr = currency === "INR" ? numAmount : numAmount * FX_RATE;

  const switchCurrency = (next: "INR" | "USDT") => {
    if (next === currency) return;
    if (numAmount > 0) {
      const converted = next === "USDT" ? numAmount / FX_RATE : numAmount * FX_RATE;
      setAmount(Math.round(converted).toString());
    }
    setShowAmtError(false);
    setCurrency(next);
  };

  const handleCryptoSelect = (id: string) => {
    if (!hasAmount) {
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    navigate(`/deposit/crypto?id=${id}&amount=${numAmount}`);
  };

  const handleInrSelect = (id: string) => {
    if (id === "imps") {
      // IMPS uses the same bank flow under the hood
      if (!hasAmount) {
        setShowAmtError(true);
        amountRef.current?.focus();
        return;
      }
      navigate(`/deposit/netbanking?amount=${numAmount}`);
      return;
    }
    if (!hasAmount) {
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    navigate(`/deposit/${id}?amount=${numAmount}`);
  };

  useEffect(() => {
    if (numAmount >= minAmount && showAmtError) setShowAmtError(false);
  }, [numAmount, minAmount, showAmtError]);

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
          <h1 className="text-2xl font-bold tracking-tight">Add Funds</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isCrypto
              ? "Crypto deposits credited after on-chain confirmation."
              : "Funds credited instantly via UPI / Net Banking / IMPS."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Current Balance</span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-emerald-400">₹{Math.round(balanceInr).toLocaleString("en-IN")}</span>
            <span className="text-[10px] text-muted-foreground font-mono">≈ ${mainBalanceUsd.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Deposit Amount</label>
            <div className="flex border border-white/10 bg-white/5 rounded-xl p-0.5 gap-0.5">
              {(["INR", "USDT"] as const).map((c) => {
                const active = currency === c;
                return (
                  <button
                    key={c}
                    onClick={() => switchCurrency(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-bold tracking-wide transition-colors",
                      active
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    data-testid={`currency-${c.toLowerCase()}`}
                  >
                    {c === "INR" ? "₹ INR" : "₮ USDT"}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 h-16 bg-white/5 border transition-colors",
              numAmount > 0 && !hasAmount
                ? "border-rose-500"
                : hasAmount
                ? "border-emerald-500"
                : "border-white/10"
            )}
          >
            <span className="text-2xl font-bold text-emerald-400 select-none">{symbol}</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent border-0 outline-none text-3xl font-bold placeholder:text-muted-foreground/50 min-w-0"
              data-testid="input-amount"
            />
            {numAmount > 0 && isCrypto && (
              <span className="text-[11px] text-muted-foreground font-medium font-mono whitespace-nowrap">
                ≈ ₹{Math.round(amountInr).toLocaleString("en-IN")}
              </span>
            )}
            {numAmount > 0 && !isCrypto && (
              <span className="text-[11px] text-muted-foreground font-medium font-mono whitespace-nowrap">
                ≈ ${(numAmount / FX_RATE).toFixed(2)}
              </span>
            )}
          </div>
          {numAmount > 0 && !hasAmount && (
            <div className="text-[11px] text-rose-400 mt-1.5">
              Minimum deposit is {symbol}
              {minAmount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a.toString())}
              className="text-xs py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 font-semibold text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`quick-${a}`}
            >
              {currency === "INR" ? `₹${(a / 1000).toFixed(0)}K` : `$${a}`}
            </button>
          ))}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {isCrypto ? "Crypto Currency" : "Payment Method"}
          </div>
          <div className="space-y-2">
            {isCrypto
              ? CRYPTO_METHODS.map((m) => {
                  const isLocked = m.id !== "usdt";
                  return (
                    <button
                      key={m.id}
                      onClick={() => { if (!isLocked) handleCryptoSelect(m.id); }}
                      disabled={isLocked}
                      aria-disabled={isLocked}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors",
                        isLocked
                          ? "border-white/5 bg-white/[0.02] cursor-not-allowed opacity-60"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                      data-testid={`method-${m.id}`}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full border flex items-center justify-center text-lg font-bold shrink-0",
                          isLocked && "grayscale",
                        )}
                        style={{ backgroundColor: m.color + "22", borderColor: m.color + "55", color: m.color }}
                      >
                        {m.symbol}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {m.label}
                          {isLocked && <Lock className="w-3 h-3 text-white/40" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.sub}</div>
                      </div>
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-white/40" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })
              : INR_METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleInrSelect(m.id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
                      data-testid={`method-${m.id}`}
                    >
                      <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{m.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.sub}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })}
          </div>
          {showAmtError && !hasAmount && (
            <div className="text-[11px] text-rose-400 mt-2">
              Enter a deposit amount of at least {symbol}
              {minAmount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")} to continue.
            </div>
          )}
        </div>

        {!isCrypto && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-[11px] text-muted-foreground">
              RBI-compliant gateways · HMAC-verified · Anti-fraud protected
            </div>
          </div>
        )}

        {!isCrypto && hasAmount && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-[11px] text-emerald-300">
              Pick a payment method above to continue with ₹{numAmount.toLocaleString("en-IN")}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
