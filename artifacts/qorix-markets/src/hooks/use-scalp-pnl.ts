import { useEffect, useState } from "react";

const SCALP_PNL_KEY = "qorix.scalp.totalPnl.v1";

function readScalpPnl(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(SCALP_PNL_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function useScalpBotPnl(): number {
  const [pnl, setPnl] = useState<number>(() => readScalpPnl());

  useEffect(() => {
    const tick = () => {
      const next = readScalpPnl();
      setPnl((prev) => (prev === next ? prev : next));
    };
    const id = window.setInterval(tick, 1000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === SCALP_PNL_KEY) tick();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return pnl;
}
