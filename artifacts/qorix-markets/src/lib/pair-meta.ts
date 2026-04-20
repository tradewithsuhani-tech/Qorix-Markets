export type PairMeta = {
  code: string;
  display: string;
  icon: string;
  color: string;
  pipSize: number;
  entryHint: string;
};

export const PAIRS: PairMeta[] = [
  { code: "XAUUSD", display: "XAU/USD", icon: "🥇", color: "#F6B93B", pipSize: 0.01,   entryHint: "2380.50" },
  { code: "BTCUSD", display: "BTC/USD", icon: "₿",  color: "#F7931A", pipSize: 1,      entryHint: "67000" },
  { code: "EURUSD", display: "EUR/USD", icon: "🇪🇺", color: "#4D6FFF", pipSize: 0.0001, entryHint: "1.0850" },
  { code: "USOIL",  display: "USOIL",   icon: "🛢️", color: "#7BA25A", pipSize: 0.01,   entryHint: "78.50" },
];

export const PAIR_BY_CODE: Record<string, PairMeta> = PAIRS.reduce((acc, p) => {
  acc[p.code] = p;
  return acc;
}, {} as Record<string, PairMeta>);

// Lenient lookup (handles both "XAUUSD" and "XAU/USD")
export function findPair(code: string | null | undefined): PairMeta | undefined {
  if (!code) return undefined;
  const clean = code.toUpperCase().replace(/\//g, "");
  return PAIR_BY_CODE[clean];
}

export function formatPair(code: string | null | undefined): string {
  const p = findPair(code);
  return p?.display ?? (code ?? "—");
}
