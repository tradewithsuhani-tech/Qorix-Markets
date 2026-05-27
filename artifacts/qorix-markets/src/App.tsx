import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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
import { HighImpactNotificationBanner } from "@/components/economic-news-widget";
import { UpdateBanner } from "@/components/update-banner";
import { MaintenanceBanner } from "@/components/maintenance-banner";
// All pages are lazy-loaded so the browser only downloads the chunk needed for
// the current route. This converts the single 3.4 MB bundle into small parallel
// chunks that load in ~400 KB instead of all-at-once.
const Landing = lazy(() => import("@/pages/marketing/home"));
const LoginPage = lazy(() => import("@/pages/login"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const AdminLoginPage = lazy(() => import("@/pages/admin-login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const DepositPage = lazy(() => import("@/pages/deposit"));
const DepositUpiPage = lazy(() => import("@/pages/deposit-upi"));
const DepositUpiPayPage = lazy(() => import("@/pages/deposit-upi-pay"));
const DepositNetBankingPage = lazy(() => import("@/pages/deposit-netbanking"));
const DepositNetBankingDetailsPage = lazy(() => import("@/pages/deposit-netbanking-details"));
const DepositVerifyPage = lazy(() => import("@/pages/deposit-verify"));
const DepositCryptoPage = lazy(() => import("@/pages/deposit-crypto"));
const DepositSuccessPage = lazy(() => import("@/pages/deposit-success"));
const WithdrawPage = lazy(() => import("@/pages/withdraw"));
const WithdrawUsdtPage = lazy(() => import("@/pages/withdraw-usdt"));
const WithdrawInrPage = lazy(() => import("@/pages/withdraw-inr"));
const WithdrawUserTransferPage = lazy(() => import("@/pages/withdraw-user-transfer"));
const WithdrawReviewPage = lazy(() => import("@/pages/withdraw-review"));
const WithdrawOtpPage = lazy(() => import("@/pages/withdraw-otp"));
const WithdrawSuccessPage = lazy(() => import("@/pages/withdraw-success"));
const InvestPage = lazy(() => import("@/pages/invest"));
const SelfTradePage = lazy(() => import("@/pages/self-trade"));
const UsdtMarketPage = lazy(() => import("@/pages/usdt-market"));
const PortfolioPage = lazy(() => import("@/pages/portfolio"));
const TransactionsPage = lazy(() => import("@/pages/transactions"));
const ReferralPage = lazy(() => import("@/pages/referral"));
const RewardsPage = lazy(() => import("@/pages/rewards"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const AdminPage = lazy(() => import("@/pages/admin"));
const AdminIntelligencePage = lazy(() => import("@/pages/admin-intelligence"));
const AdminFraudPage = lazy(() => import("@/pages/admin-fraud"));
const AdminPaymentMethodsPage = lazy(() => import("@/pages/admin-payment-methods"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/admin-subscriptions"));
const AdminSubAdminsPage = lazy(() => import("@/pages/admin-sub-admins"));
const AdminMerchantsPage = lazy(() => import("@/pages/admin-merchants"));
const AdminEscalationContactsPage = lazy(() => import("@/pages/admin-escalation-contacts"));
const MerchantLoginPage = lazy(() => import("@/pages/merchant-login"));
const MerchantDashboardPage = lazy(() => import("@/pages/merchant-dashboard"));
const MerchantPaymentMethodsPage = lazy(() => import("@/pages/merchant-payment-methods"));
const MerchantDepositsPage = lazy(() => import("@/pages/merchant-deposits"));
const MerchantWithdrawalsPage = lazy(() => import("@/pages/merchant-withdrawals"));
const MerchantSettingsPage = lazy(() => import("@/pages/merchant-settings"));
const AdminTaskProofsPage = lazy(() => import("@/pages/admin-task-proofs"));
const AdminSignalTradesPage = lazy(() => import("@/pages/admin-signal-trades"));
const SignalHistoryPage = lazy(() => import("@/pages/signal-history"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const DevicesPage = lazy(() => import("@/pages/devices"));
const KycPage = lazy(() => import("@/pages/kyc"));
const AdminKycPage = lazy(() => import("@/pages/admin-kyc"));
const AdminP2pDisputesPage = lazy(() => import("@/pages/admin-p2p-disputes"));
const AdminP2pPage = lazy(() => import("@/pages/admin-p2p"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminAnalyticsPage })));
const AdminHiddenFeaturesPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminHiddenFeaturesPage })));
const AdminLogsPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminLogsPage })));
const AdminSystemPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminSystemPage })));
const AdminTradingPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminTradingPage })));
const AdminTransactionsPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminTransactionsPage })));
const AdminUsersPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminUsersPage })));
const AdminWalletPage = lazy(() => import("@/pages/admin-modules").then(m => ({ default: m.AdminWalletPage })));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const TradingDeskPage = lazy(() => import("@/pages/trading-desk"));
const TradeActivityPage = lazy(() => import("@/pages/trade-activity"));
const VerifyPage = lazy(() => import("@/pages/verify"));
const MarketInsightsPage = lazy(() => import("@/pages/market-insights"));
const TermsPage = lazy(() => import("@/pages/legal/terms"));
const PrivacyPage = lazy(() => import("@/pages/legal/privacy"));
const RiskDisclosurePage = lazy(() => import("@/pages/legal/risk-disclosure"));
const AmlKycPage = lazy(() => import("@/pages/legal/aml-kyc"));
const RegulationPage = lazy(() => import("@/pages/legal/regulation"));
const AboutPage = lazy(() => import("@/pages/marketing/about"));
const ContactPage = lazy(() => import("@/pages/marketing/contact"));
const PartnersPage = lazy(() => import("@/pages/marketing/partners"));
const AiTradingPage = lazy(() => import("@/pages/marketing/ai-trading"));
const ZeroFeePage = lazy(() => import("@/pages/marketing/zero-fee"));
const LowInvestmentPage = lazy(() => import("@/pages/marketing/low-investment"));
const BlogIndexPage = lazy(() => import("@/pages/marketing/blog-index"));
const BlogPostPage = lazy(() => import("@/pages/marketing/blog-post"));
const P2PMarketPage = lazy(() => import("@/pages/p2p-market"));
const P2PCreateAdPage = lazy(() => import("@/pages/p2p-create-ad"));
const P2POrdersPage = lazy(() => import("@/pages/p2p-orders"));
const P2PPaymentMethodsPage = lazy(() => import("@/pages/p2p-payment-methods"));
const P2PMyAdsPage = lazy(() => import("@/pages/p2p-my-ads"));
const P2PPlaceOrderPage = lazy(() => import("@/pages/p2p-place-order"));
const P2POrderDetailPage = lazy(() => import("@/pages/p2p-order-detail"));
const P2PSellFlowPage = lazy(() => import("@/pages/p2p-sell-flow"));
const P2PChatPage = lazy(() => import("@/pages/p2p-chat"));
const P2PUserCenterPage = lazy(() => import("@/pages/p2p-user-center"));
const AdminChatsPage = lazy(() => import("@/pages/admin-chats"));
const AdminCommunicationPage = lazy(() => import("@/pages/admin-communication"));
const AdminContentPage = lazy(() => import("@/pages/admin-content"));
const AdminBlogPage = lazy(() => import("@/pages/admin-blog"));
const AdminTestPage = lazy(() => import("@/pages/admin-test"));
const AdminRoiLogPage = lazy(() => import("@/pages/admin-roi-log"));

function OfflineScreen() {
  const [dots, setDots] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 600);
    return () => clearInterval(id);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <>
      <style>{`
        @keyframes qx-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes qx-pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes qx-grid-fade { 0%,100%{opacity:.03} 50%{opacity:.07} }
        @keyframes qx-orb1 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(40px,-30px)} 66%{transform:translate(-20px,20px)} }
        @keyframes qx-orb2 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-50px,20px)} 66%{transform:translate(30px,-40px)} }
        @keyframes qx-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .qx-float { animation: qx-float 3.5s ease-in-out infinite; }
        .qx-ring { animation: qx-pulse-ring 2s ease-out infinite; }
        .qx-ring-2 { animation: qx-pulse-ring 2s ease-out infinite .7s; }
        .qx-grid { animation: qx-grid-fade 4s ease-in-out infinite; }
        .qx-orb1 { animation: qx-orb1 12s ease-in-out infinite; }
        .qx-orb2 { animation: qx-orb2 15s ease-in-out infinite; }
        .qx-shimmer-text {
          background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 40%, #38bdf8 60%, #60a5fa 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: qx-shimmer 3s linear infinite;
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#060912]">

        {/* Ambient orbs */}
        <div className="qx-orb1 absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />
        <div className="qx-orb2 absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)" }} />

        {/* Subtle grid */}
        <div className="qx-grid absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />

        {/* Card */}
        <div className="relative flex flex-col items-center gap-8 px-10 py-12 text-center max-w-sm w-full mx-6"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "24px",
            backdropFilter: "blur(24px)",
            boxShadow: "0 0 0 1px rgba(59,130,246,0.08), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>

          {/* Top accent line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(99,179,250,0.6), transparent)" }} />

          {/* Icon with pulse rings */}
          <div className="qx-float relative flex items-center justify-center w-24 h-24">
            {/* Pulse rings */}
            <div className="qx-ring absolute inset-0 rounded-full border border-blue-500/30" />
            <div className="qx-ring-2 absolute inset-0 rounded-full border border-blue-500/20" />
            {/* Icon container */}
            <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.10))",
                border: "1px solid rgba(99,179,250,0.2)",
                boxShadow: "0 0 30px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ stroke: "url(#qx-grad)", filter: "drop-shadow(0 0 8px rgba(99,179,250,0.5))" }}>
                <defs>
                  <linearGradient id="qx-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#60a5fa"/>
                    <stop offset="100%" stopColor="#a78bfa"/>
                  </linearGradient>
                </defs>
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="qx-shimmer-text">Connection Lost</span>
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Your trading session is paused. Qorix Markets requires a live connection to protect your portfolio.
            </p>
          </div>

          {/* Reconnecting status */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div className="flex gap-1">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{ background: dots > i ? "#60a5fa" : "rgba(99,179,250,0.2)" }} />
              ))}
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(99,179,250,0.7)" }}>
              Monitoring connection
            </span>
          </div>

          {/* Retry button */}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="relative w-full py-3 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-200 disabled:opacity-60"
            style={{
              background: retrying
                ? "rgba(59,130,246,0.3)"
                : "linear-gradient(135deg, #2563eb, #4f46e5)",
              boxShadow: retrying ? "none" : "0 0 20px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
              border: "1px solid rgba(99,179,250,0.2)",
            }}>
            {retrying ? "Reconnecting…" : "Retry Connection"}
          </button>

          {/* Brand footer */}
          <div className="flex items-center gap-2 mt-1">
            <div className="w-4 h-4 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}>
              <span className="text-[7px] font-black text-white">Q</span>
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>Qorix Markets</span>
          </div>
        </div>
      </div>
    </>
  );
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return isOnline;
}

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
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      {/* Legacy /demo-dashboard URL → redirect to canonical /dashboard.
          The demo dashboard was promoted to be THE user dashboard; the old
          dashboard.tsx was removed. Keeping this redirect so any bookmarked
          or in-flight links don't 404. */}
      <Route path="/demo-dashboard">{() => { window.location.replace("/dashboard"); return null; }}</Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/deposit"><ProtectedRoute component={DepositPage} /></Route>
      <Route path="/deposit/upi"><ProtectedRoute component={DepositUpiPage} /></Route>
      <Route path="/deposit/upi/pay"><ProtectedRoute component={DepositUpiPayPage} /></Route>
      <Route path="/deposit/netbanking"><ProtectedRoute component={DepositNetBankingPage} /></Route>
      <Route path="/deposit/netbanking/details"><ProtectedRoute component={DepositNetBankingDetailsPage} /></Route>
      <Route path="/deposit/verify"><ProtectedRoute component={DepositVerifyPage} /></Route>
      <Route path="/deposit/crypto"><ProtectedRoute component={DepositCryptoPage} /></Route>
      <Route path="/deposit/success"><ProtectedRoute component={DepositSuccessPage} /></Route>
      <Route path="/withdraw"><ProtectedRoute component={WithdrawPage} /></Route>
      <Route path="/withdraw/usdt"><ProtectedRoute component={WithdrawUsdtPage} /></Route>
      <Route path="/withdraw/inr"><ProtectedRoute component={WithdrawInrPage} /></Route>
      <Route path="/withdraw/user-transfer"><ProtectedRoute component={WithdrawUserTransferPage} /></Route>
      <Route path="/withdraw/review"><ProtectedRoute component={WithdrawReviewPage} /></Route>
      <Route path="/withdraw/otp"><ProtectedRoute component={WithdrawOtpPage} /></Route>
      <Route path="/withdraw/success"><ProtectedRoute component={WithdrawSuccessPage} /></Route>
      <Route path="/invest"><ProtectedRoute component={InvestPage} /></Route>
      <Route path="/self-trade"><ProtectedRoute component={SelfTradePage} /></Route>
      <Route path="/usdt-market"><ProtectedRoute component={UsdtMarketPage} /></Route>
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
      <Route path="/admin/p2p"><ProtectedRoute component={AdminP2pPage} adminOnly={true} /></Route>
      <Route path="/admin/p2p-disputes"><ProtectedRoute component={AdminP2pDisputesPage} adminOnly={true} /></Route>
      <Route path="/admin"><ProtectedRoute component={AdminPage} adminOnly={true} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsersPage} adminOnly={true} /></Route>
      <Route path="/admin/deposits"><ProtectedRoute component={() => <AdminTransactionsPage mode="deposits" />} adminOnly={true} /></Route>
      <Route path="/admin/withdrawals"><ProtectedRoute component={() => <AdminTransactionsPage mode="withdrawals" />} adminOnly={true} /></Route>
      <Route path="/admin/trading"><ProtectedRoute component={AdminTradingPage} adminOnly={true} /></Route>
      <Route path="/admin/wallet"><ProtectedRoute component={AdminWalletPage} adminOnly={true} /></Route>
      <Route path="/admin/roi-log"><ProtectedRoute component={AdminRoiLogPage} adminOnly={true} /></Route>
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
      <Route path="/admin/blog"><ProtectedRoute component={AdminBlogPage} adminOnly={true} /></Route>
      <Route path="/admin/test"><ProtectedRoute component={AdminTestPage} adminOnly={true} /></Route>
      <Route path="/admin/hidden-features"><ProtectedRoute component={AdminHiddenFeaturesPage} adminOnly={true} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
      <Route path="/devices"><ProtectedRoute component={DevicesPage} /></Route>
      <Route path="/kyc"><ProtectedRoute component={KycPage} /></Route>
      <Route path="/admin/kyc"><ProtectedRoute component={AdminKycPage} adminOnly={true} /></Route>
      <Route path="/verify/:hashId" component={VerifyPage} />
      <Route path="/verify" component={VerifyPage} />
      <Route path="/market-insights"><ProtectedRoute component={MarketInsightsPage} /></Route>
      <Route path="/p2p"><ProtectedRoute component={P2PMarketPage} /></Route>
      <Route path="/p2p/create-ad"><ProtectedRoute component={P2PCreateAdPage} /></Route>
      <Route path="/p2p/orders"><ProtectedRoute component={P2POrdersPage} /></Route>
      <Route path="/p2p/payment-methods"><ProtectedRoute component={P2PPaymentMethodsPage} /></Route>
      <Route path="/p2p/ads/my"><ProtectedRoute component={P2PMyAdsPage} /></Route>
      <Route path="/p2p/order/:id"><ProtectedRoute component={P2PPlaceOrderPage} /></Route>
      <Route path="/p2p/orders/:id"><ProtectedRoute component={P2POrderDetailPage} /></Route>
      <Route path="/p2p/sell/:adId"><ProtectedRoute component={P2PSellFlowPage} /></Route>
      <Route path="/p2p/chat"><ProtectedRoute component={P2PChatPage} /></Route>
      <Route path="/p2p/user-center"><ProtectedRoute component={P2PUserCenterPage} /></Route>
      <Route path="/legal/terms" component={TermsPage} />
      <Route path="/legal/privacy" component={PrivacyPage} />
      <Route path="/legal/risk-disclosure" component={RiskDisclosurePage} />
      <Route path="/legal/aml-kyc" component={AmlKycPage} />
      <Route path="/legal/regulation" component={RegulationPage} />
      {/* SEO marketing routes (public, indexable) */}
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/partners" component={PartnersPage} />
      <Route path="/ai-trading-platform" component={AiTradingPage} />
      <Route path="/zero-trading-fee" component={ZeroFeePage} />
      <Route path="/low-investment-trading" component={LowInvestmentPage} />
      <Route path="/blog" component={BlogIndexPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      {/* Clean-URL aliases for the existing legal pages so /privacy and
          /terms (the URLs that show up in sitemaps and footers) resolve
          without a redirect hop. */}
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
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

  // GA4 page-view tracking on every wouter location change. The helper
  // is a no-op when VITE_GA_MEASUREMENT_ID is not configured.
  useEffect(() => {
    import("@/lib/analytics").then(({ trackPageView }) => trackPageView(location));
  }, [location]);
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
    location.startsWith("/contact") ||
    location.startsWith("/partners") ||
    location.startsWith("/blog") ||
    location.startsWith("/ai-trading-platform") ||
    location.startsWith("/zero-trading-fee") ||
    location.startsWith("/low-investment-trading");

  return (
    <MaintenanceGate>
      {showSplash && <SplashScreen onDone={onSplashDone} />}
      <Suspense fallback={
        <div className="h-screen w-full bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }>
        <Router />
      </Suspense>
      {!isAdminArea && !isPublicArea && <HighImpactNotificationBanner />}
      {!isAdminArea && <QorixAssistant guestMode={isPublicArea} hideTrigger={isPublicArea} />}
      {!isAdminArea && <PWAInstallPrompt />}
      <UpdateBanner />
      <MaintenanceBanner />
    </MaintenanceGate>
  );
}

function App() {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return <OfflineScreen />;
  }

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

