import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ArrowRight } from "lucide-react";
import { StickyJoinButton } from "./sticky-cta";
import { SignupPopup } from "./signup-popup";
import { trackCta } from "@/lib/analytics";
import { withRef } from "@/lib/referral";
import qorixLogo from "@/assets/qorix-logo.png";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/ai-trading-platform", label: "AI Trading" },
  { href: "/zero-trading-fee", label: "Zero Fee" },
  { href: "/low-investment-trading", label: "Start at $10" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#050814", color: "#e2e8f0" }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          background: "rgba(5,8,20,0.85)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src={qorixLogo}
              alt="Qorix Markets logo"
              className="w-8 h-8 md:w-9 md:h-9 object-contain rounded-lg"
              style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.45))" }}
            />
            <span className="font-black text-base md:text-lg text-white">
              Qorix{" "}
              <span
                style={{
                  background: "linear-gradient(90deg,#22c55e,#22c55e)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Markets
              </span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => {
              const active = location === l.href || (l.href !== "/" && location.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "text-white bg-white/[0.06]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href={withRef("/signup")}
              onClick={() => trackCta("Start Trading", "header")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-lg"
              style={{
                background: "linear-gradient(90deg,#10b981,#22c55e)",
                boxShadow: "0 10px 30px -10px rgba(16,185,129,0.5)",
              }}
            >
              Start Trading <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden p-2 -mr-2 text-slate-300"
              aria-label="Open menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div
            className="lg:hidden border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.04]"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="sm:hidden mt-2 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.04]"
              >
                Log in
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <MarketingFooter />
      <StickyJoinButton />
      <SignupPopup />
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="border-t mt-16"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <img
              src={qorixLogo}
              alt="Qorix Markets logo"
              className="w-8 h-8 object-contain rounded-lg"
              style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.45))" }}
            />
            <span className="font-black text-white">Qorix Markets</span>
          </div>
          <p className="text-slate-500 leading-relaxed text-xs">
            AI-managed USDT trading. Zero fees. Start with $10. Trusted by
            thousands of investors worldwide.
          </p>
        </div>
        <div>
          <h3 className="text-white font-bold mb-3 text-sm">Platform</h3>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/ai-trading-platform" className="hover:text-emerald-300">AI Trading</Link></li>
            <li><Link href="/zero-trading-fee" className="hover:text-emerald-300">Zero Trading Fee</Link></li>
            <li><Link href="/low-investment-trading" className="hover:text-emerald-300">Start at $10</Link></li>
            <li><Link href={withRef("/signup")} className="hover:text-emerald-300">Open Account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-3 text-sm">Company</h3>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/about" className="hover:text-emerald-300">About Us</Link></li>
            <li><Link href="/blog" className="hover:text-emerald-300">Blog</Link></li>
            <li><Link href="/contact" className="hover:text-emerald-300">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-white font-bold mb-3 text-sm">Legal</h3>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/privacy" className="hover:text-emerald-300">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-emerald-300">Terms &amp; Conditions</Link></li>
            <li><Link href="/legal/risk-disclosure" className="hover:text-emerald-300">Risk Disclosure</Link></li>
            <li><Link href="/legal/aml-kyc" className="hover:text-emerald-300">AML / KYC</Link></li>
          </ul>
        </div>
      </div>
      <div
        className="border-t py-5 text-center text-xs text-slate-600"
        style={{ borderColor: "rgba(255,255,255,0.04)" }}
      >
        &copy; {new Date().getFullYear()} Qorix Markets. All rights reserved.
        Trading involves risk. Past performance is not a guarantee of future
        results.
      </div>
    </footer>
  );
}

export function MarketingHero({
  badge,
  title,
  subtitle,
  ctaHref = "/signup",
  ctaLabel = "Start Trading Free",
  secondaryHref,
  secondaryLabel,
  trackLocation = "hero",
}: {
  badge?: string;
  title: ReactNode;
  subtitle: string;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  trackLocation?: string;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 80% 30%, rgba(34,197,94,0.16), transparent 50%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-14 md:pt-24 pb-12 md:pb-20 text-center">
        {badge && (
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5"
            style={{
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.30)",
              color: "#6ee7b7",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {badge}
          </span>
        )}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.05] mb-5">
          {title}
        </h1>
        <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-400 leading-relaxed">
          {subtitle}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={withRef(ctaHref)}
            onClick={() => trackCta(ctaLabel, trackLocation)}
            className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{
              background: "linear-gradient(90deg,#10b981,#22c55e)",
              boxShadow: "0 14px 40px -12px rgba(16,185,129,0.55)",
            }}
          >
            {ctaLabel} <ArrowRight size={16} />
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-sm font-semibold text-slate-200 border border-white/10 hover:border-white/30 hover:bg-white/[0.04] transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
