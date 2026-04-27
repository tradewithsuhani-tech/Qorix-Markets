import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CheckCircle,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileCode,
  Lock,
  MapPin,
  PauseCircle,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  UserX,
  Wallet,
  Plus,
  Minus,
  X,
  ChevronDown,
  CreditCard,
  Server,
  Cpu,
  Zap,
  HardDrive,
  CheckCheck,
  Globe,
  Sparkles,
  Tag,
  Calendar,
  Trash2,
  Power,
  PartyPopper,
  Pencil,
  Loader2,
} from "lucide-react";
import { HIDDEN_FEATURES } from "@/lib/hidden-features";
import { AddressDisplay } from "@/components/address-display";
import { useToast } from "@/hooks/use-toast";

function token() {
  try { return localStorage.getItem("qorix_token"); } catch { return null; }
}

async function adminFetch(path: string, init?: RequestInit) {
  const authToken = token();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ModuleHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const color = value === "completed" || value === "active" || value === "enabled"
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : value === "pending" || value === "manual"
    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  return <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${color}`}>{value}</span>;
}

function BalanceAdjustModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [walletType, setWalletType] = useState("mainBalance");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const walletLabels: Record<string, string> = {
    mainBalance: "Main Balance",
    tradingBalance: "Trading Balance",
    profitBalance: "Profit Balance",
  };

  async function submit() {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const change = direction === "add" ? parsedAmount : -parsedAmount;
      await adminFetch(`/admin/users/${user.id}/balance-adjust`, {
        method: "POST",
        body: JSON.stringify({ walletType, amount: change, reason }),
      });
      toast({ title: "Balance adjusted", description: `${direction === "add" ? "+" : "-"}${money(parsedAmount)} to ${walletLabels[walletType]}` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass-card rounded-2xl border border-white/10 p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Manual Balance Adjustment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.fullName} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl">
          {Object.entries(walletLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setWalletType(key)}
              className={`py-2 rounded-lg text-xs font-medium transition-all ${walletType === key ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white/3 border border-white/8 p-4">
          <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Current Balances</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs text-muted-foreground">Main</div><div className="font-bold text-sm">{money(user.mainBalance)}</div></div>
            <div><div className="text-xs text-muted-foreground">Trading</div><div className="font-bold text-sm">{money(user.tradingBalance)}</div></div>
            <div><div className="text-xs text-muted-foreground">Profit</div><div className="font-bold text-sm">{money(user.profitBalance)}</div></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection("add")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${direction === "add" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/3 border-white/10 text-muted-foreground hover:bg-white/8"}`}
          >
            <Plus className="w-4 h-4" /> Add Funds
          </button>
          <button
            onClick={() => setDirection("deduct")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${direction === "deduct" ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/3 border-white/10 text-muted-foreground hover:bg-white/8"}`}
          >
            <Minus className="w-4 h-4" /> Deduct Funds
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Amount (USDT)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reason (Required for Audit)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Referral bonus correction, KYC reward..."
            className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm transition-all">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount || !reason}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${direction === "add" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
          >
            {loading ? "Processing..." : `${direction === "add" ? "Add" : "Deduct"} ${amount ? money(parseFloat(amount)) : "$0.00"}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ManualCreditModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit() {
    setLoading(true);
    try {
      await adminFetch("/admin/transactions/manual-credit", {
        method: "POST",
        body: JSON.stringify({ userId: parseInt(userId), amount: parseFloat(amount), reason, txHash }),
      });
      toast({ title: "Manual credit applied", description: `$${parseFloat(amount).toFixed(2)} credited to user #${userId}` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass-card rounded-2xl border border-white/10 p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Manual Deposit Credit</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Credit a deposit to user's main balance with full audit trail</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">This action is permanent and logged to the audit trail. Only credit after verifying the transaction hash on-chain.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">User ID</label>
            <input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. 42" className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Amount (USDT)</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">TX Hash (Optional)</label>
            <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="TRON blockchain transaction hash" className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Manual USDT deposit confirmed on-chain" className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500/50" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm transition-all">Cancel</button>
          <button onClick={submit} disabled={loading || !userId || !amount || !reason} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-all">
            {loading ? "Processing..." : "Apply Credit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditProfileModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState<string>(user.fullName ?? "");
  const [email, setEmail] = useState<string>(user.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState<string>(user.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const body: Record<string, any> = {};
      if (fullName.trim() !== (user.fullName ?? "")) body.fullName = fullName.trim();
      if (email.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) body.email = email.trim().toLowerCase();
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const currentPhone = user.phoneNumber ?? "";
      if (cleanPhone !== currentPhone) body.phoneNumber = cleanPhone === "" ? null : cleanPhone;

      if (Object.keys(body).length === 0) {
        toast({ title: "Nothing to save", description: "No fields changed." });
        setSaving(false);
        return;
      }

      const result = await adminFetch(`/admin/users/${user.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast({ title: "Profile updated", description: `Changed: ${(result.changedFields ?? []).join(", ") || "—"}` });
      onDone();
      onClose();
    } catch (e: any) {
      let msg = e?.message ?? "Update failed";
      try { const parsed = JSON.parse(msg); if (parsed?.message) msg = parsed.message; } catch { /* not json */ }
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-card rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-400" /> Edit Profile</h3>
            <p className="text-xs text-muted-foreground mt-1">User #{user.id} — bypasses OTP. Phone change marks the new number admin-verified.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Full Name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500/50" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-blue-500/50" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Phone Number (10 digits, blank = remove)</span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="9XXXXXXXXX"
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono tracking-wider focus:ring-1 focus:ring-blue-500/50"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white text-sm transition-all">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [adjustUser, setAdjustUser] = useState<any | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [showSmokeTest, setShowSmokeTest] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (showSmokeTest) params.set("includeSmokeTest", "true");
      const data = await adminFetch(`/admin/users?${params.toString()}`);
      setUsers(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showSmokeTest]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) => [u.email, u.fullName, u.referralCode].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [users, query]);

  async function action(id: number, userAction: string) {
    await adminFetch(`/admin/users/${id}/action`, { method: "POST", body: JSON.stringify({ action: userAction }) });
    toast({ title: "User updated", description: userAction.replace("_", " ") });
    await load();
  }

  return (
    <Layout>
      <AnimatePresence>
        {adjustUser && (
          <BalanceAdjustModal user={adjustUser} onClose={() => setAdjustUser(null)} onDone={load} />
        )}
        {editUser && (
          <EditProfileModal user={editUser} onClose={() => setEditUser(null)} onDone={load} />
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Shield} title="User Management" subtitle="Search users, review balances, KYC, risk and account security controls." />
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3 flex-wrap">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, referral code" className="bg-transparent outline-none flex-1 text-sm min-w-[12rem]" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none px-2" title="Include the deploy smoke-test account in this list (for support / debugging only).">
            <input
              type="checkbox"
              checked={showSmokeTest}
              onChange={(e) => setShowSmokeTest(e.target.checked)}
              className="accent-amber-500"
            />
            Show smoke-test account
          </label>
          <button onClick={load} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs flex items-center gap-2"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">KYC / Risk</th>
                  <th className="text-left p-4">Wallet</th>
                  <th className="text-left p-4">Trading</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading users...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.03]">
                    <td className="p-4">
                      <div className="font-semibold text-white">{u.fullName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-muted-foreground/60 font-mono">ID #{u.id}</div>
                    </td>
                    <td className="p-4">
                      <div><StatusBadge value={u.kycStatus ?? "not_submitted"} /></div>
                      <div className="text-xs text-muted-foreground mt-1">Risk: {u.riskLevel ?? "low"}</div>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      <div>Main {money(u.mainBalance)}</div>
                      <div className="text-muted-foreground">Trading {money(u.tradingBalance)}</div>
                      <div className="text-muted-foreground">Profit {money(u.profitBalance)}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">{money(u.investmentAmount)}</div>
                      <div className="text-xs text-muted-foreground">{u.isTrading ? "Active investor" : "Inactive"}</div>
                    </td>
                    <td className="p-4 space-y-1">
                      {u.isAdmin && <StatusBadge value="admin" />}
                      {u.isFrozen && <StatusBadge value="frozen" />}
                      {u.isDisabled && <StatusBadge value="disabled" />}
                      {!u.isFrozen && !u.isDisabled && !u.isAdmin && <StatusBadge value="active" />}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => action(u.id, u.isFrozen ? "unfreeze" : "freeze")} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors">{u.isFrozen ? "Unfreeze" : "Freeze"}</button>
                        <button onClick={() => action(u.id, u.isDisabled ? "enable" : "disable")} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">{u.isDisabled ? "Enable" : "Disable"}</button>
                        <button onClick={() => action(u.id, "force_logout")} className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors">Force logout</button>
                        <button onClick={() => setAdjustUser(u)} className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors flex items-center gap-1"><Wallet className="w-3 h-3" /> Balance</button>
                        <button onClick={() => setEditUser(u)} className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit Profile</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}

export function AdminTransactionsPage({ mode }: { mode: "deposits" | "withdrawals" }) {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showManualCredit, setShowManualCredit] = useState(false);
  const [showSmokeTest, setShowSmokeTest] = useState(false);
  const type = mode === "deposits" ? "deposit" : "withdrawal";

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, status, limit: "120" });
      if (showSmokeTest) params.set("includeSmokeTest", "true");
      const data = await adminFetch(`/admin/transactions?${params.toString()}`);
      setRows(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, mode, showSmokeTest]);

  return (
    <Layout>
      <AnimatePresence>
        {showManualCredit && (
          <ManualCreditModal onClose={() => setShowManualCredit(false)} onDone={load} />
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <ModuleHeader icon={mode === "deposits" ? ArrowDownCircle : ArrowUpCircle} title={mode === "deposits" ? "Deposit Management" : "Withdrawal Management"} subtitle="Monitor transaction status, hashes, manual review queues and processing controls." />
          {mode === "deposits" && (
            <button
              onClick={() => setShowManualCredit(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-all shrink-0"
            >
              <CreditCard className="w-4 h-4" /> Manual Credit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Total listed</div><div className="text-2xl font-bold">{rows.length}</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-bold text-amber-400">{rows.filter((r) => r.status === "pending").length}</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Volume</div><div className="text-2xl font-bold">{money(rows.reduce((s, r) => s + r.amount, 0))}</div></div>
        </div>
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <label
            className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none px-2"
            title="Include the deploy smoke-test account in this list (for support / debugging only)."
          >
            <input
              type="checkbox"
              checked={showSmokeTest}
              onChange={(e) => setShowSmokeTest(e.target.checked)}
              className="accent-amber-500"
            />
            Show smoke-test account
          </label>
          <div className="text-xs text-muted-foreground">{mode === "withdrawals" ? "Large withdrawals require manual approval." : "Use Manual Credit to apply off-chain deposits."}</div>
        </div>
        <TransactionTable rows={rows} loading={loading} />
      </motion.div>
    </Layout>
  );
}

function TransactionTable({ rows, loading }: { rows: any[]; loading: boolean }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-left p-4">User</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Hash / Address</th>
              <th className="text-left p-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading transactions...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No transactions found.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="p-4"><div className="font-medium">{r.userFullName || "User"}</div><div className="text-xs text-muted-foreground">{r.userEmail}</div></td>
                <td className="p-4 font-bold">{money(r.amount)}</td>
                <td className="p-4"><StatusBadge value={r.status} /></td>
                <td className="p-4 text-xs text-muted-foreground max-w-[280px]">
                  {r.txHash ? <AddressDisplay address={r.txHash} /> : r.walletAddress ? <AddressDisplay address={r.walletAddress} /> : <span className="truncate">{r.description}</span>}
                </td>
                <td className="p-4 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminTradingPage() {
  const [profit, setProfit] = useState("");
  const [slots, setSlots] = useState("");
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  async function load() {
    setStats(await adminFetch("/admin/stats"));
  }

  useEffect(() => { load(); }, []);

  async function distribute() {
    await adminFetch("/admin/profit", { method: "POST", body: JSON.stringify({ profitPercent: Number(profit) }) });
    toast({ title: "Trading payout queued", description: `${profit}% performance distribution started.` });
    setProfit("");
    await load();
  }

  async function saveSlots() {
    await adminFetch("/admin/slots", { method: "POST", body: JSON.stringify({ maxSlots: Number(slots) }) });
    toast({ title: "Investor capacity updated" });
    setSlots("");
    await load();
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Activity} title="Trading Control" subtitle="Manage daily performance, investor capacity, payout triggers and trading system state." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">AUM</div><div className="text-2xl font-bold">{money(stats?.totalAUM ?? 0)}</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Active Investors</div><div className="text-2xl font-bold">{stats?.activeInvestors ?? 0}</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Daily %</div><div className="text-2xl font-bold">{stats?.dailyProfitPercent ?? 0}%</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Slots</div><div className="text-2xl font-bold">{stats?.maxSlots === 0 ? "∞" : stats?.maxSlots ?? 0}</div></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="font-bold text-xl mb-2">Trigger Daily Payout</h2>
            <p className="text-sm text-muted-foreground mb-4">Requires admin authentication. Use negative values only for controlled drawdown simulation.</p>
            <div className="flex gap-2">
              <input value={profit} onChange={(e) => setProfit(e.target.value)} type="number" step="0.1" placeholder="e.g. 2.5" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
              <button onClick={distribute} disabled={!profit} className="px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50">Execute</button>
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl">
            <h2 className="font-bold text-xl mb-2">Investor Slots</h2>
            <p className="text-sm text-muted-foreground mb-4">Set 0 for unlimited investors, or a number for controlled capacity.</p>
            <div className="flex gap-2">
              <input value={slots} onChange={(e) => setSlots(e.target.value)} type="number" min="0" placeholder="e.g. 100" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
              <button onClick={saveSlots} disabled={slots === ""} className="px-5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <PauseCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-300">Pause / Resume Trading System</div>
            <div className="text-sm text-muted-foreground">Worker pause/resume switch is ready to connect. Backend worker state toggle can be wired to the trading worker on deployment.</div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}

export function AdminWalletPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reconcile, setReconcile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  async function load() {
    const [acc, rec, st] = await Promise.all([
      adminFetch("/admin/ledger/accounts"),
      adminFetch("/admin/ledger/reconcile"),
      adminFetch("/admin/stats"),
    ]);
    setAccounts(acc);
    setReconcile(rec);
    setStats(st);
  }

  useEffect(() => { load(); }, []);

  const systemAccounts = accounts.filter((a) => a.isSystem);
  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Wallet} title="Wallet Control" subtitle="Track hot wallet, internal balances, system accounts and ledger reconciliation." />

        {/* System Fund Overview */}
        <div className="glass-card p-6 rounded-2xl border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">System Fund Overview</h2>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total System Fund</div>
              <div className="text-3xl font-bold text-primary">${(stats?.totalUserFunds || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
              <div className="text-xs text-muted-foreground">Total Deposit Fund</div>
              <div className="text-xl font-bold">${(stats?.totalDepositsEver || 0).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Available ${(stats?.totalMainWallet || 0).toFixed(2)}</div>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
              <div className="text-xs text-muted-foreground">Trading Fund</div>
              <div className="text-xl font-bold text-blue-400">${(stats?.totalTradingWallet || 0).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Active capital</div>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
              <div className="text-xs text-muted-foreground">Profit Fund</div>
              <div className="text-xl font-bold text-emerald-400">${(stats?.totalProfitWallet || 0).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Withdrawable</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-xs text-muted-foreground">Pending Withdrawal</div>
              <div className="text-xl font-bold text-amber-400">${(stats?.pendingWithdrawalAmount || 0).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{stats?.pendingWithdrawals || 0} requests</div>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
              <div className="text-xs text-muted-foreground">Total Withdrawn (lifetime)</div>
              <div className="text-xl font-bold">${(stats?.totalWithdrawalsEver || 0).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">All-time payouts</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">System accounts</div><div className="text-2xl font-bold">{systemAccounts.length}</div></div>
          <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Total accounts</div><div className="text-2xl font-bold">{accounts.length}</div></div>
          <div className={`glass-card p-5 rounded-2xl ${reconcile?.balanced === false ? "border border-red-500/20 bg-red-500/5" : "border border-emerald-500/20 bg-emerald-500/5"}`}>
            <div className="text-xs text-muted-foreground">Ledger status</div>
            <div className={`text-2xl font-bold ${reconcile?.balanced === false ? "text-red-400" : "text-emerald-400"}`}>{reconcile?.balanced === false ? "Review" : "Balanced"}</div>
          </div>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
         <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-white/5 text-muted-foreground"><tr><th className="text-left p-4">Account</th><th className="text-left p-4">Type</th><th className="text-left p-4">Normal</th><th className="text-left p-4">Scope</th></tr></thead>
            <tbody className="divide-y divide-white/5">{accounts.map((a) => (
              <tr key={a.id} className="hover:bg-white/[0.03]">
                <td className="p-4 font-mono text-xs">{a.code}<div className="text-white font-sans text-sm mt-1">{a.name}</div></td>
                <td className="p-4"><StatusBadge value={a.accountType} /></td>
                <td className="p-4 text-muted-foreground">{a.normalBalance}</td>
                <td className="p-4 text-muted-foreground">{a.isSystem ? "System" : `User ${a.userId}`}</td>
              </tr>
            ))}</tbody>
          </table>
         </div>
        </div>
      </motion.div>
    </Layout>
  );
}

// Holiday / Scheduled Promo manager — full CRUD against /api/admin/scheduled-promos.
// Active scheduled promos OVERRIDE the rotating-window offer for everyone, so this
// is what admins use to ship one-off Diwali / NYE / event promos without redeploys.
interface ScheduledPromoRow {
  id: number;
  name: string;
  code: string;
  description: string | null;
  bonusPercent: string | number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
}

function toLocalDateTimeInput(d: Date): string {
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert an ISO timestamp (or null) coming from /admin/settings into the
// "YYYY-MM-DDTHH:mm" shape that <input type="datetime-local"> expects, in
// the admin's local wall clock. Empty string blanks the input, which is
// what we want when the row is unset.
function isoToLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toLocalDateTimeInput(d);
}

// Inverse of isoToLocalDateTimeInput. The input emits a tz-less local-time
// string ("2026-04-26T18:00"); new Date(...) interprets that as local, and
// toISOString() canonicalises it to UTC for transport. Empty input -> null
// so the API knows to delete the row (fall back to MAINTENANCE_ETA).
function localDateTimeInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// India Standard Time offset (UTC+5:30, no DST). All holiday dates in
// HOLIDAY_TEMPLATES are calendar dates in IST per Indian festival convention,
// so we anchor windows to IST wall-clock and convert to admin-local times only
// when populating the datetime-local inputs.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Build a UTC Date that represents the given IST wall-clock instant. */
function istWallClockToUtc(year: number, month1: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month1 - 1, day, hour, minute) - IST_OFFSET_MS);
}

/** Returns the year IT IS RIGHT NOW in the IST timezone (admin may be elsewhere). */
function getISTYear(d: Date): number {
  return new Date(d.getTime() + IST_OFFSET_MS).getUTCFullYear();
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Holiday templates (Indian-festival heavy, with global staples) ───────────
// Each template carries copy + a multi-year date table so we always pick the
// NEXT upcoming occurrence relative to the admin's current local time. Lunar
// holidays (Diwali, Eid, etc.) need explicit per-year dates because the
// Gregorian date shifts; solar holidays (Republic Day, Christmas) repeat the
// same month/day every year.
type HolidayTemplate = {
  id: string;                     // dropdown <option> value
  label: string;                  // display label in dropdown
  emoji: string;                  // friendly cue
  codeBase: string;               // becomes "<CODEBASE><YY>" e.g. DIWALI26
  nameTemplate: string;           // "{year}" placeholder gets the holiday year
  description: string;            // English copy shown to users
  bonusPercent: number;           // suggested fixed bonus %
  daysBefore: number;             // promo window opens N days before holiday (00:00)
  daysAfter: number;              // promo window closes N days after holiday (23:59)
  // For lunar/movable holidays. ISO "YYYY-MM-DD" in IST.
  fixedDates?: Record<number, string>;
  // For solar/recurring holidays — same month/day every year.
  fixedMonthDay?: { month: number; day: number };
};

// All dates are in IST (Asia/Kolkata) per Indian festival calendar convention.
// Years 2026-2028 covered so the form keeps working through end of 2027.
const HOLIDAY_TEMPLATES: HolidayTemplate[] = [
  {
    id: "diwali",
    label: "Diwali (Festival of Lights)",
    emoji: "🪔",
    codeBase: "DIWALI",
    nameTemplate: "Diwali Boost {year}",
    description: "Celebrate Diwali with us — a limited-time bonus on your next deposit. Light up your portfolio this festive season.",
    bonusPercent: 25,
    daysBefore: 3,
    daysAfter: 2,
    fixedDates: { 2026: "2026-11-08", 2027: "2027-10-28", 2028: "2028-11-15" },
  },
  {
    id: "dhanteras",
    label: "Dhanteras",
    emoji: "🪙",
    codeBase: "DHANTERAS",
    nameTemplate: "Dhanteras Special {year}",
    description: "Dhanteras — the day of wealth. Multiply your prosperity with a bonus on your next deposit.",
    bonusPercent: 20,
    daysBefore: 1,
    daysAfter: 1,
    fixedDates: { 2026: "2026-11-06", 2027: "2027-10-26", 2028: "2028-11-12" },
  },
  {
    id: "dussehra",
    label: "Dussehra (Vijayadashami)",
    emoji: "🏹",
    codeBase: "DUSSEHRA",
    nameTemplate: "Dussehra Victory Bonus {year}",
    description: "Vijayadashami — the triumph of good. Lock in a victory bonus on your next deposit.",
    bonusPercent: 15,
    daysBefore: 2,
    daysAfter: 1,
    fixedDates: { 2026: "2026-10-20", 2027: "2027-10-09", 2028: "2028-09-27" },
  },
  {
    id: "navratri",
    label: "Navratri (9 Nights)",
    emoji: "💃",
    codeBase: "NAVRATRI",
    nameTemplate: "Navratri Festival {year}",
    description: "Nine nights of celebration — earn an extra bonus on your next deposit through the festival.",
    bonusPercent: 18,
    daysBefore: 0,
    daysAfter: 9,
    fixedDates: { 2026: "2026-10-12", 2027: "2027-10-01", 2028: "2028-09-19" },
  },
  {
    id: "ganesh-chaturthi",
    label: "Ganesh Chaturthi",
    emoji: "🐘",
    codeBase: "GANESH",
    nameTemplate: "Ganesh Chaturthi {year}",
    description: "Lord Ganesha removes obstacles — start something new with a bonus on your next deposit.",
    bonusPercent: 15,
    daysBefore: 1,
    daysAfter: 2,
    fixedDates: { 2026: "2026-09-14", 2027: "2027-09-04", 2028: "2028-08-23" },
  },
  {
    id: "janmashtami",
    label: "Janmashtami",
    emoji: "🦚",
    codeBase: "JANMASHTAMI",
    nameTemplate: "Janmashtami Bonus {year}",
    description: "Krishna Janmashtami — celebrate with a divine bonus on your next deposit.",
    bonusPercent: 12,
    daysBefore: 1,
    daysAfter: 1,
    fixedDates: { 2026: "2026-09-04", 2027: "2027-08-25", 2028: "2028-08-13" },
  },
  {
    id: "raksha-bandhan",
    label: "Raksha Bandhan",
    emoji: "🎗️",
    codeBase: "RAKHI",
    nameTemplate: "Raksha Bandhan {year}",
    description: "A bond worth celebrating — refer your siblings and earn an extra bonus this Raksha Bandhan.",
    bonusPercent: 12,
    daysBefore: 1,
    daysAfter: 1,
    fixedDates: { 2026: "2026-08-28", 2027: "2027-08-17", 2028: "2028-08-05" },
  },
  {
    id: "karwa-chauth",
    label: "Karwa Chauth",
    emoji: "🌙",
    codeBase: "KARWA",
    nameTemplate: "Karwa Chauth {year}",
    description: "A day of devotion — cherish the bond with a special bonus on your next deposit.",
    bonusPercent: 10,
    daysBefore: 1,
    daysAfter: 0,
    fixedDates: { 2026: "2026-10-30", 2027: "2027-10-19", 2028: "2028-11-07" },
  },
  {
    id: "holi",
    label: "Holi (Festival of Colors)",
    emoji: "🌈",
    codeBase: "HOLI",
    nameTemplate: "Holi Color Bonus {year}",
    description: "Splash of colors, splash of bonus — claim your Holi deposit boost.",
    bonusPercent: 20,
    daysBefore: 1,
    daysAfter: 1,
    fixedDates: { 2026: "2026-03-04", 2027: "2027-03-22", 2028: "2028-03-11" },
  },
  {
    id: "eid-al-fitr",
    label: "Eid al-Fitr",
    emoji: "🌙",
    codeBase: "EID",
    nameTemplate: "Eid al-Fitr {year}",
    description: "Eid Mubarak — celebrate the sweet end of Ramadan with a bonus on your next deposit.",
    bonusPercent: 15,
    daysBefore: 1,
    daysAfter: 2,
    fixedDates: { 2026: "2026-03-20", 2027: "2027-03-09", 2028: "2028-02-26" },
  },
  {
    id: "eid-al-adha",
    label: "Eid al-Adha (Bakra Eid)",
    emoji: "🐑",
    codeBase: "BAKRAEID",
    nameTemplate: "Eid al-Adha {year}",
    description: "A festival of sacrifice and giving — claim a generous bonus this Eid al-Adha.",
    bonusPercent: 12,
    daysBefore: 1,
    daysAfter: 2,
    fixedDates: { 2026: "2026-05-27", 2027: "2027-05-17", 2028: "2028-05-05" },
  },
  {
    id: "onam",
    label: "Onam",
    emoji: "🌺",
    codeBase: "ONAM",
    nameTemplate: "Onam Festival {year}",
    description: "Welcome King Mahabali home — claim a special bonus this Onam season.",
    bonusPercent: 12,
    daysBefore: 2,
    daysAfter: 2,
    fixedDates: { 2026: "2026-08-26", 2027: "2027-09-14", 2028: "2028-09-02" },
  },
  // ── Solar / fixed-date holidays ────────────────────────────────────────
  {
    id: "republic-day",
    label: "Republic Day (Jan 26)",
    emoji: "🇮🇳",
    codeBase: "REPUBLIC",
    nameTemplate: "Republic Day {year}",
    description: "Honour the nation — claim a patriotic bonus this Republic Day.",
    bonusPercent: 10,
    daysBefore: 1,
    daysAfter: 1,
    fixedMonthDay: { month: 1, day: 26 },
  },
  {
    id: "independence-day",
    label: "Independence Day (Aug 15)",
    emoji: "🇮🇳",
    codeBase: "AZADI",
    nameTemplate: "Azadi Bonus {year}",
    description: "Celebrate the spirit of independence — a freedom-day bonus on your next deposit.",
    bonusPercent: 15,
    daysBefore: 1,
    daysAfter: 1,
    fixedMonthDay: { month: 8, day: 15 },
  },
  {
    id: "makar-sankranti",
    label: "Makar Sankranti / Pongal (Jan 14)",
    emoji: "☀️",
    codeBase: "SANKRANTI",
    nameTemplate: "Makar Sankranti {year}",
    description: "Harvest the sun — claim a bonus on your next deposit this Sankranti.",
    bonusPercent: 10,
    daysBefore: 1,
    daysAfter: 2,
    fixedMonthDay: { month: 1, day: 14 },
  },
  {
    id: "christmas",
    label: "Christmas (Dec 25)",
    emoji: "🎄",
    codeBase: "XMAS",
    nameTemplate: "Christmas Bonus {year}",
    description: "Wishing you a merry Christmas — unwrap a holiday bonus on your next deposit.",
    bonusPercent: 12,
    daysBefore: 2,
    daysAfter: 1,
    fixedMonthDay: { month: 12, day: 25 },
  },
  {
    id: "new-year",
    label: "New Year (Jan 1)",
    emoji: "🎆",
    codeBase: "NY",
    nameTemplate: "New Year {year}",
    description: "Start the year strong — claim a new-year bonus on your next deposit.",
    bonusPercent: 20,
    daysBefore: 2,
    daysAfter: 3,
    fixedMonthDay: { month: 1, day: 1 },
  },
];

/** A holiday occurrence resolved in IST. `instant` is the absolute UTC moment
 *  of midnight-IST on the holiday day; the istYear/istMonth/istDay components
 *  are what the Indian calendar actually says for that day. We always plan
 *  the promo window from these IST components so admins in any timezone get
 *  the correct India-local festival window. */
type HolidayOccurrence = {
  instant: Date;
  istYear: number;
  istMonth: number; // 1-indexed
  istDay: number;
};

/** Returns the next upcoming IST occurrence for the given template, or null
 *  if our table doesn't carry a future entry (lunar holidays past coverage). */
function pickUpcomingHolidayDate(t: HolidayTemplate, now: Date): HolidayOccurrence | null {
  if (t.fixedMonthDay) {
    const { month, day } = t.fixedMonthDay;
    const startYear = getISTYear(now);
    for (let y = startYear; y <= startYear + 1; y++) {
      const instant = istWallClockToUtc(y, month, day);
      if (instant.getTime() > now.getTime()) {
        return { instant, istYear: y, istMonth: month, istDay: day };
      }
    }
    return null;
  }
  if (t.fixedDates) {
    const occurrences = Object.entries(t.fixedDates)
      .map(([, iso]) => {
        const [yy, mm, dd] = iso.split("-").map(Number);
        return {
          instant: istWallClockToUtc(yy!, mm!, dd!),
          istYear: yy!,
          istMonth: mm!,
          istDay: dd!,
        };
      })
      .filter((x) => x.instant.getTime() > now.getTime())
      .sort((a, b) => a.instant.getTime() - b.instant.getTime());
    return occurrences[0] ?? null;
  }
  return null;
}

function ScheduledPromosManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduledPromoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const now = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toLocalDateTimeInput(now), [now]);
  const defaultEnd = useMemo(() => {
    const d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return toLocalDateTimeInput(d);
  }, [now]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    bonusPercent: "15",
    startsAt: defaultStart,
    endsAt: defaultEnd,
    maxRedemptions: "" as string | "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return; // "Custom" — leave fields untouched
    const t = HOLIDAY_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const occ = pickUpcomingHolidayDate(t, new Date());
    if (!occ) {
      toast({
        title: "No upcoming date for this holiday",
        description: "Please add the date manually or extend the template table.",
        variant: "destructive",
      });
      return;
    }
    // Build the window in IST: starts at 00:00 IST `daysBefore` days before
    // the holiday, ends at 23:59 IST `daysAfter` days after. We feed
    // istWallClockToUtc the unadjusted day number (it can be negative or
    // overflow into the next month — Date.UTC normalises both correctly).
    const startInstant = istWallClockToUtc(occ.istYear, occ.istMonth, occ.istDay - t.daysBefore, 0, 0);
    const endInstant = istWallClockToUtc(occ.istYear, occ.istMonth, occ.istDay + t.daysAfter, 23, 59);
    const yy = String(occ.istYear).slice(-2);
    setForm({
      name: t.nameTemplate.replace("{year}", String(occ.istYear)),
      code: `${t.codeBase}${yy}`.replace(/[^A-Z0-9]/g, "").slice(0, 32),
      description: t.description,
      bonusPercent: String(t.bonusPercent),
      // datetime-local always shows the admin's local wall clock — that's
      // what they need to see and edit in their own timezone. The absolute
      // instant (the line above us) is preserved.
      startsAt: toLocalDateTimeInput(startInstant),
      endsAt: toLocalDateTimeInput(endInstant),
      maxRedemptions: form.maxRedemptions, // preserve whatever the admin had typed
    });
  }

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/scheduled-promos");
      setRows(Array.isArray(data?.promos) ? data.promos : []);
    } catch (err: any) {
      toast({ title: "Failed to load holiday promos", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({
      name: "",
      code: "",
      description: "",
      bonusPercent: "15",
      startsAt: toLocalDateTimeInput(new Date()),
      endsAt: toLocalDateTimeInput(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
      maxRedemptions: "",
    });
    setTemplateId("");
  }

  async function createPromo() {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await adminFetch("/admin/scheduled-promos", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || null,
          bonusPercent: Number(form.bonusPercent),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        }),
      });
      toast({ title: "Holiday promo created" });
      resetForm();
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast({ title: "Failed to create promo", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: ScheduledPromoRow) {
    try {
      await adminFetch(`/admin/scheduled-promos/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast({ title: row.isActive ? "Promo disabled" : "Promo enabled" });
      await load();
    } catch (err: any) {
      toast({ title: "Update failed", description: String(err?.message ?? err), variant: "destructive" });
    }
  }

  async function deletePromo(row: ScheduledPromoRow) {
    if (row.redemptionCount > 0) {
      toast({ title: "Cannot delete — promo has redemptions. Disable it instead.", variant: "destructive" });
      return;
    }
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try {
      await adminFetch(`/admin/scheduled-promos/${row.id}`, { method: "DELETE" });
      toast({ title: "Promo deleted" });
      await load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: String(err?.message ?? err), variant: "destructive" });
    }
  }

  function statusOf(row: ScheduledPromoRow): { label: string; tone: string } {
    const t = Date.now();
    const start = new Date(row.startsAt).getTime();
    const end = new Date(row.endsAt).getTime();
    const capExhausted = row.maxRedemptions != null && row.redemptionCount >= row.maxRedemptions;
    if (!row.isActive) return { label: "Disabled", tone: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
    if (capExhausted) return { label: "Sold Out", tone: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
    if (t < start) return { label: "Scheduled", tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    if (t >= end) return { label: "Expired", tone: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
    return { label: "Live Now", tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  }

  return (
    <div className="glass-card p-6 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-pink-400" /> Holiday & Scheduled Promos
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Special event promos with fixed bonus % and date windows. When a scheduled promo is live, it <span className="text-white font-semibold">overrides</span> the rotating offer for all users. Use this for Diwali, New Year, milestone events, etc. Lifetime per-user redemption rule still applies.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:bg-pink-500/25 text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "New Holiday Promo"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 space-y-4">
          {/* Holiday template picker — auto-fills name/code/dates/copy/bonus%
              with the next upcoming occurrence of the chosen festival. Admins
              can still tweak any field after applying a template. */}
          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-xs uppercase tracking-wider font-semibold text-fuchsia-300 flex items-center gap-1.5">
                <PartyPopper className="w-3.5 h-3.5" /> Quick template
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pick a holiday and the form auto-fills with name, code, dates and English copy. Edit anything afterwards.
              </p>
            </div>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="bg-black/60 border border-fuchsia-500/30 rounded-lg px-3 py-2 text-sm text-white min-w-[260px]"
            >
              <option value="">Custom (no template)</option>
              {HOLIDAY_TEMPLATES
                .map((t) => ({ t, occ: pickUpcomingHolidayDate(t, new Date()) }))
                .filter((x): x is { t: HolidayTemplate; occ: HolidayOccurrence } => x.occ != null)
                .sort((a, b) => a.occ.instant.getTime() - b.occ.instant.getTime())
                .map(({ t, occ }) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label} — {occ.istDay} {MONTH_SHORT[occ.istMonth - 1]} {occ.istYear}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                type="text"
                maxLength={120}
                placeholder="Diwali Boost 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Redeem Code</label>
              <input
                type="text"
                maxLength={32}
                placeholder="DIWALI25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Letters/digits only. Users will type this exact code.</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Bonus %</label>
              <input
                type="number"
                min={0.5}
                max={100}
                step="0.5"
                value={form.bonusPercent}
                onChange={(e) => setForm({ ...form, bonusPercent: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Fixed % credited on next confirmed deposit (0.5–100).</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Max Redemptions (optional)</label>
              <input
                type="number"
                min={1}
                placeholder="Leave blank = unlimited"
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Starts At</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Ends At</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Description (optional)</label>
              <textarea
                rows={2}
                maxLength={500}
                placeholder="Celebrate Diwali with us — limited-time bonus on your next deposit."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { resetForm(); setShowForm(false); }}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={createPromo}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Promo"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name / Code</th>
              <th className="text-left p-3">Bonus</th>
              <th className="text-left p-3">Window</th>
              <th className="text-left p-3">Redemptions</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No holiday promos yet. Click <span className="text-pink-300 font-semibold">New Holiday Promo</span> to create one.</td></tr>
            )}
            {rows.map((r) => {
              const s = statusOf(r);
              return (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="text-white font-medium">{r.name}</div>
                    <div className="font-mono text-xs text-pink-300 mt-0.5">{r.code}</div>
                  </td>
                  <td className="p-3 text-emerald-400 font-mono font-semibold">+{Number(r.bonusPercent)}%</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    <div>{new Date(r.startsAt).toLocaleString()}</div>
                    <div className="opacity-70">→ {new Date(r.endsAt).toLocaleString()}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {r.redemptionCount}{r.maxRedemptions != null ? ` / ${r.maxRedemptions}` : " / ∞"}
                  </td>
                  <td className="p-3">
                    <span className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-1 rounded border ${s.tone}`}>{s.label}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        title={r.isActive ? "Disable" : "Enable"}
                        onClick={() => toggleActive(r)}
                        className={`p-2 rounded-lg border ${r.isActive ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => deletePromo(r)}
                        disabled={r.redemptionCount > 0}
                        className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSystemPage() {
  const [settings, setSettings] = useState<any>(null);
  const [broadcast, setBroadcast] = useState({ title: "", message: "", audience: "all" });
  const { toast } = useToast();

  async function load() {
    setSettings(await adminFetch("/admin/settings"));
  }

  useEffect(() => { load(); }, []);

  async function save(next: any) {
    const updated = { ...settings, ...next };
    setSettings(updated);
    await adminFetch("/admin/settings", { method: "POST", body: JSON.stringify(next) });
    toast({ title: "System settings saved" });
  }

  async function sendBroadcast() {
    const result = await adminFetch("/admin/broadcast", { method: "POST", body: JSON.stringify(broadcast) });
    toast({ title: "Broadcast sent", description: `${result.recipients} users notified.` });
    setBroadcast({ title: "", message: "", audience: "all" });
  }

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Settings} title="System Control" subtitle="Maintenance mode, signup controls, platform parameters and communication tools." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-2xl space-y-5">
            <h2 className="text-xl font-bold">Platform Access</h2>
            {/*
              Effective maintenance state surfaces *which* switch is currently
              freezing the site. The admin toggle below is just one of two
              sources — `MAINTENANCE_MODE` set on Fly produces the same banner
              and 503s but won't clear when the toggle is flipped off. Without
              this row admins see "toggle off" and assume the freeze is over.
              Source values come straight from getMaintenanceState() on the API.
            */}
            {(() => {
              const eff = settings?.maintenanceEffective;
              if (!eff) return null;
              const source = eff.source as "env" | "db" | "both" | null;
              const active = !!eff.active;
              const tone = active
                ? source === "env"
                  ? { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", dot: "bg-amber-400" }
                  : source === "both"
                    ? { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-300", dot: "bg-rose-400" }
                    : { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-300", dot: "bg-orange-400" }
                : { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" };
              const sourceLabel = !active
                ? "No freeze active"
                : source === "env"
                  ? "Frozen by ops env var (MAINTENANCE_MODE on Fly)"
                  : source === "db"
                    ? "Frozen by admin toggle (this panel)"
                    : "Frozen by BOTH ops env var and admin toggle";
              return (
                <div className={`rounded-xl border ${tone.border} ${tone.bg} px-4 py-3 flex items-start gap-3`} data-testid="maintenance-effective-status">
                  <span className={`mt-1 inline-block w-2.5 h-2.5 rounded-full ${tone.dot} ${active ? "animate-pulse" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${tone.text}`}>
                      {active ? "Maintenance ACTIVE" : "Maintenance OFF"}
                      {active && eff.hardBlock ? <span className="ml-2 text-[11px] uppercase tracking-wide bg-black/30 px-2 py-0.5 rounded">hard-block</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sourceLabel}</div>
                    {active && (source === "env" || source === "both") ? (
                      <div className="text-[11px] text-amber-200/90 mt-1 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Flipping the admin toggle off will <strong>not</strong> clear maintenance. Unset the Fly secret with <code className="font-mono">fly secrets unset MAINTENANCE_MODE --app qorix-api</code>.</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}
            <ToggleRow icon={Lock} label="Maintenance Mode" value={!!settings?.maintenanceMode} onToggle={(v) => save({ maintenanceMode: v })} />
            <p className="text-xs text-muted-foreground -mt-2 ml-9">
              Soft freeze: writes (deposits, trades, withdrawals) return a friendly banner; balances and charts keep loading.
              {settings?.maintenanceEffective?.active && (settings.maintenanceEffective.source === "env" || settings.maintenanceEffective.source === "both") ? (
                <span className="block mt-1 text-amber-300/90">Note: the ops <code className="font-mono">MAINTENANCE_MODE</code> env var is also on, so turning this toggle off won't fully clear maintenance.</span>
              ) : null}
            </p>
            <ToggleRow icon={Lock} label="Hard Block (legacy)" value={!!settings?.maintenanceHardBlock} onToggle={(v) => save({ maintenanceHardBlock: v })} />
            <p className="text-xs text-muted-foreground -mt-2 ml-9">
              Optional: also blocks reads for non-admin users. Only enable for full outages — most maintenance windows should use the soft freeze above.
            </p>
            <ToggleRow icon={CheckCircle} label="Registration Enabled" value={settings?.registrationEnabled !== false} onToggle={(v) => save({ registrationEnabled: v })} />
            <div>
              <label className="text-sm text-muted-foreground">Maintenance Message</label>
              <input value={settings?.maintenanceMessage ?? ""} onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })} onBlur={() => save({ maintenanceMessage: settings?.maintenanceMessage ?? "" })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Estimated end time (optional)</label>
              {/*
                Drives the countdown in the maintenance banner. Empty string
                clears the row server-side and the banner falls back to the
                MAINTENANCE_ETA env var (which is what the cutover runbook
                sets). The control shows admin-local wall clock; we round-trip
                via toISOString() so the API stores a canonical UTC ISO.
              */}
              <input
                type="datetime-local"
                value={isoToLocalDateTimeInput(settings?.maintenanceEndsAt ?? null)}
                onChange={(e) => setSettings({ ...settings, maintenanceEndsAt: localDateTimeInputToIso(e.target.value) })}
                onBlur={() => save({ maintenanceEndsAt: settings?.maintenanceEndsAt ?? null })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to clear. While set, the maintenance banner shows a live countdown to this time.
              </p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Auto Withdraw Limit (USDT)</label>
              <input value={settings?.autoWithdrawLimit ?? 0} onChange={(e) => setSettings({ ...settings, autoWithdrawLimit: e.target.value })} onBlur={() => save({ autoWithdrawLimit: settings?.autoWithdrawLimit ?? 0 })} type="number" className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Admin IP Whitelist</label>
              <input value={settings?.adminIpWhitelist ?? ""} onChange={(e) => setSettings({ ...settings, adminIpWhitelist: e.target.value })} onBlur={() => save({ adminIpWhitelist: settings?.adminIpWhitelist ?? "" })} placeholder="Comma separated IPs, empty = allow all" className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="w-5 h-5 text-blue-400" /> Quick Broadcast</h2>
            <select value={broadcast.audience} onChange={(e) => setBroadcast({ ...broadcast, audience: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm">
              <option value="all">All users</option>
              <option value="users">Users only</option>
              <option value="admins">Admins only</option>
            </select>
            <input value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} placeholder="Announcement title" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            <textarea value={broadcast.message} onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })} placeholder="Message" rows={4} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm resize-none" />
            <button onClick={sendBroadcast} disabled={!broadcast.title || !broadcast.message} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Send Broadcast</button>
          </div>
        </div>
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> Fund Transparency Baselines</h2>
            <p className="text-xs text-muted-foreground mt-1">Display-only floor values shown publicly on the dashboard's Fund Transparency widget. Real on-platform totals are added on top of these. <span className="text-amber-400">These never affect any user balance, P&amp;L, accounting or withdrawals.</span></p>
            <p className="text-xs text-blue-300/80 mt-2">💡 Tip: Keep these consistent — e.g. AUM ÷ Active Investors should look like a believable per-investor average ($2K–$10K typical).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Baseline Total AUM (USD)</label>
              <input type="number" value={settings?.baselineTotalAum ?? 0} onChange={(e) => setSettings({ ...settings, baselineTotalAum: e.target.value })} onBlur={() => save({ baselineTotalAum: Number(settings?.baselineTotalAum ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Active Capital (USD)</label>
              <input type="number" value={settings?.baselineActiveCapital ?? 0} onChange={(e) => setSettings({ ...settings, baselineActiveCapital: e.target.value })} onBlur={() => save({ baselineActiveCapital: Number(settings?.baselineActiveCapital ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Reserve Fund (USD)</label>
              <input type="number" value={settings?.baselineReserveFund ?? 0} onChange={(e) => setSettings({ ...settings, baselineReserveFund: e.target.value })} onBlur={() => save({ baselineReserveFund: Number(settings?.baselineReserveFund ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Active Investors</label>
              <input type="number" value={settings?.baselineActiveInvestors ?? 0} onChange={(e) => setSettings({ ...settings, baselineActiveInvestors: e.target.value })} onBlur={() => save({ baselineActiveInvestors: Number(settings?.baselineActiveInvestors ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Total Profit (USD)</label>
              <input type="number" step="0.01" value={settings?.baselineTotalProfit ?? 0} onChange={(e) => setSettings({ ...settings, baselineTotalProfit: e.target.value })} onBlur={() => save({ baselineTotalProfit: Number(settings?.baselineTotalProfit ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Users Earning Now</label>
              <input type="number" value={settings?.baselineUsersEarningNow ?? 0} onChange={(e) => setSettings({ ...settings, baselineUsersEarningNow: e.target.value })} onBlur={() => save({ baselineUsersEarningNow: Number(settings?.baselineUsersEarningNow ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Withdrawals (24h)</label>
              <input type="number" value={settings?.baselineWithdrawals24h ?? 0} onChange={(e) => setSettings({ ...settings, baselineWithdrawals24h: e.target.value })} onBlur={() => save({ baselineWithdrawals24h: Number(settings?.baselineWithdrawals24h ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Baseline Avg Monthly Return (%)</label>
              <input type="number" step="0.1" value={settings?.baselineAvgMonthlyReturn ?? 0} onChange={(e) => setSettings({ ...settings, baselineAvgMonthlyReturn: e.target.value })} onBlur={() => save({ baselineAvgMonthlyReturn: Number(settings?.baselineAvgMonthlyReturn ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-blue-400" /> Conversion / Demo Mode</h2>
            <p className="text-xs text-muted-foreground mt-1">Controls the demo hero, demo profit card, and live activity ticker shown to users who haven't activated live trading. <span className="text-amber-400">Display-only — never affects balances or accounting.</span></p>
          </div>
          <ToggleRow icon={Zap} label="Show Demo Mode hero on dashboard" value={settings?.demoModeEnabled ?? true} onToggle={(v) => { setSettings({ ...settings, demoModeEnabled: v }); save({ demoModeEnabled: v }); }} />
          <ToggleRow icon={Zap} label="Show Demo Profit card" value={settings?.demoProfitEnabled ?? true} onToggle={(v) => { setSettings({ ...settings, demoProfitEnabled: v }); save({ demoProfitEnabled: v }); }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Demo Profit Value (USD)</label>
              <input type="number" step="0.01" value={settings?.demoProfitValue ?? 0} onChange={(e) => setSettings({ ...settings, demoProfitValue: e.target.value })} onBlur={() => save({ demoProfitValue: Number(settings?.demoProfitValue ?? 0) })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">FOMO Ticker Messages (one per line)</label>
            <textarea
              rows={6}
              value={(() => { try { return (JSON.parse(settings?.fomoMessages ?? "[]") as string[]).join("\n"); } catch { return ""; } })()}
              onChange={(e) => setSettings({ ...settings, fomoMessages: JSON.stringify(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)) })}
              onBlur={() => save({ fomoMessages: settings?.fomoMessages ?? "[]" })}
              placeholder={"+3 investors joined today\n$2,140 invested in last 24h\nStrategy capacity 72% filled"}
              className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">Rotates every 3.5s on the user dashboard.</p>
          </div>
        </div>

        {/* Rotating Promo Builder — controls the FOMO deposit-bonus banner */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-400" /> Rotating Promo Offer</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Time-windowed deposit bonus shown on the dashboard banner. Each window generates a unique code (e.g. <span className="text-white font-mono">QRX-3F2A</span>) with a randomised bonus % within the configured range. Users have 24h to claim before the redemption auto-expires.
            </p>
            <p className="text-xs text-blue-300/80 mt-2">💡 Changes take effect within ~60s (cached server-side). The current live offer will keep its window until it naturally rotates.</p>
          </div>

          <ToggleRow
            icon={Sparkles}
            label="Enable rotating promo banner"
            value={settings?.promoEnabled ?? true}
            onToggle={(v) => { setSettings({ ...settings, promoEnabled: v }); save({ promoEnabled: v }); }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Window Length (minutes)</label>
              <input
                type="number"
                min={5}
                max={240}
                value={settings?.promoWindowMinutes ?? 30}
                onChange={(e) => setSettings({ ...settings, promoWindowMinutes: e.target.value })}
                onBlur={() => save({ promoWindowMinutes: Math.max(5, Math.min(240, Number(settings?.promoWindowMinutes ?? 30))) })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">How long each rotating offer stays live (5–240 min). Lower = more urgency.</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Code Prefix</label>
              <input
                type="text"
                maxLength={8}
                value={settings?.promoCodePrefix ?? "QRX"}
                onChange={(e) => setSettings({ ...settings, promoCodePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                onBlur={() => save({ promoCodePrefix: (settings?.promoCodePrefix ?? "QRX").toString().toUpperCase().slice(0, 8) || "QRX" })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Letters/digits only, max 8 chars. Final code: <span className="font-mono text-white">{(settings?.promoCodePrefix || "QRX").toString().toUpperCase()}-XXXX</span></p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Min Bonus %</label>
              <input
                type="number"
                min={0.5}
                max={50}
                step="0.5"
                value={settings?.promoMinPct ?? 2}
                onChange={(e) => setSettings({ ...settings, promoMinPct: e.target.value })}
                onBlur={() => {
                  const min = Math.max(0.5, Number(settings?.promoMinPct ?? 2));
                  save({ promoMinPct: min });
                }}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Max Bonus %</label>
              <input
                type="number"
                min={0.5}
                max={50}
                step="0.5"
                value={settings?.promoMaxPct ?? 10}
                onChange={(e) => setSettings({ ...settings, promoMaxPct: e.target.value })}
                onBlur={() => {
                  const max = Math.max(Number(settings?.promoMinPct ?? 2), Number(settings?.promoMaxPct ?? 10));
                  save({ promoMaxPct: max });
                }}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Step %</label>
              <input
                type="number"
                min={0.1}
                max={5}
                step="0.1"
                value={settings?.promoStepPct ?? 0.5}
                onChange={(e) => setSettings({ ...settings, promoStepPct: e.target.value })}
                onBlur={() => save({ promoStepPct: Math.max(0.1, Number(settings?.promoStepPct ?? 0.5)) })}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Bonus % is rounded to this step (e.g. 0.5 → 2.0, 2.5, 3.0...).</p>
            </div>
          </div>

          {/* Live preview strip */}
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-yellow-200/80 uppercase tracking-wider font-semibold">Live Preview</div>
              <div className="text-sm text-white mt-1">
                <span className="font-mono text-yellow-400">{(settings?.promoCodePrefix || "QRX").toString().toUpperCase()}-XXXX</span>
                {" · "}
                <span className="text-emerald-400 font-semibold">+{Number(settings?.promoMinPct ?? 2)}% to +{Number(settings?.promoMaxPct ?? 10)}%</span>
                {" bonus on next deposit · rotates every "}
                <span className="text-white font-semibold">{Number(settings?.promoWindowMinutes ?? 30)} min</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Status: {settings?.promoEnabled === false ? <span className="text-red-400 font-semibold">Disabled</span> : <span className="text-emerald-400 font-semibold">Active — banner visible to users</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Holiday / Scheduled Promos — overrides the rotating offer when active */}
        <ScheduledPromosManager />

        <div className="glass-card p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400" /> RBAC — Role-Based Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { role: "super_admin", label: "Super Admin", desc: "Full access to all modules, settings, and user management.", color: "text-red-400 bg-red-500/10 border-red-500/20" },
              { role: "finance_admin", label: "Finance Admin", desc: "Withdrawal control, transaction review, and balance management.", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
              { role: "support_admin", label: "Support Admin", desc: "User lookup, chat support, and basic account actions.", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
            ].map((r) => (
              <div key={r.role} className={`rounded-xl border p-4 ${r.color.split(" ").slice(1).join(" ")}`}>
                <div className={`font-semibold text-sm ${r.color.split(" ")[0]}`}>{r.label}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}

function ToggleRow({ icon: Icon, label, value, onToggle }: { icon: any; label: string; value: boolean; onToggle: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/8">
      <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-blue-400" /><span className="font-medium">{label}</span></div>
      <button onClick={() => onToggle(!value)} className={`w-12 h-6 rounded-full p-1 transition-colors ${value ? "bg-blue-600" : "bg-white/10"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

const LOG_TABS = ["Login Events", "Transaction Logs", "Activity Logs", "System Health"] as const;
type LogTab = typeof LOG_TABS[number];

export function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState<LogTab>("Login Events");
  const [logs, setLogs] = useState<any>({ loginEvents: [], ledgerEntries: [] });
  const [activity, setActivity] = useState<any>({ transactions: [], logins: [], settingsChanges: [] });
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [logsData, activityData, healthData] = await Promise.all([
        adminFetch("/admin/logs"),
        adminFetch("/admin/activity-logs"),
        adminFetch("/admin/system-health"),
      ]);
      setLogs(logsData);
      setActivity(activityData);
      setHealth(healthData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <ModuleHeader icon={Database} title="Logs & Monitoring" subtitle="Login events, transaction ledger, admin activity and system health." />
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
          {LOG_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Login Events" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/8 flex items-center gap-2"><UserX className="w-4 h-4 text-blue-400" /><h2 className="font-bold">Login Events</h2><span className="ml-auto text-xs text-muted-foreground">{logs.loginEvents?.length ?? 0} entries</span></div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {(logs.loginEvents ?? []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No login events found.</div>
              ) : (logs.loginEvents ?? []).map((r: any) => (
                <div key={r.id} className="p-4 hover:bg-white/[0.03] flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">{r.eventType} · User #{r.userId}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.ipAddress} · {r.userAgent?.slice(0, 60)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Transaction Logs" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/8 flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" /><h2 className="font-bold">Transaction Ledger</h2><span className="ml-auto text-xs text-muted-foreground">{logs.ledgerEntries?.length ?? 0} entries</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-muted-foreground"><tr><th className="text-left p-4">Entry</th><th className="text-left p-4">Type</th><th className="text-left p-4">Amount</th><th className="text-left p-4">Description</th><th className="text-left p-4">Date</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {(logs.ledgerEntries ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No ledger entries.</td></tr>
                  ) : (logs.ledgerEntries ?? []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-white/[0.03]">
                      <td className="p-4 font-mono text-xs text-muted-foreground">{r.accountCode}</td>
                      <td className="p-4"><StatusBadge value={r.entryType} /></td>
                      <td className="p-4 font-bold text-sm">{money(r.amount)}</td>
                      <td className="p-4 text-xs text-muted-foreground max-w-[200px] truncate">{r.description || r.journalId}</td>
                      <td className="p-4 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Activity Logs" && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/8 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /><h2 className="font-bold">Admin Transactions</h2></div>
              <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                {(activity.transactions ?? []).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No admin transaction activity.</div>
                ) : activity.transactions.map((r: any) => (
                  <div key={r.id} className="p-4 hover:bg-white/[0.03] flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{r.action}</div>
                      <div className="text-xs text-muted-foreground">{r.userEmail || `User #${r.userId}`} · {money(r.amount)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge value={r.status} />
                      <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/8 flex items-center gap-2"><Settings className="w-4 h-4 text-blue-400" /><h2 className="font-bold">Settings Changes</h2></div>
              <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                {(activity.settingsChanges ?? []).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No settings changes recorded.</div>
                ) : activity.settingsChanges.map((r: any) => (
                  <div key={r.id} className="p-4 hover:bg-white/[0.03] flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{r.action}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.value}</div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "System Health" && health && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: "database", label: "Database", icon: HardDrive },
                { key: "api", label: "API Server", icon: Server },
                { key: "profit_worker", label: "Profit Worker", icon: Cpu },
                { key: "blockchain_listener", label: "Blockchain Monitor", icon: Zap },
              ].map(({ key, label, icon: Icon }) => {
                const check = health.checks?.[key];
                const ok = check?.status === "ok";
                return (
                  <div key={key} className={`glass-card p-5 rounded-2xl border ${ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${ok ? "text-emerald-400" : "text-red-400"}`} />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                    </div>
                    <div className={`text-lg font-bold ${ok ? "text-emerald-400" : "text-red-400"}`}>{ok ? "Online" : "Error"}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {check?.latencyMs ? `${check.latencyMs}ms` : check?.detail ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Total Users</div><div className="text-2xl font-bold">{health.stats?.totalUsers ?? 0}</div></div>
              <div className="glass-card p-5 rounded-2xl"><div className="text-xs text-muted-foreground">Active Investors</div><div className="text-2xl font-bold">{health.stats?.activeInvestors ?? 0}</div></div>
              <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5"><div className="text-xs text-muted-foreground">Pending TXs</div><div className="text-2xl font-bold text-amber-400">{health.stats?.pendingTransactions ?? 0}</div></div>
              <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5"><div className="text-xs text-muted-foreground">Completed TXs</div><div className="text-2xl font-bold text-emerald-400">{health.stats?.completedTransactions ?? 0}</div></div>
            </div>
            <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-sm">Last health check: <span className="text-white">{health.timestamp ? new Date(health.timestamp).toLocaleString() : "—"}</span></div>
              <div className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold border ${health.status === "healthy" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                {health.status?.toUpperCase() ?? "UNKNOWN"}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

export function AdminAnalyticsPage() {
  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Activity} title="Analytics" subtitle="Use Intelligence for charts, growth, deposit/withdraw trends and risk distribution." />
        <div className="glass-card p-8 rounded-2xl text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Analytics available in Intelligence</h2>
          <p className="text-muted-foreground mt-2">The dedicated Intelligence module contains live charts for flows, risk exposure, top investors and profit history.</p>
        </div>
      </motion.div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hidden Features registry — admin-only memo of every product feature
// we've intentionally hidden from end users while we redesign / rebuild
// it. Lets us come back later and remember exactly what to restore.
// Source of truth: src/lib/hidden-features.ts.
// ─────────────────────────────────────────────────────────────────────
export function AdminHiddenFeaturesPage() {
  const items = HIDDEN_FEATURES;
  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader
          icon={EyeOff}
          title="Hidden Features"
          subtitle="Features intentionally hidden from end users — track here so we can rebuild and restore them later."
        />

        <div className="glass-card rounded-2xl p-5 flex items-start gap-3 bg-amber-500/5 border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Edit <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">src/lib/hidden-features.ts</code> to add or remove entries.
            To restore a feature, delete its entry from the registry — the underlying code is preserved in place.
          </div>
        </div>

        {items.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <Eye className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Nothing hidden right now</h2>
            <p className="text-muted-foreground mt-2 text-sm">All product features are currently visible to end users.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((f) => (
              <div key={f.id} className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                      <EyeOff className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-bold text-base leading-tight">{f.title}</div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{f.id}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {f.hiddenAt}
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</div>
                      <div className="text-sm">{f.location}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">File</div>
                      <div className="text-xs font-mono break-all">{f.filePath}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Why hidden</div>
                      <div className="text-sm text-muted-foreground">{f.reason}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">How to restore</div>
                      <div className="text-sm text-muted-foreground">{f.restoreNotes}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
