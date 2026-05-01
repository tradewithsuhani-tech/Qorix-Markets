// User-facing quiz hub.
//
// Three states share one route on purpose:
//   * No selection           → list of upcoming + recent quizzes ("Lobby")
//   * `?id=…` not yet live   → countdown to start + Join button
//   * `?id=…` & live         → live play UI (fed by SSE)
//   * `?id=…` & ended        → final leaderboard
//
// Keeping all three in one page avoids the route-flip flash when a quiz
// transitions from `scheduled → live` mid-view (the layout stays the same;
// just the inner section swaps).

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuizStream } from "@/hooks/use-quiz-stream";
import {
  useListVisibleQuizzes,
  useGetQuizDetail,
  useJoinQuiz,
  useSubmitQuizAnswer,
  useGetMyQuizStanding,
  useGetMyPastQuizzes,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sparkles, Clock, Trophy, Users, Wifi, WifiOff, ChevronLeft, AlertTriangle, Check, X } from "lucide-react";

function formatDate(s: string) {
  return new Date(s).toLocaleString();
}

function useCountdown(targetMs: number | null, serverOffsetMs: number) {
  // serverOffsetMs = serverTime - clientTime. We want the displayed countdown
  // to use serverNow = clientNow + offset, otherwise clients with skewed
  // clocks would countdown faster/slower than the server's deadline.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  if (!targetMs) return { ms: 0, seconds: 0, percent: 0 };
  const serverNow = now + serverOffsetMs;
  const ms = Math.max(0, targetMs - serverNow);
  return { ms, seconds: Math.ceil(ms / 1000), serverNow };
}

// ── Lobby: list of visible quizzes ──────────────────────────────────────
function QuizLobby({ onOpen }: { onOpen: (id: number) => void }) {
  const { data, isLoading } = useListVisibleQuizzes();
  const { data: past } = useGetMyPastQuizzes({ limit: 10 });

  const upcoming = useMemo(() => (data?.data ?? []).filter((q) => q.status === "scheduled"), [data]);
  const live = useMemo(() => (data?.data ?? []).filter((q) => q.status === "live"), [data]);
  const ended = useMemo(() => (data?.data ?? []).filter((q) => q.status === "ended"), [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground">Live giveaway quizzes — answer fast, climb the leaderboard, win prizes.</p>
        </div>
      </div>

      {isLoading && <Card><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>}

      {live.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-lg font-semibold">Live now</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {live.map((q) => <QuizCard key={q.id} q={q} onOpen={onOpen} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No upcoming quizzes — check back soon.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((q) => <QuizCard key={q.id} q={q} onOpen={onOpen} />)}
          </div>
        )}
      </section>

      {ended.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recently ended</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ended.map((q) => <QuizCard key={q.id} q={q} onOpen={onOpen} />)}
          </div>
        </section>
      )}

      {past?.data && past.data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Your past quizzes</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {past.data.map((q) => (
              <Card key={q.id} className="hover:bg-white/5 cursor-pointer" onClick={() => onOpen(q.id)}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{q.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Score: {q.myScore}{q.myRank ? ` · Rank #${q.myRank}` : ""}
                      {q.myPrize ? ` · Won ${q.myPrize.amount} ${q.myPrize.currency}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline">Ended</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QuizCard({ q, onOpen }: { q: { id: number; title: string; description: string; status: string; scheduledStartAt: string; prizePool: string; prizeCurrency: string; joined?: boolean }; onOpen: (id: number) => void }) {
  const isLive = q.status === "live";
  const isEnded = q.status === "ended";
  return (
    <Card data-testid={`quiz-card-${q.id}`} className="hover:bg-white/5 transition cursor-pointer" onClick={() => onOpen(q.id)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{q.title}</CardTitle>
          {isLive && <Badge className="bg-red-500/20 text-red-300 border border-red-400/30 animate-pulse">Live</Badge>}
          {isEnded && <Badge variant="outline">Ended</Badge>}
          {q.status === "scheduled" && q.joined && <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Joined</Badge>}
          {q.status === "scheduled" && !q.joined && <Badge variant="outline">Upcoming</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.description && <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-400" />{q.prizePool} {q.prizeCurrency}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(q.scheduledStartAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quiz detail / live play ─────────────────────────────────────────────
function QuizDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: detail, refetch: refetchDetail } = useGetQuizDetail(id);
  const { data: standing } = useGetMyQuizStanding(id, { query: { refetchInterval: detail?.quiz.status === "live" ? 5000 : false } });
  const join = useJoinQuiz();
  const submitAnswer = useSubmitQuizAnswer();

  // Stream — only opens when we know the quiz is approaching live or already live.
  const streamId = detail && (detail.quiz.status === "live" || detail.quiz.status === "scheduled") ? id : null;
  const { state, connectionStatus, serverNowOffsetMs } = useQuizStream(streamId, token);

  const [picked, setPicked] = useState<number | null>(null);
  const [pickedQuestionId, setPickedQuestionId] = useState<number | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<{ scoreAwarded: number; rank: number | null } | null>(null);

  // When the SSE state changes status, re-fetch the REST detail so things
  // like winners + ended state appear without a manual refresh.
  useEffect(() => {
    if (state.status === "ended" || state.status === "cancelled") {
      void refetchDetail();
    }
  }, [state.status, refetchDetail]);

  // Reset per-question pick state whenever a new question arrives.
  useEffect(() => {
    if (state.currentQuestion && state.currentQuestion.questionId !== pickedQuestionId) {
      setPicked(null);
      setSubmitFeedback(null);
      setPickedQuestionId(null);
    }
  }, [state.currentQuestion, pickedQuestionId]);

  if (!detail) {
    return <div className="py-10 text-center text-muted-foreground">Loading quiz…</div>;
  }

  const quiz = detail.quiz;
  const isLive = state.status === "live" || quiz.status === "live";
  const hasEnded = state.status === "ended" || quiz.status === "ended";
  const isCancelled = quiz.status === "cancelled";
  const isJoined = detail.joined;

  const onJoin = async () => {
    try {
      await join.mutateAsync({ id });
      await refetchDetail();
      toast({ title: "You're in!", description: "We'll auto-start the questions when the quiz begins." });
    } catch (err) {
      const e = err as { data?: { error?: string; message?: string } };
      toast({
        title: "Could not join",
        description: e?.data?.message ?? e?.data?.error ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onPick = async (idx: number) => {
    if (!state.currentQuestion) return;
    if (picked !== null) return;
    setPicked(idx);
    setPickedQuestionId(state.currentQuestion.questionId);
    try {
      const res = await submitAnswer.mutateAsync({
        id,
        data: { questionId: state.currentQuestion.questionId, selectedOption: idx },
      });
      setSubmitFeedback({ scoreAwarded: res.scoreAwarded, rank: res.rank ?? null });
    } catch (err) {
      const e = err as { data?: { error?: string } };
      // Graceful handling for the obvious server states.
      const msg = e?.data?.error;
      if (msg === "kyc_required") {
        toast({ title: "KYC required", description: "Complete KYC to play.", variant: "destructive" });
      } else if (msg === "too_late") {
        toast({ title: "Too late", description: "The window for that question closed." });
      } else if (msg === "already_answered") {
        // benign — the server is being strict, ignore
      } else {
        toast({ title: "Couldn't submit answer", description: msg ?? "Try again next round.", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
        <ConnectionDot status={connectionStatus} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl">{quiz.title}</CardTitle>
            {isLive && <Badge className="bg-red-500/20 text-red-300 border border-red-400/30 animate-pulse">Live</Badge>}
            {hasEnded && <Badge variant="outline">Ended</Badge>}
            {isCancelled && <Badge className="bg-gray-500/20 text-gray-300">Cancelled</Badge>}
          </div>
          {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-400" />Prize pool: <strong className="text-foreground">{quiz.prizePool} {quiz.prizeCurrency}</strong></span>
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{state.participants || detail.participants} joined</span>
          </div>
        </CardHeader>
      </Card>

      {isCancelled && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> This quiz was cancelled by the admin.</CardContent>
        </Card>
      )}

      {!isLive && !hasEnded && !isCancelled && (
        <Card>
          <CardContent className="py-6 space-y-4 text-center">
            <ScheduledCountdown startAt={quiz.scheduledStartAt} serverOffsetMs={serverNowOffsetMs} />
            {!isJoined ? (
              <Button data-testid="button-join-quiz" onClick={onJoin} disabled={join.isPending} size="lg">{join.isPending ? "Joining…" : "Join quiz"}</Button>
            ) : (
              <div className="text-sm text-emerald-300">You're in. Stay on this page — questions appear automatically.</div>
            )}
          </CardContent>
        </Card>
      )}

      {isLive && state.currentQuestion && isJoined && (
        <LiveQuestionCard
          question={state.currentQuestion}
          reveal={state.lastReveal && state.lastReveal.questionId === state.currentQuestion.questionId ? state.lastReveal : null}
          picked={picked}
          submitFeedback={submitFeedback}
          serverOffsetMs={serverNowOffsetMs}
          onPick={onPick}
        />
      )}

      {isLive && !state.currentQuestion && (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Get ready — next question loading…</CardContent></Card>
      )}

      {isLive && !isJoined && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm">This quiz has already started. Watching as a spectator.</CardContent>
        </Card>
      )}

      {(isLive || hasEnded) && (
        <Leaderboard rows={state.leaderboard} myStanding={standing} />
      )}

      {hasEnded && (
        <WinnersCard winners={(state.winners ?? detail.winners) as Array<{ rank: number; displayName: string; finalScore: number; prizeAmount: string; prizeCurrency: string; userId: number }>} />
      )}
    </div>
  );
}

function ScheduledCountdown({ startAt, serverOffsetMs }: { startAt: string; serverOffsetMs: number }) {
  const target = useMemo(() => new Date(startAt).getTime(), [startAt]);
  const { seconds } = useCountdown(target, serverOffsetMs);
  if (seconds <= 0) {
    return <div className="text-base font-medium">Starting now…</div>;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Starts in</div>
      <div className="text-3xl font-bold font-mono tabular-nums">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</div>
    </div>
  );
}

function LiveQuestionCard({
  question, reveal, picked, submitFeedback, serverOffsetMs, onPick,
}: {
  question: Extract<QuizSseEventPayloadX, { type: "question_started" }>;
  reveal: Extract<QuizSseEventPayloadX, { type: "question_ended" }> | null;
  picked: number | null;
  submitFeedback: { scoreAwarded: number; rank: number | null } | null;
  serverOffsetMs: number;
  onPick: (idx: number) => void;
}) {
  const { ms, seconds } = useCountdown(question.questionDeadlineMs, serverOffsetMs);
  const total = question.windowMs;
  const remaining = Math.max(0, ms);
  const percent = Math.max(0, Math.min(100, (remaining / total) * 100));
  const showReveal = !!reveal;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {question.questionIndex + 1} / {question.totalQuestions}</span>
          <span className="font-mono tabular-nums text-base text-foreground">{seconds}s</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-100" style={{ width: `${percent}%` }} />
        </div>
        <CardTitle className="text-base leading-snug pt-2">{question.prompt}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {question.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isCorrect = showReveal && reveal!.correctIndex === idx;
          const isWrongPick = showReveal && isPicked && !isCorrect;
          return (
            <button
              key={idx}
              data-testid={`option-${idx}`}
              disabled={picked !== null || showReveal || remaining <= 0}
              onClick={() => onPick(idx)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border transition flex items-center gap-3",
                "border-white/10 bg-white/5 hover:bg-white/10",
                isPicked && !showReveal && "border-blue-400/60 bg-blue-500/10",
                showReveal && isCorrect && "border-emerald-400/60 bg-emerald-500/10",
                isWrongPick && "border-red-400/60 bg-red-500/10",
                (picked !== null && !isPicked) && "opacity-60",
              )}
            >
              <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 inline-flex items-center justify-center text-xs font-mono">{String.fromCharCode(65 + idx)}</span>
              <span className="flex-1 text-sm">{opt}</span>
              {showReveal && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
              {isWrongPick && <X className="w-4 h-4 text-red-400" />}
            </button>
          );
        })}
        {submitFeedback && (
          <div className="text-xs text-muted-foreground pt-2">
            {submitFeedback.scoreAwarded > 0 ? <span className="text-emerald-300">+{submitFeedback.scoreAwarded} points!</span> : <span>Locked in.</span>}
            {submitFeedback.rank ? ` · Current rank #${submitFeedback.rank}` : ""}
          </div>
        )}
        {showReveal && reveal!.explanation && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-white/5 mt-2">
            <strong className="text-foreground">Why:</strong> {reveal!.explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Avoid an awkward circular import — re-declare the union locally so the
// LiveQuestionCard's prop types stay readable.
type QuizSseEventPayloadX =
  | { type: "question_started"; questionId: number; questionIndex: number; totalQuestions: number; prompt: string; options: string[]; windowMs: number; questionStartedAtMs: number; questionDeadlineMs: number; serverTime: string }
  | { type: "question_ended"; questionId: number; questionIndex: number; correctIndex: number; explanation: string; serverTime: string };

function Leaderboard({ rows, myStanding }: {
  rows: Array<{ userId: number; score: number; rank: number; displayName: string }>;
  myStanding: { score: number; rank?: number | null; participants: number } | undefined;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Leaderboard</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">Standings appear once answers come in…</div>
        ) : rows.map((r) => (
          <div key={r.userId} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold",
                r.rank === 1 && "bg-amber-500/20 text-amber-300 border border-amber-400/40",
                r.rank === 2 && "bg-slate-300/20 text-slate-200 border border-slate-300/40",
                r.rank === 3 && "bg-orange-500/20 text-orange-300 border border-orange-400/40",
                r.rank > 3 && "bg-white/5 text-muted-foreground",
              )}>{r.rank}</span>
              <span className="text-sm">{r.displayName}</span>
            </div>
            <span className="font-mono text-sm tabular-nums">{r.score}</span>
          </div>
        ))}
        {myStanding && myStanding.rank && myStanding.rank > rows.length && (
          <div className="flex items-center justify-between py-1.5 px-2 mt-2 border-t border-white/10 pt-2 text-blue-300">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold bg-blue-500/20 border border-blue-400/40">{myStanding.rank}</span>
              <span className="text-sm">You</span>
            </div>
            <span className="font-mono text-sm tabular-nums">{myStanding.score}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WinnersCard({ winners }: { winners: Array<{ rank: number; displayName: string; finalScore: number; prizeAmount: string; prizeCurrency: string; userId: number }> }) {
  if (!winners || winners.length === 0) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No winners — the quiz ended without scoring answers.</CardContent></Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Winners</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {winners.map((w) => (
          <div key={w.rank} data-testid={`winner-${w.rank}`} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/15">
            <div className="flex items-center gap-3">
              <span className={cn(
                "w-9 h-9 rounded-full inline-flex items-center justify-center text-sm font-bold",
                w.rank === 1 && "bg-amber-500/20 text-amber-300 border border-amber-400/40",
                w.rank === 2 && "bg-slate-300/20 text-slate-200 border border-slate-300/40",
                w.rank === 3 && "bg-orange-500/20 text-orange-300 border border-orange-400/40",
              )}>#{w.rank}</span>
              <div>
                <div className="text-sm font-medium">{w.displayName}</div>
                <div className="text-xs text-muted-foreground">Score {w.finalScore}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-amber-300">{w.prizeAmount} {w.prizeCurrency}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConnectionDot({ status }: { status: "connecting" | "open" | "reconnecting" | "closed" }) {
  if (status === "open") return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Wifi className="w-3 h-3 text-emerald-400" /> Live</span>;
  if (status === "connecting") return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Wifi className="w-3 h-3 text-blue-400 animate-pulse" /> Connecting…</span>;
  if (status === "reconnecting") return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Wifi className="w-3 h-3 text-amber-400 animate-pulse" /> Reconnecting…</span>;
  return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>;
}

// ── Page entry — chooses between lobby and detail based on `?id=…` ──────
export default function QuizzesPage() {
  const [location, navigate] = useLocation();
  // Read `?id=…` from the URL (wouter doesn't have a built-in query parser).
  const idParam = useMemo(() => {
    const search = window.location.search;
    const m = /[?&]id=(\d+)/.exec(search);
    return m ? parseInt(m[1]!, 10) : null;
  }, [location]);

  const onOpen = (id: number) => navigate(`/quizzes?id=${id}`);
  const onBack = () => navigate("/quizzes");

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto pb-32 md:pb-6">
        {idParam ? <QuizDetail id={idParam} onBack={onBack} /> : <QuizLobby onOpen={onOpen} />}
      </div>
    </Layout>
  );
}
