import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CaptchaWidget,
  CAPTCHA_ENABLED,
  type CaptchaWidgetHandle,
} from "@/components/captcha-widget";
import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recaptchaRef = useRef<CaptchaWidgetHandle | null>(null);
  const { login: setAuthData } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleTogglePassword = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    if (!showPassword) {
      setShowPassword(true);
      autoHideTimer.current = setTimeout(() => setShowPassword(false), 3000);
    } else {
      setShowPassword(false);
    }
  };

  useEffect(() => {
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  // We bypass the codegen `useLogin` hook here for the same reason
  // login.tsx does: the /auth/login response is a discriminated union
  // (token+user OR requires2FA+twoFactorToken OR requiresApproval+...)
  // AND the request body now requires `captchaToken` after the B9.6
  // captcha rollout, which the codegen `LoginBody` type doesn't expose.
  // Direct fetch keeps both halves honest without an `as any` cast.
  const submitLogin = async () => {
    setSubmitting(true);
    try {
      const data = await authFetch<any>(apiUrl("/auth/login"), {
        method: "POST",
        body: JSON.stringify({ email, password, captchaToken }),
      });

      // 2FA-enabled admins can't finish here — the regular /login page
      // owns the TOTP / backup-code / email-fallback UI. Bounce them
      // there so they don't get stuck on the captcha-only form.
      if (data?.requires2FA) {
        toast({
          title: "Use the main login page",
          description:
            "Your account has Two-Factor Auth enabled. Sign in via the regular login.",
          variant: "destructive",
        });
        setLocation("/login");
        return;
      }

      if (!data?.user || !data.user.isAdmin) {
        toast({
          title: "Admin access only",
          description: "This login is only for admin accounts.",
          variant: "destructive",
        });
        return;
      }

      setAuthData(data.token, data.user);
      setLocation("/admin");
    } catch (err: any) {
      toast({
        title: "Admin login failed",
        description: err?.message || "Invalid admin credentials",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      // Captcha tokens (Turnstile + reCAPTCHA v2) are single-use. Clear
      // local copy and reset the widget so the admin can re-submit
      // immediately after a failed attempt without a full page reload.
      // Idempotent on the success-redirect path.
      setCaptchaToken("");
      recaptchaRef.current?.reset();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (CAPTCHA_ENABLED && !captchaToken) {
      toast({
        title: "Please complete the captcha",
        variant: "destructive",
      });
      return;
    }
    void submitLogin();
  };

  const canSubmit =
    !submitting && (!CAPTCHA_ENABLED || !!captchaToken);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-blue-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-indigo-600/8 rounded-full blur-[110px] pointer-events-none" />

      <button
        onClick={() => setLocation("/")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft style={{ width: 15, height: 15 }} />
        Back to home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.42)] mb-4">
            <ShieldCheck style={{ width: 25, height: 25 }} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-2">Secure control panel login for Qorix administrators only.</p>
        </div>

        <div className="glass-card rounded-2xl p-7 space-y-6 border border-blue-500/20">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail
                style={{ width: 15, height: 15 }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
              />
              <input
                type="email"
                required
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input field-input-icon-left"
              />
            </div>

            <div className="relative">
              <Lock
                style={{ width: 15, height: 15 }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input field-input-icon-both"
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors z-10"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>

            {CAPTCHA_ENABLED && (
              <div className="flex justify-center pt-1">
                <CaptchaWidget
                  ref={recaptchaRef}
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken("")}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Checking access…" : "Enter Admin Panel"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
