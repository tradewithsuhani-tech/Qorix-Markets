// React hook for the quiz SSE stream.
//
// Why we use the native EventSource API but pass `?token=` instead of an
// Authorization header: the W3C EventSource API does not allow custom
// headers. The api-server `/quiz/:id/stream` route accepts the JWT via the
// `token` query string for exactly this reason. (We deliberately did NOT
// switch to fetch-based streaming because EventSource gives us automatic
// reconnect with `Last-Event-ID`, which we leverage here.)
//
// What this hook returns
// ──────────────────────
//   * `state`             — last-known structured state computed from events
//   * `connectionStatus`  — UI-facing connection indicator
//   * `serverNowOffsetMs` — clock-skew offset (server - client) so the
//                           question countdown stays honest even on devices
//                           with bad clocks. Updated on every event.
//   * `lastEventId`       — surfaced so the component can show a debug strip

import { useEffect, useRef, useState } from "react";

export type QuizSseEventPayload =
  | { type: "quiz_status_changed"; status: "scheduled" | "live" | "ended" | "cancelled"; serverTime: string }
  | {
      type: "question_started";
      questionId: number;
      questionIndex: number;
      totalQuestions: number;
      prompt: string;
      options: string[];
      windowMs: number;
      questionStartedAtMs: number;
      questionDeadlineMs: number;
      serverTime: string;
    }
  | {
      type: "question_ended";
      questionId: number;
      questionIndex: number;
      correctIndex: number;
      explanation: string;
      serverTime: string;
    }
  | { type: "leaderboard_update"; top: Array<{ userId: number; score: number; rank: number; displayName: string }>; participants: number; serverTime: string }
  | { type: "participant_count"; participants: number; serverTime: string }
  | {
      type: "quiz_ended";
      winners: Array<{ userId: number; rank: number; displayName: string; finalScore: number; prizeAmount: string; prizeCurrency: string }>;
      participants: number;
      serverTime: string;
    };

export type QuizSseEnvelope = {
  id: number;
  quizId: number;
  ts: string;
  payload: QuizSseEventPayload;
};

export type QuizConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export type QuizStreamState = {
  status: "scheduled" | "live" | "ended" | "cancelled" | null;
  currentQuestion: Extract<QuizSseEventPayload, { type: "question_started" }> | null;
  // Last revealed correct answer — cleared when a new question_started arrives.
  lastReveal: Extract<QuizSseEventPayload, { type: "question_ended" }> | null;
  leaderboard: Array<{ userId: number; score: number; rank: number; displayName: string }>;
  participants: number;
  winners: Extract<QuizSseEventPayload, { type: "quiz_ended" }>["winners"] | null;
};

const initialState: QuizStreamState = {
  status: null,
  currentQuestion: null,
  lastReveal: null,
  leaderboard: [],
  participants: 0,
  winners: null,
};

export function useQuizStream(quizId: number | null, token: string | null) {
  const [state, setState] = useState<QuizStreamState>(initialState);
  const [connectionStatus, setConnectionStatus] = useState<QuizConnectionStatus>("connecting");
  const [serverNowOffsetMs, setServerNowOffsetMs] = useState(0);
  const [lastEventId, setLastEventId] = useState<number>(0);
  const esRef = useRef<EventSource | null>(null);
  const seenEventIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!quizId || !token) return;
    setState(initialState);
    seenEventIdsRef.current = new Set();
    let closed = false;
    let backoff = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const url = `${import.meta.env.BASE_URL}api/quiz/${quizId}/stream?token=${encodeURIComponent(token!)}`;
      const es = new EventSource(url);
      esRef.current = es;
      setConnectionStatus("connecting");

      es.addEventListener("hello", (ev) => {
        try {
          const d = JSON.parse((ev as MessageEvent).data) as { ts: string; quizId: number; status: QuizStreamState["status"] };
          setServerNowOffsetMs(new Date(d.ts).getTime() - Date.now());
          setState((s) => ({ ...s, status: d.status ?? s.status }));
          setConnectionStatus("open");
          backoff = 1000;
        } catch {
          // ignore malformed hello
        }
      });

      const onEnvelope = (ev: MessageEvent) => {
        let env: QuizSseEnvelope;
        try { env = JSON.parse(ev.data) as QuizSseEnvelope; } catch { return; }
        // Per-event-id dedup: if EventSource auto-reconnected and replayed
        // events we've already processed, skip them.
        if (seenEventIdsRef.current.has(env.id)) return;
        seenEventIdsRef.current.add(env.id);
        setLastEventId(env.id);
        setServerNowOffsetMs(new Date(env.ts).getTime() - Date.now());

        const p = env.payload;
        switch (p.type) {
          case "quiz_status_changed":
            setState((s) => ({ ...s, status: p.status }));
            break;
          case "question_started":
            setState((s) => ({ ...s, currentQuestion: p, lastReveal: null }));
            break;
          case "question_ended":
            setState((s) => ({ ...s, lastReveal: p }));
            break;
          case "leaderboard_update":
            setState((s) => ({ ...s, leaderboard: p.top, participants: p.participants }));
            break;
          case "participant_count":
            setState((s) => ({ ...s, participants: p.participants }));
            break;
          case "quiz_ended":
            setState((s) => ({ ...s, winners: p.winners, status: "ended", currentQuestion: null }));
            break;
        }
      };

      // Subscribe to every event type by name so EventSource invokes our
      // handler. We do NOT use `onmessage` because the server names each
      // event (event: question_started, etc.) — anonymous "message" events
      // would never fire.
      const eventNames = [
        "quiz_status_changed",
        "question_started",
        "question_ended",
        "leaderboard_update",
        "participant_count",
        "quiz_ended",
      ];
      for (const name of eventNames) es.addEventListener(name, onEnvelope as EventListener);

      es.onerror = () => {
        // EventSource auto-reconnects on transient drops; close + manual
        // backoff reconnect handles the case where the server returns 5xx
        // or the connection is closed by an intermediary.
        if (closed) return;
        es.close();
        esRef.current = null;
        setConnectionStatus("reconnecting");
        const wait = Math.min(backoff, 15_000);
        reconnectTimer = setTimeout(connect, wait);
        backoff = Math.min(backoff * 2, 15_000);
      };
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnectionStatus("closed");
    };
  }, [quizId, token]);

  return { state, connectionStatus, serverNowOffsetMs, lastEventId };
}
