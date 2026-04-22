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
import { useEffect } from "react";

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

function AppContent() {
  const { showSplash, onSplashDone } = useSplash();
  const [location] = useLocation();
  const isAdminArea = location.startsWith("/admin");

  return (
    <>
      {showSplash && <SplashScreen onDone={onSplashDone} />}
      <Router />
      {!isAdminArea && <HighImpactNotificationBanner />}
      {!isAdminArea && <QorixAssistant />}
      {!isAdminArea && <PWAInstallPrompt />}
    </>
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
