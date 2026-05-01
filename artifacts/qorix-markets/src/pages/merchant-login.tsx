import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
  setMerchantToken,
} from "@/lib/merchant-auth-fetch";
import { GoldButton, StatusPill } from "@/components/merchant-ui";

interface LoginResponse {
  token: string;
  merchant: { id: number; email: string; fullName: string; phone: string | null };
}

export default function MerchantLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Eye toggle — lets the merchant peek at what they typed without
  // committing the password to the DOM (state stays local to this page).
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDisabledBanner, setShowDisabledBanner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("disabled") === "1";
  });

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
      setShowDisabledBanner(false);
      toast({ title: `Welcome, ${res.merchant.fullName}` });
      navigate("/merchant");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/disabled/i.test(msg)) setShowDisabledBanner(true);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 text-slate-100"
      style={{ backgroundColor: "#0a0d12" }}
    >
      {/* Ambient gradient backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[500px] w-[500px] rounded-full bg-amber-500/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.05] blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Left: brand showcase (desktop only) */}
        <div className="hidden flex-col justify-between rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900/60 to-slate-950/40 p-10 backdrop-blur-sm lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_6px_20px_-4px_rgba(252,213,53,0.5)]">
                <span className="text-xl font-black text-slate-950">Q</span>
              </div>
              <div className="leading-tight">
                <div className="text-lg font-bold text-white">Qorix Merchant</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  Operator Console
                </div>
              </div>
            </div>

            <h2 className="mt-12 text-3xl font-bold leading-tight tracking-tight text-white">
              Premium INR settlement,
              <br />
              built for serious volume.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Approve deposits, settle withdrawals, and manage your UPI / bank
              channels from a single console. Real-time alerts, live wallet
              status, and one-click actions — built to keep your turnaround under
              the 10-minute SLA.
            </p>

            <div className="mt-10 space-y-3">
              <FeatureLine
                icon={<ShieldCheck className="h-4 w-4" />}
                text="Verified merchant network · 2FA-ready"
              />
              <FeatureLine
                icon={<Lock className="h-4 w-4" />}
                text="Encrypted transport · audit-logged actions"
              />
            </div>
          </div>

          <div className="mt-12 flex items-center gap-3 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500">
            <StatusPill variant="success" pulse>
              All systems operational
            </StatusPill>
            <span>·</span>
            <span>SLA 99.97%</span>
          </div>
        </div>

        {/* Right: login card */}
        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_4px_16px_-2px_rgba(252,213,53,0.5)]">
              <span className="text-base font-black text-slate-950">Q</span>
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-white">Qorix Merchant</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Operator Console
              </div>
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <h3 className="text-2xl font-bold tracking-tight text-white">Sign in</h3>
            <p className="mt-1 text-sm text-slate-400">
              Use the credentials provided by the platform admin.
            </p>
          </div>

          {showDisabledBanner && (
            <div
              className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-200"
              data-testid="merchant-disabled-banner"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div className="leading-snug">
                <div className="font-semibold text-rose-100">
                  Account disabled by admin
                </div>
                <div className="mt-0.5 text-rose-200/90">
                  Sign-in will start working again as soon as the admin
                  re-enables your account — please contact them. Your password
                  has not changed.
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 pl-10 text-sm text-white placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="merchant@qorixmarkets.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="••••••••"
                />
                {/* Eye toggle. type="button" so it can't accidentally
                    submit the form. tabIndex=-1 so keyboard users tab
                    straight from password to Sign In, with the eye as
                    a click-only convenience. aria-label flips with the
                    state for screen readers. */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:text-amber-300 hover:bg-white/[0.04] transition"
                  data-testid="merchant-login-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <GoldButton type="submit" disabled={submitting} className="w-full py-2.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </GoldButton>
          </form>

          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-[11px] text-slate-500">
            Accounts are issued by the platform admin.
            <br />
            No self-signup · No password reset.
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-slate-300">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-amber-300">
        {icon}
      </div>
      {text}
    </div>
  );
}
