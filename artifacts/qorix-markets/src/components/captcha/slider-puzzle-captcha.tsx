import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AlertCircle, Check, RefreshCw } from "lucide-react";

/**
 * Batch 9.1 — Slider puzzle captcha (frontend).
 *
 * Self-contained component — no parent state plumbing required:
 *   <SliderPuzzleCaptcha onSuccess={(token) => setCaptchaToken(token)} />
 *
 * On mount it fetches a challenge from `/api/captcha/slider/challenge`,
 * renders a draggable piece + a target slot, captures the user's
 * pointer trajectory, and POSTs the solution to
 * `/api/captcha/slider/verify`. On success it calls `onSuccess(token)`
 * with a one-time `slider.v1.*` token the parent passes to the
 * actual auth submit.
 *
 * Geometry (slider width, piece width, target X) is server-driven so
 * the server can change it without coordinating a client release.
 *
 * The server validates: tolerance, sample count, duration window, and
 * y-variance (perfectly horizontal y => bot). B9.4 will add stricter
 * trajectory/jitter checks; this component already collects everything
 * those checks will need.
 */

interface Challenge {
  challengeId: string;
  targetX: number;
  sliderWidth: number;
  pieceWidth: number;
  expiresAt: number;
}

interface TrajectorySample {
  x: number;
  y: number;
  t: number;
}

export interface SliderPuzzleCaptchaProps {
  onSuccess: (token: string) => void;
  onError?: (msg: string) => void;
  /**
   * Override base URL for the captcha API. Defaults to
   * `${import.meta.env.BASE_URL}api`. Useful if the consumer is on a
   * different origin (e.g. cross-origin admin panel).
   */
  apiBase?: string;
  className?: string;
}

const DEFAULT_API_BASE = `${(import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "")}/api`;

type ComponentState =
  | "loading"
  | "ready"
  | "dragging"
  | "verifying"
  | "success"
  | "error";

export function SliderPuzzleCaptcha({
  onSuccess,
  onError,
  apiBase,
  className,
}: SliderPuzzleCaptchaProps) {
  const baseUrl = apiBase ?? DEFAULT_API_BASE;

  const [state, setState] = useState<ComponentState>("loading");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [pieceX, setPieceX] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trajectoryRef = useRef<TrajectorySample[]>([]);
  const dragOriginRef = useRef<{ pointerOffsetX: number; tStart: number } | null>(
    null,
  );
  const trackRef = useRef<HTMLDivElement | null>(null);
  // React Strict Mode runs effects twice in dev — without this guard
  // we'd burn one challenge on the first render.
  const fetchedOnceRef = useRef(false);

  const fetchChallenge = useCallback(async () => {
    setState("loading");
    setErrorMsg(null);
    setPieceX(0);
    trajectoryRef.current = [];
    dragOriginRef.current = null;
    try {
      const res = await fetch(`${baseUrl}/captcha/slider/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Challenge;
      if (
        !data.challengeId ||
        typeof data.targetX !== "number" ||
        typeof data.sliderWidth !== "number" ||
        typeof data.pieceWidth !== "number"
      ) {
        throw new Error("Bad challenge response");
      }
      setChallenge(data);
      setState("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load captcha";
      setErrorMsg(msg);
      setState("error");
      onError?.(msg);
    }
  }, [baseUrl, onError]);

  useEffect(() => {
    if (fetchedOnceRef.current) return;
    fetchedOnceRef.current = true;
    void fetchChallenge();
  }, [fetchChallenge]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (state !== "ready" || !challenge || !trackRef.current) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const trackRect = trackRef.current.getBoundingClientRect();
      dragOriginRef.current = {
        pointerOffsetX: e.clientX - trackRect.left - pieceX,
        tStart: performance.now(),
      };
      trajectoryRef.current = [
        { x: pieceX, y: e.clientY - trackRect.top, t: 0 },
      ];
      setState("dragging");
    },
    [state, challenge, pieceX],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (
        state !== "dragging" ||
        !challenge ||
        !trackRef.current ||
        !dragOriginRef.current
      )
        return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const maxX = challenge.sliderWidth - challenge.pieceWidth;
      let nextX =
        e.clientX - trackRect.left - dragOriginRef.current.pointerOffsetX;
      if (nextX < 0) nextX = 0;
      if (nextX > maxX) nextX = maxX;
      setPieceX(nextX);
      trajectoryRef.current.push({
        x: nextX,
        y: e.clientY - trackRect.top,
        t: performance.now() - dragOriginRef.current.tStart,
      });
    },
    [state, challenge],
  );

  const onPointerUp = useCallback(
    async (e: ReactPointerEvent<HTMLDivElement>) => {
      if (state !== "dragging" || !challenge) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Some browsers throw if the pointer was never captured (e.g. on
        // pointercancel). Safe to ignore.
      }
      setState("verifying");
      try {
        const res = await fetch(`${baseUrl}/captcha/slider/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            finalX: pieceX,
            trajectory: trajectoryRef.current,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          token?: string;
          error?: string;
        };
        if (data.ok && data.token) {
          setState("success");
          onSuccess(data.token);
        } else {
          const msg = data.error ?? "Verification failed";
          setErrorMsg(msg);
          setState("error");
          onError?.(msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setErrorMsg(msg);
        setState("error");
        onError?.(msg);
      }
    },
    [state, challenge, pieceX, baseUrl, onSuccess, onError],
  );

  const sliderWidth = challenge?.sliderWidth ?? 320;
  const pieceWidth = challenge?.pieceWidth ?? 40;
  const isInteractive = state === "ready" || state === "dragging";

  return (
    <div
      className={`slider-puzzle-captcha ${className ?? ""}`}
      style={{ userSelect: "none", maxWidth: sliderWidth }}
    >
      <div
        ref={trackRef}
        style={{
          position: "relative",
          width: sliderWidth,
          height: 60,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        {challenge && state !== "success" && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: challenge.targetX,
              top: 10,
              width: pieceWidth,
              height: 40,
              border: "2px dashed rgba(255,255,255,0.25)",
              borderRadius: 6,
              boxShadow: "inset 0 0 8px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }}
          />
        )}
        {challenge && (
          <div
            role="slider"
            aria-label="Drag the puzzle piece into the dashed slot"
            aria-valuemin={0}
            aria-valuemax={sliderWidth - pieceWidth}
            aria-valuenow={pieceX}
            tabIndex={isInteractive ? 0 : -1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "absolute",
              left: pieceX,
              top: 10,
              width: pieceWidth,
              height: 40,
              background:
                state === "success"
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #6366f1, #4f46e5)",
              borderRadius: 6,
              cursor: isInteractive ? "grab" : "default",
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              transition: state === "success" ? "background 0.2s ease" : undefined,
            }}
          >
            {state === "success" ? <Check size={18} /> : null}
          </div>
        )}
        {state === "loading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            }}
          >
            Loading captcha…
          </div>
        )}
        {state === "verifying" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            Verifying…
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 11,
          color: "rgba(255,255,255,0.6)",
          minHeight: 16,
        }}
      >
        <span>
          {state === "loading" && "Loading…"}
          {state === "ready" && "Drag the piece into the dashed slot"}
          {state === "dragging" && "Release when aligned"}
          {state === "verifying" && "Verifying…"}
          {state === "success" && (
            <span
              style={{
                color: "#22c55e",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={11} /> Verified
            </span>
          )}
          {state === "error" && (
            <span
              style={{
                color: "#f87171",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertCircle size={11} /> {errorMsg ?? "Try again"}
            </span>
          )}
        </span>
        {(state === "error" || state === "success") && (
          <button
            type="button"
            onClick={() => void fetchChallenge()}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
            }}
          >
            <RefreshCw size={11} /> New puzzle
          </button>
        )}
      </div>
    </div>
  );
}

export default SliderPuzzleCaptcha;
