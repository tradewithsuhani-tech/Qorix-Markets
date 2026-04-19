import React from 'react';

export function GlassmorphicPremium() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans selection:bg-indigo-500/30">
      <style>{`
        @keyframes float1 {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-30px); }
        }
        @keyframes float2 {
          0% { transform: translate(0px, 0px); }
          100% { transform: translate(15px, -20px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
        .shimmer-pill::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 3s infinite;
        }
        .conic-ring {
          background: conic-gradient(from -90deg, #22c55e 0% 74%, rgba(255,255,255,0.1) 74% 100%);
          border-radius: 50%;
          position: relative;
        }
        .conic-ring::after {
          content: '';
          position: absolute;
          inset: 12px;
          background: #09090b;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.05);
        }
      `}</style>

      {/* Aurora Blobs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[700px] h-[600px] rounded-full blur-[140px] opacity-80" style={{ background: 'rgba(79,70,229,0.12)', animation: 'float1 8s ease-in-out infinite alternate' }} />
        <div className="absolute top-[5%] right-[0%] w-[550px] h-[550px] rounded-full blur-[120px] opacity-80" style={{ background: 'rgba(59,130,246,0.1)', animation: 'float2 10s ease-in-out infinite alternate' }} />
        <div className="absolute bottom-[0%] left-[25%] w-[650px] h-[400px] rounded-full blur-[130px] opacity-80" style={{ background: 'rgba(139,92,246,0.09)', animation: 'float1 12s ease-in-out infinite alternate-reverse' }} />
        <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-80" style={{ background: 'rgba(6,182,212,0.07)', animation: 'float2 9s ease-in-out infinite alternate' }} />
      </div>

      {/* Dot Grid Overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Qorix<span className="text-blue-400 font-medium">Markets</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Platform</a>
          <a href="#" className="hover:text-white transition-colors">Performance</a>
          <a href="#" className="hover:text-white transition-colors">Security</a>
          <a href="#" className="hover:text-white transition-colors">About</a>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Sign In</button>
          <button className="relative px-5 py-2 text-sm font-semibold rounded-full overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-600 opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="absolute inset-0 border border-transparent rounded-full [background:linear-gradient(#000,#000)_padding-box,linear-gradient(to_right,#3b82f6,#8b5cf6)_border-box]"></div>
            <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">Reserve Slot</span>
          </button>
        </div>
      </nav>

      {/* Hero Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col lg:flex-row items-center justify-between min-h-[calc(100vh-80px)]">
        
        {/* Left Column */}
        <div className="w-full lg:w-[52%] pr-0 lg:pr-12 flex flex-col items-start relative z-10">
          <div className="shimmer-pill relative overflow-hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-medium text-indigo-300 mb-8 backdrop-blur-sm">
            <span>🔒</span>
            <span>Private allocation &middot; 66 seats left</span>
          </div>
          
          <h1 className="text-[60px] lg:text-[72px] font-[800] leading-[1.05] tracking-[-0.025em] mb-6">
            <span className="block text-white">Institutional-grade</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-violet-500 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)] pb-2">USDT trading system</span>
            <span className="block text-white text-[0.85em] text-slate-100">for disciplined investors.</span>
          </h1>
          
          <p className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed">
            Execute complex algorithmic strategies with zero slippage. Access our private liquidity pool and consistently outperform retail markets.
          </p>
          
          <div className="flex flex-wrap items-center gap-5 mb-16">
            <button className="px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:shadow-[0_0_40px_rgba(99,102,241,0.7)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2">
              Apply for Access <span className="text-xl leading-none">&rarr;</span>
            </button>
            <button className="px-8 py-4 rounded-full text-white font-medium hover:bg-white/5 transition-colors flex items-center gap-2 group">
              View Performance <span className="text-slate-400 text-lg leading-none group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">&nearr;</span>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-md flex flex-col gap-1">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">$4.2M+</span>
              <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">AUM</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-md flex flex-col gap-1">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">43</span>
              <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">Traders</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-md flex flex-col gap-1">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">9.3%</span>
              <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">Monthly</span>
            </div>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="w-full lg:w-[48%] relative mt-20 lg:mt-0 flex justify-center lg:justify-end perspective-1000">
          
          {/* Main Card */}
          <div className="w-full max-w-[420px] bg-white/[0.04] border border-white/10 rounded-[24px] p-7 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] relative z-10 flex flex-col gap-8 transform-gpu hover:scale-[1.02] transition-transform duration-500">
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400 uppercase">Qorix Capital OS</span>
              <div className="flex items-center gap-2 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" style={{ animation: 'pulse-glow 2s infinite' }}></div>
                <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">Desk live</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-[150px] h-[150px] conic-ring shadow-[0_0_30px_rgba(34,197,94,0.2)] flex items-center justify-center">
                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-3xl font-bold text-white tracking-tight">74%</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Allocated</span>
                </div>
              </div>
              <p className="text-sm text-slate-400 font-medium mt-6">250 total capacity</p>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                  <span className="text-sm font-medium text-slate-300">Monthly return</span>
                </div>
                <span className="text-sm font-bold text-emerald-400">+9.3%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                  <span className="text-sm font-medium text-slate-300">Active traders</span>
                </div>
                <span className="text-sm font-bold text-white">136</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"></div>
                  <span className="text-sm font-medium text-slate-300">Max drawdown</span>
                </div>
                <span className="text-sm font-bold text-white">-3.1%</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-medium text-slate-400">Private allocation capacity</span>
                <span className="text-xs font-bold text-white">185 / 250</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full w-[74%]"></div>
              </div>
            </div>

          </div>

          {/* Satellites */}
          <div className="absolute top-[-20px] right-[-30px] w-auto px-4 py-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md shadow-xl rotate-[5deg] z-20 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Return</span>
            <span className="text-lg font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">+9.3%</span>
          </div>
          
          <div className="absolute bottom-[40px] left-[-40px] w-auto px-4 py-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md shadow-xl rotate-[-8deg] z-20 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Traders</span>
            <span className="text-lg font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">43</span>
          </div>

        </div>

      </main>
    </div>
  );
}

export default GlassmorphicPremium;