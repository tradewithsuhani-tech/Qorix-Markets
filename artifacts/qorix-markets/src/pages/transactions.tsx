import { useGetTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, TrendingUp,
  Clock, CheckCircle2, XCircle, Filter, DollarSign
} from "lucide-react";
import { useState } from "react";

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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

export default function TransactionsPage() {
  const [filter, setFilter] = useState("All");
  const { data: transactionsData, isLoading } = useGetTransactions({ limit: 100 });
  const transactions = transactionsData?.data || [];

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
              Complete history of your account activity.
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

                return (
                  <motion.div
                    key={tx.id}
                    variants={row}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.025] transition-colors"
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
                        {tx.description || format(new Date(tx.createdAt), "MMM dd, yyyy · HH:mm")}
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
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </motion.div>
    </Layout>
  );
}
