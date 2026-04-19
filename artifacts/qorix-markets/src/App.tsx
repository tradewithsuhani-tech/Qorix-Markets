import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import WalletPage from "@/pages/wallet";
import InvestPage from "@/pages/invest";
import TransactionsPage from "@/pages/transactions";
import ReferralPage from "@/pages/referral";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) => {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="h-screen w-full bg-background flex items-center justify-center">Loading...</div>;

  if (!token || !user) {
    setLocation("/");
    return null;
  }

  if (adminOnly && !user.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  return <Component />;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/wallet"><ProtectedRoute component={WalletPage} /></Route>
      <Route path="/invest"><ProtectedRoute component={InvestPage} /></Route>
      <Route path="/transactions"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/referral"><ProtectedRoute component={ReferralPage} /></Route>
      <Route path="/admin"><ProtectedRoute component={AdminPage} adminOnly={true} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
