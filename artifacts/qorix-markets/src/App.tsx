import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
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
import Dashboard from "@/pages/dashboard";
import WalletPage from "@/pages/wallet";
import DepositPage from "@/pages/deposit";
import InvestPage from "@/pages/invest";
import TransactionsPage from "@/pages/transactions";
import ReferralPage from "@/pages/referral";
import RewardsPage from "@/pages/rewards";
import TasksPage from "@/pages/tasks";
import AdminPage from "@/pages/admin";
import AdminIntelligencePage from "@/pages/admin-intelligence";
import AdminFraudPage from "@/pages/admin-fraud";
import AdminTaskProofsPage from "@/pages/admin-task-proofs";
import AdminSignalTradesPage from "@/pages/admin-signal-trades";
import SignalHistoryPage from "@/pages/signal-history";
import SettingsPage from "@/pages/settings";
import KycPage from "@/pages/kyc";
import AdminKycPage from "@/pages/admin-kyc";
import {
  AdminAnalyticsPage,
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
import TermsPage from "@/pages/legal/terms";
import PrivacyPage from "@/pages/legal/privacy";
import RiskDisclosurePage from "@/pages/legal/risk-disclosure";
import AmlKycPage from "@/pages/legal/aml-kyc";

const queryClient = new QueryClient();

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
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/deposit"><ProtectedRoute component={DepositPage} /></Route>
      <Route path="/invest"><ProtectedRoute component={InvestPage} /></Route>
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
      <Route path="/admin/task-proofs"><ProtectedRoute component={AdminTaskProofsPage} adminOnly={true} /></Route>
      <Route path="/admin/chats"><ProtectedRoute component={AdminChatsPage} adminOnly={true} /></Route>
      <Route path="/admin/communication"><ProtectedRoute component={AdminCommunicationPage} adminOnly={true} /></Route>
      <Route path="/admin/content"><ProtectedRoute component={AdminContentPage} adminOnly={true} /></Route>
      <Route path="/admin/test"><ProtectedRoute component={AdminTestPage} adminOnly={true} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
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
        if (!cancelled) setState({ on: !!d.maintenance, msg: d.maintenanceMessage || "" });
      } catch { /* ignore */ }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
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

  return (
    <MaintenanceGate>
      {showSplash && <SplashScreen onDone={onSplashDone} />}
      <Router />
      {!isAdminArea && <HighImpactNotificationBanner />}
      {!isAdminArea && <QorixAssistant />}
      {!isAdminArea && <PWAInstallPrompt />}
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
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
