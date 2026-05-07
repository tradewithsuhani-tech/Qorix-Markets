import { useEffect, useState } from "react";
import { Users } from "lucide-react";

function seedFromDate(): number {
  const now = new Date();
  const dayKey = now.getUTCFullYear() * 1000 + now.getUTCMonth() * 50 + now.getUTCDate();
  const minuteKey = now.getUTCHours() * 60 + now.getUTCMinutes();
  let h = (dayKey * 9301 + minuteKey * 49297) % 233280;
  h = (h + 1247) % 233280;
  return h / 233280;
}

function baseCount(): number {
  const hour = new Date().getUTCHours();
  const peak = 1 - Math.abs(((hour + 5.5) % 24) - 14) / 14;
  const min = 820;
  const max = 1680;
  const r = seedFromDate();
  return Math.round(min + (max - min) * (0.55 + 0.45 * peak) + r * 60);
}

export function LiveUsersPill() {
  const [count, setCount] = useState<number>(() => baseCount());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((prev) => {
        const drift = Math.round((Math.random() - 0.45) * 9);
        const next = Math.max(820, Math.min(1700, prev + drift));
        if (next !== prev) {
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
        return next;
      });
    }, 3500 + Math.floor(Math.random() * 2500));
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${count.toLocaleString()} investors trading right now`}
      className="fixed left-3 md:left-5 bottom-3 md:bottom-5 z-40 pointer-events-none select-none"
    >
      <div
        className="pointer-events-auto inline-flex items-center gap-2 md:gap-2.5 pl-2.5 md:pl-3 pr-3 md:pr-3.5 py-1.5 md:py-2 rounded-full backdrop-blur-md shadow-2xl"
        style={{
          background: "rgba(5,8,20,0.88)",
          border: "1px solid rgba(16,185,129,0.35)",
          boxShadow:
            "0 18px 50px -18px rgba(16,185,129,0.45), 0 6px 20px -10px rgba(0,0,0,0.6)",
        }}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
        <Users size={13} className="text-emerald-300 shrink-0 hidden xs:inline" />
        <span className="text-[11px] md:text-xs font-semibold text-slate-100 leading-none whitespace-nowrap">
          <span
            className={`tabular-nums font-bold text-white transition-all duration-300 ${
              pulse ? "text-emerald-300" : ""
            }`}
          >
            {count.toLocaleString()}
          </span>{" "}
          <span className="text-slate-300">investors trading</span>{" "}
          <span className="text-emerald-300 font-bold">now</span>
        </span>
      </div>
    </div>
  );
}
