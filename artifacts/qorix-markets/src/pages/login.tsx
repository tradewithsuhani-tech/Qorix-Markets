import { useState, useEffect, useRef } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Lock, Mail, User as UserIcon, ArrowLeft, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { QorixLogo } from "@/components/qorix-logo";
import { useToast } from "@/hooks/use-toast";
import { Recaptcha, CAPTCHA_ENABLED } from "@/components/recaptcha";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
function getToken() { try { return localStorage.getItem("qorix_token"); } catch { return null; } }
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Request failed"), { data, status: res.status });
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Email OTP verification step (shown after successful registration)
// ────────────────────────────────────────────────────────────────────────────
function EmailVerifyStep({ onSkip, onVerified }: { onSkip: () => void; onVerified: () => void }) {
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    setSending(true);
    try {
      await apiFetch("/auth/send-otp", { method: "POST" });
      setOtpSent(true);
      toast({ title: "Verification code sent!", description: "Check your email inbox." });
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { sendOtp(); }, []);

  const handleVerify = async () => {
    if (otp.length < 6) return;
    setVerifying(true);
    try {
      await apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ otp }) });
      toast({ title: "Email verified!", description: "You earned 25 bonus points. Welcome aboard!" });
      onVerified();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto">
          <Mail className="h-7 w-7 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to your email. Enter it below to earn 25 bonus points.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="field-input text-center text-2xl font-mono tracking-[0.3em]"
          autoFocus
        />

        <button
          onClick={handleVerify}
          disabled={verifying || otp.length < 6}
          className="btn btn-primary w-full"
        >
          {verifying ? "Verifying..." : "Verify Email"}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending}
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            {sending ? "Sending..." : "Resend code"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Skip for now →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main login/register page
// ────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageLoadTime = useRef<number>(Date.now());

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
    pageLoadTime.current = Date.now();
    return () => { if (autoHideTimer.current) clearTimeout(autoHideTimer.current); };
  }, []);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuthData(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuthData(data.token, data.user);
        // Show email OTP verification step
        setShowOtpStep(true);
      },
      onError: (err: any) => {
        const msg = err.message || "Something went wrong";
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (CAPTCHA_ENABLED && !captchaToken) {
      toast({ title: "Please complete the captcha", variant: "destructive" });
      return;
    }

    if (isLogin) {
      loginMutation.mutate({ data: { email, password, captchaToken } as any });
    } else {
      registerMutation.mutate({
        data: {
          email,
          password,
          fullName,
          referralCode: referralCode || undefined,
          captchaToken,
          _hp: "",            // honeypot — must be empty (bots fill this)
          _plt: pageLoadTime.current.toString(), // page load time for bot timing check
        } as any,
      });
    }
    // Turnstile tokens are single-use; widget will auto-refresh via callback
    setCaptchaToken("");
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const canSubmit = !isPending && (!CAPTCHA_ENABLED || !!captchaToken);

  // ── OTP verification step ──
  if (showOtpStep) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-2xl p-7">
            <AnimatePresence mode="wait">
              <EmailVerifyStep
                onSkip={() => setLocation("/dashboard")}
                onVerified={() => setLocation("/dashboard")}
              />
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Back link */}
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
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_22px_rgba(59,130,246,0.38)]">
            <QorixLogo size={48} />
          </div>
          <span className="text-xl font-bold">Qorix<span className="text-primary font-light">Markets</span></span>
        </div>

        <div className="glass-card rounded-2xl p-7 space-y-6">
          {/* Heading */}
          <div className="text-center space-y-1">
            <AnimatePresence mode="wait">
              <motion.h1
                key={isLogin ? "login" : "register"}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="text-2xl font-bold tracking-tight"
              >
                {isLogin ? "Welcome back" : "Create account"}
              </motion.h1>
            </AnimatePresence>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Sign in to access your trading terminal." : "Start automated USD trading today."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* ── Honeypot field — hidden from real users, bots fill it ── */}
            <input
              type="text"
              name="_hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
              value=""
              readOnly
            />

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="relative pb-0.5">
                    <UserIcon
                      style={{ width: 15, height: 15 }}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="field-input field-input-icon-left"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="relative">
              <Mail
                style={{ width: 15, height: 15 }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
              />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input field-input-icon-left"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock
                style={{ width: 15, height: 15 }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
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

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="pb-0.5">
                    <input
                      type="text"
                      placeholder="Referral Code (Optional)"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="field-input"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {CAPTCHA_ENABLED && (
              <div className="pt-1">
                <Recaptcha
                  onVerify={(t) => setCaptchaToken(t)}
                  onExpire={() => setCaptchaToken("")}
                />
              </div>
            )}

            <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full mt-1">
              {isPending ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Security badge on registration */}
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Protected by anti-fraud security · Email verification required
            </motion.div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-semibold">
              {isLogin ? "Register now" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
