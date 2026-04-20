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
      className={`flex items-center gap-1 bg-white/[0.04] border border-white/8 rounded-xl p-1 ${className}`}
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
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 ${
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
  { label: "All", value: 3650 },
];
