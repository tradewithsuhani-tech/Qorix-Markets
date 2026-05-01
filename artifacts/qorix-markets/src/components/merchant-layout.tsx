import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearMerchantToken,
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";
import { useQuery } from "@tanstack/react-query";
import { MerchantDepositNotifier } from "./merchant-deposit-notifier";
import { MerchantWithdrawalNotifier } from "./merchant-withdrawal-notifier";
import { MerchantPendingBadge } from "./merchant-pending-beacon";
import { StatusPill, timeAgo } from "./merchant-ui";

interface MeResponse {
  merchant: {
    id: number;
    email: string;
    fullName: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
  } | null;
}

// Must match the heartbeat window used server-side in
// routes/inr-deposits.ts (`m.last_login_at > now() - interval '5 minutes'`)
// — that's the same column-derived is_online flag used to sort deposit
// assignment, so the badge stays consistent with the assignment logic.
const ONLINE_WINDOW_MS = 5 * 60_000;

const PRIMARY_LINKS = [
  { href: "/merchant", label: "Dashboard", icon: LayoutDashboard },
  { href: "/merchant/deposits", label: "INR Deposits", icon: ArrowDownCircle },
  { href: "/merchant/withdrawals", label: "INR Withdrawals", icon: ArrowUpCircle },
];

const ACCOUNT_LINKS = [
  { href: "/merchant/methods", label: "Payment Methods", icon: Landmark },
  { href: "/merchant/settings", label: "Settings", icon: SettingsIcon },
];

const ALL_LINKS = [...PRIMARY_LINKS, ...ACCOUNT_LINKS];

export function MerchantLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!getMerchantToken()) navigate("/merchant/login");
  }, [navigate]);

  const { data, isError } = useQuery<MeResponse>({
    queryKey: ["merchant-me"],
    queryFn: () => merchantAuthFetch<MeResponse>(merchantApiUrl("/merchant/me")),
    enabled: Boolean(getMerchantToken()),
    retry: false,
    // Heartbeat is throttled to 60s server-side (merchant-auth.ts), so
    // refetching /me at the same cadence keeps lastLoginAt fresh enough for
    // the online/offline badge without burning extra round-trips.
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Local clock so the pill can flip to "Offline" even when no /me refetch
  // has fired yet (e.g. tab was backgrounded long enough that the heartbeat
  // expired but the cached MeResponse is still recent). Re-evaluating every
  // 30s is plenty given the 5-minute window.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isError) {
      clearMerchantToken();
      navigate("/merchant/login");
    }
  }, [isError, navigate]);

  function handleLogout() {
    clearMerchantToken();
    navigate("/merchant/login");
  }

  const merchant = data?.merchant;
  const initials =
    merchant?.fullName
      ?.split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "M";

  // Real online state: same definition the deposit-assignment query uses
  // (lastLoginAt within the heartbeat window). Until /me has loaded we treat
  // status as unknown rather than asserting "Online" so we don't repeat the
  // bug this badge is meant to fix.
  const lastLoginMs = merchant?.lastLoginAt
    ? new Date(merchant.lastLoginAt).getTime()
    : null;
  const hasMe = Boolean(merchant);
  const isOnline =
    lastLoginMs !== null && now - lastLoginMs < ONLINE_WINDOW_MS;
  const statusVariant: "success" | "warning" | "neutral" = !hasMe
    ? "neutral"
    : isOnline
      ? "success"
      : "warning";
  const statusLabel = !hasMe
    ? "Connecting…"
    : isOnline
      ? "Online · Live sync"
      : "Offline";
  const statusTooltip = !hasMe
    ? "Checking session status"
    : lastLoginMs
      ? `Last activity ${timeAgo(merchant!.lastLoginAt!)}` +
        (isOnline
          ? ""
          : " — heartbeat expired, deposits won't be routed to you until you interact with the panel")
      : "No activity recorded yet";

  return (
    <div
      className="relative min-h-screen text-slate-100 antialiased"
      style={{ backgroundColor: "#0a0d12" }}
    >
      {/* Premium ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl" />
      </div>

      <div className="flex">
        {/* ───── Desktop sidebar ───── */}
        <aside
          className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-r md:border-white/[0.06] md:bg-slate-950/80 md:backdrop-blur-xl"
        >
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_4px_16px_-2px_rgba(252,213,53,0.5)]">
              <span className="text-base font-black text-slate-950">Q</span>
              {/* Corner dot mirrors heartbeat state — green pulses when online,
                  amber/static when offline, so it doesn't fight the pill below. */}
              <span
                className="absolute -right-0.5 -top-0.5 flex h-3 w-3"
                title={statusTooltip}
              >
                {isOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-3 w-3 rounded-full ring-2 ring-slate-950",
                    isOnline ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-white">
                Qorix Merchant
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Operator Console
              </div>
            </div>
          </div>

          {/* Status row */}
          <div className="space-y-2 border-b border-white/[0.06] px-5 py-3">
            <StatusPill
              variant={statusVariant}
              pulse={isOnline}
              title={statusTooltip}
            >
              {statusLabel}
            </StatusPill>
            <MerchantPendingBadge variant="sidebar" />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarSection label="Operations" links={PRIMARY_LINKS} location={location} />
            <SidebarSection
              label="Account"
              links={ACCOUNT_LINKS}
              location={location}
              className="mt-6"
            />
          </nav>

          {/* Footer / merchant card */}
          <div className="border-t border-white/[0.06] p-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-slate-950 ring-2 ring-white/10">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">
                    {merchant?.fullName ?? "—"}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {merchant?.email ?? ""}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white"
                >
                  <LogOut className="h-3 w-3" /> Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ───── Mobile top bar ───── */}
        <header className="fixed inset-x-0 top-0 z-30 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_3px_10px_-2px_rgba(252,213,53,0.5)]">
                <span className="text-sm font-black text-slate-950">Q</span>
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-bold text-white">
                  Qorix Merchant
                </div>
                <div
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.18em]",
                    !hasMe
                      ? "text-slate-400"
                      : isOnline
                        ? "text-emerald-400"
                        : "text-amber-400",
                  )}
                  title={statusTooltip}
                >
                  ● {!hasMe ? "Connecting" : isOnline ? "Live" : "Offline"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MerchantPendingBadge variant="mobile" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>
        </header>

        {/* ───── Mobile bottom nav ───── */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.06] bg-slate-950/95 backdrop-blur-xl md:hidden">
          {ALL_LINKS.map((l) => {
            const active =
              location === l.href ||
              (l.href !== "/merchant" && location.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-amber-300"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <l.icon className="h-[18px] w-[18px]" />
                {l.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>

        {/* ───── Main ───── */}
        <main className="flex-1 pb-24 pt-16 md:pb-0 md:pl-64 md:pt-0">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>

      <MerchantDepositNotifier />
      <MerchantWithdrawalNotifier />
    </div>
  );
}

function SidebarSection({
  label,
  links,
  location,
  className,
}: {
  label: string;
  links: typeof PRIMARY_LINKS;
  location: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </div>
      <div className="space-y-0.5">
        {links.map((l) => {
          const active =
            location === l.href ||
            (l.href !== "/merchant" && location.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent text-amber-200"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-white",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-yellow-300 to-amber-500" />
              )}
              <l.icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active
                    ? "text-amber-300"
                    : "text-slate-500 group-hover:text-slate-300",
                )}
              />
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
