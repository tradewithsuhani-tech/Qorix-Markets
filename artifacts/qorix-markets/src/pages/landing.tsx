import { useState } from "react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Lock, Mail, User as UserIcon, Zap, Shield, BarChart2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FEATURES = [
  { icon: Zap, label: "AI-Powered Trading", sub: "Institutional-grade algorithms running 24/7" },
  { icon: Shield, label: "Capital Protection", sub: "Automated drawdown limits safeguard your funds" },
  { icon: BarChart2, label: "Real-Time Analytics", sub: "Live P&L tracking with full transparency" },
];

const STATS = [
  { value: "0.5–1.5%", label: "Daily Returns" },
  { value: "24/7", label: "Automated" },
  { value: "100%", label: "USDT Based" },
  { value: "<5%", label: "Max Drawdown" },
];

const TESTIMONIALS = [
  { name: "Alex K.", tier: "Gold", text: "Best automated trading platform I've used. Returns are consistent." },
  { name: "Sarah M.", tier: "Platinum", text: "The VIP program is worth it — lower fees and higher profit bonuses." },
];

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const { login: setAuthData } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err.message || "Something went wrong", variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      loginMutation.mutate({ data: { email, password } });
    } else {
      registerMutation.mutate({ data: { email, password, fullName, referralCode: referralCode || undefined } });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col md:flex-row overflow-hidden">

      {/* ── Left — Auth Form ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 md:px-12 lg:px-16 xl:px-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/8 rounded-full translate-x-1/2 translate-y-1/2 blur-[80px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative max-w-md w-full mx-auto space-y-7"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.4)]">
              <TrendingUp style={{ width: 20, height: 20 }} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">Qorix</span>
              <span className="text-xl font-light text-primary">Markets</span>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <AnimatePresence mode="wait">
              <motion.h2
                key={isLogin ? "login" : "register"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-2xl md:text-3xl font-bold tracking-tight"
              >
                {isLogin ? "Welcome back" : "Start your journey"}
              </motion.h2>
            </AnimatePresence>
            <p className="text-muted-foreground text-sm">
              {isLogin
                ? "Sign in to access your trading terminal."
                : "Create a free account and start automated trading."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="relative pb-1">
                    <UserIcon style={{ width: 16, height: 16 }} className="absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="field-input pl-10"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail style={{ width: 16, height: 16 }} className="absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input pl-10"
              />
            </div>

            <div className="relative">
              <Lock style={{ width: 16, height: 16 }} className="absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input pl-10"
              />
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
                  <div className="pb-1">
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

            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary w-full mt-1"
            >
              {isPending
                ? "Please wait…"
                : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            {" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-semibold transition-colors"
            >
              {isLogin ? "Register now" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* ── Right — Marketing Panel ───────────────────────────────────── */}
      <div className="hidden md:flex flex-1 relative items-center justify-center overflow-hidden bg-black/20">
        {/* Background image */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative z-10 max-w-md w-full px-8 py-10 space-y-8"
        >
          <div>
            <h2 className="text-3xl font-bold leading-tight mb-3">
              Professional Automated<br />
              <span className="gradient-text">USDT Trading</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Institutional-grade algorithms, real-time analytics, and automated wealth generation — all in one secure platform.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="glass-card p-4 rounded-xl text-center">
                <div className="text-xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/12 text-primary shrink-0">
                    <Icon style={{ width: 14, height: 14 }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Testimonials */}
          <div className="space-y-2">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                <Star style={{ width: 13, height: 13 }} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground leading-relaxed">"{t.text}"</p>
                  <p className="text-xs font-semibold mt-1">{t.name} <span className="text-muted-foreground font-normal">· {t.tier} Member</span></p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
