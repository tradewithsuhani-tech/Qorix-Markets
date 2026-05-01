import { useEffect, useState } from "react";
import {
  Trophy,
  Sparkles,
  Zap,
  ShieldCheck,
  Clock,
  LogIn,
  UserPlus,
  ArrowRight,
  Flame,
  Users,
  Coins,
} from "lucide-react";
import { startLogin } from "@/lib/start-login";
import { clearAllAuth, readToken } from "@/lib/auth-storage";
import logoUrl from "@/assets/qorix-play-logo.png";

// B35: SSO with Qorix Markets is live, but the actual quiz-play screens
// land in B38. Until then "signed in" just means we have a Markets
// access token in localStorage and we replace the "Launching soon" CTA
// with a personalized "You're in — play coming soon" pill.
function useIsSignedIn(): {
  isSignedIn: boolean;
  signOut: () => void;
} {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return readToken() !== null;
  });

  useEffect(() => {
    function refresh() {
      setIsSignedIn(readToken() !== null);
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return {
    isSignedIn,
    signOut: () => {
      clearAllAuth();
      setIsSignedIn(false);
    },
  };
}

export function LandingPage() {
  const { isSignedIn, signOut } = useIsSignedIn();
  const [signInPending, setSignInPending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function handleSignIn() {
    setSignInError(null);
    setSignInPending(true);
    try {
      await startLogin({ returnTo: "/" });
      setSignInPending(false);
    } catch (err) {
      setSignInError(
        err instanceof Error
          ? err.message
          : "Could not start sign-in. Please try again.",
      );
      setSignInPending(false);
    }
  }

  // B37: brand-new users path. Same PKCE handshake as sign-in, but the
  // Markets bounce page reads `mode=signup` and drops the user on the
  // Sign Up form instead of the Sign In form.
  async function handleSignUp() {
    setSignInError(null);
    setSignInPending(true);
    try {
      await startLogin({ returnTo: "/", signup: true });
      setSignInPending(false);
    } catch (err) {
      setSignInError(
        err instanceof Error
          ? err.message
          : "Could not start sign-up. Please try again.",
      );
      setSignInPending(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-white">
      {/* All page-scoped keyframes live here so the file stays self-contained
          and we don't have to teach the global tailwind config new utilities
          for what is essentially landing-page eye-candy. */}
      <style>{`
        @keyframes qp-bgpan {
          0% { background-position: 0% 0%, 100% 0%, 50% 100%; }
          50% { background-position: 30% 20%, 70% 30%, 50% 80%; }
          100% { background-position: 0% 0%, 100% 0%, 50% 100%; }
        }
        @keyframes qp-grid {
          0% { transform: perspective(900px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(900px) rotateX(60deg) translateY(120px); }
        }
        @keyframes qp-spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes qp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes qp-pulse-glow {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(168,85,247,0.45),
              0 16px 50px -10px rgba(168,85,247,0.7),
              inset 0 0 0 1px rgba(255,255,255,0.18);
          }
          50% {
            box-shadow:
              0 0 0 18px rgba(168,85,247,0),
              0 18px 60px -10px rgba(217,70,239,0.85),
              inset 0 0 0 1px rgba(255,255,255,0.25);
          }
        }
        @keyframes qp-shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes qp-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes qp-scan {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        @keyframes qp-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }
        @keyframes qp-borderspin {
          to { transform: rotate(360deg); }
        }
        .qp-bg {
          background:
            radial-gradient(900px 600px at 15% -10%, rgba(34,211,238,0.28), transparent 60%),
            radial-gradient(900px 600px at 100% 0%, rgba(168,85,247,0.32), transparent 60%),
            radial-gradient(700px 500px at 50% 100%, rgba(217,70,239,0.22), transparent 60%),
            linear-gradient(180deg, #0a0420 0%, #0c0428 35%, #0a0224 70%, #07021a 100%);
          background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
          animation: qp-bgpan 18s ease-in-out infinite;
        }
        .qp-grid-floor {
          background-image:
            linear-gradient(rgba(34,211,238,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.35) 1px, transparent 1px);
          background-size: 60px 60px, 60px 60px;
          animation: qp-grid 6s linear infinite;
          mask-image: linear-gradient(to top, black 0%, black 30%, transparent 80%);
        }
        .qp-scanline {
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(34,211,238,0.08) 45%,
            rgba(168,85,247,0.18) 50%,
            rgba(34,211,238,0.08) 55%,
            transparent 100%);
          height: 240px;
          animation: qp-scan 9s linear infinite;
        }
        .qp-headline-shine {
          background-image: linear-gradient(
            90deg,
            #22d3ee 0%, #a855f7 25%, #d946ef 50%, #a855f7 75%, #22d3ee 100%);
          background-size: 200% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: qp-shine 6s linear infinite;
        }
        .qp-cta {
          background: linear-gradient(135deg, #22d3ee 0%, #a855f7 60%, #d946ef 100%);
          color: #06030f;
          animation: qp-pulse-glow 2.6s ease-in-out infinite;
        }
        .qp-logo-halo::before {
          content: "";
          position: absolute;
          inset: -20%;
          background: conic-gradient(from 0deg,
            rgba(34,211,238,0.0),
            rgba(34,211,238,0.5),
            rgba(168,85,247,0.6),
            rgba(217,70,239,0.5),
            rgba(34,211,238,0.0));
          filter: blur(40px);
          opacity: 0.7;
          animation: qp-spin-slow 14s linear infinite;
          z-index: -1;
        }
        .qp-logo-float { animation: qp-float 4s ease-in-out infinite; }
        .qp-ticker {
          display: inline-flex;
          gap: 2.5rem;
          padding-right: 2.5rem;
          animation: qp-ticker 28s linear infinite;
          white-space: nowrap;
        }
        .qp-twinkle { animation: qp-twinkle 3s ease-in-out infinite; }
        .qp-card-border {
          position: relative;
          background: rgba(255,255,255,0.03);
          border-radius: 1rem;
        }
        .qp-card-border::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg,
            rgba(34,211,238,0.45),
            rgba(168,85,247,0.45),
            rgba(217,70,239,0.45));
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.7;
        }
      `}</style>

      {/* ========== BACKGROUND LAYERS (fixed) ========== */}
      <div aria-hidden className="qp-bg pointer-events-none fixed inset-0 -z-30" />

      {/* Tron-style perspective grid floor — sits at the bottom and
          recedes into the horizon. This is the single biggest "gaming"
          tell on the page; without it the surface reads as a generic
          dark dashboard. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-20 h-[60vh] origin-bottom"
      >
        <div className="qp-grid-floor h-full w-full" />
      </div>

      {/* Slow scanline sweep */}
      <div
        aria-hidden
        className="qp-scanline pointer-events-none fixed inset-x-0 top-0 -z-10"
      />

      {/* Twinkling stars */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {Array.from({ length: 32 }).map((_, i) => {
          const left = (i * 53) % 100;
          const top = (i * 31) % 100;
          const size = (i % 3) + 1;
          const delay = (i * 0.27) % 4;
          const palette = ["#22d3ee", "#a855f7", "#d946ef", "#ffffff"];
          const color = palette[i % palette.length];
          return (
            <span
              key={i}
              className="qp-twinkle absolute rounded-full"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                background: color,
                boxShadow: `0 0 ${size * 4}px ${color}`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>

      {/* ========== LIVE TICKER (top edge) ========== */}
      <div className="relative z-20 overflow-hidden border-b border-cyan-400/20 bg-black/40 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
        <div className="qp-ticker">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex items-center gap-10">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live · prize pool growing
              </span>
              <span className="text-fuchsia-300">★ Top 10 · 90% payout</span>
              <span className="text-violet-300">⚡ 5 questions · 1 timer</span>
              <span className="text-cyan-300">🛡 KYC verified play</span>
              <span className="text-fuchsia-300">★ Auto-credit winnings</span>
              <span className="text-violet-300">⚡ Rounds every few mins</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08031a]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <a href="/" className="flex items-center gap-2" data-testid="logo-mark">
            <img
              src={logoUrl}
              alt="Qorix Play"
              className="h-9 w-auto sm:h-10"
              draggable={false}
            />
          </a>
          <div className="hidden items-center gap-2 text-xs text-white/70 sm:flex">
            {isSignedIn ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-emerald-200"
                  data-testid="badge-signed-in"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Signed in
                </span>
                <button
                  onClick={signOut}
                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 transition hover:border-white/30 hover:bg-white/10"
                  data-testid="button-sign-out"
                >
                  Sign out
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-400" />
                </span>
                Coming soon
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO */}
        <section className="pt-12 pb-16 text-center sm:pt-20 sm:pb-24">
          {/* Hero logo with conic-spinning halo */}
          <div className="qp-logo-float relative mx-auto mb-8 flex w-full max-w-2xl items-center justify-center">
            <div className="qp-logo-halo relative">
              <img
                src={logoUrl}
                alt="Qorix Play"
                className="relative z-10 h-32 w-auto drop-shadow-[0_0_40px_rgba(168,85,247,0.6)] sm:h-44 md:h-56"
                draggable={false}
              />
            </div>
          </div>

          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
            Play · Compete · Win
          </div>

          <h1
            className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
            data-testid="text-headline"
          >
            <span className="block">Play smart.</span>
            <span className="qp-headline-shine block">Win real cash.</span>
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-base text-white/70 sm:text-lg"
            data-testid="text-subhead"
          >
            Five timed questions. One live leaderboard. The top 10 split 90% of
            the prize pool — paid out automatically. Create your free account
            in seconds and start playing.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {isSignedIn ? (
              <button
                disabled
                className="qp-cta group relative inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold opacity-95"
                data-testid="button-play"
                title="Quiz play opens shortly"
              >
                <Trophy className="h-4 w-4" />
                You&apos;re in — play opens shortly
              </button>
            ) : (
              <>
                <button
                  onClick={handleSignUp}
                  disabled={signInPending}
                  className="qp-cta group relative inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                  data-testid="button-sign-up"
                >
                  <UserPlus className="h-4 w-4" />
                  {signInPending ? "Redirecting…" : "Create free account"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={handleSignIn}
                  disabled={signInPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/90 backdrop-blur transition hover:border-cyan-400/50 hover:bg-white/10 hover:text-white hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] disabled:cursor-wait disabled:opacity-70"
                  data-testid="button-sign-in"
                >
                  <LogIn className="h-4 w-4" />
                  {signInPending ? "Redirecting…" : "Sign in"}
                </button>
              </>
            )}
          </div>

          {signInError && (
            <p
              className="mt-3 text-xs text-rose-300"
              data-testid="text-sign-in-error"
            >
              {signInError}
            </p>
          )}

          {/* Quick stat strip */}
          <div className="qp-card-border mx-auto mt-12 grid max-w-3xl grid-cols-3 divide-x divide-white/10 overflow-hidden text-center backdrop-blur">
            <Stat
              icon={<Zap className="h-4 w-4" />}
              label="Questions / round"
              value="5"
              accent="cyan"
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Winners / round"
              value="Top 10"
              accent="violet"
            />
            <Stat
              icon={<Coins className="h-4 w-4" />}
              label="Prize payout"
              value="90%"
              accent="fuchsia"
            />
          </div>
        </section>

        {/* FEATURES */}
        <section className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Clock className="h-5 w-5" />}
            title="5 fast rounds"
            body="Each quiz is 5 multiple-choice questions on a strict timer. Smooth, fair, no filler."
            accent="cyan"
          />
          <FeatureCard
            icon={<Trophy className="h-5 w-5" />}
            title="Top 10 win"
            body="Prize pool is 90% of entries. Auto-split across the top 10 finishers — credited instantly."
            accent="violet"
          />
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="Live leaderboard"
            body="See your rank update in real time as the round plays out. Server-authoritative scoring, no lag."
            accent="fuchsia"
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="KYC + fair play"
            body="One verified player, one entry. Anti-cheat baked in: device fingerprint, geo-rules, and audit trail."
            accent="cyan"
          />
        </section>

        {/* HOW IT WORKS */}
        <section className="pb-16">
          <div className="mb-6 text-center">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-300">
              <Flame className="h-3 w-3" />
              How it works
            </div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Three steps. <span className="qp-headline-shine">Real money.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Step
              n="01"
              title="Join a round"
              body="Pick your category. A small entry seeds the prize pool — you'll see the live pot before you join."
              accent="cyan"
            />
            <Step
              n="02"
              title="Answer fast, answer right"
              body="5 questions. Strict timer. Speed bonus on every correct answer — accuracy and tempo both matter."
              accent="violet"
            />
            <Step
              n="03"
              title="Top 10 get paid"
              body="Winnings auto-credited to your wallet the moment the round ends. No claims, no waiting."
              accent="fuchsia"
            />
          </div>
        </section>

        {/* BOTTOM CTA */}
        {!isSignedIn && (
          <section className="mb-12">
            <div className="qp-card-border relative overflow-hidden p-8 text-center sm:p-12">
              <div
                aria-hidden
                className="absolute -top-32 left-1/2 -z-10 h-64 w-[120%] -translate-x-1/2 blur-3xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(168,85,247,0.45), rgba(34,211,238,0.25), transparent 70%)",
                }}
              />
              <h3 className="text-3xl font-black tracking-tight sm:text-4xl">
                Ready to play your{" "}
                <span className="qp-headline-shine">first round?</span>
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
                Free to join. Pay only when you enter a round. Withdraw anytime.
              </p>
              <button
                onClick={handleSignUp}
                disabled={signInPending}
                className="qp-cta mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                data-testid="button-cta-bottom-sign-up"
              >
                <UserPlus className="h-4 w-4" />
                {signInPending ? "Redirecting…" : "Create free account"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <footer className="border-t border-white/10 py-8 text-center text-xs text-white/50">
          <div data-testid="text-build">
            Qorix Play · {new Date().getFullYear()}
          </div>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "fuchsia";
}) {
  const color =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "violet"
        ? "text-violet-300"
        : "text-fuchsia-300";
  return (
    <div className="px-3 py-5">
      <div className={`mb-1 flex items-center justify-center gap-1.5 ${color}`}>
        {icon}
      </div>
      <div className={`text-2xl font-black sm:text-3xl ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
        {label}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: "cyan" | "violet" | "fuchsia";
}) {
  const iconBg =
    accent === "cyan"
      ? "bg-cyan-400/10 text-cyan-300 border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
      : accent === "violet"
        ? "bg-violet-400/10 text-violet-300 border-violet-400/40 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
        : "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/40 shadow-[0_0_20px_rgba(217,70,239,0.3)]";
  return (
    <div className="qp-card-border group relative p-5 backdrop-blur transition hover:-translate-y-1">
      <div
        className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${iconBg}`}
      >
        {icon}
      </div>
      <div className="text-base font-bold text-white">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  accent,
}: {
  n: string;
  title: string;
  body: string;
  accent: "cyan" | "violet" | "fuchsia";
}) {
  const numColor =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "violet"
        ? "text-violet-300"
        : "text-fuchsia-300";
  const ringColor =
    accent === "cyan"
      ? "shadow-[0_0_30px_rgba(34,211,238,0.4)]"
      : accent === "violet"
        ? "shadow-[0_0_30px_rgba(168,85,247,0.4)]"
        : "shadow-[0_0_30px_rgba(217,70,239,0.4)]";
  return (
    <div
      className={`qp-card-border relative p-6 backdrop-blur ${ringColor}`}
    >
      <div
        className={`text-4xl font-black tracking-tighter ${numColor}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {n}
      </div>
      <div className="mt-3 text-base font-bold text-white">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</div>
    </div>
  );
}
