import { useGetTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, TrendingUp,
  Clock, CheckCircle2, XCircle, Filter, DollarSign, X, ArrowLeft,
  ShieldCheck, Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AddressDisplay, maskAddress } from "@/components/address-display";

type Tx = {
  id: number;
  userId: number;
  type: string;
  amount: number;
  status: string;
  description?: string | null;
  walletAddress?: string | null;
  createdAt: string;
};

const TX_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  deposit:       { label: "Deposit",       icon: ArrowDownCircle,  color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/20" },
  withdrawal:    { label: "Withdrawal",    icon: ArrowUpCircle,    color: "text-amber-400",   bg: "bg-amber-500/12 border-amber-500/20" },
  transfer:      { label: "Transfer",      icon: ArrowRightLeft,   color: "text-emerald-300", bg: "bg-emerald-500/12 border-emerald-500/20" },
  profit:        { label: "Profit",        icon: TrendingUp,       color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/20" },
  fee:           { label: "Fee",           icon: DollarSign,       color: "text-red-400",     bg: "bg-red-500/12 border-red-500/20" },
  referral_bonus:{ label: "Referral",      icon: DollarSign,       color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/20" },
  investment:    { label: "Investment",    icon: TrendingUp,       color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/20" },
  system:        { label: "System",        icon: Clock,            color: "text-muted-foreground", bg: "bg-white/5 border-white/8" },
};

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-400", label: "Completed" },
  pending:   { icon: Clock,        color: "text-amber-400",   label: "Pending" },
  failed:    { icon: XCircle,      color: "text-red-400",     label: "Failed" },
  rejected:  { icon: XCircle,      color: "text-red-400",     label: "Rejected" },
};

const FILTERS = ["All", "Deposit", "Withdrawal", "Profit", "Transfer", "Fee"];

function TxSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/5 animate-pulse">
      <div className="skeleton-shimmer w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer h-2.5 w-40 rounded" />
      </div>
      <div className="space-y-2 text-right">
        <div className="skeleton-shimmer h-3 w-16 rounded ml-auto" />
        <div className="skeleton-shimmer h-2.5 w-12 rounded ml-auto" />
      </div>
    </div>
  );
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

/** Strip raw wallet address from server description so we can render a masked/revealable pill instead. */
function cleanDescription(desc: string | null | undefined, addr: string | null | undefined): string {
  if (!desc) return "";
  if (!addr) return desc;
  return desc.replaceAll(addr, maskAddress(addr));
}

export default function TransactionsPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Tx | null>(null);
  const { data: transactionsData, isLoading } = useGetTransactions({ limit: 100 });
  const transactions = (transactionsData?.data || []) as Tx[];

  // Auto-open detail modal when arriving with ?focus=<id> from wallet
  useEffect(() => {
    if (!transactions.length) return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get("focus");
    if (!focusId) return;
    const tx = transactions.find((t) => String(t.id) === focusId);
    if (tx) {
      setSelected(tx);
      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [transactions]);

  const filtered = filter === "All"
    ? transactions
    : transactions.filter((tx) => tx.type.toLowerCase() === filter.toLowerCase());

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="space-y-5 md:space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setLocation("/wallet")}
              aria-label="Back"
              className="shrink-0 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors mt-0.5"
            >
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Transactions</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Complete history of your account activity. Tap any row for details.
              </p>
            </div>
          </div>
          {!isLoading && (
            <div className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full self-start sm:self-auto ml-12 sm:ml-0">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Filter style={{ width: 13, height: 13 }} className="text-muted-foreground shrink-0" />
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150 ${
                filter === f
                  ? "bg-emerald-500/20 border-emerald-500/35 text-emerald-300"
                  : "bg-white/5 border-white/8 text-muted-foreground hover:text-white hover:bg-white/8"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <TxSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock style={{ width: 32, height: 32 }} className="mb-3 opacity-25" />
              <p className="font-medium">No transactions found</p>
              <p className="text-xs opacity-50 mt-1">Try a different filter</p>
            </div>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="divide-y divide-white/[0.05]"
            >
              {filtered.map((tx) => {
                const meta = TX_META[tx.type.toLowerCase()] ?? TX_META.system!;
                const statusMeta = STATUS_META[tx.status.toLowerCase()] ?? STATUS_META.pending!;
                const Icon = meta.icon;
                const StatusIcon = statusMeta.icon;
                const isCredit = ["deposit", "profit", "referral_bonus"].includes(tx.type.toLowerCase());
                const isDebit = ["withdrawal", "fee"].includes(tx.type.toLowerCase());
                const desc = cleanDescription(tx.description, tx.walletAddress);

                return (
                  <motion.button
                    key={tx.id}
                    variants={row}
                    onClick={() => setSelected(tx)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.035] transition-colors"
                  >
                    <div className={`p-2 rounded-xl border shrink-0 ${meta.bg}`}>
                      <Icon style={{ width: 16, height: 16 }} className={meta.color} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{meta.label}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          statusMeta.color === "text-emerald-400"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : statusMeta.color === "text-amber-400"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}>
                          <StatusIcon style={{ width: 9, height: 9 }} />
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[260px]">
                        {desc || format(new Date(tx.createdAt), "MMM dd, yyyy · HH:mm")}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold font-mono tabular-nums ${
                        isCredit ? "text-emerald-400" : isDebit ? "text-red-400" : "text-white"
                      }`}>
                        {isCredit ? "+" : isDebit ? "−" : ""}${tx.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(tx.createdAt), "MMM dd, HH:mm")}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && <TxDetailModal tx={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </Layout>
  );
}

function TxDetailModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const meta = TX_META[tx.type.toLowerCase()] ?? TX_META.system!;
  const statusMeta = STATUS_META[tx.status.toLowerCase()] ?? STATUS_META.pending!;
  const Icon = meta.icon;
  const StatusIcon = statusMeta.icon;
  const isWithdrawal = tx.type.toLowerCase() === "withdrawal";
  const isApproved = tx.status.toLowerCase() === "completed";
  const isPending = tx.status.toLowerCase() === "pending";

  // Parse fee from description if present: "(fee: $X.XX)"
  const feeMatch = tx.description?.match(/fee:\s*\$([0-9.]+)/i);
  const fee = feeMatch ? parseFloat(feeMatch[1]!) : 0;
  const sourceMatch = tx.description?.match(/from\s+(main|profit)/i);
  const source = sourceMatch ? sourceMatch[1]!.toLowerCase() : null;

  // Theme by status (matches live deposit-receipt modal)
  const isRejected = tx.status.toLowerCase() === "rejected" || tx.status.toLowerCase() === "failed";
  const theme = isApproved
    ? {
        ring: "border-emerald-500/15", ring2: "border-emerald-500/25", ring3: "border-emerald-500/40",
        hub: "bg-emerald-500 shadow-[0_0_40px_-6px_rgba(16,185,129,0.7)]",
        labelText: "text-emerald-400",
        banner: "border-emerald-500/30 bg-emerald-500/10", bannerIcon: "text-emerald-300",
        pillBg: "bg-emerald-500/15 border-emerald-500/35 text-emerald-300", pillDot: "bg-emerald-400",
      }
    : isRejected
      ? {
          ring: "border-rose-500/15", ring2: "border-rose-500/25", ring3: "border-rose-500/40",
          hub: "bg-rose-500 shadow-[0_0_40px_-6px_rgba(244,63,94,0.7)]",
          labelText: "text-rose-400",
          banner: "border-rose-500/30 bg-rose-500/10", bannerIcon: "text-rose-300",
          pillBg: "bg-rose-500/15 border-rose-500/35 text-rose-300", pillDot: "bg-rose-400",
        }
      : {
          ring: "border-amber-500/15", ring2: "border-amber-500/25", ring3: "border-amber-500/40",
          hub: "bg-amber-500 shadow-[0_0_40px_-6px_rgba(245,158,11,0.7)]",
          labelText: "text-amber-400",
          banner: "border-amber-500/30 bg-amber-500/10", bannerIcon: "text-amber-300",
          pillBg: "bg-amber-500/15 border-amber-500/35 text-amber-300", pillDot: "bg-amber-400",
        };

  const headlineLabel = `${meta.label.toUpperCase()} ${isApproved ? "COMPLETED" : isRejected ? "REJECTED" : "SUBMITTED"}`;
  const subtitle = isApproved
    ? "Processed successfully · funds settled"
    : isRejected
      ? "Request was rejected · amount refunded"
      : "Queued for verification · approved in 1–3 hrs";
  const HeroIcon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock;

  const FX_RATE = 83.42;
  const inrAmount = tx.amount * FX_RATE;
  const isOut = isWithdrawal || tx.type === "fee";
  const sign = isOut ? "− " : "+ ";

  const [, navigate] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center px-4 py-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md my-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c0d10] via-[#0a0b0e] to-[#06070a] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-5 sm:p-6 space-y-4 sm:space-y-5"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero icon with concentric rings */}
        <div className="flex flex-col items-center pt-1 sm:pt-2">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center"
          >
            <span className={`absolute inset-0 rounded-full border ${theme.ring}`} />
            <span className={`absolute inset-3 rounded-full border ${theme.ring2}`} />
            <span className={`absolute inset-6 rounded-full border ${theme.ring3}`} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.05 }}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center ${theme.hub}`}
            >
              <HeroIcon className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
          <div className={`mt-3 sm:mt-5 text-[11px] tracking-[0.28em] font-bold ${theme.labelText}`}>
            {headlineLabel}
          </div>
          <div className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-bold text-white tabular-nums">
            ₹{inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 sm:mt-2 text-xs text-muted-foreground text-center px-2">
            {subtitle}
          </div>
        </div>

        {/* Status banner */}
        <div className={`rounded-2xl border ${theme.banner} px-4 py-3 flex items-start gap-3`}>
          <ShieldCheck className={`w-4 h-4 mt-0.5 shrink-0 ${theme.bannerIcon}`} />
          <span className="text-xs text-white leading-relaxed">
            Secured by Qorix · <span className="font-semibold">${tx.amount.toFixed(2)} USDT</span>{" "}
            {isApproved ? "settled" : isRejected ? "refunded" : "pending review"}
          </span>
        </div>

        {/* Transaction details card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-5 pt-4 pb-3 text-[10px] tracking-[0.22em] font-bold text-white/55">
            TRANSACTION DETAILS
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
              <span className="text-xs text-white/55">Type</span>
              <span className="text-xs font-semibold text-white inline-flex items-center gap-2 min-w-0">
                <span className={`w-6 h-6 rounded-md inline-flex items-center justify-center shrink-0 border ${meta.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                </span>
                <span className="truncate">{meta.label}</span>
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-white/55">{isOut ? "Amount Debited" : "Amount Credited"}</span>
              <span className={`text-xs font-bold tabular-nums ${isOut ? "text-rose-300" : "text-emerald-300"}`}>
                {sign}₹{inrAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
            </div>
            {source && (
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">From</span>
                <span className="text-xs font-semibold text-white">
                  {source === "main" ? "Main Balance" : "Profit Balance"}
                </span>
              </div>
            )}
            {fee > 0 && (
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Network Fee</span>
                <span className="text-xs font-semibold text-white tabular-nums">${fee.toFixed(2)}</span>
              </div>
            )}
            {tx.walletAddress && (
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55 shrink-0">To Address</span>
                <div className="min-w-0 max-w-[60%]">
                  <AddressDisplay address={tx.walletAddress} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-white/55">Submitted</span>
              <span className="text-xs font-semibold text-white">
                {format(new Date(tx.createdAt), "dd MMM yyyy, hh:mm a")}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-white/55">Status</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${theme.pillBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.pillDot} ${isPending ? "animate-pulse" : ""}`} />
                {statusMeta.label}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-xs text-white/55">Reference</span>
              <span className="text-xs font-mono font-semibold text-white">
                QM-{String(tx.id).padStart(6, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => { onClose(); setTimeout(() => navigate("/wallet"), 60); }}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_28px_-6px_rgba(16,185,129,0.65)] transition-all inline-flex items-center justify-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          Back to Wallet
        </button>
        <p className="text-[10px] text-center text-white/45 leading-relaxed -mt-1">
          Receipt #{tx.id} · Share this screen for proof
        </p>
      </motion.div>
    </motion.div>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : "font-medium"} ${highlight ? "text-emerald-400 font-bold" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
