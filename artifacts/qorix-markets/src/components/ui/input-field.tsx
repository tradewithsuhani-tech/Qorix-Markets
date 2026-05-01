import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  // For password fields we render an inline eye toggle so the caller
  // (admin Create dialog, Reset password dialog, anywhere this shared
  // field is used with type="password") gets the show/hide behaviour
  // for free without each call site having to wire its own state.
  // For non-password types this is a no-op — the original behaviour
  // is preserved exactly.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-500 ${
            isPassword ? "pr-10" : ""
          }`}
        />
        {isPassword && (
          // type="button" so we never accidentally submit a parent
          // <form>. tabIndex=-1 keeps the keyboard tab order on the
          // form fields themselves; the eye is a click-only convenience.
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition"
            data-testid={`input-toggle-password-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
