import React from "react";
import { ArrowRight, ArrowDown } from "lucide-react";

export function BoldEditorial() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white relative overflow-hidden font-sans">
      {/* Background Texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 8px)`
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-1.5 text-2xl tracking-tighter">
          <span className="font-bold text-white">Qorix</span>
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#f59e0b] to-[#d97706]">
            Markets
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Strategy</a>
          <a href="#" className="hover:text-white transition-colors">Performance</a>
          <a href="#" className="hover:text-white transition-colors">About</a>
          <a href="#" className="hover:text-white transition-colors">Client Portal</a>
        </div>

        <button className="text-[11px] uppercase tracking-wider font-bold px-5 py-2.5 border border-[#f59e0b]/50 text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors">
          Reserve Slot
        </button>
      </nav>

      {/* Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f59e0b]/30 to-transparent opacity-50" />

      {/* Hero Section */}
      <main className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 pt-20 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[58%_42%] gap-16 lg:gap-8 items-center">
          
          {/* Left Column */}
          <div className="flex flex-col items-start space-y-8">
            <div className="text-[#f59e0b] text-xs font-bold uppercase tracking-[0.25em]">
              Est. 2023 · Institutional Grade
            </div>
            
            <h1 className="text-5xl md:text-[5rem] font-black leading-[1.05] tracking-[-0.025em]">
              <span className="text-white block mb-2">A hedge-fund style</span>
              <span className="text-white block mb-2">trading system</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f59e0b] to-[#d97706] block">
                built for disciplined investors.
              </span>
            </h1>
            
            <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
              Qorix Markets provides accredited investors with algorithmic trading strategies previously reserved for institutional desks. Strict risk management, verified returns, completely hands-off.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button className="flex items-center gap-2 bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-[#080c14] px-8 py-4 font-bold uppercase text-sm tracking-wider hover:opacity-90 transition-opacity">
                Apply for Access
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 text-slate-300 hover:text-white px-8 py-4 font-bold uppercase text-sm tracking-wider transition-colors">
                Track Record
                <ArrowDown className="w-4 h-4 opacity-70" />
              </button>
            </div>
            
            <div className="flex items-center gap-8 pt-12 mt-4 border-t border-slate-800/50 w-full max-w-2xl">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[#f59e0b] mb-1">$4.2M+</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">AUM</span>
              </div>
              <div className="w-px h-10 bg-slate-800" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[#f59e0b] mb-1">43</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Traders</span>
              </div>
              <div className="w-px h-10 bg-slate-800" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[#f59e0b] mb-1">9.3%</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Monthly Avg</span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="relative h-[500px] w-full max-w-md mx-auto lg:ml-auto perspective-1000">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              
              {/* Card 1 */}
              <div className="w-[320px] p-6 mb-[-60px] relative z-30 transform rotate-3 hover:rotate-0 transition-transform duration-500"
                   style={{
                     background: 'rgba(15,20,35,0.8)',
                     border: '1px solid rgba(255,255,255,0.08)',
                     borderLeft: '4px solid #10b981',
                     backdropFilter: 'blur(12px)',
                     boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
                   }}>
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-3">Monthly Return</div>
                <div className="text-4xl font-black text-[#10b981]">+9.3%</div>
                <div className="mt-4 h-12 flex items-end gap-1 opacity-70">
                  <div className="w-1/6 bg-[#10b981]/20 h-[30%]"></div>
                  <div className="w-1/6 bg-[#10b981]/40 h-[45%]"></div>
                  <div className="w-1/6 bg-[#10b981]/60 h-[35%]"></div>
                  <div className="w-1/6 bg-[#10b981]/80 h-[70%]"></div>
                  <div className="w-1/6 bg-[#10b981] h-[100%]"></div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="w-[320px] p-6 mb-[-60px] relative z-20 transform -rotate-2 hover:rotate-0 transition-transform duration-500"
                   style={{
                     background: 'rgba(15,20,35,0.8)',
                     border: '1px solid rgba(255,255,255,0.08)',
                     borderLeft: '4px solid #3b82f6',
                     backdropFilter: 'blur(12px)',
                     boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
                   }}>
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-3">AUM Engine</div>
                <div className="text-4xl font-black text-[#3b82f6]">$4.2M</div>
                <div className="text-sm text-slate-500 mt-2 font-mono">Active Capital deployed</div>
              </div>

              {/* Card 3 */}
              <div className="w-[320px] p-6 relative z-10 transform translate-x-4 hover:translate-x-0 transition-transform duration-500"
                   style={{
                     background: 'rgba(15,20,35,0.8)',
                     border: '1px solid rgba(255,255,255,0.08)',
                     borderLeft: '4px solid #f59e0b',
                     backdropFilter: 'blur(12px)',
                     boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
                   }}>
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-3">Max Drawdown</div>
                <div className="text-4xl font-black text-[#f59e0b]">-3.1%</div>
                <div className="text-sm text-slate-500 mt-2 font-mono">Strict risk parameters</div>
              </div>
              
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}

export default BoldEditorial;