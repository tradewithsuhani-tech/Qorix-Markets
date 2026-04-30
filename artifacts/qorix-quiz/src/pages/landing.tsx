import { Trophy, Sparkles, Zap, ShieldCheck, Clock } from "lucide-react";

export function LandingPage() {
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Coming soon
            </span>
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
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold opacity-70 cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(135deg, hsl(262 83% 65%), hsl(262 83% 55%))",
                color: "white",
                boxShadow: "0 8px 24px -8px hsl(262 83% 50% / 0.6)",
              }}
              data-testid="button-launch"
              title="Launching soon"
            >
              <Trophy className="w-4 h-4" />
              Launching soon
            </button>
            <a
              href="https://qorixmarkets.com"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-5 py-2.5 text-sm hover-elevate"
              data-testid="link-markets"
            >
              Visit Qorix Markets →
            </a>
          </div>
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
