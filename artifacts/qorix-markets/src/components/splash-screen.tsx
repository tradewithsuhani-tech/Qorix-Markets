import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QorixLogo } from "@/components/qorix-logo";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 1900);
    const t3 = setTimeout(() => onDoneRef.current(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <AnimatePresence>
      {phase !== "out" ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0f1c] select-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        >
          {/* Logo mark */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.7, delay: 0.05 }}
            className="relative mb-6"
          >
            {/* Outer glow ring */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: "0 0 60px 10px rgba(59,130,246,0.25)",
              }}
            />
            <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center shadow-2xl shadow-blue-500/30 relative">
              <QorixLogo size={96} />
            </div>
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center"
          >
            <div className="text-3xl font-bold tracking-tight text-white leading-none">
              Qorix<span className="text-blue-400">Markets</span>
            </div>
            <div className="text-[11px] font-medium tracking-[0.25em] uppercase text-muted-foreground mt-2">
              Pro Trading Terminal
            </div>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32"
          >
            <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, delay: 0.7, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              />
            </div>
          </motion.div>

          {/* Version tag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="absolute bottom-8 text-[10px] text-muted-foreground"
          >
            Secure · Automated · Professional
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function useSplash(): { showSplash: boolean; onSplashDone: () => void } {
  return { showSplash: false, onSplashDone: () => {} };
}
