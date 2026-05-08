import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Lock, Search, X, ChevronRight, Info, Loader2, AlertCircle, Check, Building2,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const getApiUrl = (path: string) => `${BASE_URL}api${path}`;

interface PaymentMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  minAmount: string;
  maxAmount: string;
  merchantId?: number | null;
  merchantName?: string | null;
  merchantAvailable?: number | string | null;
  isOnline?: boolean;
}

const COLORS = ["#10B981", "#14B8A6", "#06B6D4", "#3B82F6", "#22C55E", "#EC4899", "#F59E0B"];
const colorFor = (id: number) => COLORS[id % COLORS.length];

const formatLimit = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString("en-IN")}`;

export default function DepositNetBankingPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "capacity", String(numAmount)],
    queryFn: () => authFetch(getApiUrl(`/payment-methods?amount=${numAmount}`)),
    enabled: numAmount > 0,
  });

  const bankMethods = useMemo(() => {
    const all = (data?.methods ?? []).filter((m) => m.type === "bank" && !!m.accountNumber);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((m) =>
      [m.bankName, m.merchantName, m.displayName, m.accountHolder]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const select = (m: PaymentMethod) => {
    navigate(`/deposit/netbanking/details?methodId=${m.id}&amount=${numAmount}`);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">SELECT YOUR BANK</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            RBI-compliant · <span className="text-muted-foreground">Secure NEFT/IMPS transfer to verified beneficiary</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 h-11 rounded-xl bg-white/5 border border-white/10">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bank or merchant"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            data-testid="input-search-bank"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <div className="text-xs text-muted-foreground">Finding bank merchants for ₹{numAmount.toLocaleString("en-IN")}…</div>
          </div>
        )}

        {isError && !isLoading && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center space-y-2">
            <AlertCircle className="w-5 h-5 mx-auto text-rose-400" />
            <div className="text-sm text-rose-300">Could not load banks</div>
            <button onClick={() => refetch()} className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && bankMethods.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-2">
            <Building2 className="w-5 h-5 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              {search.trim()
                ? `No banks found for "${search}"`
                : `No bank merchants available for ₹${numAmount.toLocaleString("en-IN")} right now.`}
            </div>
            <button
              onClick={() => (search.trim() ? setSearch("") : navigate("/deposit"))}
              className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold"
            >
              {search.trim() ? "Clear search" : "Try a different amount"}
            </button>
          </div>
        )}

        {!isLoading && bankMethods.length > 0 && (
          <div className="space-y-2">
            {bankMethods.map((m) => <BankRow key={m.id} method={m} amount={numAmount} onClick={() => select(m)} />)}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
          <Info className="w-3 h-3" />
          All accounts verified · 256-bit SSL · 0% gateway fees
        </div>
      </div>
    </Layout>
  );
}

function BankRow({
  method, amount, onClick,
}: {
  method: PaymentMethod;
  amount: number;
  onClick: () => void;
}) {
  const minN = parseFloat(method.minAmount) || 0;
  const maxN = parseFloat(method.maxAmount) || 0;
  const eligible = amount >= minN && amount <= maxN;
  const color = colorFor(method.merchantId ?? method.id);
  const bankLabel = method.bankName ?? method.displayName ?? "Bank";
  const initial = bankLabel.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      disabled={!eligible}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 transition-colors text-left",
        eligible ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed",
      )}
      data-testid={`bank-${method.id}`}
    >
      <div className="relative w-11 h-11 shrink-0">
        <div
          className="w-11 h-11 rounded-xl border-[1.5px] flex items-center justify-center text-base font-bold"
          style={{ backgroundColor: color + "22", borderColor: color + "66", color }}
        >
          {initial}
        </div>
        <div className={cn(
          "absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-[#0b1220]",
          method.isOnline === false ? "bg-rose-500" : "bg-emerald-500",
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-sm font-bold truncate">
            {method.merchantName ?? method.accountHolder ?? "Verified beneficiary"}
          </div>
          {method.isOnline !== false && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/45 text-emerald-400 text-[9px] font-bold tracking-wider">
              <Check className="w-2.5 h-2.5" /> ONLINE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate font-semibold text-foreground/80">{bankLabel}</span>
          {method.accountNumber && (
            <span className="font-mono">
              ····{method.accountNumber.slice(-4)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground">
            LIMIT{" "}
            <span className={eligible ? "text-foreground/70" : "text-rose-400"}>
              {formatLimit(minN)} – {formatLimit(maxN)}
            </span>
          </div>
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}
