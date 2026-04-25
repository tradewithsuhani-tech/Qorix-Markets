import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 18000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center text-center max-w-[60vw]">
        
        {/* Logo/Brand */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <div className="w-[10vw] h-[10vw] mx-auto rounded-3xl bg-gradient-to-br from-accent to-bg-dark flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.3)] border border-white/10 relative overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-white/20"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-[5vw] font-display font-bold tracking-tighter">Q</span>
          </div>
        </motion.div>

        {/* Headline */}
        <h1 className="text-[5vw] font-display font-bold leading-tight mb-6 tracking-tight overflow-hidden pb-4" style={{ perspective: '1000px' }}>
          {'QORIX MARKETS'.split(' ').map((word, i) => (
            <motion.span 
              key={i} 
              className="inline-block mx-[1vw] bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60"
              initial={{ opacity: 0, y: '100%', rotateX: -90 }}
              animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: '100%', rotateX: -90 }}
              transition={{ duration: 1.2, delay: 0.2 + (i * 0.1), type: 'spring', stiffness: 100 }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subline */}
        <motion.p 
          className="text-[1.8vw] text-text-secondary font-medium max-w-[45vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          24/7 Automated Trading Desk. Real results. Zero manual effort.
        </motion.p>
        
        {/* Trust badge */}
        <motion.div
          className="mt-12 px-[2vw] py-[1vw] rounded-full border border-white/10 bg-white/5 backdrop-blur-md flex items-center gap-[1vw]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.8, delay: 0.5, type: 'spring' }}
        >
          <div className="flex -space-x-4">
            {[1,2,3].map((_, i) => (
              <div key={i} className="w-[3vw] h-[3vw] rounded-full bg-secondary border-2 border-primary overflow-hidden">
                <img src={`https://i.pravatar.cc/100?img=${i+10}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <span className="text-[1.2vw] font-medium text-white/80">Trusted by <span className="text-success font-bold">1,540+</span> investors</span>
        </motion.div>

      </div>
    </motion.div>
  );
}
