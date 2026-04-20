import { findPair } from "@/lib/pair-meta";

// Circular flag SVGs rendered inline so they scale and never 404.
function USFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="rounded-full shrink-0">
      <defs>
        <clipPath id="usClip"><circle cx="16" cy="16" r="16" /></clipPath>
      </defs>
      <g clipPath="url(#usClip)">
        <rect width="32" height="32" fill="#B22234" />
        {[1, 3, 5, 7, 9, 11].map((i) => (
          <rect key={i} y={i * (32 / 13)} width="32" height={32 / 13} fill="#fff" />
        ))}
        <rect width="14" height="15" fill="#3C3B6E" />
        <g fill="#fff" fontSize="3" fontFamily="Arial">
          {Array.from({ length: 20 }).map((_, i) => {
            const x = (i % 5) * 2.6 + 1.2;
            const y = Math.floor(i / 5) * 3 + 2.5;
            return <circle key={i} cx={x} cy={y} r="0.5" />;
          })}
        </g>
      </g>
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(0,0,0,0.15)" />
    </svg>
  );
}

function EUFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="rounded-full shrink-0">
      <defs>
        <clipPath id="euClip"><circle cx="16" cy="16" r="16" /></clipPath>
      </defs>
      <g clipPath="url(#euClip)">
        <rect width="32" height="32" fill="#003399" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const cx = 16 + Math.cos(angle) * 10;
          const cy = 16 + Math.sin(angle) * 10;
          return <circle key={i} cx={cx} cy={cy} r="1.2" fill="#FFCC00" />;
        })}
      </g>
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(0,0,0,0.15)" />
    </svg>
  );
}

function GoldCoin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="rounded-full shrink-0">
      <defs>
        <radialGradient id="goldG" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#FFE58A" />
          <stop offset="60%" stopColor="#E0B243" />
          <stop offset="100%" stopColor="#9A7418" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#goldG)" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <path d="M10 22 L16 10 L22 22 Z" fill="none" stroke="#5A3F0A" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="10.5" y="18" width="11" height="1.4" fill="#5A3F0A" />
    </svg>
  );
}

function BTCCoin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="rounded-full shrink-0">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <text
        x="16" y="22"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="18"
        fill="#fff"
      >₿</text>
    </svg>
  );
}

function OilDrop({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="rounded-full shrink-0">
      <circle cx="16" cy="16" r="16" fill="#0E0E10" />
      <path
        d="M16 7 C 20 13, 23 17, 23 20.5 C 23 24.5, 20 27, 16 27 C 12 27, 9 24.5, 9 20.5 C 9 17, 12 13, 16 7 Z"
        fill="#fff"
      />
      <path
        d="M12.5 20 C 12.5 22.5, 14 24, 16 24"
        fill="none" stroke="#0E0E10" strokeWidth="1.2" strokeLinecap="round" opacity="0.35"
      />
    </svg>
  );
}

function PairPair({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center" style={{ width: 30, height: 20 }}>
      <span className="absolute left-0 top-0" style={{ zIndex: 1 }}>{left}</span>
      <span className="absolute top-0" style={{ left: 12, zIndex: 2, boxShadow: "0 0 0 2px #0b0d12", borderRadius: "9999px" }}>{right}</span>
    </span>
  );
}

export function PairIcon({ code, size = 20 }: { code: string | null | undefined; size?: number }) {
  const meta = findPair(code);
  switch (meta?.code) {
    case "XAUUSD":
      return <PairPair left={<GoldCoin size={size} />} right={<USFlag size={size} />} />;
    case "EURUSD":
      return <PairPair left={<EUFlag size={size} />} right={<USFlag size={size} />} />;
    case "BTCUSD":
      return <BTCCoin size={size + 4} />;
    case "USOIL":
      return <OilDrop size={size + 4} />;
    default:
      return (
        <span
          className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
          style={{ width: size + 4, height: size + 4, background: "#2a2d35" }}
        >
          {(code ?? "?").slice(0, 2).toUpperCase()}
        </span>
      );
  }
}
