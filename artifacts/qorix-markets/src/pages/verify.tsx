import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute } from "wouter";
import { format, parseISO } from "date-fns";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Hash,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Clock,
  Trophy,
  AlertCircle,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";

type VerifyReport = {
  hashId: string;
  yearMonth: string;
  monthlyReturn: number;
  maxDrawdown: number;
  winRate: number;
  totalProfit: number;
  tradingDays: number;
  winningDays: number;
  startEquity: number;
  peakEquity: number;
  contentHash: string;
  generatedAt: string;
  isAuthentic: boolean;
};

async function fetchReport(hashId: string): Promise<VerifyReport> {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${base}/api/verify/${hashId}`);
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("server_error");
  return res.json();
}

function StatCard({ icon: Icon, label, value, color = "text-foreground" }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        <Icon style={{ width: 12, height: 12 }} />
        <span>{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export default function VerifyPage() {
  const [, params] = useRoute("/verify/:hashId");
  const [input, setInput] = useState(params?.hashId ?? "");
  const [query, setQuery] = useState(params?.hashId ?? "");
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not_found" | "error">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (params?.hashId) {
      setInput(params.hashId);
      setQuery(params.hashId);
    }
  }, [params?.hashId]);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    setStatus("loading");
    setReport(null);
    fetchReport(query.trim())
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setStatus("found");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setStatus(err.message === "not_found" ? "not_found" : "error");
        }
      });
    return () => { cancelled = true; };
  }, [query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) setQuery(input.trim());
  }

  function copyHash(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const monthLabel = report
    ? (() => { try { return format(parseISO(`${report.yearMonth}-01`), "MMMM yyyy"); } catch { return report.yearMonth; } })()
    : "";

  const generatedLabel = report
    ? (() => { try { return format(parseISO(report.generatedAt), "dd MMM yyyy, HH:mm 'UTC'"); } catch { return report.generatedAt; } })()
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <ShieldCheck style={{ width: 16, height: 16, color: "#60a5fa" }} />
          </div>
          <div>
            <div className="font-semibold text-sm">Qorix Markets</div>
            <div className="text-[11px] text-muted-foreground">Performance Report Verifier</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:block">
          Tamper-proof · SHA-256 verified
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 gap-8 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Verify Performance Report
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Enter a report ID to cryptographically verify an investor's monthly performance record. Any data modification will be detected.
          </p>
        </motion.div>

        {/* Search */}
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSearch}
          className="w-full"
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Hash style={{ width: 14, height: 14, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste report ID (e.g. 3a8f1c2d...)"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-sm outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || status === "loading"}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
            >
              {status === "loading" ? (
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              ) : (
                <Search style={{ width: 14, height: 14 }} />
              )}
              Verify
            </button>
          </div>
        </motion.form>

        {/* Results */}
        <AnimatePresence mode="wait">
          {status === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 style={{ width: 28, height: 28, animation: "spin 1s linear infinite", color: "#60a5fa" }} />
              <span className="text-sm">Verifying report…</span>
            </motion.div>
          )}

          {status === "not_found" && (
            <motion.div key="notfound" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full glass-card rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
              <AlertCircle style={{ width: 32, height: 32, color: "#f87171" }} />
              <div className="font-semibold">Report Not Found</div>
              <div className="text-sm text-muted-foreground">No report exists for this ID. Double-check the ID and try again.</div>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full glass-card rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
              <AlertCircle style={{ width: 32, height: 32, color: "#fb923c" }} />
              <div className="font-semibold">Verification Error</div>
              <div className="text-sm text-muted-foreground">Could not connect to the verification service. Please try again.</div>
            </motion.div>
          )}

          {status === "found" && report && (
            <motion.div key="found" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full space-y-5">
              {/* Authenticity banner */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${report.isAuthentic
                ? "bg-green-500/8 border-green-500/25"
                : "bg-red-500/8 border-red-500/25"}`}>
                {report.isAuthentic ? (
                  <ShieldCheck style={{ width: 24, height: 24, color: "#4ade80", flexShrink: 0 }} />
                ) : (
                  <ShieldAlert style={{ width: 24, height: 24, color: "#f87171", flexShrink: 0 }} />
                )}
                <div className="min-w-0">
                  <div className={`font-bold text-sm ${report.isAuthentic ? "text-green-400" : "text-red-400"}`}>
                    {report.isAuthentic ? "✓ Authentic — Data Verified" : "⚠ Integrity Check Failed"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {report.isAuthentic
                      ? "SHA-256 content hash matches the original — this report has not been tampered with."
                      : "The stored data does not match the original hash. This report may have been modified."}
                  </div>
                </div>
              </div>

              {/* Report header */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-base">{monthLabel} Performance Report</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar style={{ width: 11, height: 11 }} />
                    {monthLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock style={{ width: 11, height: 11 }} />
                    Generated {generatedLabel}
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={TrendingUp}
                  label="Monthly Return"
                  value={`${report.monthlyReturn >= 0 ? "+" : ""}${report.monthlyReturn.toFixed(2)}%`}
                  color={report.monthlyReturn >= 0 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  icon={TrendingDown}
                  label="Max Drawdown"
                  value={`${report.maxDrawdown.toFixed(2)}%`}
                  color="text-orange-400"
                />
                <StatCard
                  icon={Trophy}
                  label="Win Rate"
                  value={`${report.winRate.toFixed(1)}%`}
                  color={report.winRate >= 50 ? "text-yellow-400" : "text-red-400"}
                />
                <StatCard
                  icon={BarChart2}
                  label="Total Profit"
                  value={`${report.totalProfit >= 0 ? "+" : ""}$${Math.abs(report.totalProfit).toFixed(2)}`}
                  color={report.totalProfit >= 0 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  icon={Calendar}
                  label="Trading Days"
                  value={`${report.winningDays}W / ${report.tradingDays}T`}
                  color="text-blue-400"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Peak Equity"
                  value={`$${report.peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  color="text-purple-400"
                />
              </div>

              {/* Hash details */}
              <div className="glass-card rounded-2xl p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cryptographic Proof</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Report ID</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg flex-1 truncate">{report.hashId}</code>
                      <button onClick={() => copyHash(report.hashId)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                        {copied ? <CheckCheck style={{ width: 12, height: 12, color: "#4ade80" }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">SHA-256 Content Hash</div>
                    <code className="text-xs font-mono bg-white/5 px-3 py-1.5 rounded-lg block truncate">{report.contentHash}</code>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The content hash is computed from a deterministic canonical encoding of all report fields at generation time.
                  Any modification to the data produces a different hash, making tampering immediately detectable.
                </p>
              </div>
            </motion.div>
          )}

          {status === "idle" && !params?.hashId && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <ShieldCheck style={{ width: 40, height: 40, opacity: 0.25 }} />
              <p className="text-sm text-center max-w-xs">
                Enter a report ID above to verify the authenticity of a performance report.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/8 px-6 py-4 text-center text-[11px] text-muted-foreground">
        Qorix Markets · Performance Verification System · SHA-256 Tamper-Proof
      </footer>
    </div>
  );
}
