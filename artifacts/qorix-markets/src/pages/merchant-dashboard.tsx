import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Landmark, Wallet } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { Link } from "wouter";

interface DashboardResponse {
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalMethods: number;
  // INR wallet snapshot. Returned as numeric strings from the API so we can
  // safely format/parse without floating-point drift on big rupee values.
  inrBalance: string;
  pendingHold: string;
  available: string;
}

// Render a numeric string (e.g. "10000.00") as Indian-style "₹10,000.00".
// Falls back to "₹0.00" for null/undefined/NaN so the card never says "₹NaN".
function formatINR(s: string | undefined | null): string {
  const n = parseFloat(s ?? "0");
  if (!Number.isFinite(n)) return "₹0.00";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MerchantDashboardPage() {
  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["merchant-dashboard"],
    queryFn: () => merchantAuthFetch<DashboardResponse>(merchantApiUrl("/merchant/dashboard")),
    refetchInterval: 30_000,
  });

  const cards = [
    {
      label: "Pending Deposits",
      value: data?.pendingDeposits ?? 0,
      href: "/merchant/deposits",
      icon: ArrowDownCircle,
      color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "Pending Withdrawals",
      value: data?.pendingWithdrawals ?? 0,
      href: "/merchant/withdrawals",
      icon: ArrowUpCircle,
      color: "from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-300",
    },
    {
      label: "Active Methods",
      value: data?.totalMethods ?? 0,
      href: "/merchant/methods",
      icon: Landmark,
      color: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-300",
    },
  ];

  return (
    <MerchantLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Live queue for the actions awaiting your attention.</p>
      </div>

      {/* INR wallet snapshot — admin top-ups land here, pendingHold is what's
          locked against pending user deposits on your methods, available is
          the headroom new user deposits can match against. */}
      <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent p-5">
        <div className="flex items-center gap-2 text-cyan-300">
          <Wallet className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wide font-semibold">INR Wallet</span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Wallet Balance</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">
              {isLoading ? "—" : formatINR(data?.inrBalance)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Topped up by platform admin.</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Pending Hold</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-300">
              {isLoading ? "—" : formatINR(data?.pendingHold)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Locked against pending user deposits.</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Available</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
              {isLoading ? "—" : formatINR(data?.available)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Headroom for new deposits to match you.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <a
              className={`block rounded-2xl border bg-gradient-to-br ${c.color} p-5 hover:scale-[1.01] transition-transform`}
            >
              <div className="flex items-center justify-between">
                <c.icon className="h-6 w-6 opacity-80" />
                <div className="text-3xl font-bold tabular-nums">{isLoading ? "—" : c.value}</div>
              </div>
              <div className="mt-3 text-xs uppercase tracking-wide opacity-80">{c.label}</div>
            </a>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-slate-200">How escalation works</h2>
        <ul className="mt-3 text-sm text-slate-400 space-y-2 list-disc list-inside">
          <li>New deposit on your method → instant email to you.</li>
          <li>If untouched after <span className="text-slate-200">10 min</span> → automated voice call to your registered phone.</li>
          <li>If still untouched at <span className="text-slate-200">15 min</span> → escalated to platform admin.</li>
          <li>After <span className="text-slate-200">30 min</span> the user sees a "high load" banner — please act before then.</li>
        </ul>
      </div>
    </MerchantLayout>
  );
}
