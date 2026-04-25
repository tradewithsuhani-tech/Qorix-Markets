import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
      setTimeout(() => setPhase(5), 28000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10 p-[10vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full h-full items-center justify-between gap-[5vw]">
        
        {/* Left Side: Text Content */}
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-[4vw] h-[4vw] rounded-2xl bg-accent/20 flex items-center justify-center mb-[2vw] border border-accent/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <svg className="w-[2vw] h-[2vw] text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-[4vw] font-display font-bold leading-tight mb-[1.5vw]">
              Frictionless<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">Onboarding</span>
            </h2>
          </motion.div>

          <div className="space-y-[1.5vw] mt-[2vw]">
            <motion.div 
              className="flex items-center gap-[1.5vw]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-[3vw] h-[3vw] rounded-full bg-secondary flex items-center justify-center font-bold text-[1.2vw]">1</div>
              <p className="text-[1.8vw] text-text-secondary">One-tap Google or Email Signup</p>
            </motion.div>

            <motion.div 
              className="flex items-center gap-[1.5vw]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-[3vw] h-[3vw] rounded-full bg-secondary flex items-center justify-center font-bold text-[1.2vw]">2</div>
              <p className="text-[1.8vw] text-text-secondary">Instant KYC Verification</p>
            </motion.div>

            <motion.div 
              className="flex items-center gap-[1.5vw]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-[3vw] h-[3vw] rounded-full bg-accent text-white flex items-center justify-center font-bold text-[1.2vw] shadow-[0_0_20px_rgba(59,130,246,0.4)]">3</div>
              <p className="text-[1.8vw] font-medium">USDT TRC20 Wallet Setup</p>
            </motion.div>
          </div>

          <motion.div 
            className="mt-[3vw] inline-flex"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="px-[2vw] py-[1vw] rounded-xl bg-success/10 border border-success/30">
              <p className="text-[1.5vw] text-success font-medium tracking-wide">Start with as little as $10</p>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Mockup UI */}
        <div className="flex-1 h-full flex items-center justify-center relative perspective-[1000px]">
          <motion.div
            className="w-[20vw] h-[40vw] rounded-[3vw] border-[8px] border-secondary bg-bg-dark relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
            initial={{ rotateY: 20, rotateX: 10, scale: 0.8, opacity: 0 }}
            animate={phase >= 1 ? { rotateY: [-5, 5, -5], rotateX: [2, -2, 2], scale: 1, opacity: 1 } : { rotateY: 20, rotateX: 10, scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.8, rotateY: { duration: 15, repeat: Infinity, ease: "linear" }, rotateX: { duration: 12, repeat: Infinity, ease: "linear" } }}
          >
            {/* Phone Screen Content */}
            <div className="absolute inset-0 bg-bg-light p-[2vw] flex flex-col pt-[4vw]">
              {/* Header */}
              <div className="flex justify-between items-center mb-[3vw]">
                <div className="w-[2vw] h-[2vw] rounded bg-white/10"></div>
                <div className="text-[1.2vw] font-bold">Deposit USDT</div>
                <div className="w-[2vw] h-[2vw]"></div>
              </div>

              {/* Network Selector */}
              <div className="bg-secondary p-[1.5vw] rounded-2xl mb-[2vw]">
                <div className="text-[1vw] text-text-secondary mb-[0.5vw]">Network</div>
                <div className="flex justify-between items-center">
                  <div className="text-[1.2vw] font-bold text-accent">Tron (TRC20)</div>
                  <div className="w-[1.5vw] h-[1.5vw] rounded-full bg-accent/20 flex items-center justify-center">
                    <div className="w-[0.8vw] h-[0.8vw] rounded-full bg-accent"></div>
                  </div>
                </div>
              </div>

              {/* QR Code Mockup */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-[12vw] h-[12vw] bg-white rounded-xl p-[1vw] mb-[2vw] relative">
                  {/* Fake QR pattern */}
                  <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-[2px]">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className={`bg-black ${Math.random() > 0.3 ? 'opacity-100' : 'opacity-0'}`}></div>
                    ))}
                    {/* QR eyes */}
                    <div className="absolute top-[1vw] left-[1vw] w-[2.5vw] h-[2.5vw] border-[4px] border-black"></div>
                    <div className="absolute top-[1vw] right-[1vw] w-[2.5vw] h-[2.5vw] border-[4px] border-black"></div>
                    <div className="absolute bottom-[1vw] left-[1vw] w-[2.5vw] h-[2.5vw] border-[4px] border-black"></div>
                  </div>
                </div>

                <div className="w-full bg-secondary p-[1vw] rounded-xl flex justify-between items-center border border-white/5">
                  <div className="text-[0.9vw] font-mono text-text-muted truncate mr-[1vw]">
                    T9y...Kq2p
                  </div>
                  <div className="text-[1vw] text-accent font-medium bg-accent/10 px-[1vw] py-[0.5vw] rounded-lg">Copy</div>
                </div>
              </div>
            </div>
            
            {/* Phone Notch */}
            <div className="absolute top-0 inset-x-0 h-[2vw] flex justify-center">
              <div className="w-[6vw] h-[1.5vw] bg-secondary rounded-b-xl"></div>
            </div>
          </motion.div>
        </div>
        
      </div>
    </motion.div>
  );
}
