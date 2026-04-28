import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Store, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
  setMerchantToken,
} from "@/lib/merchant-auth-fetch";

interface LoginResponse {
  token: string;
  merchant: { id: number; email: string; fullName: string; phone: string | null };
}

export default function MerchantLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // `?disabled=1` is set by merchant-auth-fetch when the SPA gets booted off
  // mid-session because the admin disabled this merchant. Sticky local state
  // (not just a URL read) so it persists if the user navigates within the
  // login screen, and `?disabledNow=1` is set on the *current* login attempt
  // when the backend returns ACCOUNT_DISABLED — covers the case where the
  // merchant was disabled BEFORE they even loaded the page.
  const [showDisabledBanner, setShowDisabledBanner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("disabled") === "1";
  });

  // If already logged in, jump straight to dashboard. Cheap UX win — avoids
  // a re-login prompt on accidental page refresh while a token is valid.
  useEffect(() => {
    if (getMerchantToken()) navigate("/merchant");
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Email and password required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await merchantAuthFetch<LoginResponse>(merchantApiUrl("/merchant/auth/login"), {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setMerchantToken(res.token);
      // Successful login wipes the stale "you were disabled" banner — the
      // admin clearly re-enabled the account, so leaving it up would be
      // confusing.
      setShowDisabledBanner(false);
      toast({ title: `Welcome, ${res.merchant.fullName}` });
      navigate("/merchant");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Backend returns the exact "Your merchant account is disabled…"
      // message verbatim for ACCOUNT_DISABLED. Promote it from a quick toast
      // to the persistent in-form banner so the merchant cannot miss it
      // (and so they don't burn through the right password thinking it's
      // wrong, the way the original bug report described).
      if (/disabled/i.test(msg)) {
        setShowDisabledBanner(true);
      }
      toast({
        title: "Login failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <Store className="h-7 w-7 text-amber-400" />
          <div>
            <div className="text-lg font-semibold">Merchant Panel</div>
            <div className="text-xs text-slate-400">Qorix Markets</div>
          </div>
        </div>
        {showDisabledBanner && (
          <div
            className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs text-red-200 flex items-start gap-2"
            data-testid="merchant-disabled-banner"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <div className="leading-snug">
              <div className="font-semibold text-red-100">Account disabled by admin</div>
              <div className="mt-0.5 text-red-200/90">
                Your merchant account has been disabled by the platform admin and you have been signed out.
                Sign-in will start working again as soon as the admin re-enables your account — please contact
                them. Your password has not changed.
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="merchant@qorixmarkets.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-medium px-4 py-2 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </button>
        </form>
        <div className="mt-6 text-xs text-slate-500 text-center">
          Accounts are created by the platform admin.
          <br />
          No self-signup, no password reset.
        </div>
      </div>
    </div>
  );
}
