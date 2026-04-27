import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Loader2, ArrowRight, RefreshCw, X, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function api(p: string) { return `${BASE_URL}api${p}`; }

type Step = "idle" | "awaiting_old_otp" | "awaiting_new_phone" | "awaiting_new_otp";

interface ChangeStatus {
  currentPhone: string | null;
  currentVerified: boolean;
  step: Step;
  pendingNewPhone: string | null;
  otpExpiresAt: string | null;
  oldVerifiedWindowExpiresAt: string | null;
}

function maskPhone(p: string | null | undefined): string {
  if (!p) return "—";
  return p.length >= 4 ? `******${p.slice(-4)}` : p;
}

function useCountdown(expiresAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) { setSecondsLeft(0); return; }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return secondsLeft;
}

export function PhoneChangeCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: status, isLoading } = useQuery<ChangeStatus>({
    queryKey: ["phone-change-status"],
    queryFn: async () => {
      const r = await authFetch(api("/phone-change/status"));
      if (!r.ok) throw new Error("status_fetch_failed");
      return r.json();
    },
    refetchInterval: open ? 5000 : false,
  });

  const otpExpiresIn = useCountdown(status?.otpExpiresAt ?? null);
  const windowExpiresIn = useCountdown(status?.oldVerifiedWindowExpiresAt ?? null);

  function resetWizard() {
    setOtp("");
    setNewPhone("");
  }

  const handleApiError = (e: any) => {
    let msg = e?.message ?? "Something went wrong";
    try { const parsed = JSON.parse(msg); if (parsed?.message) msg = parsed.message; } catch { /* not json */ }
    toast({ title: "Failed", description: msg, variant: "destructive" });
  };

  const startMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api("/phone-change/start"), { method: "POST", body: JSON.stringify({}) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    },
    onSuccess: (d: any) => {
      toast({ title: "Voice call placed", description: `OTP sent to ${d.sentTo}` });
      qc.invalidateQueries({ queryKey: ["phone-change-status"] });
    },
    onError: handleApiError,
  });

  const verifyOldMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api("/phone-change/verify-old"), { method: "POST", body: JSON.stringify({ otp }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    },
    onSuccess: () => {
      setOtp("");
      toast({ title: "Old number verified", description: "Now enter your new mobile number." });
      qc.invalidateQueries({ queryKey: ["phone-change-status"] });
    },
    onError: handleApiError,
  });

  const sendNewMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api("/phone-change/send-new"), { method: "POST", body: JSON.stringify({ phone: newPhone }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    },
    onSuccess: (d: any) => {
      toast({ title: "Voice call placed", description: `OTP sent to your new number ${maskPhone(d.newPhone)}` });
      qc.invalidateQueries({ queryKey: ["phone-change-status"] });
    },
    onError: handleApiError,
  });

  const verifyNewMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api("/phone-change/verify-new"), { method: "POST", body: JSON.stringify({ otp }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(data));
      return data;
    },
    onSuccess: (d: any) => {
      resetWizard();
      setOpen(false);
      toast({ title: "Phone updated", description: `Your verified number is now ${maskPhone(d.newPhone)}.` });
      qc.invalidateQueries({ queryKey: ["phone-change-status"] });
      qc.invalidateQueries({ queryKey: ["phone-otp-status"] });
    },
    onError: handleApiError,
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api("/phone-change/cancel"), { method: "POST", body: JSON.stringify({}) });
      if (!r.ok) throw new Error("cancel_failed");
    },
    onSuccess: () => {
      resetWizard();
      qc.invalidateQueries({ queryKey: ["phone-change-status"] });
      toast({ title: "Cancelled" });
    },
    onError: handleApiError,
  });

  const step: Step = status?.step ?? "idle";
  const newPhoneClean = useMemo(() => newPhone.replace(/\D/g, ""), [newPhone]);
  const newPhoneValid = newPhoneClean.length === 10 && /^[6-9]/.test(newPhoneClean);

  const noPhoneYet = !status?.currentPhone || !status?.currentVerified;

  return (
    <motion.div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
          <Phone style={{ width: 15, height: 15 }} />
        </div>
        <h3 className="font-semibold">Mobile Number</h3>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="min-w-0 pr-3">
              <div className="text-sm font-medium font-mono">{maskPhone(status?.currentPhone)}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                {status?.currentVerified ? (
                  <><ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified via voice OTP</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 text-amber-400" /> Not verified yet</>
                )}
              </div>
            </div>
            {!noPhoneYet && (
              <button
                onClick={() => setOpen(true)}
                className="px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors whitespace-nowrap"
              >
                Change Number
              </button>
            )}
          </div>
          {noPhoneYet && (
            <p className="text-xs text-muted-foreground">
              Verify your phone number first using the regular phone verification (in KYC).
              You'll be able to change it from here once it's verified.
            </p>
          )}
        </>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => { if (step === "idle") setOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass-card rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" /> Change Mobile Number</h3>
                  <p className="text-xs text-muted-foreground mt-1">Verify the old number, then verify the new one.</p>
                </div>
                <button onClick={() => { cancelMut.mutate(); setOpen(false); }} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`px-2 py-1 rounded-full ${step !== "idle" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>1. Old OTP</span>
                <span className="text-muted-foreground">›</span>
                <span className={`px-2 py-1 rounded-full ${step === "awaiting_new_phone" || step === "awaiting_new_otp" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>2. New number</span>
                <span className="text-muted-foreground">›</span>
                <span className={`px-2 py-1 rounded-full ${step === "awaiting_new_otp" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>3. New OTP</span>
              </div>

              {/* Step 1: idle / awaiting_old_otp */}
              {(step === "idle" || step === "awaiting_old_otp") && (
                <div className="space-y-3">
                  <div className="text-sm">
                    We will place a voice call to your current verified number{" "}
                    <span className="font-mono font-semibold">{maskPhone(status?.currentPhone)}</span>.
                  </div>
                  {step === "idle" ? (
                    <button
                      onClick={() => startMut.mutate()}
                      disabled={startMut.isPending}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {startMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      Send OTP to old number
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Enter the digits you heard</span>
                        <span>{otpExpiresIn > 0 ? `${otpExpiresIn}s remaining` : "expired"}</span>
                      </div>
                      <input
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="OTP"
                        inputMode="numeric"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base font-mono tracking-[0.5em] text-center focus:ring-1 focus:ring-emerald-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => startMut.mutate()}
                          disabled={startMut.isPending}
                          className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-3 h-3" /> Resend
                        </button>
                        <button
                          onClick={() => verifyOldMut.mutate()}
                          disabled={otp.length < 4 || verifyOldMut.isPending}
                          className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                        >
                          {verifyOldMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          Verify old number
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: awaiting_new_phone */}
              {step === "awaiting_new_phone" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Old number verified. Window: {windowExpiresIn}s</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Enter your new 10-digit Indian mobile number</div>
                  <input
                    autoFocus
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9XXXXXXXXX"
                    inputMode="numeric"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base font-mono tracking-wider focus:ring-1 focus:ring-emerald-500/50"
                  />
                  <button
                    onClick={() => sendNewMut.mutate()}
                    disabled={!newPhoneValid || sendNewMut.isPending}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {sendNewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                    Send OTP to new number
                  </button>
                </div>
              )}

              {/* Step 3: awaiting_new_otp */}
              {step === "awaiting_new_otp" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Voice call placed to <span className="font-mono">{maskPhone(status?.pendingNewPhone)}</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Enter the digits you heard on the new number</span>
                    <span>{otpExpiresIn > 0 ? `${otpExpiresIn}s remaining` : "expired"}</span>
                  </div>
                  <input
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="OTP"
                    inputMode="numeric"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base font-mono tracking-[0.5em] text-center focus:ring-1 focus:ring-emerald-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendNewMut.mutate()}
                      disabled={sendNewMut.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend
                    </button>
                    <button
                      onClick={() => verifyNewMut.mutate()}
                      disabled={otp.length < 4 || verifyNewMut.isPending}
                      className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {verifyNewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Confirm change
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
