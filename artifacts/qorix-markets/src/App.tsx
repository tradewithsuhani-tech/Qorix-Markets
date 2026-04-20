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
import { useLocation } from "wouter";
import { useEffect } from "react";

import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import AdminLoginPage from "@/pages/admin-login";
import Dashboard from "@/pages/dashboard";
import WalletPage from "@/pages/wallet";
import DepositPage from "@/pages/deposit";
import InvestPage from "@/pages/invest";
import TransactionsPage from "@/pages/transactions";
import ReferralPage from "@/pages/referral";
import RewardsPage from "@/pages/rewards";
import AdminPage from "@/pages/admin";
import AdminIntelligencePage from "@/pages/admin-intelligence";
import AdminFraudPage from "@/pages/admin-fraud";
import SettingsPage from "@/pages/settings";
import AnalyticsPage from "@/pages/analytics";
import TradingDeskPage from "@/pages/trading-desk";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login"><PublicOnlyRoute component={LoginPage} /></Route>
      <Route path="/admin-login"><PublicOnlyRoute component={AdminLoginPage} adminRedirect={true} /></Route>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/deposit"><ProtectedRoute component={DepositPage} /></Route>
      <Route path="/invest"><ProtectedRoute component={InvestPage} /></Route>
      <Route path="/transactions"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/referral"><ProtectedRoute component={ReferralPage} /></Route>
      <Route path="/rewards"><ProtectedRoute component={RewardsPage} /></Route>
      <Route path="/analytics"><ProtectedRoute component={AnalyticsPage} /></Route>
      <Route path="/trading-desk"><ProtectedRoute component={TradingDeskPage} /></Route>
      <Route path="/admin"><ProtectedRoute component={AdminPage} adminOnly={true} /></Route>
      <Route path="/admin/intelligence"><ProtectedRoute component={AdminIntelligencePage} adminOnly={true} /></Route>
      <Route path="/admin/fraud"><ProtectedRoute component={AdminFraudPage} adminOnly={true} /></Route>
      <Route path="/admin/chats"><ProtectedRoute component={AdminChatsPage} adminOnly={true} /></Route>
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
