import { useEffect, useState } from "react";
import { computeGlobalScalpState } from "@/lib/scalp-pnl";

/**
 * Live scalp-bot P&L derived globally from time + AUM, so every
 * user / browser / device sees the SAME number. No localStorage
 * coupling — it's pure deterministic derivation that ticks once a
 * second so the dashboard cards animate smoothly.
 */
export function useScalpBotPnl(aum: number): number {
  const [pnl, setPnl] = useState<number>(() => computeGlobalScalpState(aum).pnl);

  useEffect(() => {
    const tick = () => {
      const next = computeGlobalScalpState(aum).pnl;
      setPnl((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [aum]);

  return pnl;
}
