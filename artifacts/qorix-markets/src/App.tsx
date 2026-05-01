import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { SiteActivityToaster } from "@/components/site-activity-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LoginApprovalGate } from "@/components/login-approval-modal";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { SplashScreen, useSplash } from "@/components/splash-screen";
import { QorixAssistant } from "@/components/qorix-assistant";
import AdminChatsPage from "@/pages/admin-chats";
import AdminCommunicationPage from "@/pages/admin-communication";
import AdminContentPage from "@/pages/admin-content";
import AdminTestPage from "@/pages/admin-test";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import AdminLoginPage from "@/pages/admin-login";
import OauthQuizAuthorizePage from "@/pages/oauth-quiz-authorize";
import Dashboard from "@/pages/dashboard";
import WalletPage from "@/pages/wallet";
import DepositPage from "@/pages/deposit";
import InvestPage from "@/pages/invest";
import PortfolioPage from "@/pages/portfolio";
import TransactionsPage from "@/pages/transactions";
import ReferralPage from "@/pages/referral";
import RewardsPage from "@/pages/rewards";
import TasksPage from "@/pages/tasks";
import AdminPage from "@/pages/admin";
import AdminIntelligencePage from "@/pages/admin-intelligence";
import AdminFraudPage from "@/pages/admin-fraud";
import AdminPaymentMethodsPage from "@/pages/admin-payment-methods";
import AdminSubscriptionsPage from "@/pages/admin-subscriptions";
import AdminSubAdminsPage from "@/pages/admin-sub-admins";
import AdminMerchantsPage from "@/pages/admin-merchants";
import AdminEscalationContactsPage from "@/pages/admin-escalation-contacts";
import MerchantLoginPage from "@/pages/merchant-login";
import MerchantDashboardPage from "@/pages/merchant-dashboard";
import MerchantPaymentMethodsPage from "@/pages/merchant-payment-methods";
import MerchantDepositsPage from "@/pages/merchant-deposits";
import MerchantWithdrawalsPage from "@/pages/merchant-withdrawals";
import MerchantSettingsPage from "@/pages/merchant-settings";
import AdminTaskProofsPage from "@/pages/admin-task-proofs";
import AdminSignalTradesPage from "@/pages/admin-signal-trades";
import SignalHistoryPage from "@/pages/signal-history";
import SettingsPage from "@/pages/settings";
import DevicesPage from "@/pages/devices";
import KycPage from "@/pages/kyc";
import AdminKycPage from "@/pages/admin-kyc";
import {
  AdminAnalyticsPage,
  AdminHiddenFeaturesPage,
  AdminLogsPage,
  AdminSystemPage,
  AdminTradingPage,
  AdminTransactionsPage,
  AdminUsersPage,
  AdminWalletPage,
} from "@/pages/admin-modules";
import AnalyticsPage from "@/pages/analytics";
import TradingDeskPage from "@/pages/trading-desk";
import TradeActivityPage from "@/pages/trade-activity";
import VerifyPage from "@/pages/verify";
import MarketInsightsPage from "@/pages/market-insights";
import { HighImpactNotificationBanner } from "@/components/economic-news-widget";
import { UpdateBanner } from "@/components/update-banner";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import TermsPage from "@/pages/legal/terms";
import PrivacyPage from "@/pages/legal/privacy";
import RiskDisclosurePage from "@/pages/legal/risk-disclosure";
import AmlKycPage from "@/pages/legal/aml-kyc";

// Perf overhaul: tighten query-client defaults so we stop firing 50+
// requests on every render. Per-query polling (refetchInterval) still
// overrides these defaults for live dashboards / notifications, and
// mutation invalidations still force refetch regardless of staleTime.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache reads for 30s before considering them stale. Eliminates the
      // immediate refetch-on-mount thrash when navigating between pages.
      staleTime: 30_000,
      // Hold cached data for 5 min after the last subscriber unmounts so
      // navigating back is instant.
      gcTime: 5 * 60_000,
      // Tab-focus refetch caused random duplicate calls every time the user
      // alt-tabbed. Polling queries already keep their own cadence.
      refetchOnWindowFocus: false,
      // Skip refetch on remount if data is still fresh (within staleTime).
      refetchOnMount: false,
      // Faster failure for end users; one retry is enough for transient blips.
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ component: Component, adminOnly = false }: { component: any; adminOnly?: boolean }) => {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || !user) {
    setLocation(adminOnly ? "/admin-login" : "/");
    return null;
  }

  if (adminOnly && !user.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  return <Component />;
};

const PublicOnlyRoute = ({ component: Component, adminRedirect = false }: { component: any; adminRedirect?: boolean }) => {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && token && user) {
      setLocation(adminRedirect && user.isAdmin ? "/admin" : "/dashboard");
    }
  }, [isLoading, token, user, adminRedirect]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (token && user) return null;

  return <Component />;
};

function LandingOrRedirect() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    // If logged in, go to dashboard
    if (token && user) {
      setLocation(user.isAdmin ? "/admin" : "/dashboard");
      return;
    }
    // If running as installed PWA (standalone), skip landing → login
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari PWA
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setLocation("/login");
    }
  }, [isLoading, token, user]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  return <Landing />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingOrRedirect} />
      <Route path="/login"><PublicOnlyRoute component={LoginPage} /></Route>
      <Route path="/register"><PublicOnlyRoute component={LoginPage} /></Route>
      <Route path="/signup"><PublicOnlyRoute component={LoginPage} /></Route>
      <Route path="/forgot-password"><PublicOnlyRoute component={ForgotPasswordPage} /></Route>
      <Route path="/admin-login"><PublicOnlyRoute component={AdminLoginPage} adminRedirect={true} /></Route>
      {/* Qorix Play SSO bounce — handles its own auth state (logged-out users
          get parked at /login with a sessionStorage resume hook in
          AuthProvider). Deliberately NOT wrapped in ProtectedRoute so it
          can read query params and stash the resume URL before redirect. */}
      <Route path="/oauth/quiz/authorize" component={OauthQuizAuthorizePage} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      {/* Legacy /demo-dashboard URL → redirect to canonical /dashboard.
          The demo dashboard was promoted to be THE user dashboard; the old
          dashboard.tsx was removed. Keeping this redirect so any bookmarked
          or in-flight links don't 404. */}
      <Route path="/demo-dashboard">{() => { window.location.replace("/dashboard"); return null; }}</Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/deposit"><ProtectedRoute component={DepositPage} /></Route>
      <Route path="/invest"><ProtectedRoute component={InvestPage} /></Route>
      <Route path="/portfolio"><ProtectedRoute component={PortfolioPage} /></Route>
      <Route path="/transactions"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/referral"><ProtectedRoute component={ReferralPage} /></Route>
      <Route path="/rewards"><ProtectedRoute component={RewardsPage} /></Route>
      <Route path="/tasks"><ProtectedRoute component={TasksPage} /></Route>
      <Route path="/analytics"><ProtectedRoute component={AnalyticsPage} /></Route>
      <Route path="/trading-desk"><ProtectedRoute component={TradingDeskPage} /></Route>
      <Route path="/trade-activity"><ProtectedRoute component={TradeActivityPage} /></Route>
      <Route path="/signal-history"><ProtectedRoute component={SignalHistoryPage} /></Route>
      <Route path="/admin/signal-trades"><ProtectedRoute component={AdminSignalTradesPage} adminOnly={true} /></Route>
      <Route path="/admin"><ProtectedRoute component={AdminPage} adminOnly={true} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsersPage} adminOnly={true} /></Route>
      <Route path="/admin/deposits"><ProtectedRoute component={() => <AdminTransactionsPage mode="deposits" />} adminOnly={true} /></Route>
      <Route path="/admin/withdrawals"><ProtectedRoute component={() => <AdminTransactionsPage mode="withdrawals" />} adminOnly={true} /></Route>
      <Route path="/admin/trading"><ProtectedRoute component={AdminTradingPage} adminOnly={true} /></Route>
      <Route path="/admin/wallet"><ProtectedRoute component={AdminWalletPage} adminOnly={true} /></Route>
      <Route path="/admin/analytics"><ProtectedRoute component={AdminAnalyticsPage} adminOnly={true} /></Route>
      <Route path="/admin/system"><ProtectedRoute component={AdminSystemPage} adminOnly={true} /></Route>
      <Route path="/admin/logs"><ProtectedRoute component={AdminLogsPage} adminOnly={true} /></Route>
      <Route path="/admin/intelligence"><ProtectedRoute component={AdminIntelligencePage} adminOnly={true} /></Route>
      <Route path="/admin/fraud"><ProtectedRoute component={AdminFraudPage} adminOnly={true} /></Route>
      <Route path="/admin/payment-methods"><ProtectedRoute component={AdminPaymentMethodsPage} adminOnly={true} /></Route>
      <Route path="/admin/subscriptions"><ProtectedRoute component={AdminSubscriptionsPage} adminOnly={true} /></Route>
      <Route path="/admin/sub-admins"><ProtectedRoute component={AdminSubAdminsPage} adminOnly={true} /></Route>
      <Route path="/admin/merchants"><ProtectedRoute component={AdminMerchantsPage} adminOnly={true} /></Route>
      <Route path="/admin/escalation-contacts"><ProtectedRoute component={AdminEscalationContactsPage} adminOnly={true} /></Route>
      <Route path="/merchant/login" component={MerchantLoginPage} />
      <Route path="/merchant" component={MerchantDashboardPage} />
      <Route path="/merchant/methods" component={MerchantPaymentMethodsPage} />
      <Route path="/merchant/deposits" component={MerchantDepositsPage} />
      <Route path="/merchant/withdrawals" component={MerchantWithdrawalsPage} />
      <Route path="/merchant/settings" component={MerchantSettingsPage} />
      <Route path="/admin/task-proofs"><ProtectedRoute component={AdminTaskProofsPage} adminOnly={true} /></Route>
      <Route path="/admin/chats"><ProtectedRoute component={AdminChatsPage} adminOnly={true} /></Route>
      <Route path="/admin/communication"><ProtectedRoute component={AdminCommunicationPage} adminOnly={true} /></Route>
      <Route path="/admin/content"><ProtectedRoute component={AdminContentPage} adminOnly={true} /></Route>
      <Route path="/admin/test"><ProtectedRoute component={AdminTestPage} adminOnly={true} /></Route>
      <Route path="/admin/hidden-features"><ProtectedRoute component={AdminHiddenFeaturesPage} adminOnly={true} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
      <Route path="/devices"><ProtectedRoute component={DevicesPage} /></Route>
      <Route path="/kyc"><ProtectedRoute component={KycPage} /></Route>
      <Route path="/admin/kyc"><ProtectedRoute component={AdminKycPage} adminOnly={true} /></Route>
      <Route path="/verify/:hashId" component={VerifyPage} />
      <Route path="/verify" component={VerifyPage} />
      <Route path="/market-insights"><ProtectedRoute component={MarketInsightsPage} /></Route>
      <Route path="/legal/terms" component={TermsPage} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/legal/risk-disclosure" component={RiskDisclosurePage} />
      <Route path="/legal/aml-kyc" component={AmlKycPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [state, setState] = useState<{ on: boolean; msg: string }>({ on: false, msg: "" });

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}api/system/status`);
        if (!r.ok) return;
        const d = await r.json();
        // The full-screen overlay is reserved for the admin-toggled
        // `system_settings.maintenance_mode` flag (long planned outages).
        // The env-var `MAINTENANCE_MODE` (cutover) is shown via the lighter
        // inline `<MaintenanceBanner />` instead, so reads can keep rendering.
        const overlayActive = !!d.maintenance && !d.writesDisabled;
        if (!cancelled) setState({ on: overlayActive, msg: d.maintenanceMessage || "" });
      } catch { /* ignore */ }
    };
    fetchStatus();
    // Maintenance overlay flag flips rarely; 5-min cadence is plenty.
    // Bumped from 60s to drop one of the steady-state per-page polls.
    const id = setInterval(fetchStatus, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Admins always bypass; admin-login route always allowed (so admins can sign in)
  const allowedPath = location === "/admin-login";
  if (state.on && !user?.isAdmin && !allowedPath) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Under Maintenance</h1>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">{state.msg}</p>
          </div>
          <div className="text-xs text-white/40">Qorix Markets · Status will refresh automatically</div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AppContent() {
  const { showSplash, onSplashDone } = useSplash();
  const [location] = useLocation();
  const isAdminArea = location.startsWith("/admin");
  // Don't show the floating "High Impact" market alert on public/marketing
  // pages — it overlaps the hero on mobile and is only meaningful for
  // logged-in investors.
  const isPublicArea =
    location === "/" ||
    location === "" ||
    location.startsWith("/login") ||
    location.startsWith("/register") ||
    location.startsWith("/signup") ||
    location.startsWith("/forgot") ||
    location.startsWith("/reset") ||
    location.startsWith("/verify") ||
    location.startsWith("/auth") ||
    location.startsWith("/legal") ||
    location.startsWith("/terms") ||
    location.startsWith("/privacy") ||
    location.startsWith("/about") ||
    location.startsWith("/contact");

  return (
    <MaintenanceGate>
      {showSplash && <SplashScreen onDone={onSplashDone} />}
      <Router />
      {!isAdminArea && !isPublicArea && <HighImpactNotificationBanner />}
      {!isAdminArea && <QorixAssistant />}
      {!isAdminArea && <PWAInstallPrompt />}
      <UpdateBanner />
      <MaintenanceBanner />
    </MaintenanceGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppContent />
            <LoginApprovalGate />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
        {/* <SiteActivityToaster /> disabled per user request */}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

