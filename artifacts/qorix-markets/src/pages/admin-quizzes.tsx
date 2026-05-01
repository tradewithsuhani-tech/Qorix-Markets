// Admin quizzes — single page with three sub-views driven by URL state:
//   * list             (default)         — table of all quizzes + create button
//   * detail editor    (?id=…)           — schedule fields + question editor + AI generator
//   * live monitor     (?id=…&view=live) — real-time leaderboard via SSE for an active quiz
//   * results / payout (?id=…&view=results) — final standings + mark-paid actions
//
// All four are intentionally on a single route so an admin can flip between
// "Edit", "Monitor", and "Results" tabs for a quiz without losing context.
//
// Why we still subscribe to SSE on the admin monitor view: the REST
// `/admin/quizzes/:id/monitor` endpoint is a snapshot for a one-shot fetch.
// During a live quiz the leaderboard mutates every few hundred ms; rather
// than poll aggressively we reuse the same user-facing event bus.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuizStream } from "@/hooks/use-quiz-stream";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useAdminListQuizzes, useAdminCreateQuiz, useAdminUpdateQuiz,
  useAdminCancelQuiz, useAdminForceStartQuiz,
  useAdminListQuizQuestions, useAdminAddQuizQuestions, useAdminUpdateQuizQuestion,
  useAdminDeleteQuizQuestion, useAdminGenerateQuizQuestionsAi,
  useAdminMonitorQuiz, useAdminGetQuizResults, useAdminMarkQuizWinnerPaid,
  type AdminQuiz, type AdminQuizQuestion, type AdminGenerateQuizAiDraft,
  type AdminQuizQuestionPayload,
} from "@workspace/api-client-react";
import {
  Sparkles, ChevronLeft, Play, Trash2, Plus, Save, X, Edit, Wand2,
  Activity, Users, Trophy, CheckCircle2, Clock, AlertTriangle, BarChart3,
} from "lucide-react";

// ── URL helpers ────────────────────────────────────────────────────────
function readParam(name: string): string | null {
  const m = new RegExp(`[?&]${name}=([^&]+)`).exec(window.location.search);
  return m ? decodeURIComponent(m[1]!) : null;
}

function fmtLocal(s: string) { return new Date(s).toLocaleString(); }

// Convert an ISO string from the server into the value format <input type="datetime-local"> expects.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

// ── Page entry ─────────────────────────────────────────────────────────
export default function AdminQuizzesPage() {
  const [location, navigate] = useLocation();
  const id = useMemo(() => {
    const v = readParam("id");
    return v ? parseInt(v, 10) : null;
  }, [location]);
  const view = useMemo(() => readParam("view"), [location]);

  const goList = () => navigate("/admin/quizzes");
  const goEdit = (qid: number) => navigate(`/admin/quizzes?id=${qid}`);
  const goMonitor = (qid: number) => navigate(`/admin/quizzes?id=${qid}&view=live`);
  const goResults = (qid: number) => navigate(`/admin/quizzes?id=${qid}&view=results`);

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto pb-32 md:pb-6">
        {!id && <QuizListView onCreate={goEdit} onOpen={goEdit} onMonitor={goMonitor} onResults={goResults} />}
        {id && view === "live" && <MonitorView id={id} onBack={() => goEdit(id)} />}
        {id && view === "results" && <ResultsView id={id} onBack={() => goEdit(id)} />}
        {id && !view && <DetailEditor id={id} onBack={goList} onMonitor={() => goMonitor(id)} onResults={() => goResults(id)} />}
      </div>
    </Layout>
  );
}

// ── List ───────────────────────────────────────────────────────────────
function QuizListView({ onCreate, onOpen, onMonitor, onResults }: {
  onCreate: (id: number) => void;
  onOpen: (id: number) => void;
  onMonitor: (id: number) => void;
  onResults: (id: number) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data, refetch, isLoading } = useAdminListQuizzes(statusFilter ? { status: statusFilter as never } : undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const quizzes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-sm text-muted-foreground">Schedule, monitor, and reward quiz winners.</p>
          </div>
        </div>
        <Button data-testid="button-create-quiz" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New quiz</Button>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        {[
          { v: undefined, l: "All" },
          { v: "scheduled", l: "Scheduled" },
          { v: "live", l: "Live" },
          { v: "ended", l: "Ended" },
          { v: "cancelled", l: "Cancelled" },
        ].map((b) => (
          <button
            key={b.l}
            onClick={() => setStatusFilter(b.v)}
            className={cn(
              "px-3 py-1.5 rounded-full border transition",
              statusFilter === b.v ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
            )}
          >{b.l}</button>
        ))}
      </div>

      {isLoading && <Card><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>}

      {!isLoading && quizzes.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No quizzes yet — create one to get started.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {quizzes.map((q) => (
          <Card key={q.id} data-testid={`admin-quiz-${q.id}`} className="hover:bg-white/5">
            <CardContent className="py-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{q.title}</span>
                  <StatusBadge status={q.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Starts {fmtLocal(q.scheduledStartAt)} · Prize {q.prizePool} {q.prizeCurrency} · Window {Math.round(q.questionTimeMs / 1000)}s
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => onOpen(q.id)}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button>
                {q.status === "live" && <Button size="sm" variant="outline" onClick={() => onMonitor(q.id)}><Activity className="w-3.5 h-3.5 mr-1" />Live</Button>}
                {(q.status === "live" || q.status === "ended") && <Button size="sm" variant="outline" onClick={() => onResults(q.id)}><Trophy className="w-3.5 h-3.5 mr-1" />Results</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateQuizDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(qid) => { setCreateOpen(false); refetch(); onCreate(qid); }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    scheduled: "bg-blue-500/15 text-blue-300 border-blue-400/30",
    live: "bg-red-500/15 text-red-300 border-red-400/30 animate-pulse",
    ended: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    cancelled: "bg-gray-500/15 text-gray-300 border-gray-400/30",
  }[status] ?? "bg-white/10 text-muted-foreground border-white/10";
  return <Badge className={cn("border", cls)}>{status}</Badge>;
}

// ── Create ─────────────────────────────────────────────────────────────
function CreateQuizDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: number) => void }) {
  const create = useAdminCreateQuiz();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [prizePool, setPrizePool] = useState("100");
  const [prizeCurrency, setPrizeCurrency] = useState("USDT");
  const [questionTimeSec, setQuestionTimeSec] = useState(15);
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  // Reset on open so the form is fresh each time.
  useEffect(() => {
    if (open) {
      setTitle(""); setDescription(""); setScheduledStartAt("");
      setPrizePool("100"); setPrizeCurrency("USDT"); setQuestionTimeSec(15);
      setNotifyEnabled(true);
    }
  }, [open]);

  const onSubmit = async () => {
    if (!title.trim() || !scheduledStartAt) {
      toast({ title: "Missing fields", description: "Title and start time are required.", variant: "destructive" });
      return;
    }
    try {
      const res = await create.mutateAsync({ data: {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledStartAt: localInputToIso(scheduledStartAt),
        prizePool: prizePool || "0",
        prizeCurrency,
        questionTimeMs: questionTimeSec * 1000,
        notifyEnabled,
      } });
      onCreated(res.id);
      toast({ title: "Quiz scheduled", description: "Now add 5 questions before the start time." });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Failed to create", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New quiz</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Title"><Input data-testid="input-quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday Crypto Quiz" /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — shown to players." rows={2} /></Field>
          <Field label="Start time"><Input data-testid="input-quiz-start" type="datetime-local" value={scheduledStartAt} onChange={(e) => setScheduledStartAt(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Prize pool"><Input value={prizePool} onChange={(e) => setPrizePool(e.target.value)} /></Field>
            <Field label="Currency"><Input value={prizeCurrency} onChange={(e) => setPrizeCurrency(e.target.value)} /></Field>
            <Field label="Time/Q (s)"><Input type="number" min={5} max={30} value={questionTimeSec} onChange={(e) => setQuestionTimeSec(parseInt(e.target.value || "15", 10))} /></Field>
          </div>
          <label className="flex items-start gap-2 text-sm pt-1">
            <input
              type="checkbox"
              data-testid="checkbox-quiz-notify"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Email + push joined players
              <span className="block text-xs text-muted-foreground">
                Sends a "starts in 5 min" ping and a "live now" ping to everyone who has joined.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="button-confirm-create" onClick={onSubmit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// ── Detail editor ──────────────────────────────────────────────────────
function DetailEditor({ id, onBack, onMonitor, onResults }: { id: number; onBack: () => void; onMonitor: () => void; onResults: () => void }) {
  // Reuse list endpoint to fetch a single quiz cheaply rather than adding another endpoint.
  const { data, refetch } = useAdminListQuizzes();
  const quiz = useMemo(() => (data?.data ?? []).find((q) => q.id === id), [data, id]);

  const update = useAdminUpdateQuiz();
  const cancel = useAdminCancelQuiz();
  const forceStart = useAdminForceStartQuiz();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [prizeCurrency, setPrizeCurrency] = useState("");
  const [questionTimeSec, setQuestionTimeSec] = useState(15);
  const [requireKyc, setRequireKyc] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  useEffect(() => {
    if (!quiz) return;
    setTitle(quiz.title);
    setDescription(quiz.description ?? "");
    setScheduledStartAt(isoToLocalInput(quiz.scheduledStartAt));
    setPrizePool(quiz.prizePool);
    setPrizeCurrency(quiz.prizeCurrency);
    setQuestionTimeSec(Math.round((quiz.questionTimeMs ?? 15000) / 1000));
    setRequireKyc(quiz.entryRules?.requireKyc !== false);
    setNotifyEnabled(quiz.notifyEnabled !== false);
  }, [quiz]);

  if (!quiz) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-3"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
        <div className="text-muted-foreground py-10 text-center">Loading quiz…</div>
      </div>
    );
  }

  const isScheduled = quiz.status === "scheduled";
  const isLive = quiz.status === "live";

  const onSave = async () => {
    try {
      await update.mutateAsync({ id, data: {
        title: title.trim(),
        description: description.trim(),
        scheduledStartAt: scheduledStartAt ? localInputToIso(scheduledStartAt) : undefined,
        prizePool,
        prizeCurrency,
        questionTimeMs: questionTimeSec * 1000,
        entryRules: { requireKyc },
        notifyEnabled,
      } });
      await refetch();
      toast({ title: "Saved" });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Save failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  const onCancelQuiz = async () => {
    if (!confirm("Cancel this quiz? Joined players will be notified.")) return;
    try { await cancel.mutateAsync({ id }); await refetch(); toast({ title: "Quiz cancelled" }); }
    catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Cancel failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  const onForceStart = async () => {
    if (!confirm("Start this quiz now? You can't undo.")) return;
    try { await forceStart.mutateAsync({ id }); await refetch(); toast({ title: "Quiz starting…" }); onMonitor(); }
    catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Start failed", description: err?.data?.error ?? "Make sure 5 questions are added.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
        <div className="flex gap-2 flex-wrap">
          {(isLive || quiz.status === "ended") && <Button size="sm" variant="outline" onClick={onMonitor}><Activity className="w-3.5 h-3.5 mr-1" />Monitor</Button>}
          {(quiz.status === "ended" || quiz.status === "live") && <Button size="sm" variant="outline" onClick={onResults}><Trophy className="w-3.5 h-3.5 mr-1" />Results</Button>}
          {isScheduled && <Button size="sm" variant="outline" onClick={onForceStart} disabled={forceStart.isPending}><Play className="w-3.5 h-3.5 mr-1" />Force start</Button>}
          {isScheduled && <Button size="sm" variant="destructive" onClick={onCancelQuiz} disabled={cancel.isPending}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Quiz settings</CardTitle>
            <StatusBadge status={quiz.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isScheduled} /></Field>
          <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isScheduled} /></Field>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Start time"><Input type="datetime-local" value={scheduledStartAt} onChange={(e) => setScheduledStartAt(e.target.value)} disabled={!isScheduled} /></Field>
            <Field label="Prize pool"><Input value={prizePool} onChange={(e) => setPrizePool(e.target.value)} disabled={!isScheduled} /></Field>
            <Field label="Currency"><Input value={prizeCurrency} onChange={(e) => setPrizeCurrency(e.target.value)} disabled={!isScheduled} /></Field>
            <Field label="Time/Q (s)"><Input type="number" min={5} max={30} value={questionTimeSec} onChange={(e) => setQuestionTimeSec(parseInt(e.target.value || "15", 10))} disabled={!isScheduled} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requireKyc} disabled={!isScheduled} onChange={(e) => setRequireKyc(e.target.checked)} />
            Require KYC to join
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="checkbox-quiz-notify-edit"
              checked={notifyEnabled}
              disabled={!isScheduled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Email + push joined players
              <span className="block text-xs text-muted-foreground">
                Sends a "starts in 5 min" ping and a "live now" ping to everyone who has joined.
              </span>
            </span>
          </label>
          {isScheduled && (
            <div className="flex justify-end pt-1">
              <Button onClick={onSave} disabled={update.isPending}><Save className="w-4 h-4 mr-1" />{update.isPending ? "Saving…" : "Save settings"}</Button>
            </div>
          )}
          {!isScheduled && <p className="text-xs text-muted-foreground">Quiz fields are locked once a quiz starts.</p>}
        </CardContent>
      </Card>

      <QuestionsEditor quizId={id} canEdit={isScheduled} />
    </div>
  );
}

// ── Questions editor ───────────────────────────────────────────────────
const MAX_QUESTIONS = 5;

function QuestionsEditor({ quizId, canEdit }: { quizId: number; canEdit: boolean }) {
  const { data, refetch, isLoading } = useAdminListQuizQuestions(quizId);
  const add = useAdminAddQuizQuestions();
  const update = useAdminUpdateQuizQuestion();
  const del = useAdminDeleteQuizQuestion();
  const generateAi = useAdminGenerateQuizQuestionsAi();
  const { toast } = useToast();

  const [editing, setEditing] = useState<{ qid: number | null; payload: AdminQuizQuestionPayload } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const questions = data?.data ?? [];
  const remaining = MAX_QUESTIONS - questions.length;

  const onAdd = () => setEditing({ qid: null, payload: { prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", source: "manual" } });
  const onEdit = (q: AdminQuizQuestion) => setEditing({ qid: q.id, payload: { prompt: q.prompt, options: [...q.options], correctIndex: q.correctIndex, explanation: q.explanation ?? "", source: q.source } });

  const onSave = async () => {
    if (!editing) return;
    const p = editing.payload;
    if (!p.prompt.trim() || p.options.length !== 4 || p.options.some((o) => !o.trim())) {
      toast({ title: "Invalid question", description: "Need a prompt and 4 non-empty options.", variant: "destructive" });
      return;
    }
    try {
      if (editing.qid == null) {
        await add.mutateAsync({ id: quizId, data: { question: p } });
      } else {
        await update.mutateAsync({ id: quizId, qid: editing.qid, data: p });
      }
      setEditing(null);
      await refetch();
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Save failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  const onDelete = async (qid: number) => {
    if (!confirm("Delete this question?")) return;
    try { await del.mutateAsync({ id: quizId, qid }); await refetch(); }
    catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Delete failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  const onAiBulk = async (drafts: AdminGenerateQuizAiDraft[]) => {
    try {
      // Persist drafts as questions with `replace:true` so the editor goes
      // straight to a usable 5-question set.
      await add.mutateAsync({ id: quizId, data: {
        replace: true,
        questions: drafts.map((d) => ({ prompt: d.prompt, options: d.options, correctIndex: d.correctIndex, explanation: d.explanation, source: "ai" })),
      } });
      await refetch();
      toast({ title: "Questions imported", description: `${drafts.length} AI questions saved.` });
      setAiOpen(false);
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Import failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Questions ({questions.length} / {MAX_QUESTIONS})</CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}><Wand2 className="w-3.5 h-3.5 mr-1" />Generate with AI</Button>
              <Button size="sm" onClick={onAdd} disabled={remaining <= 0}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && questions.length === 0 && (
          <div className="text-sm text-muted-foreground">No questions yet — add 5 manually or generate with AI.</div>
        )}
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">Q{idx + 1} · {q.source}</div>
                <div className="text-sm font-medium mb-2">{q.prompt}</div>
                <ul className="space-y-1 text-xs">
                  {q.options.map((o, i) => (
                    <li key={i} className={cn("flex items-center gap-2", i === q.correctIndex && "text-emerald-300")}>
                      <span className="font-mono w-4">{String.fromCharCode(65 + i)}.</span>
                      <span>{o}</span>
                      {i === q.correctIndex && <CheckCircle2 className="w-3 h-3" />}
                    </li>
                  ))}
                </ul>
                {q.explanation && <div className="text-xs text-muted-foreground mt-2 italic">Why: {q.explanation}</div>}
              </div>
              {canEdit && (
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(q)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(q.id)} className="text-red-300 hover:text-red-200"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      {editing && (
        <QuestionEditDialog
          payload={editing.payload}
          onChange={(payload) => setEditing({ ...editing, payload })}
          onClose={() => setEditing(null)}
          onSave={onSave}
          saving={add.isPending || update.isPending}
        />
      )}

      <AiGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        quizId={quizId}
        onAccept={onAiBulk}
        generate={generateAi}
      />
    </Card>
  );
}

function QuestionEditDialog({ payload, onChange, onClose, onSave, saving }: {
  payload: AdminQuizQuestionPayload;
  onChange: (p: AdminQuizQuestionPayload) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Prompt"><Textarea rows={3} value={payload.prompt} onChange={(e) => onChange({ ...payload, prompt: e.target.value })} /></Field>
          <div className="space-y-2">
            <Label className="text-xs">Options (pick the correct one)</Label>
            {payload.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={payload.correctIndex === idx}
                  onChange={() => onChange({ ...payload, correctIndex: idx })}
                />
                <span className="font-mono text-xs w-4">{String.fromCharCode(65 + idx)}</span>
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...payload.options];
                    next[idx] = e.target.value;
                    onChange({ ...payload, options: next });
                  }}
                />
              </div>
            ))}
          </div>
          <Field label="Explanation (shown after each round)">
            <Textarea rows={2} value={payload.explanation ?? ""} onChange={(e) => onChange({ ...payload, explanation: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save question"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerateDialog({ open, onOpenChange, quizId, onAccept, generate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quizId: number;
  onAccept: (drafts: AdminGenerateQuizAiDraft[]) => void;
  generate: ReturnType<typeof useAdminGenerateQuizQuestionsAi>;
}) {
  const [topic, setTopic] = useState("");
  const [drafts, setDrafts] = useState<AdminGenerateQuizAiDraft[]>([]);
  const { toast } = useToast();

  useEffect(() => { if (open) { setTopic(""); setDrafts([]); } }, [open]);

  const onGenerate = async () => {
    try {
      const res = await generate.mutateAsync({ id: quizId, data: { topicHint: topic.trim() || undefined } });
      setDrafts(res.data);
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "AI generation failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle><Wand2 className="w-4 h-4 inline mr-1.5" />Generate questions with AI</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Topic hint (optional)">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. crypto basics, India macro, Bitcoin history" />
          </Field>
          <div className="flex justify-end">
            <Button size="sm" onClick={onGenerate} disabled={generate.isPending}>{generate.isPending ? "Generating…" : "Generate 5 drafts"}</Button>
          </div>
          {drafts.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {drafts.map((d, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="text-xs font-medium mb-1">Q{idx + 1}: {d.prompt}</div>
                  <ul className="text-xs space-y-0.5">
                    {d.options.map((o, i) => (
                      <li key={i} className={cn(i === d.correctIndex && "text-emerald-300")}>
                        <span className="font-mono mr-1">{String.fromCharCode(65 + i)}.</span>{o}
                      </li>
                    ))}
                  </ul>
                  {d.explanation && <div className="text-[11px] text-muted-foreground italic mt-1">{d.explanation}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => onAccept(drafts)} disabled={drafts.length === 0}>Replace questions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Live monitor (admin) ───────────────────────────────────────────────
function MonitorView({ id, onBack }: { id: number; onBack: () => void }) {
  const { token } = useAuth();
  // REST snapshot for initial paint + leaderboard with displayName.
  const { data, refetch } = useAdminMonitorQuiz(id, { query: { refetchInterval: 5000 } });
  const { state, connectionStatus } = useQuizStream(id, token);

  // Refetch when SSE indicates a phase change so we get fresh runner info.
  useEffect(() => {
    if (state.status === "ended") void refetch();
  }, [state.status, refetch]);

  const quiz = data?.quiz;
  const leaderboard = state.leaderboard.length > 0 ? state.leaderboard : (data?.leaderboard ?? []);
  const participants = state.participants || data?.participants || 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
        <span className="text-xs text-muted-foreground">SSE: {connectionStatus}</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{quiz?.title ?? "…"}</CardTitle>
              {quiz && <p className="text-xs text-muted-foreground">{fmtLocal(quiz.scheduledStartAt)}</p>}
            </div>
            {quiz && <StatusBadge status={quiz.status} />}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Users className="w-4 h-4" />} label="Participants" value={String(participants)} />
          <Stat icon={<Trophy className="w-4 h-4" />} label="Prize pool" value={quiz ? `${quiz.prizePool} ${quiz.prizeCurrency}` : "—"} />
          <Stat icon={<Clock className="w-4 h-4" />} label="Question" value={state.currentQuestion ? `${state.currentQuestion.questionIndex + 1} / ${state.currentQuestion.totalQuestions}` : "—"} />
        </CardContent>
      </Card>

      {state.currentQuestion && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Now playing</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{state.currentQuestion.prompt}</div>
            <ul className="text-xs space-y-0.5 mt-1">
              {state.currentQuestion.options.map((o, i) => <li key={i}><span className="font-mono mr-1">{String.fromCharCode(65 + i)}.</span>{o}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {state.lastReveal && (
        <Card className="border-emerald-500/20">
          <CardContent className="py-3 text-sm">
            <BarChart3 className="w-4 h-4 inline mr-1.5 text-emerald-400" />
            Last answer was <strong>{String.fromCharCode(65 + state.lastReveal.correctIndex)}</strong>.
            {state.lastReveal.explanation && <span className="text-muted-foreground"> — {state.lastReveal.explanation}</span>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Leaderboard</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {leaderboard.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No standings yet.</div>
          ) : leaderboard.slice(0, 20).map((r) => (
            <div key={r.userId} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 text-xs font-mono text-muted-foreground">#{r.rank}</span>
                <span className="text-sm">{r.displayName}</span>
              </div>
              <span className="font-mono text-sm tabular-nums">{r.score}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// ── Results / mark paid ────────────────────────────────────────────────
function ResultsView({ id, onBack }: { id: number; onBack: () => void }) {
  const { data, refetch } = useAdminGetQuizResults(id);
  const markPaid = useAdminMarkQuizWinnerPaid();
  const { toast } = useToast();
  const [noteByWinner, setNoteByWinner] = useState<Record<number, string>>({});

  const onMark = async (wid: number) => {
    try {
      await markPaid.mutateAsync({ id, wid, data: { note: noteByWinner[wid] || undefined } });
      await refetch();
      toast({ title: "Marked paid" });
    } catch (e) {
      const err = e as { data?: { error?: string } };
      toast({ title: "Failed", description: err?.data?.error ?? "Try again.", variant: "destructive" });
    }
  };

  const quiz = data?.quiz;
  const winners = data?.winners ?? [];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{quiz?.title ?? "…"}</CardTitle>
              {quiz && <p className="text-xs text-muted-foreground">Ended {quiz.endedAt ? fmtLocal(quiz.endedAt) : "—"}</p>}
            </div>
            {quiz && <StatusBadge status={quiz.status} />}
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {data ? `${data.participants} participants · ${winners.length} winners` : "Loading…"}
        </CardContent>
      </Card>

      {winners.length === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No winners surfaced (quiz may have ended without scoring answers).</CardContent></Card>
      )}

      <div className="space-y-2">
        {winners.map((w) => {
          const isPaid = w.paidStatus === "paid";
          const isAutoCredited = isPaid && w.paidTxnId != null;
          return (
            <Card key={w.id} data-testid={`winner-row-${w.id}`} className={cn(isPaid && "bg-emerald-500/5 border-emerald-500/20")}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold",
                      w.rank === 1 && "bg-amber-500/20 text-amber-300 border border-amber-400/40",
                      w.rank === 2 && "bg-slate-300/20 text-slate-200 border border-slate-300/40",
                      w.rank === 3 && "bg-orange-500/20 text-orange-300 border border-orange-400/40",
                    )}>#{w.rank}</span>
                    <div>
                      <div className="text-sm font-medium">{w.userName ?? `User ${w.userId}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {w.userEmail ?? "—"} · {w.userPhone ?? "—"} · Score {w.finalScore}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-300">{w.prizeAmount} {w.prizeCurrency}</div>
                    {isAutoCredited ? (
                      <div
                        data-testid={`winner-credited-${w.id}`}
                        className="text-xs text-emerald-300 inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Credited {w.paidAt ? fmtLocal(w.paidAt) : ""}
                        <span className="ml-1 text-emerald-200/70">· txn #{w.paidTxnId}</span>
                      </div>
                    ) : isPaid ? (
                      <div className="text-xs text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Paid {w.paidAt ? fmtLocal(w.paidAt) : ""}</div>
                    ) : (
                      <div className="text-xs text-amber-300 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unpaid</div>
                    )}
                  </div>
                </div>
                {!isPaid && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Optional note (tx hash, reference)"
                      value={noteByWinner[w.id] ?? ""}
                      onChange={(e) => setNoteByWinner({ ...noteByWinner, [w.id]: e.target.value })}
                      className="text-xs"
                    />
                    <Button size="sm" onClick={() => onMark(w.id)} disabled={markPaid.isPending}>Mark paid</Button>
                  </div>
                )}
                {isPaid && w.paidNote && <div className="text-xs text-muted-foreground italic">Note: {w.paidNote}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Avoid an unused-import warning if _AdminQuiz_ is referenced via type position only.
export type { AdminQuiz, AdminQuizQuestion };
