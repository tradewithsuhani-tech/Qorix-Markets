import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Store, Loader2 } from "lucide-react";
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
      toast({ title: `Welcome, ${res.merchant.fullName}` });
      navigate("/merchant");
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : String(err),
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
