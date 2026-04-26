import { useGetTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, TrendingUp,
  Clock, CheckCircle2, XCircle, Filter, DollarSign, X,
} from "lucide-react";
import { useState } from "react";
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
  transfer:      { label: "Transfer",      icon: ArrowRightLeft,   color: "text-blue-400",    bg: "bg-blue-500/12 border-blue-500/20" },
  profit:        { label: "Profit",        icon: TrendingUp,       color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/20" },
  fee:           { label: "Fee",           icon: DollarSign,       color: "text-red-400",     bg: "bg-red-500/12 border-red-500/20" },
  referral_bonus:{ label: "Referral",      icon: DollarSign,       color: "text-violet-400",  bg: "bg-violet-500/12 border-violet-500/20" },
  investment:    { label: "Investment",    icon: TrendingUp,       color: "text-blue-400",    bg: "bg-blue-500/12 border-blue-500/20" },
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
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Tx | null>(null);
  const { data: transactionsData, isLoading } = useGetTransactions({ limit: 100 });
  const transactions = (transactionsData?.data || []) as Tx[];

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Transactions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Complete history of your account activity. Tap any row for details.
            </p>
          </div>
          {!isLoading && (
            <div className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
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
                  ? "bg-blue-500/20 border-blue-500/35 text-blue-400"
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0b1020] border-t sm:border border-white/10 sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${meta.bg}`}>
              <Icon style={{ width: 18, height: 18 }} className={meta.color} />
            </div>
            <div>
              <div className="text-base font-bold">{meta.label} Details</div>
              <div className="text-[11px] text-muted-foreground">Ref #{tx.type.slice(0, 2).toUpperCase()}-{tx.id}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Amount hero */}
          <div className="text-center py-3">
            <div className={`text-3xl font-bold font-mono tabular-nums ${
              isWithdrawal ? "text-red-400" : tx.type === "deposit" || tx.type === "profit" ? "text-emerald-400" : "text-white"
            }`}>
              {isWithdrawal ? "−" : ""}${tx.amount.toFixed(2)}
            </div>
            <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
              statusMeta.color === "text-emerald-400"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : statusMeta.color === "text-amber-400"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              <StatusIcon style={{ width: 10, height: 10 }} />
              {statusMeta.label}
            </span>
          </div>

          {/* Details card */}
          <div className="rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5 text-xs">
            <DetailRow label="Reference ID" value={`#${tx.type.slice(0, 2).toUpperCase()}-${tx.id}`} mono />
            <DetailRow label="Type" value={meta.label} />
            {source && <DetailRow label="From" value={source === "main" ? "Main Balance" : "Profit Balance"} />}
            {fee > 0 && <DetailRow label="Network Fee" value={`$${fee.toFixed(2)}`} />}
            {isWithdrawal && fee > 0 && (
              <DetailRow label="You'll Receive" value={`$${(tx.amount).toFixed(2)} USD`} highlight />
            )}
            {tx.walletAddress && (
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                <span className="text-muted-foreground">To Address</span>
                <AddressDisplay address={tx.walletAddress} />
              </div>
            )}
            <DetailRow label="Submitted" value={format(new Date(tx.createdAt), "dd/MM/yyyy, HH:mm:ss")} />
          </div>

          {/* Status-based callout for withdrawal */}
          {isWithdrawal && isPending && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300/90">
              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Your withdrawal request has been <b>submitted</b> and is awaiting admin review (usually within 24 hours).</span>
            </div>
          )}
          {isWithdrawal && isApproved && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-300/95">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Withdrawal request <b>approved</b>. Funds have been dispatched via our payment partner and will arrive at your wallet
                within <b>30 minutes to 3 working days</b>.
              </span>
            </div>
          )}
          {isWithdrawal && tx.status.toLowerCase() === "rejected" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-xs text-red-300/95">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>This withdrawal was rejected. The amount has been refunded to your balance. Please contact support for more info.</span>
            </div>
          )}
        </div>

        <div className="p-4 pt-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
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
