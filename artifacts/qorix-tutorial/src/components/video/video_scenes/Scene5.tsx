import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full h-full flex flex-col items-center justify-center p-[6vw]">
        
        {/* Header */}
        <motion.div 
          className="text-center mb-[4vw]"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-[3.5vw] font-display font-bold mb-[1vw]">Notifications & Unwavering Trust</h2>
          <p className="text-[1.6vw] text-text-secondary max-w-[50vw] mx-auto">
            Stay informed via In-app, Telegram, and Email. Same-speed USDT TRC20 withdrawals, fully verifiable on-chain.
          </p>
        </motion.div>

        <div className="flex w-full gap-[4vw] h-[30vw]">
          
          {/* Left: Notifications */}
          <div className="flex-1 relative flex flex-col items-center justify-center">
            {/* Background glowing image */}
            <motion.div 
              className="absolute inset-0 z-0 opacity-40 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={phase >= 2 ? { scale: 1, opacity: 0.4 } : { scale: 0.8, opacity: 0 }}
              transition={{ duration: 1.5 }}
            >
              <img src={`${import.meta.env.BASE_URL}images/telegram-notification.png`} className="w-[80%] h-[80%] object-contain" alt=""/>
            </motion.div>

            {/* Notification Cards */}
            <div className="relative z-10 flex flex-col gap-[1.5vw] w-[80%]">
              <motion.div 
                className="bg-secondary/90 backdrop-blur-xl p-[1.5vw] rounded-2xl border border-white/10 shadow-xl flex items-center gap-[1.5vw]"
                initial={{ opacity: 0, x: -50 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
                transition={{ duration: 0.6, type: 'spring' }}
              >
                <div className="w-[3vw] h-[3vw] rounded-full bg-accent/20 flex items-center justify-center text-accent">
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <div>
                  <div className="text-[1vw] text-text-secondary">In-App Alert</div>
                  <div className="text-[1.2vw] font-bold">Profit Distributed: $142.50</div>
                </div>
              </motion.div>

              <motion.div 
                className="bg-secondary/90 backdrop-blur-xl p-[1.5vw] rounded-2xl border border-[#2AABEE]/30 shadow-[0_0_30px_rgba(42,171,238,0.15)] flex items-center gap-[1.5vw]"
                initial={{ opacity: 0, x: -50 }}
                animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
                transition={{ duration: 0.6, type: 'spring' }}
              >
                <div className="w-[3vw] h-[3vw] rounded-full bg-[#2AABEE]/20 flex items-center justify-center text-[#2AABEE]">
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.18-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.18 3.44-.49.33-.93.49-1.33.48-.44-.01-1.28-.24-1.9-.44-.77-.24-1.38-.37-1.33-.78.03-.22.34-.44.93-.68 3.65-1.59 6.09-2.64 7.31-3.15 3.48-1.44 4.2-1.69 4.68-1.69.1 0 .32.02.47.14.12.1.15.24.16.35-.01.06-.01.12-.02.2z"/></svg>
                </div>
                <div>
                  <div className="text-[1vw] text-text-secondary">Telegram Bot DM</div>
                  <div className="text-[1.2vw] font-bold">Trade Closed: BTC/USDT +1.2%</div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right: Withdrawal Timeline */}
          <div className="flex-1 flex flex-col justify-center">
            
            <motion.div 
              className="bg-secondary/50 rounded-3xl border border-white/10 p-[3vw] backdrop-blur-md relative overflow-hidden"
              initial={{ opacity: 0, x: 50 }}
              animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
              transition={{ duration: 0.8 }}
            >
              <div className="absolute inset-0 z-0 opacity-20 mt-[10vw]">
                <img src={`${import.meta.env.BASE_URL}images/withdrawal-flow.png`} className="w-full h-full object-cover" alt="" />
              </div>

              <div className="relative z-10">
                <h3 className="text-[1.8vw] font-bold mb-[2vw]">Withdrawal Status</h3>
                
                <div className="flex flex-col gap-[2vw]">
                  {['Queued', 'Approved', 'Sent', 'Confirmed on TronScan'].map((step, i) => (
                    <motion.div 
                      key={i}
                      className="flex items-center gap-[1.5vw]"
                      initial={{ opacity: 0.3 }}
                      animate={phase >= 4 ? { opacity: i === 3 ? 0.4 : 1 } : { opacity: 0.3 }}
                      transition={{ duration: 1, delay: 0.5 + (i * 0.3) }}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-[1.5vw] h-[1.5vw] rounded-full ${i < 3 ? 'bg-success' : 'bg-secondary border-2 border-text-secondary'}`}></div>
                        {i < 3 && <div className="w-[2px] h-[2vw] bg-success absolute mt-[1.5vw]"></div>}
                      </div>
                      <div className={`text-[1.5vw] ${i < 3 ? 'text-white font-bold' : 'text-text-secondary'}`}>{step}</div>
                      {i === 2 && (
                        <motion.div 
                          className="ml-auto flex items-center gap-[0.5vw] text-accent text-[1vw] bg-accent/10 px-[1vw] py-[0.5vw] rounded-lg border border-accent/20 cursor-pointer"
                          initial={{ scale: 0 }}
                          animate={phase >= 4 ? { scale: 1 } : { scale: 0 }}
                          transition={{ delay: 2, type: 'spring' }}
                        >
                          Verify TxHash
                          <svg className="w-[1vw] h-[1vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>

        </div>

      </div>
    </motion.div>
  );
}
