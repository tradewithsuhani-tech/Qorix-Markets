import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  Wallet,
  TrendingUp,
  Mail,
  Phone,
  AlertOctagon,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "wouter";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import {
  PageHeader,
  PremiumCard,
  StatusPill,
  SectionLabel,
  formatINR,
} from "@/components/merchant-ui";
import { cn } from "@/lib/utils";

interface DashboardResponse {
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalMethods: number;
  inrBalance: string;
  pendingHold: string;
  available: string;
}

export default function MerchantDashboardPage() {
  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["merchant-dashboard"],
    queryFn: () =>
      merchantAuthFetch<DashboardResponse>(merchantApiUrl("/merchant/dashboard")),
    refetchInterval: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const inrBalance = parseFloat(data?.inrBalance ?? "0");
  const pendingHold = parseFloat(data?.pendingHold ?? "0");
  const headroomPct =
    inrBalance > 0 ? Math.min(100, (pendingHold / inrBalance) * 100) : 0;

  return (
    <MerchantLayout>
      <PageHeader
        title="Dashboard"
        subtitle="Live operations queue and INR wallet snapshot."
        action={
          <StatusPill variant="success" pulse>
            Realtime · syncing every 10s
          </StatusPill>
        }
      />

      {/* ── INR Wallet Hero ───────────────────────────────────── */}
      <PremiumCard
        className="mb-6 overflow-hidden p-0"
        glow
      >
        <div className="relative p-6 sm:p-7">
          {/* gold-corner accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 shadow-[0_4px_14px_-2px_rgba(252,213,53,0.45)]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <SectionLabel>INR Wallet</SectionLabel>
                  <div className="text-[11px] text-slate-500">
                    Topped up by platform admin
                  </div>
                </div>
              </div>
              <StatusPill variant="gold">Active</StatusPill>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <BalanceCell
                label="Wallet Balance"
                value={isLoading ? "—" : formatINR(data?.inrBalance)}
                color="text-white"
                hint="Total funds you hold"
              />
              <BalanceCell
                label="Pending Hold"
                value={isLoading ? "—" : formatINR(data?.pendingHold)}
                color="text-amber-300"
                hint="Locked against pending user deposits"
              />
              <BalanceCell
                label="Available"
                value={isLoading ? "—" : formatINR(data?.available)}
                color="text-emerald-300"
                hint="Headroom for new deposits to match you"
              />
            </div>

            {/* Utilisation bar */}
            <div className="mt-6 border-t border-white/[0.05] pt-4">
              <div className="flex items-center justify-between text-[11px]">
                <SectionLabel>Wallet Utilisation</SectionLabel>
                <span className="font-mono font-semibold text-slate-300 tabular-nums">
                  {headroomPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
                  style={{ width: `${headroomPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* ── Stat tiles ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Pending Deposits"
          value={isLoading ? "—" : data?.pendingDeposits ?? 0}
          href="/merchant/deposits"
          icon={ArrowDownCircle}
          variant="emerald"
          hint="Awaiting your approval"
        />
        <StatTile
          label="Pending Withdrawals"
          value={isLoading ? "—" : data?.pendingWithdrawals ?? 0}
          href="/merchant/withdrawals"
          icon={ArrowUpCircle}
          variant="rose"
          hint="Awaiting payout"
        />
        <StatTile
          label="Active Methods"
          value={isLoading ? "—" : data?.totalMethods ?? 0}
          href="/merchant/methods"
          icon={Landmark}
          variant="amber"
          hint="UPI / bank channels live"
        />
      </div>

      {/* ── Escalation timeline ────────────────────────────────── */}
      <PremiumCard className="mt-6 p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Response Time Policy
            </h2>
            <div className="text-[11px] text-slate-500">
              Stay ahead of automated escalation
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TimelineStep
            icon={Mail}
            time="Instant"
            label="Email alert"
            desc="New deposit on your method → email to you."
            tone="info"
          />
          <TimelineStep
            icon={Phone}
            time="10 min"
            label="Voice call"
            desc="Untouched? Automated voice call to your phone."
            tone="warning"
          />
          <TimelineStep
            icon={AlertOctagon}
            time="15 min"
            label="Admin escalation"
            desc="Still untouched → escalated to platform admin."
            tone="danger"
          />
          <TimelineStep
            icon={Clock}
            time="30 min"
            label="User banner"
            desc="User sees a 'high load' banner. Act before then."
            tone="muted"
          />
        </div>
      </PremiumCard>
    </MerchantLayout>
  );
}

function BalanceCell({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint: string;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div
        className={cn(
          "mt-1.5 text-[26px] font-bold tracking-tight tabular-nums leading-none",
          color,
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

const TILE_VARIANTS = {
  emerald: {
    glow: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    border: "hover:border-emerald-500/30",
    iconBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    accent: "text-emerald-300",
  },
  rose: {
    glow: "from-rose-500/15 via-rose-500/5 to-transparent",
    border: "hover:border-rose-500/30",
    iconBg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    accent: "text-rose-300",
  },
  amber: {
    glow: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "hover:border-amber-500/30",
    iconBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    accent: "text-amber-300",
  },
} as const;

function StatTile({
  label,
  value,
  href,
  icon: Icon,
  variant,
  hint,
}: {
  label: string;
  value: number | string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: keyof typeof TILE_VARIANTS;
  hint: string;
}) {
  const v = TILE_VARIANTS[variant];
  return (
    <Link href={href}>
      <a
        className={cn(
          "group relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-5 backdrop-blur-sm transition-all",
          "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
          v.border,
          "hover:-translate-y-0.5",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100",
            v.glow,
          )}
        />
        <div className="relative flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              v.iconBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-slate-300" />
        </div>
        <div className="relative mt-5">
          <div
            className={cn(
              "text-4xl font-bold tabular-nums tracking-tight",
              v.accent,
            )}
          >
            {value}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{label}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
        </div>
      </a>
    </Link>
  );
}

const TONE_STYLES = {
  info: "border-sky-500/20 text-sky-300",
  warning: "border-amber-500/20 text-amber-300",
  danger: "border-rose-500/20 text-rose-300",
  muted: "border-slate-700 text-slate-400",
} as const;

function TimelineStep({
  icon: Icon,
  time,
  label,
  desc,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  time: string;
  label: string;
  desc: string;
  tone: keyof typeof TONE_STYLES;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className={cn("flex items-center gap-2", TONE_STYLES[tone])}>
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {time}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-[11px] leading-snug text-slate-500">{desc}</div>
    </div>
  );
}
