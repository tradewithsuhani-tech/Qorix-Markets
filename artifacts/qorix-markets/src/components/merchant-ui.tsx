import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared premium UI primitives for the merchant operator panel.
// Uses Binance-grade visual tokens: deep black surfaces, glassmorphism,
// subtle white-alpha borders, gold accent, and crisp typography.

type Variant = "neutral" | "success" | "danger" | "warning" | "info" | "gold";

const PILL_STYLES: Record<Variant, { bg: string; text: string; dot: string }> = {
  neutral: {
    bg: "bg-white/5 border border-white/10",
    text: "text-slate-300",
    dot: "bg-slate-400",
  },
  success: {
    bg: "bg-emerald-500/10 border border-emerald-500/30",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  danger: {
    bg: "bg-rose-500/10 border border-rose-500/30",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
  warning: {
    bg: "bg-amber-500/10 border border-amber-500/30",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  info: {
    bg: "bg-sky-500/10 border border-sky-500/30",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
  gold: {
    bg: "bg-yellow-400/10 border border-yellow-400/30",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
  },
};

export function StatusPill({
  variant = "neutral",
  children,
  pulse = false,
  className,
  title,
}: {
  variant?: Variant;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
  // Optional native browser tooltip — used by the merchant header pill to
  // surface the last-activity timestamp so an operator can self-diagnose
  // why their badge says Offline.
  title?: string;
}) {
  const s = PILL_STYLES[variant];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn("relative flex h-1.5 w-1.5")}>
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              s.dot,
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", s.dot)}
        />
      </span>
      {children}
    </span>
  );
}

export function PremiumCard({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-slate-900/80 to-slate-950/60 backdrop-blur-sm",
        "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
        glow &&
          "shadow-[0_8px_30px_-12px_rgba(252,213,53,0.25),0_0_0_1px_rgba(252,213,53,0.15)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GoldButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
        "bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950",
        "shadow-[0_4px_14px_-2px_rgba(252,213,53,0.45)]",
        "hover:from-yellow-200 hover:to-amber-400 hover:shadow-[0_6px_20px_-2px_rgba(252,213,53,0.55)]",
        "transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-slate-200",
        "hover:border-white/20 hover:bg-white/[0.05]",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300",
        "hover:border-rose-500/60 hover:bg-rose-500/20",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SuccessButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white",
        "bg-gradient-to-b from-emerald-400 to-emerald-600",
        "shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)]",
        "hover:from-emerald-300 hover:to-emerald-500",
        "transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Avatar circle with initials, used for user IDs in the deposit/withdrawal lists.
export function InitialAvatar({
  seed,
  size = 36,
}: {
  seed: string | number;
  size?: number;
}) {
  const s = String(seed);
  const initial = s.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?";
  // Hash seed → hue so the same user always gets the same colour
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-slate-950 ring-2 ring-white/5"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 70%), hsl(${(hue + 40) % 360}, 70%, 55%))`,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </div>
  );
}

// Format a numeric string in Indian rupee notation. Safe for null/undefined/NaN.
export function formatINR(s: string | number | undefined | null): string {
  const n = typeof s === "number" ? s : parseFloat(s ?? "0");
  if (!Number.isFinite(n)) return "₹0.00";
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatUSDT(s: string | number | undefined | null): string {
  const n = typeof s === "number" ? s : parseFloat(s ?? "0");
  if (!Number.isFinite(n)) return "$0.00";
  return "$" + n.toFixed(2);
}

export function timeAgo(d: string | Date): string {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
