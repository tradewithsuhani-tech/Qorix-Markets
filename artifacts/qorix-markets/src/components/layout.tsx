import React, { useState, useCallback, useEffect, useMemo } from "react";
import { initNotificationSound } from "@/lib/notification-sound";
import { useNotificationSoundOnNew } from "@/hooks/use-notification-sound";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { QorixLogo } from "@/components/qorix-logo";
import { motion, AnimatePresence, type Variants, type Transition } from "framer-motion";
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
  CheckCheck,
  MoreHorizontal,
  Briefcase,
  Brain,
  PieChart,
  Activity,
  MessageCircle,
  Globe,
  Trophy,
  Database,
  ListChecks,
  ClipboardCheck,
  Zap,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetInvestment,
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";
import { TODAY_EVENTS } from "@/lib/economic-calendar-data";

const NOTIF_ICONS: Record<string, React.ElementType> = {
  daily_profit: TrendingUp,
  monthly_payout: CalendarDays,
  drawdown_alert: AlertTriangle,
  deposit: ArrowDownCircle,
  withdrawal: ArrowUpCircle,
  system: Info,
  high_impact_news: Zap,
};

const NOTIF_COLORS: Record<string, string> = {
  daily_profit: "text-emerald-400",
  monthly_payout: "text-blue-400",
  drawdown_alert: "text-red-400",
  deposit: "text-emerald-400",
  withdrawal: "text-amber-400",
  system: "text-blue-400",
  high_impact_news: "text-red-400",
};

type AnyNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  __virtual?: boolean;
};

// Build virtual notification entries for upcoming high-impact events (next 4 hours).
// These are merged in client-side so users see news alerts in the bell list too.
function buildHighImpactVirtualNotifs(): AnyNotification[] {
  const now = Date.now();
  const window = 4 * 60 * 60 * 1000; // next 4h
  return TODAY_EVENTS.filter(
    (e) => e.impact === "high" && e.timeMs > now && e.timeMs - now < window,
  )
    .slice(0, 3)
    .map((e, i) => {
      const minsAway = Math.max(1, Math.round((e.timeMs - now) / 60000));
      const when = minsAway < 60
        ? `in ${minsAway}m`
        : `in ${Math.floor(minsAway / 60)}h ${minsAway % 60}m`;
      return {
        id: -1000 - i, // negative ids never collide with server ids
        type: "high_impact_news",
        title: "High Impact News",
        message: `${e.flag} ${e.currency} · ${e.event} ${when} (${e.time})`,
        isRead: false,
        createdAt: new Date().toISOString(),
        __virtual: true,
      };
    });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Exness-style absolute date: "16 Apr 2026, 19:08"
function formatNotifDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function groupByMonth<T extends { createdAt: string }>(items: T[]): [string, T[]][] {
  const groups: Record<string, T[]> = {};
  const order: string[] = [];
  for (const it of items) {
    const d = new Date(it.createdAt);
    const key = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(it);
  }
  return order.map((k) => [k, groups[k]]);
}

function haptic(pattern: number | number[] = 10) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function NotificationPanel({ onClose, variant }: { onClose: () => void; variant: "mobile" | "desktop" }) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetNotifications(
    { limit: 20 },
    { query: { refetchInterval: 30000 } }
  );
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });

  const handleMarkRead = (id: number) => markRead.mutate({ id }, { onSuccess: invalidate });
  const handleMarkAll = () => markAll.mutate(undefined, { onSuccess: invalidate });
  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    del.mutate({ id }, { onSuccess: invalidate });
  };

  // Merge in virtual high-impact news entries so they appear at the top of the bell list.
  // Re-evaluate every minute so the "in Xm" text stays fresh while the panel is open.
  const [newsTick, setNewsTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNewsTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const virtualNews = useMemo(
    () => buildHighImpactVirtualNotifs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newsTick],
  );
  const serverNotifs = (data?.notifications ?? []) as AnyNotification[];
  const notifications: AnyNotification[] = [...virtualNews, ...serverNotifs];
  const unread = (data?.unreadCount ?? 0) + virtualNews.length;
  const isMobile = variant === "mobile";
  const grouped = groupByMonth(notifications);

  // -------- MOBILE: Exness-style FULL-SCREEN page --------
  if (isMobile) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 z-[80] bg-[#050816] flex flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Header: X close + title (left), Mark as read (right) */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-1 -ml-1 text-white" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
            <span className="text-base font-semibold text-white">Notifications</span>
          </div>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-sm text-blue-400 font-medium px-2 py-1 active:opacity-60"
            >
              Mark as read
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Bell className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-base text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            grouped.map(([month, items]) => (
              <div key={month}>
                <div className="px-4 pt-5 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  {month}
                </div>
                {items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                    className="flex items-start justify-between gap-3 px-4 py-4 border-b border-white/5 active:bg-white/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-base font-semibold leading-snug",
                        n.isRead ? "text-muted-foreground" : "text-white"
                      )}>
                        {n.title}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="text-xs text-muted-foreground/60 mt-2">
                        {formatNotifDate(n.createdAt)}
                      </div>
                    </div>
                    {!n.isRead && (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-2" />
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </motion.div>
    );
  }

  // -------- DESKTOP: anchored dropdown (unchanged) --------
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="z-50 rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 overflow-hidden absolute left-0 bottom-full mb-2 w-[20rem] max-w-[calc(100vw-1.5rem)]"
      style={{ backdropFilter: "blur(20px)" }}
    >
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
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto">
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
                      <span className={cn("text-xs font-semibold leading-tight", n.isRead ? "text-muted-foreground" : "text-white")}>
                        {n.title}
                      </span>
                      <button
                        onClick={(e) => handleDelete(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-white transition-all shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NotificationBell({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const { data } = useGetNotifications(
    { limit: 1, unread: "true" },
    { query: { refetchInterval: 30000 } }
  );
  const unread = data?.unreadCount ?? 0;

  return (
    <>
      {/* Backdrop — dims the page and closes the panel on tap/click anywhere outside.
          Visible dim + blur so user clearly sees that the rest of the screen is "behind" the panel. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            // Mobile (<md): backdrop starts BELOW top bar so logo + bell stay visible.
            // Desktop (md+): full inset, lighter dim.
            className="fixed left-0 right-0 bottom-0 z-40 bg-black/55 backdrop-blur-sm md:inset-0 md:bg-black/30"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
            onClick={() => setOpen(false)}
            onTouchStart={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <div className="relative z-50">
        <button
          onClick={() => { setOpen((p) => !p); haptic(8); }}
          className={cn(
            "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
            open ? "bg-blue-500/15 border border-blue-500/30 text-blue-400" : "text-muted-foreground hover:text-white hover:bg-white/8 border border-transparent"
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
          {open && <NotificationPanel onClose={() => setOpen(false)} variant={variant} />}
        </AnimatePresence>
      </div>
    </>
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
            <Link href="/invest" className="text-xs px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg font-medium transition-all">
              Review
            </Link>
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-white transition-colors p-1 rounded">
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function MoreSheet({
  open,
  onClose,
  links,
  location,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string; icon: React.ElementType }[];
  location: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="more-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0d1525] border-t border-white/10 overflow-hidden"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-4 mb-4" />
            <div className="px-4 pb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">More</p>
              <div className="space-y-1">
                {links.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <button
                      key={link.href}
                      onClick={() => { onNavigate(link.href); haptic(10); }}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                          : "text-muted-foreground hover:text-white hover:bg-white/5"
                      )}
                    >
                      <link.icon style={{ width: 18, height: 18 }} className={isActive ? "text-blue-400" : "text-muted-foreground"} />
                      {link.label}
                      {isActive && <ChevronRight style={{ width: 13, height: 13 }} className="ml-auto text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const pageTransition: Transition = {
  type: "tween",
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: 0.25,
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { logout, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdminArea = location.startsWith("/admin");
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 60000, enabled: !isAdminArea } });
  const vipTier = (summary?.vip?.tier ?? "none") as "none" | "silver" | "gold" | "platinum";

  // Notification sound: arm WebAudio on first user gesture; play tone when a new notif arrives.
  useEffect(() => { initNotificationSound(); }, []);
  useNotificationSoundOnNew();

  const userLinks = [
    { href: "/demo-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/invest", label: "Trade", icon: TrendingUp, featured: true },
    { href: "/portfolio", label: "Portfolio", icon: PieChart },
    { href: "/deposit", label: "Deposit", icon: ArrowDownCircle },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/market-insights", label: "Market Insights", icon: Globe },
    { href: "/trading-desk", label: "Trading Desk", icon: Briefcase },
    { href: "/trade-activity", label: "Trade Activity", icon: Activity },
    { href: "/transactions", label: "History", icon: History },
    { href: "/referral", label: "Referrals", icon: Users },
    { href: "/rewards", label: "Promotions", icon: Trophy },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/deposits", label: "Deposits", icon: ArrowDownCircle },
    { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
    { href: "/admin/payment-methods", label: "INR / Payments", icon: Landmark },
    { href: "/admin/trading", label: "Trading", icon: TrendingUp },
    { href: "/admin/signal-trades", label: "Signal Trades", icon: Activity },
    { href: "/admin/wallet", label: "Wallet", icon: Wallet },
    { href: "/admin/intelligence", label: "Intelligence", icon: Brain },
    { href: "/admin/communication", label: "Communication", icon: Bell },
    { href: "/admin/content", label: "Content", icon: Globe },
    { href: "/admin/system", label: "System", icon: Settings },
    { href: "/admin/logs", label: "Logs", icon: Database },
    { href: "/admin/fraud", label: "Fraud Monitor", icon: Shield },
    { href: "/admin/chats", label: "Support Chats", icon: MessageCircle },
    { href: "/admin/task-proofs", label: "Task Proofs", icon: ClipboardCheck },
  ];

  const allLinks = isAdminArea ? adminLinks : userLinks;

  const primaryNavLinks = allLinks.slice(0, 4);
  const overflowLinks = allLinks.slice(4);
  const isMoreActive = overflowLinks.some((l) => l.href === location);

  const handleMoreNavigate = useCallback((href: string) => {
    navigate(href);
    setMoreOpen(false);
  }, [navigate]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 glass-nav shrink-0">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              <QorixLogo size={36} />
            </div>
            <div className="leading-none">
              <div className="text-[22px] font-extrabold tracking-tight leading-none">
                <span className="text-white">Qorix</span>
                <span
                  style={{
                    background: "linear-gradient(90deg,#38bdf8,#818cf8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Markets
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold tracking-[0.28em] uppercase mt-1.5">
                Pro Terminal
              </div>
            </div>
          </div>
        </div>
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {allLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                  isActive ? "text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
                onClick={() => haptic(8)}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-blue-500/10 border border-blue-500/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <link.icon className={cn("relative z-10 shrink-0 transition-colors", isActive ? "text-blue-400" : "text-muted-foreground group-hover:text-white")} style={{ width: 17, height: 17 }} />
                <span className="relative z-10">{link.label}</span>
                {isActive && <ChevronRight className="ml-auto relative z-10 text-blue-400" style={{ width: 13, height: 13 }} />}
              </Link>
            );
          })}
        </nav>
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />
        <div className="p-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
              {isAdminArea ? "A" : user?.fullName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-medium text-white truncate">{isAdminArea ? "Qorix Admin" : user?.fullName}</div>
                {!isAdminArea && <VipBadge tier={vipTier} size="xs" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">{isAdminArea ? "Admin Console" : user?.email}</div>
            </div>
            {!isAdminArea && <NotificationBell variant="desktop" />}
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
        {!isAdminArea && <ProtectionBanner />}

        {/* Mobile top bar — relative + z-[60] so logo + bell stay ABOVE the notification backdrop (z-40)
            and panel (z-50). Solid bg ensures dim never bleeds through. */}
        <div className="md:hidden relative z-[60] flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
            background: "#050816",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
              <QorixLogo size={32} />
            </div>
            <span className="text-sm font-bold text-white">
              Qorix<span className="text-blue-400">Markets</span>
            </span>
            {!isAdminArea && <VipBadge tier={vipTier} size="xs" />}
          </div>
          {!isAdminArea && <NotificationBell variant="mobile" />}
        </div>

        {/* Page content with transitions.
            Mobile bottom clearance is enforced by an EXPLICIT spacer div inside the children
            (see <MobileBottomSpacer /> below) — far more reliable than padding-bottom on the
            scroll container, which some pages were bypassing. */}
        <div className="flex-1 overflow-y-auto scroll-smooth-ios">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <div className="p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                  {children}
                </div>
              </div>
              {/* Hard spacer: clears BOTH the bottom-nav pill AND the chat FAB
                  that floats above it on mobile, plus 24px breathing room.
                  Driven by --mobile-bottom-clearance so the nav/FAB geometry
                  lives in exactly one place (see index.css). Zero on desktop. */}
              <div
                aria-hidden
                className="md:hidden w-full"
                style={{ height: "var(--mobile-bottom-clearance)" }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav — pill with floating Trade FAB on top */}
      <nav
        className="md:hidden fixed bottom-3 left-3 right-3 z-50"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.5rem)" }}
      >
        {/* Solid background layer — no mask hacks, works on every browser */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-3xl border border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.45)] pointer-events-none"
          style={{
            background: "rgba(13, 21, 37, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        />
        <div className="relative flex justify-around items-end px-2 pt-2">
          {primaryNavLinks.map((link) => {
            const isActive = location === link.href;
            const featured = (link as { featured?: boolean }).featured;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex flex-col items-center justify-center w-14 py-1.5"
                onClick={() => haptic(10)}
              >
                {isActive && !featured && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-xl bg-blue-500/10"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
                  />
                )}
                {isActive && !featured && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-400"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
                    style={{ boxShadow: "0 0 8px rgba(96,165,250,0.9)" }}
                  />
                )}
                {featured ? (
                  <div className="relative z-10 flex flex-col items-center" style={{ marginTop: "-26px" }}>
                    {/* Floating FAB-style Trade button */}
                    <motion.div
                      className="relative"
                      animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                      whileTap={{ scale: 0.92 }}
                      transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                    >
                      {/* Outer pulsing glow ring (subtle) */}
                      <motion.div
                        className="absolute inset-0 rounded-full bg-blue-500/25"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                        style={{ filter: "blur(5px)" }}
                      />
                      {/* Subtle brand-blue ring */}
                      <div
                        className="absolute -inset-[1.5px] rounded-full"
                        style={{
                          background: "linear-gradient(160deg, #60a5fa 0%, #3b82f6 50%, #1e3a8a 100%)",
                        }}
                      />
                      {/* Inner button — brand blue tones */}
                      <div
                        className="relative flex items-center justify-center w-14 h-14 rounded-full text-white"
                        style={{
                          background:
                            "radial-gradient(circle at 35% 30%, #5b8def 0%, #3b82f6 45%, #1e40af 100%)",
                          boxShadow:
                            "0 6px 16px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.10) inset, 0 -1px 4px rgba(255,255,255,0.12) inset",
                        }}
                      >
                        {/* Glossy highlight */}
                        <div
                          className="absolute inset-x-2 top-1.5 h-3 rounded-full opacity-60 pointer-events-none"
                          style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))",
                            filter: "blur(2px)",
                          }}
                        />
                        <link.icon style={{ width: 24, height: 24, position: "relative" }} strokeWidth={2.75} />
                      </div>
                    </motion.div>
                    <span
                      className={cn(
                        "mt-1 text-[10px] font-extrabold leading-none tracking-[0.08em] uppercase",
                        isActive ? "text-blue-200" : "text-blue-300",
                      )}
                      style={{ textShadow: "0 0 8px rgba(96,165,250,0.6)" }}
                    >
                      {link.label}
                    </span>
                  </div>
                ) : (
                  <motion.div
                    className={cn("relative z-10 flex flex-col items-center gap-1 transition-colors duration-200", isActive ? "text-blue-400" : "text-muted-foreground")}
                    animate={isActive ? { scale: 1.08 } : { scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                  >
                    <link.icon style={{ width: 20, height: 20 }} />
                    <span className="text-[9px] font-medium leading-none">{link.label}</span>
                  </motion.div>
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => { setMoreOpen(true); haptic(10); }}
            className="relative flex flex-col items-center justify-center w-14 py-1.5"
          >
            {isMoreActive && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-0 rounded-xl bg-blue-500/10"
                transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
              />
            )}
            {isMoreActive && (
              <motion.div
                layoutId="bottom-nav-indicator"
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-400"
                transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
                style={{ boxShadow: "0 0 8px rgba(96,165,250,0.9)" }}
              />
            )}
            <div className={cn("relative z-10 flex flex-col items-center gap-1", isMoreActive ? "text-blue-400" : "text-muted-foreground")}>
              <MoreHorizontal style={{ width: 20, height: 20 }} />
              <span className="text-[9px] font-medium leading-none">More</span>
            </div>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        links={overflowLinks}
        location={location}
        onNavigate={handleMoreNavigate}
      />
    </div>
  );
}
