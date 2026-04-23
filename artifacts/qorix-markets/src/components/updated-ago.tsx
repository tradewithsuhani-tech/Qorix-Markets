import { useEffect, useRef, useState } from "react";

interface UpdatedAgoProps {
  className?: string;
  /** Show a small green pulsing dot before the text (default true). */
  withDot?: boolean;
  /**
   * Optional epoch-millis reference of when the underlying data last updated.
   * When this changes, the timer resets to "just now" — making the timestamp
   * feel real (it ticks while idle, snaps back the moment fresh data lands).
   * Falls back to mount time if not provided.
   */
  timestamp?: number;
}

/**
 * Tiny "updated just now / Xs ago / Xm ago" relative-time chip. Mounts once
 * and ticks every second so it actually feels live instead of being a static
 * label. Used across the dashboard wherever we show a "live" data section.
 */
export function UpdatedAgo({ className, withDot = true, timestamp }: UpdatedAgoProps) {
  const [, forceTick] = useState(0);
  const mountedAt = useRef(Date.now());
  // Effective reference time — explicit prop wins, otherwise we use mount time.
  const ref = timestamp ?? mountedAt.current;
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - ref) / 1000));
  const label =
    seconds < 5
      ? "updated just now"
      : seconds < 60
      ? `updated ${seconds}s ago`
      : `updated ${Math.floor(seconds / 60)}m ago`;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide tabular-nums text-emerald-400/80 " +
        (className ?? "")
      }
    >
      {withDot && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
      {label}
    </span>
  );
}
