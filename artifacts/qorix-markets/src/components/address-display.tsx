import { useState } from "react";
import { Copy, Eye, EyeOff, Check } from "lucide-react";

export function maskAddress(addr: string, head = 4, tail = 5) {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function AddressDisplay({
  address,
  className = "",
  mono = true,
}: {
  address: string;
  className?: string;
  mono?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const display = revealed ? address : maskAddress(address);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`${mono ? "font-mono" : ""} ${revealed ? "break-all" : ""} text-white`}
        title={revealed ? address : "Hidden — tap the eye to reveal"}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
        aria-label={revealed ? "Hide address" : "Reveal address"}
      >
        {revealed ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Copy address"
      >
        {copied ? (
          <Check style={{ width: 12, height: 12 }} className="text-emerald-400" />
        ) : (
          <Copy style={{ width: 12, height: 12 }} />
        )}
      </button>
    </span>
  );
}
