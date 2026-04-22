import { useState, useEffect, useRef } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
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
function EmailVerifyStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (token: string, user: any) => void;
}) {
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    setSending(true);
    try {
      await apiFetch("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
      toast({ title: "Verification code sent!", description: `Check ${email} (and your spam folder).` });
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Initial OTP is already sent by the register endpoint — don't double-send.

  const handleVerify = async () => {
    if (otp.length < 6) return;
    setVerifying(true);
    try {
      const data = await apiFetch("/auth/verify-email-public", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      toast({ title: "Email verified!", description: "You earned 25 bonus points. Welcome aboard!" });
      onVerified(data.token, data.user);
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

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending}
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            {sending ? "Sending..." : "Didn't get the code? Resend"}
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
  const [referralLocked, setReferralLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");
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

  // Auto-fill referral code from URL (?ref=XXX) and switch to Sign Up mode.
  // The code is locked so users who arrived via a referral link cannot remove it.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = (params.get("ref") || params.get("referral") || "").trim().toUpperCase();
      if (ref) {
        setReferralCode(ref);
        setReferralLocked(true);
        setIsLogin(false);
        try { sessionStorage.setItem("qorix_ref", ref); } catch {}
      } else {
        // Fallback: persisted ref from earlier visit (e.g. user opened link, navigated, came back)
        try {
          const stored = sessionStorage.getItem("qorix_ref");
          if (stored) {
            setReferralCode(stored);
            setReferralLocked(true);
            setIsLogin(false);
          }
        } catch {}
      }
    } catch {}
  }, []);

  // Capture token from Google OAuth callback (?token=...) and bootstrap session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const errCode = params.get("error");
    if (errCode) {
      const map: Record<string, string> = {
        google_no_code: "Google did not return a code",
        google_token_failed: "Token exchange with Google failed",
        google_no_token: "No access token from Google",
        google_profile_failed: "Could not fetch Google profile",
        google_no_email: "Google account has no email",
        google_create_failed: "Account creation failed",
        google_callback_error: "Sign-in failed unexpectedly",
      };
      toast({ title: "Google sign-in failed", description: map[errCode] || errCode, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (token) {
      // Strip token from URL and fetch profile
      window.history.replaceState({}, "", window.location.pathname);
      fetch(`${import.meta.env.BASE_URL}api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Failed to load profile");
          const data = await r.json();
          setAuthData(token, data.user || data);
          setLocation(data.user?.isAdmin ? "/admin" : "/dashboard");
        })
        .catch((e) => {
          toast({ title: "Sign-in failed", description: e.message || "Could not load profile", variant: "destructive" });
        });
    }
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
      onSuccess: (_data: any) => {
        // IMPORTANT: do NOT log the user in here. The backend now requires
        // email OTP verification before issuing an auth token. We just move
        // to the OTP step using the email the user typed.
        setPendingVerifyEmail(email);
        setShowOtpStep(true);
        toast({
          title: "Check your email",
          description: `We sent a 6-digit code to ${email}. Enter it to finish creating your account.`,
        });
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
                email={pendingVerifyEmail}
                onVerified={(token, user) => {
                  setAuthData(token, user);
                  setLocation("/dashboard");
                }}
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

            {/* Forgot password (login mode only) */}
            {isLogin && (
              <div className="flex justify-end -mt-1">
                <Link href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

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
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={referralLocked ? "Referral Code (locked)" : "Referral Code (Optional)"}
                        value={referralCode}
                        onChange={(e) => { if (!referralLocked) setReferralCode(e.target.value.toUpperCase()); }}
                        readOnly={referralLocked}
                        className={`field-input ${referralLocked ? "pr-10 bg-emerald-500/5 border-emerald-500/30 text-emerald-300 cursor-not-allowed" : ""}`}
                      />
                      {referralLocked && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" title="Referral code locked from invite link">
                          <ShieldCheck style={{ width: 16, height: 16 }} />
                        </span>
                      )}
                    </div>
                    {referralLocked && (
                      <p className="text-[11px] text-emerald-400/80 mt-1.5 flex items-center gap-1">
                        <CheckCircle2 style={{ width: 11, height: 11 }} />
                        Invited by <span className="font-semibold tracking-wide">{referralCode}</span> — locked from your invite link.
                      </p>
                    )}
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

          {/* OR divider + Google OAuth */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or continue with</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = `${import.meta.env.BASE_URL}api/auth/google`; }}
              className="w-full inline-flex items-center justify-center gap-2.5 h-10 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-white font-medium text-sm border border-white/10 hover:border-white/20 active:scale-[0.99] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8L6.1 33C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
          </div>


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
