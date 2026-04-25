import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="flex flex-col items-center justify-center text-center">
        
        {/* Logo Lockup */}
        <motion.div
          className="mb-[3vw] flex flex-col items-center"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.8, opacity: 0, y: 30 }}
          transition={{ duration: 1, type: 'spring', stiffness: 100 }}
        >
          <div className="w-[8vw] h-[8vw] rounded-[2vw] bg-accent flex items-center justify-center shadow-[0_0_80px_rgba(59,130,246,0.6)] mb-[2vw]">
            <span className="text-[4vw] font-display font-bold text-white tracking-tighter">Q</span>
          </div>
          <h1 className="text-[6vw] font-display font-bold leading-none tracking-tight">Qorix Markets</h1>
        </motion.div>

        {/* Tagline */}
        <motion.div
          className="overflow-hidden mb-[4vw]"
          initial={{ height: 0 }}
          animate={phase >= 2 ? { height: 'auto' } : { height: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h2 className="text-[2.5vw] text-text-secondary font-medium tracking-wide uppercase">
            Smart trading. Simply built.
          </h2>
        </motion.div>

        {/* Stat Counters */}
        <motion.div 
          className="flex gap-[4vw] mb-[5vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex flex-col items-center">
            <div className="text-[3vw] font-bold text-success">1,540+</div>
            <div className="text-[1.2vw] text-text-muted uppercase tracking-wider">Active Investors</div>
          </div>
          <div className="w-[1px] h-full bg-white/10"></div>
          <div className="flex flex-col items-center">
            <div className="text-[3vw] font-bold text-success">$2.3M+</div>
            <div className="text-[1.2vw] text-text-muted uppercase tracking-wider">Trading Volume</div>
          </div>
        </motion.div>

        {/* CTA URL */}
        <motion.div
          className="px-[3vw] py-[1.5vw] rounded-full border border-white/20 bg-white/5 backdrop-blur-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={phase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-[2vw] font-bold text-white tracking-wide">qorixmarkets.com</span>
        </motion.div>

      </div>
    </motion.div>
  );
}
