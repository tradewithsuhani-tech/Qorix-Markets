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
  Lock,
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
} from "lucide-react";
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

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [adjustUser, setAdjustUser] = useState<any | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch("/admin/users?limit=100");
      setUsers(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ModuleHeader icon={Shield} title="User Management" subtitle="Search users, review balances, KYC, risk and account security controls." />
        <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, referral code" className="bg-transparent outline-none flex-1 text-sm" />
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
  const type = mode === "deposits" ? "deposit" : "withdrawal";

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/transactions?type=${type}&status=${status}&limit=120`);
      setRows(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, mode]);

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
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
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
          <table className="w-full text-sm">
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
      </motion.div>
    </Layout>
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
            <ToggleRow icon={Lock} label="Maintenance Mode" value={!!settings?.maintenanceMode} onToggle={(v) => save({ maintenanceMode: v })} />
            <ToggleRow icon={CheckCircle} label="Registration Enabled" value={settings?.registrationEnabled !== false} onToggle={(v) => save({ registrationEnabled: v })} />
            <div>
              <label className="text-sm text-muted-foreground">Maintenance Message</label>
              <input value={settings?.maintenanceMessage ?? ""} onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })} onBlur={() => save({ maintenanceMessage: settings?.maintenanceMessage ?? "" })} className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm" />
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
