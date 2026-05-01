import { useState, useEffect, useRef } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Lock, Mail, User as UserIcon, ArrowLeft, Eye, EyeOff, ShieldCheck, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { QorixLogo } from "@/components/qorix-logo";
import qorixPlayLogo from "@/assets/qorix-play-logo.png";
import { useToast } from "@/hooks/use-toast";
import {
  CaptchaWidget,
  CAPTCHA_ENABLED,
  type CaptchaWidgetHandle,
} from "@/components/captcha-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
async function apiFetch(path: string, options: RequestInit = {}) {
  return authFetch(apiUrl(path), options);
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
// Awaiting-approval step (single-active-device login)
// Shown when the backend says another device currently owns the account.
// We poll /auth/login-attempts/:id/status every 3s; once the active device
// hits Approve we receive the JWT and call onSuccess. If 60s elapse with
// no answer we surface the email-OTP fallback so the user isn't stuck.
// ────────────────────────────────────────────────────────────────────────────
function AwaitingApprovalStep({
  info,
  onSuccess,
  onCancel,
}: {
  info: {
    attemptId: number;
    pollToken: string;
    expiresAt: string;
    otpFallbackAfterMs: number;
    device: { browser: string; os: string };
  };
  onSuccess: (token: string, user: any) => void;
  onCancel: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(info.expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [otpAvailable, setOtpAvailable] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const { toast } = useToast();
  const startedAt = useRef(Date.now());

  // The parent passes inline arrow functions for onSuccess/onCancel, so
  // their identity changes on every render. Stash them in refs so the
  // poll effect below doesn't tear down + recreate its setTimeout chain
  // every time the parent re-renders (which would also restart the
  // 3-second poll interval, hammering the API).
  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  // Tick the visible countdown + reveal the OTP fallback option once the
  // server's fallback window has elapsed.
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      if (Date.now() - startedAt.current >= info.otpFallbackAfterMs) setOtpAvailable(true);
    }, 1000);
    return () => clearInterval(t);
  }, [info.otpFallbackAfterMs]);

  // Poll the status endpoint. As soon as the active device approves, we
  // receive a one-shot JWT and complete the login.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const data = await apiFetch(
          `/auth/login-attempts/${info.attemptId}/status?pollToken=${encodeURIComponent(info.pollToken)}`,
        );
        if (cancelled) return;
        if (data.status === "approved" && data.token) {
          onSuccessRef.current(data.token, data.user);
          return;
        }
        if (data.status === "denied") {
          setDenied(true);
          return;
        }
        if (data.status === "expired") {
          toast({ title: "Login request expired", description: "Please try signing in again.", variant: "destructive" });
          onCancelRef.current();
          return;
        }
      } catch {
        // Network blip — just retry on next tick.
      } finally {
        if (!cancelled) timer = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Intentionally only depend on the stable IDs — callbacks are read
    // through refs (above) so the poll loop survives parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.attemptId, info.pollToken]);

  const requestOtp = async () => {
    setBusy(true);
    try {
      await apiFetch(`/auth/login-attempts/${info.attemptId}/request-otp`, {
        method: "POST",
        body: JSON.stringify({ pollToken: info.pollToken }),
      });
      setOtpRequested(true);
      toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
    } catch (err: any) {
      toast({ title: "Could not send code", description: err.message || "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const verifyOtpAndLogin = async () => {
    if (otp.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch(`/auth/login-attempts/${info.attemptId}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ pollToken: info.pollToken, otp }),
      });
      if (data?.token && data?.user) onSuccess(data.token, data.user);
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message || "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-7 space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Confirm sign-in on your other device</h2>
            <p className="text-sm text-muted-foreground">
              For your security, your account can only be active on one device at a time.
              We've sent a request to your other device — tap <strong>Approve</strong> there to continue.
            </p>
          </div>

          {denied ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-center space-y-3">
              <p className="font-medium text-rose-200">Sign-in was denied on your other device.</p>
              <p className="text-rose-200/80">If this wasn't you, change your password right away.</p>
              <Button variant="outline" size="sm" onClick={onCancel}>Back to login</Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-center text-muted-foreground">
                This device: {info.device.browser} on {info.device.os}
              </div>

              {!otpRequested ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Waiting for approval…</span>
                  </div>
                  {otpAvailable ? (
                    <div className="space-y-2">
                      <p className="text-xs text-center text-muted-foreground">
                        Other device not responding? Get a code by email instead.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={requestOtp}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code to my email"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-center text-muted-foreground">
                      Email backup will become available in {Math.max(0, Math.ceil((info.otpFallbackAfterMs - (Date.now() - startedAt.current)) / 1000))}s
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-lg tracking-widest"
                  />
                  <Button className="w-full" onClick={verifyOtpAndLogin} disabled={busy || otp.length !== 6}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm sign-in"}
                  </Button>
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={busy}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    Resend code
                  </button>
                </div>
              )}

              <div className="text-xs text-center text-muted-foreground">
                Request expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Two-Factor prompt step (shown after successful password when user has 2FA on)
// ────────────────────────────────────────────────────────────────────────────
interface TwoFactorVerifySuccess {
  // Success path — same shape as a normal /auth/login success
  token?: string;
  user?: any;
  // OR the device-fingerprint pending-approval branch
  requiresApproval?: boolean;
  attemptId?: number;
  pollToken?: string;
  expiresAt?: string;
  otpFallbackAfterMs?: number;
  device?: { browser: string; os: string };
}

function TwoFactorPromptStep({
  twoFactorToken,
  onSuccess,
  onCancel,
}: {
  twoFactorToken: string;
  onSuccess: (data: TwoFactorVerifySuccess) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 4-mode state machine for the 2FA step:
  //   • "totp"    — default; show authenticator-app code input
  //   • "chooser" — fallback picker (after the user clicks "Switch to
  //                 Another Verification Method"); offers Backup Code OR
  //                 Email Verification Code
  //   • "backup"  — XXXX-XXXX one-time backup code input
  //   • "email"   — 6-digit code we mailed to the user's registered address
  // Backend `/auth/2fa/login-verify` accepts all three (TOTP/backup share
  // the existing path; "email" sends `mode: "email_otp"` and we mailed the
  // code via `/auth/2fa/email-fallback/request`).
  const [verifyMode, setVerifyMode] = useState<"totp" | "chooser" | "backup" | "email">("totp");
  // Email-fallback bookkeeping
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const { toast } = useToast();

  // Resend-cooldown ticker — counts down once per second after we send an
  // email. Disables the Resend button so users can't hammer the endpoint.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Per-mode input handler. TOTP/email strip non-digits and cap at 6;
  // backup uppercases, strips non-alphanumerics, auto-inserts the dash
  // after 4 chars, and caps at 9 (XXXX-XXXX).
  const handleCodeChange = (raw: string) => {
    if (verifyMode === "backup") {
      const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      const formatted = cleaned.length > 4
        ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
        : cleaned;
      setCode(formatted);
    } else {
      // totp + email both want 6 digits
      setCode(raw.replace(/\D/g, "").slice(0, 6));
    }
  };

  // Request a fresh email OTP from the backend. Used both for the initial
  // "Email me a code" choice and for the "Resend" button on the email
  // input screen.
  const requestEmailCode = async () => {
    if (requestingEmail || resendCooldown > 0) return;
    setRequestingEmail(true);
    try {
      const data = await apiFetch("/auth/2fa/email-fallback/request", {
        method: "POST",
        body: JSON.stringify({ twoFactorToken }),
      });
      setMaskedEmail(data?.email || "");
      setVerifyMode("email");
      setCode("");
      setResendCooldown(45); // 45s before user can resend again
      toast({
        title: "Code sent",
        description: data?.email
          ? `Check ${data.email} for the 6-digit code.`
          : "Check your registered email for the 6-digit code.",
      });
    } catch (err: any) {
      toast({
        title: "Could not send email",
        description: err.message || "Please try again or use a backup code.",
        variant: "destructive",
      });
    } finally {
      setRequestingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast({
        title:
          verifyMode === "backup"
            ? "Enter your backup code"
            : verifyMode === "email"
              ? "Enter the email code"
              : "Enter your 6-digit code",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const body: { twoFactorToken: string; code: string; mode?: "email_otp" } = {
        twoFactorToken,
        code: trimmed,
      };
      if (verifyMode === "email") body.mode = "email_otp";
      const data = await apiFetch("/auth/2fa/login-verify", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSuccess(data);
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message || "Please check your code and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Mode-switch helpers ───────────────────────────────────────────────
  const goToChooser = () => {
    setVerifyMode("chooser");
    setCode("");
  };
  const goToTotp = () => {
    setVerifyMode("totp");
    setCode("");
  };
  const goToBackup = () => {
    setVerifyMode("backup");
    setCode("");
  };

  // ─── Render: chooser step ──────────────────────────────────────────────
  if (verifyMode === "chooser") {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-2xl p-7">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-300 mb-3">
                <ShieldCheck style={{ width: 28, height: 28 }} />
              </div>
              <h2 className="text-xl font-semibold">Choose a Verification Method</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Can't access your authenticator app? Pick one of the options below to finish signing in.
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Backup code */}
              <button
                type="button"
                onClick={goToBackup}
                className="w-full text-left p-4 rounded-xl bg-amber-500/8 border border-amber-500/25 hover:bg-amber-500/12 hover:border-amber-500/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 p-2 rounded-lg bg-amber-500/15 text-amber-400">
                    <KeyRound style={{ width: 20, height: 20 }} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-amber-100">Use a Backup Code</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Enter one of the XXXX-XXXX codes you saved when enabling 2FA.
                    </div>
                  </div>
                  <div className="shrink-0 text-amber-400/60 group-hover:text-amber-400 transition-colors text-lg">›</div>
                </div>
              </button>

              {/* Option 2: Email OTP */}
              <button
                type="button"
                onClick={requestEmailCode}
                disabled={requestingEmail}
                className="w-full text-left p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/25 hover:bg-cyan-500/12 hover:border-cyan-500/40 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 p-2 rounded-lg bg-cyan-500/15 text-cyan-300">
                    {requestingEmail ? (
                      <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
                    ) : (
                      <Mail style={{ width: 20, height: 20 }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-cyan-100">
                      {requestingEmail ? "Sending code…" : "Email me a verification code"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      We'll send a 6-digit one-time code to your registered email address.
                    </div>
                  </div>
                  {!requestingEmail && (
                    <div className="shrink-0 text-cyan-300/60 group-hover:text-cyan-300 transition-colors text-lg">›</div>
                  )}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={goToTotp}
              className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors py-3 mt-4"
            >
              ← Back to authenticator app
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-muted-foreground hover:text-white transition-colors py-1"
            >
              Cancel and start over
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Render: verification input (totp / backup / email) ────────────────
  const isBackup = verifyMode === "backup";
  const isEmail = verifyMode === "email";
  const accent = isBackup
    ? { bg: "bg-amber-500/15", text: "text-amber-400", border: "focus:border-amber-500/50", icon: KeyRound, link: "text-amber-400 hover:text-amber-300" }
    : isEmail
      ? { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "focus:border-cyan-500/50", icon: Mail, link: "text-cyan-300 hover:text-cyan-200" }
      : { bg: "bg-blue-500/15", text: "text-blue-400", border: "focus:border-blue-500/50", icon: ShieldCheck, link: "text-amber-400 hover:text-amber-300" };
  const AccentIcon = accent.icon;

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-7">
          <div className="flex flex-col items-center text-center mb-5">
            <div className={`p-3 rounded-2xl mb-3 ${accent.bg} ${accent.text}`}>
              <AccentIcon style={{ width: 28, height: 28 }} />
            </div>
            <h2 className="text-xl font-semibold">
              {isBackup ? "Use a Backup Code" : isEmail ? "Email Verification" : "Two-Factor Authentication"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isBackup
                ? "Enter one of the 8-character backup codes you saved when enabling 2FA."
                : isEmail
                  ? maskedEmail
                    ? <>We sent a 6-digit code to <span className="text-cyan-200 font-medium">{maskedEmail}</span>. It expires in 10 minutes.</>
                    : "We sent a 6-digit code to your registered email. It expires in 10 minutes."
                  : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              key={verifyMode}
              type="text"
              inputMode={isBackup ? "text" : "numeric"}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder={isBackup ? "XXXX-XXXX" : "123456"}
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-center text-lg font-mono focus:outline-none ${
                isBackup ? "tracking-[0.25em] uppercase" : "tracking-[0.3em]"
              } ${accent.border}`}
              autoFocus
              maxLength={isBackup ? 9 : 6}
            />
            <Button
              type="submit"
              disabled={submitting || !code.trim() || (isBackup ? code.replace(/-/g, "").length < 8 : code.length < 6)}
              className="w-full h-11"
            >
              {submitting ? (
                <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              ) : (
                "Verify & Sign in"
              )}
            </Button>

            {/* Email-mode-only: Resend button with cooldown */}
            {isEmail && (
              <button
                type="button"
                onClick={requestEmailCode}
                disabled={requestingEmail || resendCooldown > 0}
                className="w-full text-xs text-cyan-300/80 hover:text-cyan-200 transition-colors py-1 disabled:text-muted-foreground/60 disabled:cursor-not-allowed"
              >
                {requestingEmail
                  ? "Resending…"
                  : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't get the email? Resend code"}
              </button>
            )}

            {/* Switch to chooser — primary fallback affordance */}
            <button
              type="button"
              onClick={goToChooser}
              className={`w-full text-sm font-semibold py-2 transition-colors ${accent.link}`}
            >
              {verifyMode === "totp"
                ? "Switch to Another Verification Method"
                : "Try a different method"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-muted-foreground hover:text-white transition-colors py-1"
            >
              Cancel and start over
            </button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground/70 mt-4">
            {isBackup
              ? "Each backup code works only once and is then permanently used."
              : isEmail
                ? "Never share this code with anyone. Qorix staff will never ask for it."
                : "Lost access to your authenticator? Use a backup code or get an email code."}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main login/register page
// ────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  // B25 (2026-04-30): default to Sign Up mode when the user lands on
  // /register or /signup. LoginPage is mounted on /login, /register and
  // /signup routes (see App.tsx Route definitions), so without this lazy
  // initializer every path shows the "Welcome back" sign-in form — confusing
  // for new users who paste or share a /register link expecting the
  // registration form. Lazy init runs synchronously on first render so the
  // form starts in the correct mode without a flash of the wrong tab.
  const [isLogin, setIsLogin] = useState<boolean>(() => {
    try {
      const path = window.location.pathname;
      if (path === "/register" || path === "/signup") return false;
    } catch {
      // Defensive: window may be undefined in non-browser contexts (SSR
      // smoke tests). Default to login mode in that case — the existing
      // ?ref= effect below still flips to register if a referral is
      // present, preserving the original B-batch behavior.
    }
    return true;
  });

  // When the user landed here via the Qorix Play OAuth bounce
  // (oauth-quiz-authorize.tsx sets `qorix_play_branding=1` in
  // sessionStorage right before redirecting to /login or /signup), we
  // re-skin the page with the Qorix Play logo + copy so the user
  // doesn't get a jarring "wait, why am I on Qorix Markets?" moment.
  // Same backend, same account — just visually consistent. The flag
  // lives for the rest of the tab session; the bounce page resets it
  // on every visit so it can't go stale across normal Play flows.
  const [isPlayBranding] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("qorix_play_branding") === "1";
    } catch {
      return false;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralLocked, setReferralLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  // B6.1: imperative ref so failed login/signup can reset the v2 widget
  // (single-use tokens — without reset the user has to wait ~2min before
  // re-submitting). See captcha-widget.tsx:CaptchaWidgetHandle which
  // forwards to either Recaptcha or Turnstile depending on the
  // build-time VITE_CAPTCHA_PROVIDER (B9.6).
  const recaptchaRef = useRef<CaptchaWidgetHandle | null>(null);
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

  // Awaiting-approval state — populated when the backend responds with
  // `requiresApproval: true` (i.e. another device currently owns this
  // account). Triggers the polling UI below.
  const [pendingApproval, setPendingApproval] = useState<{
    attemptId: number;
    pollToken: string;
    expiresAt: string;
    otpFallbackAfterMs: number;
    device: { browser: string; os: string };
  } | null>(null);
  const [loginInFlight, setLoginInFlight] = useState(false);

  // ── Two-Factor challenge state ───────────────────────────────────────
  // Set when the backend returns { requires2FA, twoFactorToken } after a
  // successful password check. Triggers the TwoFactorPromptStep below,
  // which collects the 6-digit code and POSTs to /auth/2fa/login-verify
  // — that response can then be ANOTHER discriminated branch (success
  // OR pending-approval), so we route it through the same setters.
  const [pendingTwoFactor, setPendingTwoFactor] = useState<{
    twoFactorToken: string;
  } | null>(null);

  // We bypass the codegen useLogin hook here because the /auth/login
  // response shape is now a discriminated union (token+user OR
  // requiresApproval+attemptId OR requires2FA+twoFactorToken). Direct
  // fetch keeps types honest.
  const submitLogin = async () => {
    setLoginInFlight(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, captchaToken }),
      });
      if (data?.requires2FA && data?.twoFactorToken) {
        setPendingTwoFactor({ twoFactorToken: data.twoFactorToken });
        return;
      }
      if (data?.requiresApproval) {
        setPendingApproval({
          attemptId: data.attemptId,
          pollToken: data.pollToken,
          expiresAt: data.expiresAt,
          otpFallbackAfterMs: data.otpFallbackAfterMs,
          device: data.device,
        });
        return;
      }
      // B23: Backend now blocks login for accounts that registered but
      // never confirmed their email OTP. Route them to the same OTP
      // screen we use right after register; backend has already fired a
      // fresh code so the user can verify and finish signing in.
      if (data?.requiresVerification && data?.email) {
        setPendingVerifyEmail(data.email);
        setShowOtpStep(true);
        toast({
          title: "Verify your email first",
          description: `We sent a 6-digit code to ${data.email}. Enter it to finish signing in.`,
        });
        return;
      }
      if (data?.token && data?.user) {
        setAuthData(data.token, data.user);
        setLocation("/dashboard");
        return;
      }
      throw new Error("Unexpected response from login");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoginInFlight(false);
      // B6.1: reCAPTCHA v2 tokens are single-use. Clear local copy and
      // reset the widget so the user can re-submit immediately after a
      // failed attempt (or after a successful 2FA-required path that
      // keeps them on this page). Idempotent on success-redirect paths.
      setCaptchaToken("");
      recaptchaRef.current?.reset();
    }
  };

  // Lightweight shim so the rest of the file (which references
  // loginMutation.isPending below) keeps working without a wider refactor.
  const loginMutation = { isPending: loginInFlight };

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
        // B6.1: same single-use-token reset as submitLogin's finally.
        // Failed signup leaves user on the form, so the widget must be
        // reset before they can re-submit.
        setCaptchaToken("");
        recaptchaRef.current?.reset();
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
      void submitLogin();
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
    // B6.1: do NOT clear captchaToken synchronously here. Both
    // submitLogin (finally) and registerMutation (onError) own the
    // reset+clear lifecycle now — this used to fire before the async
    // submit completed, leaving a stale-but-cleared token state for
    // any error toast retry path.
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const canSubmit = !isPending && (!CAPTCHA_ENABLED || !!captchaToken);

  // ── Two-Factor prompt step (shown when password OK but 2FA enabled) ──
  // Comes BEFORE the awaiting-approval check because /auth/2fa/login-verify
  // is what triggers the device-fingerprint logic — until that succeeds,
  // we don't know whether to show the approval flow.
  if (pendingTwoFactor) {
    return (
      <TwoFactorPromptStep
        twoFactorToken={pendingTwoFactor.twoFactorToken}
        onSuccess={(data) => {
          setPendingTwoFactor(null);
          if (data.requiresApproval) {
            // When requiresApproval is true, the API contract guarantees the
            // approval-branch fields below are present. Asserting non-null
            // here keeps the call-site simple without modelling a discriminated
            // union across the whole TwoFactorVerifySuccess shape.
            setPendingApproval({
              attemptId: data.attemptId!,
              pollToken: data.pollToken!,
              expiresAt: data.expiresAt!,
              otpFallbackAfterMs: data.otpFallbackAfterMs!,
              device: data.device!,
            });
            return;
          }
          if (data.token && data.user) {
            setAuthData(data.token, data.user);
            setLocation("/dashboard");
          }
        }}
        onCancel={() => setPendingTwoFactor(null)}
      />
    );
  }

  // ── Awaiting-approval step (shown when another device owns this account) ──
  if (pendingApproval) {
    return (
      <AwaitingApprovalStep
        info={pendingApproval}
        onSuccess={(token, user) => {
          setAuthData(token, user);
          setLocation("/dashboard");
        }}
        onCancel={() => setPendingApproval(null)}
      />
    );
  }

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
    <div
      className={`min-h-screen w-full flex flex-col items-center px-4 pt-20 pb-8 relative overflow-hidden ${
        isPlayBranding ? "bg-[#05010f]" : "bg-background"
      }`}
    >
      {/* Background — gaming neon vibe when arriving from Qorix Play,
          otherwise the calm Markets blobs. */}
      {isPlayBranding ? (
        <>
          {/* Tron grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(168,85,247,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 85%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 85%)",
            }}
          />
          {/* Neon blobs */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[520px] bg-fuchsia-600/25 rounded-full blur-[140px] pointer-events-none animate-pulse" />
          <div className="absolute top-1/3 -left-32 w-[420px] h-[420px] bg-purple-700/30 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 -right-24 w-[460px] h-[460px] bg-cyan-500/20 rounded-full blur-[130px] pointer-events-none" />
          {/* Conic spinning halo behind the logo column */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[260px] h-[260px] rounded-full pointer-events-none opacity-50 mix-blend-screen" style={{ background: "conic-gradient(from 0deg, rgba(168,85,247,0.0), rgba(168,85,247,0.55), rgba(34,211,238,0.55), rgba(236,72,153,0.55), rgba(168,85,247,0.0))", animation: "qp-spin 11s linear infinite", filter: "blur(28px)" }} />
          {/* Soft scanline overlay for that "arcade screen" feel */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)",
            }}
          />
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />
          <style>{`@keyframes qp-spin { from { transform: translate(-50%, 0) rotate(0deg); } to { transform: translate(-50%, 0) rotate(360deg); } } @keyframes qp-pulse-ring { 0%, 100% { box-shadow: 0 0 0 1px rgba(168,85,247,0.45), 0 0 32px rgba(168,85,247,0.25); } 50% { box-shadow: 0 0 0 1px rgba(34,211,238,0.55), 0 0 44px rgba(236,72,153,0.35); } }`}</style>
        </>
      ) : (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/6 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}

      {/* Back link — sits in the safe top-left zone above the form column.
          The parent now uses `flex-col` + `pt-20` so the form starts at y≈80
          and never collides with this absolutely-positioned button (which
          ends around y≈46). The button text stays readable down to 320px. */}
      <button
        onClick={() => {
          if (isPlayBranding) {
            // Send the user back to the Play landing they came from.
            window.location.href = "https://qorixplay.com";
          } else {
            setLocation("/");
          }
        }}
        className={`absolute top-6 left-4 sm:left-6 flex items-center gap-1.5 text-sm transition-colors z-10 ${
          isPlayBranding
            ? "text-purple-200/80 hover:text-fuchsia-300"
            : "text-muted-foreground hover:text-white"
        }`}
      >
        <ArrowLeft style={{ width: 15, height: 15 }} />
        {isPlayBranding ? "Back to Qorix Play" : "Back to home"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo — Qorix Play skin when the user came via Qorixplay's
            OAuth bounce, otherwise the default Qorix Markets wordmark. */}
        {isPlayBranding ? (
          <div className="flex items-center justify-center mb-8">
            <img
              src={qorixPlayLogo}
              alt="Qorix Play"
              draggable={false}
              className="h-12 w-auto drop-shadow-[0_0_24px_rgba(168,85,247,0.6)]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_22px_rgba(59,130,246,0.38)]">
              <QorixLogo size={48} />
            </div>
            <span className="text-xl font-bold">Qorix{" "}<span className="text-primary font-light">Markets</span></span>
          </div>
        )}

        <div
          className={
            isPlayBranding
              ? "relative rounded-2xl p-7 space-y-6 bg-[#0a0418]/80 backdrop-blur-xl border border-purple-500/30"
              : "glass-card rounded-2xl p-7 space-y-6"
          }
          style={isPlayBranding ? { animation: "qp-pulse-ring 3.4s ease-in-out infinite" } : undefined}
        >
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
                {isLogin
                  ? isPlayBranding
                    ? "Sign in to play"
                    : "Welcome back"
                  : isPlayBranding
                    ? "Create your Qorix Play account"
                    : "Create account"}
              </motion.h1>
            </AnimatePresence>
            <p className="text-sm text-muted-foreground">
              {isLogin
                ? isPlayBranding
                  ? "Sign in to join live quiz rounds and win real cash."
                  : "Sign in to access your trading terminal."
                : isPlayBranding
                  ? "Free account · play live quiz rounds · win real cash."
                  : "Start automated USD trading today."}
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {CAPTCHA_ENABLED && (
              <div className="pt-1">
                <CaptchaWidget
                  ref={recaptchaRef}
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
              onClick={() => {
                // Google OAuth needs a hard browser navigation to the API host.
                // window.location.href bypasses the main.tsx fetch shim, so on
                // Fly prod (web on qorixmarkets.com, api on api.qorixmarkets.com)
                // we must use the absolute API URL. In Replit dev VITE_API_URL
                // is unset and the same-origin /api/* path works via Vite proxy.
                const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
                const target = apiBase
                  ? `${apiBase}/api/auth/google`
                  : `${import.meta.env.BASE_URL}api/auth/google`;
                window.location.href = target;
              }}
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
