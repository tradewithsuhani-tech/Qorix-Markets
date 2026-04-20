import { useState, useEffect, useRef } from "react";
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
  LinkIcon,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

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

export default function DepositPage() {
  const qc = useQueryClient();
  const [platformAddress, setPlatformAddress] = useState("");
  const [userTronAddress, setUserTronAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);

  const [tronInput, setTronInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: historyData, isLoading: historyLoading, refetch } = useGetBlockchainDepositHistory(
    { limit: 20 },
    { query: { refetchInterval: 15000 } },
  );

  const deposits = historyData?.deposits ?? [];

  useEffect(() => {
    const token = localStorage.getItem("qorix_token");
    fetch(getApiUrl("/deposit/address"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        setPlatformAddress(d.platformAddress ?? "");
        setUserTronAddress(d.userTronAddress ?? null);
      })
      .catch(() => {})
      .finally(() => setAddressLoading(false));
  }, []);

  const handleSaveTronAddress = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const token = localStorage.getItem("qorix_token");
    try {
      const res = await fetch(getApiUrl("/deposit/tron-address"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tronAddress: tronInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Invalid address");
      } else {
        setUserTronAddress(tronInput.trim());
        setSaveSuccess(true);
        setTronInput("");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold text-white">USDT Deposit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send USDT via TRC20 to the platform address. Funds are credited automatically.
          </p>
        </div>

        {/* Step 1 — Register TronLink Address */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold text-blue-400">1</div>
            <span className="text-sm font-semibold text-white">Register Your TronLink Wallet</span>
          </div>

          {userTronAddress ? (
            <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-emerald-400 font-medium mb-0.5">Wallet Registered</div>
                <div className="text-xs font-mono text-white/70 truncate">{userTronAddress}</div>
              </div>
              <button
                onClick={() => setUserTronAddress(null)}
                className="text-[10px] text-muted-foreground hover:text-white transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter your <span className="text-white font-medium">TronLink wallet address</span> (the address you will send USDT from). This links your wallet to your account so deposits are credited automatically.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={tronInput}
                    onChange={(e) => setTronInput(e.target.value)}
                    placeholder="T... (your TronLink address)"
                    className="bg-transparent text-xs text-white placeholder:text-muted-foreground/50 outline-none w-full font-mono"
                  />
                </div>
                <button
                  onClick={handleSaveTronAddress}
                  disabled={saving || !tronInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              {saveSuccess && <p className="text-xs text-emerald-400">Wallet registered successfully!</p>}
            </div>
          )}
        </motion.div>

        {/* Step 2 — Platform Deposit Address */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold text-blue-400">2</div>
            <div>
              <div className="text-sm font-semibold text-white">Send USDT to Platform Address</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full uppercase tracking-wider">TRC20</span>
                <span className="text-[10px] text-muted-foreground">USDT · TRON Network</span>
              </div>
            </div>
          </div>

          {addressLoading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading address…</p>
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
            <div className="flex flex-col items-center gap-2 py-6">
              <Wallet className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Platform deposit address not configured</p>
            </div>
          )}
        </motion.div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-semibold text-amber-400">Important: </span>
            Send only <span className="font-semibold text-white">USDT (TRC20)</span> to this address. You must register your TronLink wallet (Step 1) before sending so your deposit is credited automatically. Minimum deposit is <span className="font-semibold text-white">1 USDT</span>.
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">How it works</span>
          </div>
          <div className="space-y-3">
            {[
              { step: "1", text: "Register your TronLink wallet address above" },
              { step: "2", text: "Copy the platform address or scan the QR code" },
              { step: "3", text: "Send USDT (TRC20) from your registered TronLink wallet" },
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
          transition={{ duration: 0.3, delay: 0.2 }}
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
