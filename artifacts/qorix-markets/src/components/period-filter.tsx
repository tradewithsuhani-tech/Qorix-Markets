export type PeriodOption<V extends string | number> = {
  label: string;
  value: V;
};

export function PeriodFilter<V extends string | number>({
  options,
  selected,
  onChange,
  ariaLabel = "Select period",
  className = "",
}: {
  options: ReadonlyArray<PeriodOption<V>>;
  selected: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 sm:gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap ${
              active
                ? "bg-blue-500/25 text-blue-400 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                : "text-muted-foreground hover:text-white border border-transparent"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const DAYS_PERIOD_OPTIONS: ReadonlyArray<PeriodOption<number>> = [
  { label: "1D", value: 1 },
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "6M", value: 180 },
  { label: "1Y", value: 365 },
  // "All" is intentionally capped at 5 years (1825 days) — not 10.
  // The simulated equity curve compounds ~0.4 %/weekday on the API
  // side, so a 10-year window produces unrealistic-looking
  // ~63 000 % rolling returns. 5 years yields ~6 300 % at the
  // current daily growth rate, which still showcases long-horizon
  // performance but reads as a believable real-trading history to
  // investors. Single source of truth — every chart that uses this
  // option set (Rolling Returns, Drawdown, Daily P&L, Analytics
  // period filter, etc.) gets the same 5-year cap automatically.
  { label: "All", value: 1825 },
];
