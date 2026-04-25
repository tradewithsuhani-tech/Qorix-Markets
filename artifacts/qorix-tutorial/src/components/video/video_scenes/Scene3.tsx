import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => setPhase(5), 38000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full h-full p-[6vw] flex flex-col">
        
        {/* Header */}
        <motion.div 
          className="text-center mb-[4vw]"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-[3.5vw] font-display font-bold">24x7 Automated Trading Desk</h2>
          <p className="text-[1.8vw] text-text-secondary mt-[1vw]">Strict risk limits. Real-time compounding.</p>
        </motion.div>

        {/* Dashboard Layout */}
        <div className="flex-1 flex gap-[3vw]">
          
          {/* Main Chart Area */}
          <div className="flex-[2] flex flex-col gap-[2vw]">
            <motion.div 
              className="flex-1 bg-secondary/50 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col backdrop-blur-md"
              initial={{ opacity: 0, x: -30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.8 }}
            >
              <div className="p-[2vw] pb-0 flex justify-between items-end relative z-10">
                <div>
                  <div className="text-[1.2vw] text-text-secondary mb-[0.5vw]">Total Equity</div>
                  <div className="text-[3vw] font-display font-bold">$12,450.00</div>
                </div>
                <div className="text-right">
                  <div className="text-[1.2vw] text-text-secondary mb-[0.5vw]">Today's P&L</div>
                  <div className="text-[2vw] font-bold text-success flex items-center justify-end gap-[0.5vw]">
                    <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    +$142.50
                  </div>
                </div>
              </div>
              
              <div className="absolute inset-0 z-0 opacity-80 mt-[8vw]">
                <img 
                  src={`${import.meta.env.BASE_URL}images/trading-chart.png`} 
                  className="w-full h-full object-cover" 
                  alt="Chart" 
                />
              </div>
            </motion.div>

            {/* Bottom Stats */}
            <motion.div 
              className="flex gap-[2vw] h-[10vw]"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex-1 bg-gradient-to-br from-success/20 to-success/5 rounded-2xl border border-success/20 p-[2vw] flex flex-col justify-center">
                <div className="text-[1.2vw] text-success/80 mb-[0.5vw]">Monthly Payouts</div>
                <div className="text-[2vw] font-bold text-success text-transparent">Automated Processing</div>
              </div>
              <div className="flex-1 bg-secondary/50 rounded-2xl border border-white/10 p-[2vw] flex flex-col justify-center">
                <div className="text-[1.2vw] text-text-secondary mb-[0.5vw]">Active Investment</div>
                <div className="text-[2vw] font-bold">$10,000.00</div>
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar - Trade Feed */}
          <motion.div 
            className="flex-1 bg-secondary/30 rounded-3xl border border-white/10 p-[2vw] flex flex-col backdrop-blur-md"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex justify-between items-center mb-[2vw]">
              <h3 className="text-[1.5vw] font-bold">Live Signals</h3>
              <div className="flex items-center gap-[0.5vw]">
                <div className="w-[0.8vw] h-[0.8vw] rounded-full bg-success animate-pulse"></div>
                <span className="text-[1vw] text-success">Running</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-[1vw] overflow-hidden relative">
              {/* Fade out mask */}
              <div className="absolute bottom-0 inset-x-0 h-[4vw] bg-gradient-to-t from-bg-dark to-transparent z-10"></div>
              
              {[
                { pair: 'BTC/USDT', type: 'LONG', profit: '+1.2%', time: 'Just now' },
                { pair: 'ETH/USDT', type: 'SHORT', profit: '+0.8%', time: '2m ago' },
                { pair: 'SOL/USDT', type: 'LONG', profit: '+2.1%', time: '15m ago' },
                { pair: 'AVAX/USDT', type: 'LONG', profit: '+1.5%', time: '45m ago' },
                { pair: 'LINK/USDT', type: 'SHORT', profit: '+0.5%', time: '1h ago' }
              ].map((trade, i) => (
                <motion.div 
                  key={i}
                  className="bg-white/5 rounded-xl p-[1.5vw] border border-white/5 flex justify-between items-center"
                  initial={{ opacity: 0, x: 20 }}
                  animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.5, delay: 0.2 + (i * 0.1) }}
                >
                  <div>
                    <div className="text-[1.2vw] font-bold">{trade.pair}</div>
                    <div className="text-[1vw] text-text-muted">{trade.time}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[1vw] font-bold ${trade.type === 'LONG' ? 'text-success' : 'text-error'}`}>{trade.type}</div>
                    <div className="text-[1.2vw] text-success font-mono">{trade.profit}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
