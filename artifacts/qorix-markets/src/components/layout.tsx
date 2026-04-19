import React, { useState, useRef, useEffect } from "react";
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
  AlertTriangle,
  BarChart2,
  Bell,
  BellDot,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Info,
  CheckCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetInvestment,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";

const NOTIF_ICONS: Record<string, React.ElementType> = {
  daily_profit: TrendingUp,
  monthly_payout: CalendarDays,
  drawdown_alert: AlertTriangle,
  deposit: ArrowDownCircle,
  withdrawal: ArrowUpCircle,
  system: Info,
};

const NOTIF_COLORS: Record<string, string> = {
  daily_profit: "text-emerald-400",
  monthly_payout: "text-blue-400",
  drawdown_alert: "text-red-400",
  deposit: "text-emerald-400",
  withdrawal: "text-amber-400",
  system: "text-blue-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetNotifications(
    { limit: 20 },
    { query: { refetchInterval: 30000 } }
  );
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, { onSuccess: invalidate });
  };
  const handleMarkAll = () => {
    markAll.mutate(undefined, { onSuccess: invalidate });
  };
  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    del.mutate({ id }, { onSuccess: invalidate });
  };

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 overflow-hidden"
      style={{ backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unread > 0 && (
            <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((n) => {
              const Icon = NOTIF_ICONS[n.type] ?? Info;
              const color = NOTIF_COLORS[n.type] ?? "text-blue-400";
              return (
                <motion.div
                  key={n.id}
                  layout
                  className={cn(
                    "group flex gap-3 px-4 py-3 cursor-pointer transition-colors",
                    n.isRead ? "hover:bg-white/3" : "bg-blue-500/5 hover:bg-blue-500/8"
                  )}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    n.isRead ? "bg-white/5" : "bg-blue-500/10 border border-blue-500/20"
                  )}>
                    <Icon className={cn("w-4 h-4", n.isRead ? "text-muted-foreground" : color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className={cn(
                        "text-xs font-semibold leading-tight",
                        n.isRead ? "text-muted-foreground" : "text-white"
                      )}>
                        {n.title}
                      </span>
                      <button
                        onClick={(e) => handleDelete(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-white transition-all shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {!n.isRead && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useGetNotifications(
    { limit: 1, unread: "true" },
    { query: { refetchInterval: 30000 } }
  );
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
          open
            ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
            : "text-muted-foreground hover:text-white hover:bg-white/8 border border-transparent"
        )}
      >
        {unread > 0 ? <BellDot className="w-4.5 h-4.5" /> : <Bell className="w-4.5 h-4.5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold bg-blue-500 text-white rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && <NotificationPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

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
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
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
            <NotificationBell />
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

        {/* Mobile top bar with notifications */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">Qorix<span className="text-blue-400">Markets</span></span>
          </div>
          <NotificationBell />
        </div>

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
