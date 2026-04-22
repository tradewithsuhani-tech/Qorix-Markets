import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { QorixLogo } from "@/components/qorix-logo";
import { useToast } from "@/hooks/use-toast";

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pending, setPending] = useState(false);

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    const { ok, data } = await postJson("/forgot-password", { email });
    setPending(false);
    if (!ok) {
      toast({ title: "Failed", description: data.error ?? "Could not send code" });
      return;
    }
    toast({ title: "Code sent", description: "Check your email for a 6-digit code." });
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) return;
    setPending(true);
    const { ok, data } = await postJson("/verify-reset-otp", { email, otp });
    setPending(false);
    if (!ok) {
      toast({ title: "Invalid code", description: data.error ?? "Try again" });
      return;
    }
    setStep("password");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters" });
      return;
    }
    setPending(true);
    const { ok, data } = await postJson("/reset-password", { email, otp, newPassword });
    setPending(false);
    if (!ok) {
      toast({ title: "Reset failed", description: data.error ?? "Try again" });
      return;
    }
    setStep("done");
    toast({ title: "Password reset", description: "You can now sign in with your new password." });
    setTimeout(() => navigate("/login"), 1500);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#050816]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10">
              <QorixLogo size={48} />
            </div>
            <span className="text-2xl font-bold text-white">
              Qorix<span className="text-blue-400">Markets</span>
            </span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>

          {step === "email" && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-white">Reset password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email and we'll send you a 6-digit code to reset your password.
                </p>
              </div>
              <form onSubmit={handleSendCode} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    autoFocus
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input field-input-icon-left"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending || !email}
                  className="btn btn-primary w-full"
                >
                  {pending ? "Sending…" : "Send reset code"}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-white">Enter code</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="field-input text-center text-2xl tracking-[0.5em] font-bold"
                  required
                />
                <button
                  type="submit"
                  disabled={pending || otp.length < 4}
                  className="btn btn-primary w-full"
                >
                  {pending ? "Verifying…" : "Verify code"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="w-full text-xs text-muted-foreground hover:text-blue-400 transition-colors"
                >
                  Didn't receive? Resend code
                </button>
              </form>
            </>
          )}

          {step === "password" && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-white">New password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a strong password (at least 8 characters).
                </p>
              </div>
              <form onSubmit={handleReset} className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPwd ? "text" : "password"}
                    autoFocus
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field-input field-input-icon-both"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={pending || newPassword.length < 8}
                  className="btn btn-primary w-full"
                >
                  {pending ? "Updating…" : "Reset password"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Password reset!</h2>
              <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
