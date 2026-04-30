import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp } from "lucide-react";

interface Section {
  title: string;
  content: React.ReactNode;
}

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: Section[];
}

export function LegalLayout({ title, subtitle, effectiveDate, sections }: LegalLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen" style={{ background: "#050814", color: "#e2e8f0" }}>
      <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(5,8,20,0.92)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                <TrendingUp size={11} className="text-white" />
              </div>
              <span className="font-black text-sm text-white">Qorix{" "}<span style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Markets</span></span>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">Effective {effectiveDate}</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-5">
            Legal
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">{title}</h1>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">{subtitle}</p>
          <div className="mt-4 text-sm text-slate-500">Last updated: {effectiveDate}</div>
        </div>

        <div className="space-y-10">
          {sections.map((section, i) => (
            <div key={i} className="rounded-2xl p-6 md:p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h2 className="text-lg font-bold text-white mb-4 flex items-start gap-3">
                <span className="text-[13px] font-black px-2 py-0.5 rounded-lg shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.title}
              </h2>
              <div className="text-slate-400 text-sm leading-relaxed space-y-3">{section.content}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <p className="text-sm text-slate-400">
            Questions about this document? Contact us at{" "}
            <span className="text-emerald-400 font-semibold">legal@qorixmarkets.com</span>
          </p>
        </div>
      </div>

      <footer className="border-t py-8" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
              <TrendingUp size={8} className="text-white" />
            </div>
            <span className="font-bold text-slate-500">QorixMarkets</span>
          </div>
          <div className="flex gap-4">
            {[["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"], ["Risk Disclosure", "/legal/risk-disclosure"], ["AML/KYC", "/legal/aml-kyc"]].map(([label, path]) => (
              <button key={path} onClick={() => setLocation(path)} className="hover:text-slate-400 transition-colors">{label}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
