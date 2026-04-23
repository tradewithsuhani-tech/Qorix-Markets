import { useState, useEffect, useRef, useCallback } from "react";
import { useGetBlockchainDepositHistory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBlockchainDepositHistoryQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowDownCircle,
  QrCode,
  Info,
  ExternalLink,
  Wallet,
  ChevronRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";
import { BannerCarousel } from "@/components/banner-carousel";
import { PromoBonusBanner } from "@/components/promo-bonus-banner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { BadgePercent, Gift, Sparkles, ClipboardPaste, X } from "lucide-react";

const DEPOSIT_BANNERS = [
  { src: `${import.meta.env.BASE_URL}promo/banner-4-automate.png`, alt: "Automate. Invest. Grow. — Trade Smarter, Not Harder" },
  { src: `${import.meta.env.BASE_URL}promo/banner-5-smart-algo.png`, alt: "Smart Algo. Real Growth. — Start Trading with Just $10" },
  { src: `${import.meta.env.BASE_URL}promo/banner-6-zero-fee.png`, alt: "Zero Trading Fee — Algo Trading Starts at Just $10" },
];

const BASE_URL = import.meta.env.BASE_URL ?? "/";

function getApiUrl(path: string) {
  return `${BASE_URL}api${path}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function QRCodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 180,
      margin: 2,
      color: { dark: "#ffffff", light: "#0d1117" },
    });
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl border border-white/10"
      style={{ width: 180, height: 180 }}
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
        copied
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 border border-white/10",
      )}
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

type DepositStep = "amount" | "address" | "confirmed";

export default function DepositPage() {
  const qc = useQueryClient();

  const { toast } = useToast();

  // Deposit stepper state
  const [step, setStep] = useState<DepositStep>("amount");
  const [amount, setAmount] = useState("");
  const [platformAddress, setPlatformAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastDepositCount, setLastDepositCount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const { data: promoOffer, refetch: refetchPromo } = useQuery<{
    alreadyRedeemed: boolean;
    redemption: { code: string; bonusPercent: number; status: string } | null;
    active: boolean;
    code: string;
    bonusPercent: number;
  }>({
    queryKey: ["promo-offer"],
    queryFn: () => authFetch("/api/promo/offer"),
    retry: false,
  });

  const redeemPromo = useMutation({
    mutationFn: (code: string) =>
      authFetch<{ success: boolean; bonusPercent: number }>("/api/promo/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: (res) => {
      toast({
        title: `${res.bonusPercent}% bonus locked in`,
        description:
          "Your bonus will credit to Trading Balance after this deposit confirms.",
      });
      refetchPromo();
    },
    onError: (err: any) => {
      toast({
        title: "Could not apply promo",
        description: err?.message ?? "Invalid or expired code.",
        variant: "destructive",
      });
    },
  });

  const clearPromo = useMutation({
    mutationFn: () =>
      authFetch<{ success: boolean }>("/api/promo/redemption", { method: "DELETE" }),
    onSuccess: () => {
      setPromoInput("");
      refetchPromo();
    },
    onError: (err: any) => {
      toast({
        title: "Could not remove promo",
        description: err?.message ?? "Try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-clear any pending (uncredited) promo redemption when the user
  // navigates away from the deposit page — so coming back shows a fresh
  // offer instead of a stale "applied" indicator.
  useEffect(() => {
    return () => {
      const status = promoOffer?.redemption?.status;
      if (status === "redeemed") {
        // Fire-and-forget; user is already leaving.
        authFetch("/api/promo/redemption", { method: "DELETE" }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoOffer?.redemption?.status]);

  const { data: historyData, isLoading: historyLoading, refetch } = useGetBlockchainDepositHistory(
    { limit: 20 },
    { query: { refetchInterval: 15000 } },
  );

  const deposits = historyData?.deposits ?? [];

  const fetchAddress = useCallback(async () => {
    setAddressLoading(true);
    const token = localStorage.getItem("qorix_token");
    try {
      const res = await fetch(getApiUrl("/deposit/address"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      setPlatformAddress(d.platformAddress ?? "");
    } catch {
    } finally {
      setAddressLoading(false);
    }
  }, []);

  const fetchConfirmedCount = useCallback(async (): Promise<number> => {
    const token = localStorage.getItem("qorix_token");
    try {
      const res = await fetch(getApiUrl("/deposit/history?limit=50"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      return (d.deposits ?? []).filter((dep: any) => dep.status === "confirmed").length;
    } catch {
      return 0;
    }
  }, []);

  const handleNext = async () => {
    if (!amount || Number(amount) < 1) return;
    await fetchAddress();
    const count = await fetchConfirmedCount();
    setLastDepositCount(count);
    setStep("address");
  };

  // Poll for new confirmed deposits after moving to address step
  useEffect(() => {
    if (step !== "address" || lastDepositCount === null) return;

    setPolling(true);
    pollRef.current = setInterval(async () => {
      const count = await fetchConfirmedCount();
      if (count > lastDepositCount) {
        clearInterval(pollRef.current!);
        setPolling(false);
        setStep("confirmed");
        qc.invalidateQueries({ queryKey: getGetBlockchainDepositHistoryQueryKey() });
        refetch();
      }
    }, 10000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, lastDepositCount, fetchConfirmedCount, qc, refetch]);

  const reset = () => {
    setStep("amount");
    setAmount("");
    setPlatformAddress("");
    setLastDepositCount(null);
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: getGetBlockchainDepositHistoryQueryKey() });
    refetch();
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Deposit USDT</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send USDT via TRC20. Deposits are detected automatically and credited to your balance.
          </p>
        </div>

        {/* Live rotating bonus offer — peak intent moment (user is already on deposit page).
            Locks in the current 2-10% offer before they send funds. */}
        <PromoBonusBanner />

        {/* Promo Banners — auto-scrolling carousel */}
        <BannerCarousel
          slides={DEPOSIT_BANNERS}
          intervalMs={4500}
          maxWidth={640}
        />

        {/* Stepper Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          {/* Card header with step indicator */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/8">
            {step !== "amount" && step !== "confirmed" && (
              <button
                onClick={reset}
                className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">
                {step === "amount" && "Step 1 — Enter Amount"}
                {step === "address" && "Step 2 — Send USDT"}
                {step === "confirmed" && "Deposit Confirmed"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full uppercase tracking-wider">TRC20</span>
                <span className="text-[10px] text-muted-foreground">USDT · TRON Network</span>
              </div>
            </div>
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {(["amount", "address", "confirmed"] as DepositStep[]).map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    step === s ? "w-6 bg-blue-500" :
                    i < ["amount", "address", "confirmed"].indexOf(step) ? "w-4 bg-emerald-500/60" :
                    "w-4 bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="px-5 pb-6 pt-5">
            <AnimatePresence mode="wait">

              {/* Step 1: Amount */}
              {step === "amount" && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USDT)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="field-input"
                      placeholder="Enter amount"
                      min="1"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[100, 500, 1000, 5000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(String(amt))}
                        className={cn(
                          "text-xs py-2 rounded-xl border font-medium transition-all",
                          amount === String(amt)
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                            : "bg-white/5 hover:bg-blue-500/15 hover:text-blue-400 border-white/8 hover:border-blue-500/25 text-muted-foreground"
                        )}
                      >
                        ${amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>

                  {/* Promo Code Input */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-purple-400" />
                      Promo Code <span className="text-muted-foreground/60 font-normal">(optional)</span>
                    </label>
                    {promoOffer?.alreadyRedeemed ? (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <div>
                            <div className="text-xs font-bold text-emerald-300 font-mono tracking-wider">
                              {promoOffer.redemption?.code}
                            </div>
                            <div className="text-[10px] text-emerald-400/80">
                              {promoOffer.redemption?.bonusPercent}% bonus applied — credits to Trading Balance
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <BadgePercent className="w-4 h-4 text-emerald-400" />
                          {promoOffer.redemption?.status === "redeemed" && (
                            <button
                              type="button"
                              onClick={() => clearPromo.mutate()}
                              disabled={clearPromo.isPending}
                              className="text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 rounded p-1 transition disabled:opacity-50"
                              aria-label="Remove promo code"
                              title="Remove promo code"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            className="field-input w-full font-mono tracking-wider uppercase pr-10"
                            placeholder={promoOffer?.code ? `Try ${promoOffer.code}` : "Enter code"}
                            maxLength={20}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text) {
                                  setPromoInput(text.trim().toUpperCase());
                                  toast({ title: "Pasted", description: "Promo code pasted from clipboard." });
                                }
                              } catch {
                                toast({
                                  title: "Paste blocked",
                                  description: "Please paste manually (Ctrl/Cmd+V).",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-purple-300/70 hover:text-purple-300 hover:bg-purple-500/15 transition-all"
                            title="Paste from clipboard"
                            aria-label="Paste from clipboard"
                          >
                            <ClipboardPaste className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            const code = promoInput.trim() || promoOffer?.code || "";
                            if (code) redeemPromo.mutate(code);
                          }}
                          disabled={redeemPromo.isPending || (!promoInput.trim() && !promoOffer?.code)}
                          className="px-4 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                        >
                          {redeemPromo.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                    {!promoOffer?.alreadyRedeemed && promoOffer?.active && (
                      <div className="text-[10px] text-purple-300/70 mt-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Live offer: <span className="font-mono font-bold text-purple-300">{promoOffer.code}</span> — {promoOffer.bonusPercent}% bonus to Trading Balance
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl px-3 py-2.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Send exactly <span className="text-white font-semibold">{amount ? `${amount} USDT` : "the entered amount"}</span> via <span className="text-white font-medium">TRON (TRC20)</span>. Your deposit will be detected and credited within ~15 seconds.
                    </p>
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={!amount || Number(amount) < 1}
                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                  >
                    Next — Get Deposit Address
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* Step 2: Address + QR */}
              {step === "address" && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-5"
                >
                  {/* Amount badge */}
                  <div className="flex items-center justify-between bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                    <span className="text-xs text-muted-foreground">Send exactly</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{amount} USDT</span>
                      <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full uppercase tracking-wider">TRC20</span>
                    </div>
                  </div>

                  {addressLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                  ) : platformAddress ? (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* QR Code */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="p-3 rounded-xl bg-[#0d1117] border border-white/10">
                          <QRCodeCanvas value={platformAddress} />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <QrCode className="w-3 h-3" />
                          Scan to deposit
                        </div>
                      </div>

                      {/* Address + info */}
                      <div className="flex-1 w-full space-y-4">
                        <div>
                          <div className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                            Platform Wallet Address
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-white break-all leading-relaxed">{platformAddress}</span>
                            <CopyButton text={platformAddress} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Network</div>
                            <div className="text-xs font-semibold text-emerald-400">TRON (TRC20)</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Token</div>
                            <div className="text-xs font-semibold text-white">USDT</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Min. Deposit</div>
                            <div className="text-xs font-semibold text-white">1 USDT</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Confirmations</div>
                            <div className="text-xs font-semibold text-white">~1–3 min</div>
                          </div>
                        </div>

                        <a
                          href={`https://tronscan.org/#/address/${platformAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on TronScan
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Wallet className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Platform address not configured</p>
                    </div>
                  )}

                  {/* Waiting indicator */}
                  {polling && (
                    <div className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-blue-400">Waiting for payment…</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Checking every 10 seconds. Do not close this page.</div>
                      </div>
                    </div>
                  )}

                  {/* Warning */}
                  <div className="flex gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/80 leading-relaxed">
                      <span className="font-semibold text-amber-400">Important: </span>
                      Send only <span className="font-semibold text-white">USDT (TRC20)</span> to this address. Other tokens or networks will be lost permanently. Minimum deposit is <span className="font-semibold text-white">1 USDT</span>.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Confirmed */}
              {step === "confirmed" && (
                <motion.div
                  key="confirmed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">Deposit Confirmed!</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="text-emerald-400 font-semibold">{amount} USDT</span> has been credited to your main balance.
                    </div>
                  </div>
                  <button onClick={reset} className="btn btn-primary mt-2 px-8">
                    Make Another Deposit
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">How it works</span>
          </div>
          <div className="space-y-3">
            {[
              { step: "1", text: "Enter the amount of USDT you want to deposit" },
              { step: "2", text: "Copy the platform address or scan the QR code" },
              { step: "3", text: "Send USDT (TRC20) from your wallet to the address shown" },
              { step: "4", text: "System detects your transaction within ~15 seconds and credits your balance" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0 mt-0.5">
                  {step}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Deposit History */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-white">Deposit History</span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", historyLoading && "animate-spin")} />
            </button>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <ArrowDownCircle className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No deposits yet</p>
              <p className="text-xs text-muted-foreground/60">Deposits appear here within ~15 seconds of detection</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              <AnimatePresence>
                {deposits.map((d) => (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 px-5 py-4"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        d.status === "confirmed"
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-amber-500/10 border border-amber-500/20",
                      )}
                    >
                      {d.status === "confirmed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          +{d.amount.toFixed(2)} USDT
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                            d.status === "confirmed"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/25",
                          )}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {d.txHash.slice(0, 12)}…{d.txHash.slice(-8)}
                        </span>
                        <a
                          href={`https://tronscan.org/#/transaction/${d.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-muted-foreground">{timeAgo(d.createdAt)}</div>
                      {d.creditedAt && (
                        <div className="text-[10px] text-emerald-400/70 mt-0.5">Credited</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

      </div>
    </Layout>
  );
}
