import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings as SettingsIcon,
  LogOut,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearMerchantToken,
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";
import { useQuery } from "@tanstack/react-query";

interface MeResponse {
  merchant: {
    id: number;
    email: string;
    fullName: string;
    phone: string | null;
    isActive: boolean;
  } | null;
}

const links = [
  { href: "/merchant", label: "Dashboard", icon: LayoutDashboard },
  { href: "/merchant/methods", label: "Payment Methods", icon: Landmark },
  { href: "/merchant/deposits", label: "INR Deposits", icon: ArrowDownCircle },
  { href: "/merchant/withdrawals", label: "INR Withdrawals", icon: ArrowUpCircle },
  { href: "/merchant/settings", label: "Settings", icon: SettingsIcon },
];

export function MerchantLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  // Bounce to login if no token. Done in an effect so SSR (if ever added)
  // doesn't crash on missing localStorage.
  useEffect(() => {
    if (!getMerchantToken()) {
      navigate("/merchant/login");
    }
  }, [navigate]);

  const { data, isError } = useQuery<MeResponse>({
    queryKey: ["merchant-me"],
    queryFn: () => merchantAuthFetch<MeResponse>(merchantApiUrl("/merchant/me")),
    enabled: Boolean(getMerchantToken()),
    retry: false,
    staleTime: 60_000,
  });

  // Server says 401 / token rejected → useQuery throws → isError. Bounce.
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 border-r border-slate-800">
          <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
            <Store className="h-6 w-6 text-amber-400" />
            <div>
              <div className="text-sm font-semibold">Qorix Merchant</div>
              <div className="text-xs text-slate-400">Operator Panel</div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {links.map((l) => {
              const active = location === l.href || (l.href !== "/merchant" && location.startsWith(l.href));
              return (
                <Link key={l.href} href={l.href}>
                  <a
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </a>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-800 px-4 py-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Signed in</div>
              <div className="text-sm font-medium truncate">{merchant?.fullName ?? "—"}</div>
              <div className="text-xs text-slate-400 truncate">{merchant?.email ?? ""}</div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-sm">Merchant Panel</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900 border-t border-slate-800 grid grid-cols-5">
          {links.map((l) => {
            const active = location === l.href || (l.href !== "/merchant" && location.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href}>
                <a
                  className={cn(
                    "flex flex-col items-center justify-center py-2 text-[10px] gap-0.5",
                    active ? "text-amber-300" : "text-slate-400",
                  )}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label.split(" ")[0]}
                </a>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
