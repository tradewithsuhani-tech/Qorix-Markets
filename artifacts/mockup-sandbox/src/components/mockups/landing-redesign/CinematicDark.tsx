import React from "react";
import { Link } from "wouter";

export default function CinematicDark() {
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-hidden relative font-sans selection:bg-blue-500/30">
      <style>{`
        @keyframes pulse-dot {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @keyframes grain-shift {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(-15%, 5%); }
          30% { transform: translate(7%, -25%); }
          40% { transform: translate(-5%, 25%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 15%); }
          80% { transform: translate(3%, 35%); }
          90% { transform: translate(-10%, 10%); }
        }
        .animate-pulse-dot {
          animation: pulse-dot 2s infinite;
        }
        .grain-overlay {
          position: absolute;
          top: -100%;
          left: -100%;
          width: 300%;
          height: 300%;
          pointer-events: none;
          z-index: 10;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          animation: grain-shift 8s steps(10) infinite;
        }
      `}</style>

      {/* Background Glow */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Noise overlay */}
      <div className="grain-overlay mix-blend-overlay"></div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-[#030712]/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <div className="w-3 h-3 bg-white rounded-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">Qorix</span>
            <span className="text-blue-500">Markets</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="text-sm font-medium px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
            Reserve Slot
          </Link>
        </div>
      </nav>

      {/* Hero Content */}
      <main className="relative z-20 flex flex-col items-center justify-center pt-32 pb-24 px-4 max-w-[900px] mx-auto text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-blue-500/30 mb-10 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
          <span className="text-xs font-medium text-blue-200 tracking-wide uppercase">Private allocation — 66 seats left</span>
        </div>

        {/* Headline */}
        <h1 className="text-[3.5rem] md:text-[5.5rem] font-[800] leading-[1.02] tracking-[-0.03em] mb-6 flex flex-col items-center">
          <span className="text-white text-shadow-sm">A hedge-fund style USDT trading system</span>
          <span className="bg-clip-text text-transparent bg-gradient-to-br from-blue-500 via-violet-500 to-purple-400 drop-shadow-[0_0_25px_rgba(139,92,246,0.3)]">
            built for disciplined investors.
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl font-light">
          Institutional-grade algorithmic execution, transparent yield generation, and strict risk management protocols.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
          <button className="px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-lg hover:from-blue-500 hover:to-indigo-500 transition-all shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 w-full sm:w-auto">
            Apply for Access <span className="ml-2">→</span>
          </button>
          <button className="px-8 py-4 rounded-full bg-transparent border border-white/10 text-white font-medium text-lg hover:bg-white/5 transition-all w-full sm:w-auto backdrop-blur-sm">
            Review Track Record <span className="ml-2 text-gray-400">↓</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {[
            { value: "$4.2M+", label: "Managed AUM" },
            { value: "43", label: "Active traders" },
            { value: "9.3%", label: "Avg monthly" }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
              <span className="text-3xl font-bold text-blue-400 mb-1">{stat.value}</span>
              <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
