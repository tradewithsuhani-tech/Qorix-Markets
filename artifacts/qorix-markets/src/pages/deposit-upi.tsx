import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, Shield, Check, ChevronRight, Users, Loader2, AlertCircle,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const getApiUrl = (path: string) => `${BASE_URL}api${path}`;

interface PaymentMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  upiId: string | null;
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

export default function DepositUpiPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const numAmount = parseFloat(params.get("amount") ?? "0") || 0;

  const { data, isLoading, isError, refetch } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "capacity", String(numAmount)],
    queryFn: () => authFetch(getApiUrl(`/payment-methods?amount=${numAmount}`)),
    enabled: numAmount > 0,
  });

  const upiMethods = useMemo(
    () => (data?.methods ?? []).filter((m) => m.type === "upi" && !!m.upiId),
    [data],
  );

  const handlePay = (m: PaymentMethod) => {
    navigate(`/deposit/upi/pay?methodId=${m.id}&amount=${numAmount}`);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] text-emerald-400">SELECT P2P MERCHANT</div>
            <div className="text-xl font-bold mt-0.5">Pay ₹{numAmount.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            Escrow-protected · <span className="text-muted-foreground">Funds released after merchant confirms</span>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <div className="text-xs text-muted-foreground">Finding merchants with capacity for ₹{numAmount.toLocaleString("en-IN")}…</div>
          </div>
        )}

        {isError && !isLoading && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center space-y-2">
            <AlertCircle className="w-5 h-5 mx-auto text-rose-400" />
            <div className="text-sm text-rose-300">Could not load merchants</div>
            <button
              onClick={() => refetch()}
              className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && upiMethods.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-2">
            <Users className="w-5 h-5 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              No UPI merchants available for ₹{numAmount.toLocaleString("en-IN")} right now.
            </div>
            <button
              onClick={() => navigate("/deposit")}
              className="px-3.5 py-2 rounded-full border border-emerald-500 text-emerald-400 text-xs font-bold"
            >
              Try a different amount
            </button>
          </div>
        )}

        {!isLoading && upiMethods.length > 0 && (
          <div className="space-y-2">
            {upiMethods.map((m) => {
              const minN = parseFloat(m.minAmount) || 0;
              const maxN = parseFloat(m.maxAmount) || 0;
              const eligible = numAmount >= minN && numAmount <= maxN;
              const color = colorFor(m.merchantId ?? m.id);
              const name = m.merchantName ?? m.displayName ?? "Merchant";
              const initial = name.charAt(0).toUpperCase();
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5"
                  data-testid={`merchant-${m.id}`}
                >
                  <div className="relative w-11 h-11 shrink-0">
                    <div
                      className="w-11 h-11 rounded-full border-[1.5px] flex items-center justify-center text-lg font-bold"
                      style={{
                        backgroundColor: color + "33",
                        borderColor: color + "66",
                        color,
                      }}
                    >
                      {initial}
                    </div>
                    <div
                      className={cn(
                        "absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-[#0b1220]",
                        m.isOnline === false ? "bg-rose-500" : "bg-emerald-500"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-base font-extrabold truncate uppercase">{name}</div>
                      {m.isOnline !== false && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-emerald-500/20 border-emerald-500/45 text-emerald-400 text-[9px] font-bold tracking-wider">
                          <Check className="w-2.5 h-2.5" /> ONLINE
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

                  <button
                    onClick={() => handlePay(m)}
                    disabled={!eligible}
                    className={cn(
                      "h-9 px-3.5 rounded-lg flex items-center gap-1 text-sm font-bold transition-opacity disabled:cursor-not-allowed",
                      eligible
                        ? "bg-emerald-500 text-white hover:opacity-90"
                        : "bg-white/5 text-muted-foreground"
                    )}
                    data-testid={`pay-${m.id}`}
                  >
                    Pay <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground text-center">
          All merchants verified · 24/7 dispute support · 0% gateway fees
        </div>
      </div>
    </Layout>
  );
}
