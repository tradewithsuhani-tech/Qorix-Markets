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
} from "lucide-react";
import { startLogin } from "@/lib/start-login";
import { clearAllAuth, readToken } from "@/lib/auth-storage";
import logoUrl from "@/assets/qorix-play-logo.png";

// B35: SSO with Qorix Markets is live, but the actual quiz-play screens
// land in B38. Until then "signed in" just means we have a Markets
// access token in localStorage and we replace the "Launching soon" CTA
// with a personalized "You're in — play coming soon" pill so users get
// some feedback that the round-trip worked.
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
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#06030f] text-white">
      {/* Decorative background glow — fixed, behind everything. Two soft
          radial blooms (cyan + magenta) match the logo's neon palette and
          give the page that "arcade prize box" feel without needing any
          JS animation cost. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 600px at 15% -10%, rgba(34,211,238,0.18), transparent 60%), radial-gradient(900px 600px at 100% 0%, rgba(168,85,247,0.20), transparent 60%), radial-gradient(700px 500px at 50% 100%, rgba(217,70,239,0.12), transparent 60%)",
        }}
      />
      {/* Subtle grid overlay for the cyber/arcade vibe */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06030f]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <a
            href="/"
            className="flex items-center gap-2"
            data-testid="logo-mark"
          >
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

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO */}
        <section className="pt-12 pb-16 text-center sm:pt-20 sm:pb-24">
          {/* Hero logo with neon halo */}
          <div className="relative mx-auto mb-8 flex w-full max-w-2xl items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(168,85,247,0.45), rgba(34,211,238,0.25), transparent 70%)",
              }}
            />
            <img
              src={logoUrl}
              alt="Qorix Play"
              className="h-28 w-auto sm:h-40 md:h-48"
              draggable={false}
            />
          </div>

          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
            Play · Compete · Win
          </div>

          <h1
            className="mx-auto max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
            data-testid="text-headline"
          >
            Play smart.{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #22d3ee 0%, #a855f7 55%, #d946ef 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Win real cash.
            </span>
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
                className="group relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, #22d3ee 0%, #a855f7 60%, #d946ef 100%)",
                  color: "#06030f",
                  boxShadow:
                    "0 12px 40px -10px rgba(168,85,247,0.7), 0 0 0 1px rgba(255,255,255,0.15) inset",
                }}
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
                  className="group relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                  style={{
                    background:
                      "linear-gradient(135deg, #22d3ee 0%, #a855f7 60%, #d946ef 100%)",
                    color: "#06030f",
                    boxShadow:
                      "0 16px 50px -10px rgba(168,85,247,0.7), 0 0 0 1px rgba(255,255,255,0.18) inset",
                  }}
                  data-testid="button-sign-up"
                >
                  <UserPlus className="h-4 w-4" />
                  {signInPending ? "Redirecting…" : "Create free account"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={handleSignIn}
                  disabled={signInPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:border-cyan-400/40 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-70"
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

          {/* Quick stat strip — high-trust social-proof bar right under
              the CTA. Inline numbers convert better than feature words
              alone for skill-gaming traffic. */}
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-center backdrop-blur">
            <Stat label="Questions / round" value="5" accent="cyan" />
            <Stat label="Winners / round" value="Top 10" accent="violet" />
            <Stat label="Prize pool payout" value="90%" accent="fuchsia" />
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
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                How it works
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Three steps. Real money.
              </h2>
            </div>
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
              body="Winnings are auto-credited to your wallet the moment the round ends. No claims, no waiting."
              accent="fuchsia"
            />
          </div>
        </section>

        {/* BOTTOM CTA */}
        {!isSignedIn && (
          <section className="mb-12">
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center sm:p-12"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(168,85,247,0.18) 50%, rgba(217,70,239,0.14) 100%)",
              }}
            >
              <div
                aria-hidden
                className="absolute -top-32 left-1/2 -z-10 h-64 w-[120%] -translate-x-1/2 blur-3xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(168,85,247,0.4), transparent 70%)",
                }}
              />
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ready to play your first round?
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
                Free to join. Pay only when you enter a round. Withdraw anytime.
              </p>
              <button
                onClick={handleSignUp}
                disabled={signInPending}
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                style={{
                  background:
                    "linear-gradient(135deg, #22d3ee 0%, #a855f7 60%, #d946ef 100%)",
                  color: "#06030f",
                  boxShadow:
                    "0 16px 50px -10px rgba(168,85,247,0.7), 0 0 0 1px rgba(255,255,255,0.18) inset",
                }}
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
  label,
  value,
  accent,
}: {
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
    <div className="px-3 py-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
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
  const ring =
    accent === "cyan"
      ? "from-cyan-400/30 to-cyan-400/0"
      : accent === "violet"
        ? "from-violet-400/30 to-violet-400/0"
        : "from-fuchsia-400/30 to-fuchsia-400/0";
  const iconBg =
    accent === "cyan"
      ? "bg-cyan-400/10 text-cyan-300 border-cyan-400/30"
      : accent === "violet"
        ? "bg-violet-400/10 text-violet-300 border-violet-400/30"
        : "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/30";
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 -top-px mx-auto h-px w-2/3 bg-gradient-to-r ${ring}`}
      />
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}
      >
        {icon}
      </div>
      <div className="text-base font-semibold text-white">{title}</div>
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
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div
        className={`text-3xl font-black tracking-tighter ${numColor}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {n}
      </div>
      <div className="mt-3 text-base font-semibold text-white">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</div>
    </div>
  );
}
