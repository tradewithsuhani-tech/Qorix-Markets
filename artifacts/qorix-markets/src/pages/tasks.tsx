import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Star, LogIn, LayoutDashboard, Twitter, MessageCircle, Instagram,
  Share2, UserPlus, BadgeCheck, DollarSign, ShieldCheck, Wallet,
  CheckCircle2, Clock, Upload, X, AlertCircle, Coins, ChevronRight,
  Flame, Zap, Trophy, RefreshCw, Mail, Eye, EyeOff,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

function getToken() {
  try { return localStorage.getItem("qorix_token"); } catch { return null; }
}

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
// Icon mapping
// ────────────────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  LogIn, LayoutDashboard, Twitter, MessageCircle, Instagram,
  Share2, UserPlus, BadgeCheck, DollarSign, ShieldCheck, Wallet, Star,
};

function TaskIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Star;
  return <Icon className={className} />;
}

// ────────────────────────────────────────────────────────────────────────────
// Category helpers
// ────────────────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  daily: "Daily Tasks",
  weekly: "Weekly Tasks",
  social: "Social Tasks",
  one_time: "One-time Milestones",
};

const CATEGORY_COLORS: Record<string, string> = {
  daily: "text-blue-400",
  weekly: "text-violet-400",
  social: "text-pink-400",
  one_time: "text-amber-400",
};

const CATEGORY_BG: Record<string, string> = {
  daily: "bg-blue-500/10 border-blue-500/20",
  weekly: "bg-violet-500/10 border-violet-500/20",
  social: "bg-pink-500/10 border-pink-500/20",
  one_time: "bg-amber-500/10 border-amber-500/20",
};

const CATEGORY_ICON_BG: Record<string, string> = {
  daily: "bg-blue-500/20 text-blue-400",
  weekly: "bg-violet-500/20 text-violet-400",
  social: "bg-pink-500/20 text-pink-400",
  one_time: "bg-amber-500/20 text-amber-400",
};

// ────────────────────────────────────────────────────────────────────────────
// Proof submission modal
// ────────────────────────────────────────────────────────────────────────────
function ProofModal({
  task,
  onClose,
  onSubmitted,
}: {
  task: any;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [proofType, setProofType] = useState<"text" | "url">("url");
  const [proofContent, setProofContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!proofContent.trim()) {
      toast({ title: "Proof required", description: "Please enter your proof", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.slug}/proof`, {
        method: "POST",
        body: JSON.stringify({ proofType, proofContent }),
      });
      toast({ title: "Proof submitted!", description: "Our team will review it shortly." });
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="bg-[#0d0f17] border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-base">{task.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Submit proof to earn {task.pointReward} pts</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(["url", "text"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setProofType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium border transition-colors",
                  proofType === t
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-white/10 text-muted-foreground hover:border-white/20",
                )}
              >
                {t === "url" ? "Link / URL" : "Screenshot / Text"}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              {proofType === "url" ? "Paste the URL / link" : "Describe or paste screenshot content"}
            </label>
            <textarea
              value={proofContent}
              onChange={(e) => setProofContent(e.target.value)}
              placeholder={proofType === "url" ? "https://x.com/..." : "Paste screenshot text or describe..."}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
            Points are awarded after admin review (usually within 24h).
          </p>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Proof"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Email OTP Verification banner
// ────────────────────────────────────────────────────────────────────────────
function EmailVerificationBanner({ onVerified }: { onVerified: () => void }) {
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    setSending(true);
    try {
      await apiFetch("/auth/send-otp", { method: "POST" });
      setOtpSent(true);
      setShowInput(true);
      toast({ title: "OTP sent!", description: "Check your email for the verification code." });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setVerifying(true);
    try {
      await apiFetch("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ otp }),
      });
      toast({ title: "Email verified!", description: "You earned 25 bonus points!" });
      onVerified();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-500/20 shrink-0">
          <Mail className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-300">Verify your email address</p>
          <p className="text-xs text-muted-foreground mt-0.5">Earn 25 bonus points + unlock all task rewards</p>

          {showInput ? (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code"
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-blue-400/50"
              />
              <button
                onClick={verifyOtp}
                disabled={verifying || otp.length < 6}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition-colors disabled:opacity-50"
              >
                {verifying ? "..." : "Verify"}
              </button>
            </div>
          ) : (
            <button
              onClick={sendOtp}
              disabled={sending}
              className="mt-2.5 px-4 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send verification code"}
            </button>
          )}

          {otpSent && (
            <button
              onClick={sendOtp}
              disabled={sending}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Resend code
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Task card
// ────────────────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onComplete,
  onProofSubmit,
}: {
  task: any;
  onComplete: (slug: string) => void;
  onProofSubmit: (task: any) => void;
}) {
  const cat = task.category as string;
  const completed = task.completed as boolean;
  const pendingProof = task.pendingProof as boolean;

  return (
    <motion.div
      layout
      className={cn(
        "relative border rounded-2xl p-4 transition-colors overflow-hidden",
        completed
          ? "bg-emerald-500/5 border-emerald-500/15"
          : "bg-white/[0.03] border-white/8 hover:border-white/15",
      )}
    >
      {completed && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-xl shrink-0", CATEGORY_ICON_BG[cat] ?? "bg-white/10 text-foreground")}>
          <TaskIcon name={task.iconName} className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-medium", completed && "text-muted-foreground line-through")}>{task.title}</p>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              CATEGORY_BG[cat] ?? "bg-white/5 border-white/10",
              CATEGORY_COLORS[cat] ?? "text-foreground",
            )}>
              {task.category === "one_time" ? "one-time" : task.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">+{task.pointReward} pts</span>
            </div>

            {completed ? (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Done
              </span>
            ) : pendingProof ? (
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Under review
              </span>
            ) : task.requiresProof ? (
              <button
                onClick={() => onProofSubmit(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-400 text-xs font-medium hover:bg-pink-500/25 transition-colors"
              >
                <Upload className="h-3 w-3" /> Submit Proof
              </button>
            ) : (
              <button
                onClick={() => onComplete(task.slug)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  task.category === "daily" || task.category === "weekly"
                    ? "bg-primary/15 border border-primary/25 text-primary hover:bg-primary/25"
                    : "bg-white/8 border border-white/15 text-foreground hover:bg-white/12",
                )}
              >
                <Zap className="h-3 w-3" /> Claim
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [points, setPoints] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [proofTask, setProofTask] = useState<any>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(true);

  useEffect(() => {
    if (user) {
      setIsEmailVerified(!!(user as any).emailVerified);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    try {
      const [tasksData, pointsData] = await Promise.all([
        apiFetch("/tasks"),
        apiFetch("/points"),
      ]);
      setTasks(tasksData);
      setPoints(pointsData);
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleComplete = async (slug: string) => {
    setCompleting(slug);
    try {
      const result = await apiFetch(`/tasks/${slug}/complete`, { method: "POST" });
      toast({
        title: "Task completed!",
        description: result.pointsAwarded > 0
          ? `You earned ${result.pointsAwarded} points!`
          : "Daily points cap reached — try again tomorrow.",
      });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Cannot complete task", description: err.message, variant: "destructive" });
    } finally {
      setCompleting(null);
    }
  };

  // Group tasks by category
  const grouped = tasks.reduce<Record<string, any[]>>((acc, t) => {
    const cat = t.category as string;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(t);
    return acc;
  }, {});

  const catOrder = ["daily", "weekly", "social", "one_time"];
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold">Tasks & Promotions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete tasks to earn points and unlock benefits</p>
        </motion.div>

        {/* Email verification banner */}
        {!isEmailVerified && (
          <EmailVerificationBanner onVerified={() => { setIsEmailVerified(true); fetchData(); }} />
        )}

        {/* Points summary */}
        {points && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="col-span-2 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-muted-foreground font-medium">Total Points</span>
              </div>
              <p className="text-3xl font-bold text-amber-400">{points.balance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Daily cap: {points.dailyCap} pts/day</p>
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="h-4 w-4 text-violet-400" />
                <span className="text-xs text-muted-foreground">Progress</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{progressPct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{completedCount}/{totalCount}</p>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div
                  className="bg-violet-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Points usage info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Points can be used for: </span>
            withdrawal fee discounts · VIP level upgrades · investment bonuses.
            Points are not directly withdrawable as cash.
          </p>
        </motion.div>

        {/* Task list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            {catOrder.map((cat) => {
              const catTasks = grouped[cat];
              if (!catTasks || catTasks.length === 0) return null;
              return (
                <motion.div key={cat} variants={item}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", CATEGORY_COLORS[cat])}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs text-muted-foreground">
                      {catTasks.filter((t) => t.completed).length}/{catTasks.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {catTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={completing === task.slug ? () => {} : handleComplete}
                        onProofSubmit={setProofTask}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Recent points history */}
        {points?.history?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/[0.03] border border-white/8 rounded-2xl p-4"
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" /> Recent Points
            </h3>
            <div className="space-y-2">
              {points.history.slice(0, 8).map((h: any) => (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-muted-foreground truncate flex-1">{h.description}</span>
                  <span className={cn("text-xs font-semibold ml-3", h.amount > 0 ? "text-emerald-400" : "text-red-400")}>
                    {h.amount > 0 ? "+" : ""}{h.amount} pts
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Proof modal */}
      <AnimatePresence>
        {proofTask && (
          <ProofModal
            task={proofTask}
            onClose={() => setProofTask(null)}
            onSubmitted={fetchData}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
