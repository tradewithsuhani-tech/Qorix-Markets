import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  History, 
  Users, 
  ShieldAlert, 
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  X,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetInvestment } from "@workspace/api-client-react";

function ProtectionBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: investment } = useGetInvestment({ query: { refetchInterval: 10000 } });

  const isTriggered = investment?.isPaused && !investment?.isActive;
  if (!isTriggered || dismissed) return null;

  const drawdownPct = investment.amount > 0
    ? ((investment.drawdown / investment.amount) * 100).toFixed(2)
    : "0.00";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden shrink-0"
      >
        <div className="bg-red-500/10 border-b border-red-500/25 px-4 md:px-8 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <Shield style={{ width: 13, height: 13 }} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                <AlertTriangle style={{ width: 13, height: 13 }} />
                Capital Protection Triggered
              </span>
              <span className="text-xs text-muted-foreground">
                Trading paused — drawdown reached{" "}
                <span className="text-white font-medium">{drawdownPct}%</span>{" "}
                of your{" "}
                <span className="text-white font-medium">{investment.drawdownLimit}% limit</span>.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/invest"
              className="text-xs px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg font-medium transition-all"
            >
              Review
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-white transition-colors p-1 rounded"
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/invest", label: "Invest", icon: TrendingUp },
    { href: "/transactions", label: "History", icon: History },
    { href: "/referral", label: "Referrals", icon: Users },
    ...(user?.isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldAlert }] : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const mobileLinks = links.slice(0, 5);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary/30">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 glass-nav shrink-0">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white leading-none">
                Qorix<span className="text-blue-400">Markets</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase mt-0.5">
                Pro Terminal
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />
        
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {links.map((link) => {
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                  isActive 
                    ? "text-white" 
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-blue-500/10 border border-blue-500/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <link.icon className={cn(
                  "relative z-10 shrink-0 transition-colors",
                  isActive ? "text-blue-400" : "text-muted-foreground group-hover:text-white"
                )} style={{ width: 17, height: 17 }} />
                <span className="relative z-10">{link.label}</span>
                {isActive && (
                  <ChevronRight className="ml-auto relative z-10 text-blue-400" style={{ width: 13, height: 13 }} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />

        <div className="p-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
              {user?.fullName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.fullName}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <LogOut style={{ width: 15, height: 15 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ProtectionBanner />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav z-50 px-4 pt-2 bottom-nav-safe">
        <div className="flex justify-around items-center">
          {mobileLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className="relative flex flex-col items-center justify-center w-14 py-1.5"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-xl bg-blue-500/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-400"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                    style={{ boxShadow: "0 0 8px rgba(96,165,250,0.8)" }}
                  />
                )}
                <div className={cn(
                  "relative z-10 flex flex-col items-center gap-1 transition-all duration-200",
                  isActive ? "text-blue-400" : "text-muted-foreground"
                )}>
                  <link.icon style={{ width: 20, height: 20 }} />
                  <span className="text-[9px] font-medium leading-none">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
