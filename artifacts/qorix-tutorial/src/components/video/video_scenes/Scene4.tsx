import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
      setTimeout(() => setPhase(5), 33000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full h-full p-[8vw] flex flex-col justify-center relative">
        
        {/* Decorative background image */}
        <motion.div 
          className="absolute inset-0 opacity-20 z-0"
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ duration: 20, ease: 'easeOut' }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/promo-cards.png`} 
            className="w-full h-full object-cover blur-[8px]" 
            alt="" 
          />
        </motion.div>

        <div className="relative z-10 flex gap-[6vw] items-center h-full">
          
          {/* Left Text */}
          <div className="flex-1">
            <motion.h2 
              className="text-[4vw] font-display font-bold leading-tight mb-[2vw]"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.8 }}
            >
              VIP Tier Ladder & <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]">Elite Rewards</span>
            </motion.h2>

            <motion.p 
              className="text-[1.8vw] text-text-secondary mb-[3vw] max-w-[35vw]"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8 }}
            >
              Rotate through deposit bonuses, unlock milestone progress, and earn lifetime commissions via referral leaderboards.
            </motion.p>

            {/* VIP Progress Bar */}
            <motion.div 
              className="bg-secondary/80 backdrop-blur-md p-[2vw] rounded-2xl border border-white/10"
              initial={{ opacity: 0, x: -30 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex justify-between items-end mb-[1vw]">
                <div>
                  <div className="text-[1vw] text-text-secondary uppercase tracking-wider font-bold">Current Tier</div>
                  <div className="text-[1.8vw] font-bold text-white">Silver</div>
                </div>
                <div className="text-right">
                  <div className="text-[1vw] text-text-secondary uppercase tracking-wider font-bold">Next: Gold</div>
                  <div className="text-[1.5vw] font-bold text-[#FCD34D]">65%</div>
                </div>
              </div>
              
              <div className="h-[1vw] bg-bg-dark rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-accent to-[#FCD34D]"
                  initial={{ width: "0%" }}
                  animate={phase >= 4 ? { width: "65%" } : { width: "0%" }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Visuals - Tier Cards */}
          <div className="flex-1 relative h-[30vw] perspective-[1200px]">
            
            {/* Platinum Card */}
            <motion.div 
              className="absolute top-[2vw] right-[2vw] w-[20vw] h-[12vw] rounded-2xl border-[1px] border-white/30 bg-gradient-to-br from-gray-300 to-gray-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-[1.5vw]"
              initial={{ opacity: 0, z: -200, rotateY: -30, x: 50 }}
              animate={phase >= 2 ? { opacity: 1, z: -100, rotateY: -15, x: 20 } : { opacity: 0, z: -200, rotateY: -30, x: 50 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <div className="w-full h-full border border-white/20 rounded-xl flex flex-col justify-between p-[1vw]">
                <div className="text-[1vw] font-bold text-bg-dark opacity-80 uppercase tracking-widest">Platinum</div>
                <div className="text-[1.5vw] font-bold text-bg-dark">+15% Bonus</div>
              </div>
            </motion.div>

            {/* Gold Card */}
            <motion.div 
              className="absolute top-[8vw] right-[6vw] w-[22vw] h-[13vw] rounded-2xl border-[1px] border-[#FCD34D]/50 bg-gradient-to-br from-[#FCD34D] to-[#B45309] shadow-[0_20px_50px_rgba(245,158,11,0.3)] flex items-center justify-center p-[1.5vw] z-10"
              initial={{ opacity: 0, z: -100, rotateY: -30, x: 50 }}
              animate={phase >= 3 ? { opacity: 1, z: 0, rotateY: -10, x: 0 } : { opacity: 0, z: -100, rotateY: -30, x: 50 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            >
              <div className="w-full h-full border border-white/30 rounded-xl flex flex-col justify-between p-[1.5vw]">
                <div className="text-[1.2vw] font-bold text-bg-dark uppercase tracking-widest flex justify-between">
                  <span>Gold</span>
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div>
                  <div className="text-[2vw] font-bold text-bg-dark">+10% Bonus</div>
                  <div className="text-[0.9vw] text-bg-dark/80 font-medium">Reduced Withdrawal Fees</div>
                </div>
              </div>
            </motion.div>

            {/* Silver Card */}
            <motion.div 
              className="absolute top-[15vw] right-[10vw] w-[20vw] h-[12vw] rounded-2xl border-[1px] border-white/20 bg-gradient-to-br from-slate-600 to-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-[1.5vw] z-20"
              initial={{ opacity: 0, z: 0, rotateY: -30, x: 50 }}
              animate={phase >= 4 ? { opacity: 1, z: 100, rotateY: -5, x: -20 } : { opacity: 0, z: 0, rotateY: -30, x: 50 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
            >
              <div className="w-full h-full border border-white/10 rounded-xl flex flex-col justify-between p-[1vw]">
                <div className="text-[1vw] font-bold text-white uppercase tracking-widest">Silver</div>
                <div className="text-[1.5vw] font-bold text-white">+5% Bonus</div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
