import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, Trash2, Users, Shield, TrendingUp,
  ArrowDownToLine, ArrowUpFromLine, Zap, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight,
  Bug, BarChart3, RefreshCw, ToggleLeft, ToggleRight, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";

async function apiFetch(path: string, method = "GET", body?: unknown) {
  return authFetch(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const CATEGORY_ICONS: Record<string, any> = {
  "Deposit Engine": ArrowDownToLine,
  "Profit Engine": TrendingUp,
  "Withdrawal Flow": ArrowUpFromLine,
  "Security": Shield,
  "Fraud Detection": AlertTriangle,
  "Load & Performance": Zap,
};

function StatusBadge({ status }: { status: "passed" | "failed" | "warning" }) {
  if (status === "passed") return (
    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
      <CheckCircle2 className="w-3 h-3" /> PASS
    </span>
  );
  if (status === "failed") return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
      <XCircle className="w-3 h-3" /> FAIL
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
      <AlertCircle className="w-3 h-3" /> WARN
    </span>
  );
}

function CategoryCard({ category }: { category: any }) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICONS[category.name] ?? FlaskConical;
  const passed = category.tests.filter((t: any) => t.status === "passed").length;
  const failed = category.tests.filter((t: any) => t.status === "failed").length;
  const warnings = category.tests.filter((t: any) => t.status === "warning").length;

  return (
    <motion.div
      className="border border-white/10 rounded-xl overflow-hidden bg-white/3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Icon className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">{category.name}</div>
          <div className="flex gap-3 mt-0.5 text-xs">
            <span className="text-emerald-400">{passed} passed</span>
            {failed > 0 && <span className="text-red-400">{failed} failed</span>}
            {warnings > 0 && <span className="text-amber-400">{warnings} warnings</span>}
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          {failed > 0 ? (
            <div className="w-2 h-2 rounded-full bg-red-400" />
          ) : warnings > 0 ? (
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
          {open ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 divide-y divide-white/5">
              {category.tests.map((test: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
                  <div className="mt-0.5"><StatusBadge status={test.status} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium">{test.name}</div>
                    <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{test.detail}</div>
                  </div>
                  {test.durationMs !== undefined && (
                    <div className="text-xs text-white/30 shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {test.durationMs}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminTestPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["test-status"],
    queryFn: () => apiFetch("/api/test/status"),
    refetchInterval: 5000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["test-status"] });

  const enableMutation = useMutation({
    mutationFn: () => apiFetch("/api/test/enable", "POST"),
    onSuccess: (d) => { addLog(d.message); invalidate(); toast({ title: "Test Mode Enabled", description: d.message }); },
    onError: (e: any) => { addLog(`ERROR: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const disableMutation = useMutation({
    mutationFn: () => apiFetch("/api/test/disable", "POST"),
    onSuccess: (d) => { addLog(d.message); invalidate(); toast({ title: "Test Mode Disabled" }); },
    onError: (e: any) => { addLog(`ERROR: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const seedMutation = useMutation({
    mutationFn: () => apiFetch("/api/test/seed-users", "POST"),
    onSuccess: (d) => { addLog(d.message); invalidate(); toast({ title: "Users Seeded", description: d.message }); },
    onError: (e: any) => { addLog(`ERROR: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const runAllMutation = useMutation({
    mutationFn: () => apiFetch("/api/test/run-all", "POST"),
    onSuccess: (d) => {
      const { summary, durationMs } = d.report;
      addLog(`Tests complete in ${durationMs}ms: ${summary.passed} passed, ${summary.failed} failed, ${summary.warnings} warnings`);
      invalidate();
      toast({ title: "Test Suite Complete", description: `${summary.passed}/${summary.total} tests passed in ${(durationMs/1000).toFixed(1)}s` });
    },
    onError: (e: any) => { addLog(`ERROR: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => apiFetch("/api/test/cleanup", "DELETE"),
    onSuccess: (d) => { addLog(d.message); invalidate(); toast({ title: "Cleanup Complete", description: d.message }); },
    onError: (e: any) => { addLog(`ERROR: ${e.message}`); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const testMode = status?.testMode ?? false;
  const report = status?.report;
  const isRunning = runAllMutation.isPending || seedMutation.isPending;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
              <FlaskConical className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Test Lab</h1>
              <p className="text-sm text-white/50">Safe simulation environment — no real funds affected</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
              testMode
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/15 text-white/50"
            }`}>
              <div className={`w-2 h-2 rounded-full ${testMode ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
              {testMode ? "Test Mode ON" : "Test Mode OFF"}
            </div>

            <button
              onClick={() => testMode ? disableMutation.mutate() : enableMutation.mutate()}
              disabled={enableMutation.isPending || disableMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                testMode
                  ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              {testMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {testMode ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        {!testMode && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-300">Test Mode is OFF</div>
              <div className="text-xs text-white/50 mt-0.5">Enable Test Mode first to prevent any interference with real user data or funds. All simulations are isolated within test user accounts.</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Test Users", value: status?.testUserCount ?? 0, icon: Users, color: "text-blue-400" },
            { label: "Total Tests", value: report?.summary?.total ?? "—", icon: FlaskConical, color: "text-violet-400" },
            { label: "Passed", value: report?.summary?.passed ?? "—", icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Failed", value: report?.summary?.failed ?? "—", icon: XCircle, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="text-xs text-white/50">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={!testMode || seedMutation.isPending}
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {seedMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {seedMutation.isPending ? "Seeding…" : "Seed 50 Test Users"}
          </button>

          <button
            onClick={() => { addLog("Starting full test suite…"); runAllMutation.mutate(); }}
            disabled={!testMode || isRunning || (status?.testUserCount ?? 0) === 0}
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {runAllMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {runAllMutation.isPending ? "Running Tests…" : "Run Full Test Suite"}
          </button>

          <button
            onClick={() => cleanupMutation.mutate()}
            disabled={!testMode || cleanupMutation.isPending}
            className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {cleanupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {cleanupMutation.isPending ? "Cleaning…" : "Cleanup Test Data"}
          </button>
        </div>

        {logs.length > 0 && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-4">
            <div className="text-xs font-mono text-white/40 mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Console
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-emerald-300/80">{log}</div>
              ))}
            </div>
          </div>
        )}

        {report && (
          <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-400" />
                Test Report
              </h2>
              <div className="text-xs text-white/40">
                {new Date(report.timestamp).toLocaleString()} · {(report.durationMs / 1000).toFixed(2)}s
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Passed", val: report.summary.passed, pct: Math.round(report.summary.passed / report.summary.total * 100), color: "emerald" },
                { label: "Warnings", val: report.summary.warnings, pct: Math.round(report.summary.warnings / report.summary.total * 100), color: "amber" },
                { label: "Failed", val: report.summary.failed, pct: Math.round(report.summary.failed / report.summary.total * 100), color: "red" },
              ].map(({ label, val, pct, color }) => (
                <div key={label} className={`p-4 rounded-xl border bg-${color}-500/5 border-${color}-500/20`}>
                  <div className={`text-2xl font-bold text-${color}-400`}>{val}</div>
                  <div className="text-xs text-white/50 mt-0.5">{label}</div>
                  <div className={`mt-2 text-xs text-${color}-400/60`}>{pct}% of total</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {report.categories.map((cat: any, i: number) => (
                <CategoryCard key={i} category={cat} />
              ))}
            </div>

            {report.performance.length > 0 && (
              <div className="border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Performance Metrics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.performance.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                      <span className="text-white/60">{p.metric}</span>
                      <span className="text-amber-300 font-mono font-medium">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.bugs.length > 0 && (
              <div className="border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-400" /> Detected Issues ({report.bugs.length})
                </h3>
                <div className="space-y-2">
                  {report.bugs.map((bug: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg border text-sm ${
                      bug.severity === "high"
                        ? "bg-red-500/5 border-red-500/20"
                        : bug.severity === "medium"
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                          bug.severity === "high" ? "bg-red-500/20 text-red-400"
                          : bug.severity === "medium" ? "bg-amber-500/20 text-amber-400"
                          : "bg-blue-500/20 text-blue-400"
                        }`}>{bug.severity}</span>
                      </div>
                      <div className="text-white/80 text-xs">{bug.description}</div>
                      <div className="text-white/40 text-xs mt-1">→ {bug.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.bugs.length === 0 && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-emerald-300">No Critical Issues Detected</div>
                  <div className="text-xs text-white/50 mt-0.5">All test scenarios passed without any flagged bugs. System is operating within expected parameters.</div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!report && !statusLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical className="w-12 h-12 text-white/15 mb-4" />
            <div className="text-white/40 text-sm">No test report yet</div>
            <div className="text-white/25 text-xs mt-1">Enable test mode → seed users → run the full test suite</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
