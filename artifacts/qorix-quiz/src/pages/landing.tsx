import { useEffect, useState } from "react";
import { Trophy, Sparkles, Zap, ShieldCheck, Clock, LogIn, UserPlus } from "lucide-react";
import { startLogin } from "@/lib/start-login";
import { clearAllAuth, readToken } from "@/lib/auth-storage";

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

  // Re-check on focus / visibilitychange so a sign-in completed in
  // another tab gets reflected here without a hard reload. The cost is
  // ~1 localStorage read per focus event — negligible.
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
      // B36: full sign-out — wipe BOTH access and refresh tokens so
      // the user lands cleanly on /sign-in with no stale credentials
      // that the refresh helper might try to silently reuse.
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
      // window.location.assign inside startLogin replaces the page —
      // we won't get here unless the navigation was blocked. If we
      // do, surface a generic error so the user isn't stuck on a
      // spinner forever.
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
  // Sign Up form instead of the Sign In form — so they're not asked to
  // log in to an account they don't have yet. After signup completes,
  // the existing resume URL flow brings them back to /auth/callback
  // and on into Qorixplay, exactly like sign-in.
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
    <div className="min-h-screen w-full">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-30 bg-background/70">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base"
              style={{
                background:
                  "linear-gradient(135deg, hsl(262 83% 65%), hsl(48 96% 58%))",
                color: "hsl(262 47% 7%)",
              }}
              data-testid="logo-mark"
            >
              Q
            </div>
            <div className="leading-tight">
              <div
                className="font-bold text-base tracking-tight"
                data-testid="text-brand"
              >
                Qorix Play
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Skill · Speed · Wins
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            {isSignedIn ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/60"
                  data-testid="badge-signed-in"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Signed in with Markets
                </span>
                <button
                  onClick={signOut}
                  className="px-2.5 py-1 rounded-full border border-border/60 bg-card/60 hover-elevate"
                  data-testid="button-sign-out"
                >
                  Sign out
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Quiz play coming soon
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            Skill-based quizzes · 5 questions · Top 10 win
          </div>
          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]"
            data-testid="text-headline"
          >
            Play smart.{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(90deg, hsl(262 83% 65%), hsl(48 96% 58%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Win real cash.
            </span>
          </h1>
          <p
            className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            data-testid="text-subhead"
          >
            Five timed questions. One live leaderboard. The top 10 split 90% of
            the prize pool — paid out automatically. Sign in once with your
            Qorix Markets account, no separate signup needed.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {isSignedIn ? (
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold opacity-70 cursor-not-allowed"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(262 83% 65%), hsl(262 83% 55%))",
                  color: "white",
                  boxShadow: "0 8px 24px -8px hsl(262 83% 50% / 0.6)",
                }}
                data-testid="button-play"
                title="Quiz play opens shortly"
              >
                <Trophy className="w-4 h-4" />
                You&apos;re in — play opens shortly
              </button>
            ) : (
              <>
                {/* B37: brand-new users get the primary CTA — most
                    Qorixplay traffic is fresh-from-ads, so a "Create
                    account" path that drops them straight on the Sign
                    Up form (instead of asking them to log in to an
                    account they don't have) is the conversion-critical
                    surface here. Existing Markets users still get the
                    "Sign in" secondary right next to it. */}
                <button
                  onClick={handleSignUp}
                  disabled={signInPending}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-70 disabled:cursor-wait"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(262 83% 65%), hsl(48 96% 58%))",
                    color: "hsl(262 47% 7%)",
                    boxShadow: "0 8px 24px -8px hsl(262 83% 50% / 0.6)",
                  }}
                  data-testid="button-sign-up"
                >
                  <UserPlus className="w-4 h-4" />
                  {signInPending ? "Redirecting…" : "Create free account"}
                </button>
                <button
                  onClick={handleSignIn}
                  disabled={signInPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-5 py-2.5 text-sm hover-elevate disabled:opacity-70 disabled:cursor-wait"
                  data-testid="button-sign-in"
                >
                  <LogIn className="w-4 h-4" />
                  {signInPending ? "Redirecting…" : "Sign in"}
                </button>
              </>
            )}
            <a
              href="https://qorixmarkets.com"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-5 py-2.5 text-sm hover-elevate"
              data-testid="link-markets"
            >
              Visit Qorix Markets →
            </a>
          </div>
          {signInError && (
            <p
              className="mt-3 text-xs text-red-400"
              data-testid="text-sign-in-error"
            >
              {signInError}
            </p>
          )}
        </section>

        <section className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<Clock className="w-5 h-5" />}
            title="5 fast rounds"
            body="Each quiz is 5 multiple-choice questions on a strict timer. Smooth, fair, no filler."
            tone="violet"
          />
          <FeatureCard
            icon={<Trophy className="w-5 h-5" />}
            title="Top 10 win"
            body="Prize pool is 90% of entries. Auto-split across the top 10 finishers — credited instantly."
            tone="yellow"
          />
          <FeatureCard
            icon={<Zap className="w-5 h-5" />}
            title="Live leaderboard"
            body="See your rank update in real time as the round plays out. Server-authoritative scoring, no lag."
            tone="violet"
          />
          <FeatureCard
            icon={<ShieldCheck className="w-5 h-5" />}
            title="KYC + fair play"
            body="One verified player, one entry. Anti-cheat baked in: device fingerprint, geo-rules, and audit trail."
            tone="yellow"
          />
        </section>

        <section className="mt-16 rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            Single sign-on
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            One Qorix account. Two products.
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
            Sign in with your existing Qorix Markets account — no separate
            password, no separate KYC. Your USDT and INR wallets stay where
            they are; entry fees and winnings move directly between Markets and
            Play.
          </p>
        </section>

        <footer className="mt-16 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
          <div data-testid="text-build">
            B32 · qorix-quiz scaffold · {new Date().getFullYear()} Qorix Markets
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "violet" | "yellow";
}) {
  const accent =
    tone === "violet"
      ? "hsl(262 83% 65%)"
      : "hsl(48 96% 58%)";
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/60 p-5 hover-elevate"
      data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{
          background: `${accent}1A`,
          color: accent,
        }}
      >
        {icon}
      </div>
      <div className="font-semibold text-sm tracking-tight mb-1">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        {body}
      </div>
    </div>
  );
}
