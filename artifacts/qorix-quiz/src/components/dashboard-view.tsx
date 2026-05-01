// Authenticated player dashboard — replaces the marketing CTAs on the
// Qorix Play landing page when the visitor is signed in. Driven by a
// single round-trip to GET /api/quiz/me/dashboard.
//
// Why one component, not a separate route:
//   The Qorixplay SPA only has two routes (`/` landing + `/auth/callback`).
//   The signed-in dashboard lives on the same `/` URL so a fresh tab
//   open / cold reload doesn't bounce through a route change first.
//
// Why no client-side aggregation:
//   The endpoint already merges profile, wallet, lifetime stats, recent
//   wins, recent rounds, and the next/live quiz. We render exactly what
//   the server sent — no derived state, no second fetch loop.

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Wallet as WalletIcon,
  Crown,
  History,
  ArrowRight,
  Flame,
  Loader2,
  AlertTriangle,
  Hash,
  Coins,
} from "lucide-react";
import { API_URL } from "@/lib/oauth-config";
import { getValidAccessToken } from "@/lib/refresh-client";
import { MARKETS_URL } from "@/lib/oauth-config";

// ── Server response shape ──────────────────────────────────────────────
// Mirrors api-server/src/routes/quiz.ts → /quiz/me/dashboard. Money
// fields are strings (server returns DECIMAL.toString() to avoid the
// JS Number 2^53 truncation issue on USDT 8-decimal balances).
interface DashboardData {
  profile: {
    id: number;
    email: string;
    fullName: string;
    kycStatus: string;
  };
  wallet: {
    mainBalance: string;
    currency: string;
  };
  stats: {
    quizzesPlayed: number;
    quizzesWon: number;
    totalWinnings: string;
    bestRank: number | null;
    currency: string;
  };
  recentWins: Array<{
    quizId: number;
    title: string;
    rank: number;
    prizeAmount: string;
    prizeCurrency: string;
    endedAt: string | null;
    paidAt: string | null;
  }>;
  recentRounds: Array<{
    quizId: number;
    title: string;
    status: string;
    scheduledStartAt: string | null;
    endedAt: string | null;
    joinedAt: string;
    myScore: number;
    myRank: number | null;
    myPrize: { amount: string; currency: string } | null;
  }>;
  upcoming: {
    quizId: number;
    title: string;
    status: "scheduled" | "live";
    scheduledStartAt: string | null;
    prizePool: string;
    prizeCurrency: string;
    entryFee: string;
    joined: boolean;
  } | null;
}

// Format a fixed-point money string for compact display. We trim to two
// decimals for human-readable amounts but never use parseFloat — keeps
// trailing-zero precision and avoids the float-rounding surprises that
// would otherwise turn "100.00000001" into "100".
function fmtMoney(s: string | undefined | null): string {
  if (!s) return "0.00";
  const [whole, frac = ""] = String(s).split(".");
  const fracTrim = (frac + "00").slice(0, 2);
  // Add thousand separators for the integer part — purely cosmetic but
  // makes 4-digit+ wallet balances readable at a glance.
  const wholeFmt = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${wholeFmt}.${fracTrim}`;
}

// "in 4m 12s" / "5m ago" — preferred over a raw timestamp because the
// dashboard is glanceable, not analytical. For >24h windows we fall
// back to a short date so "in 3 days" doesn't lie about precision.
function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const sign = diff >= 0 ? "in " : "";
  const suffix = diff >= 0 ? "" : " ago";
  if (abs < 60_000) {
    return `${sign}${Math.max(1, Math.round(abs / 1000))}s${suffix}`;
  }
  if (abs < 60 * 60_000) {
    return `${sign}${Math.round(abs / 60_000)}m${suffix}`;
  }
  if (abs < 24 * 60 * 60_000) {
    const h = Math.floor(abs / (60 * 60_000));
    const m = Math.round((abs % (60 * 60_000)) / 60_000);
    return `${sign}${h}h ${m}m${suffix}`;
  }
  // > 24h — switch to short date. We don't show year because the live
  // dashboard never references rounds older than a few months in
  // practice (the recent-* lists are LIMIT 5).
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Small badge for round status. Keeping the colour palette consistent
// with the marketing landing's cyan/violet/emerald scheme so the page
// feels like one continuous surface, not a separate signed-in app.
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    live: {
      label: "Live",
      cls: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    },
    scheduled: {
      label: "Scheduled",
      cls: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    },
    in_progress: {
      label: "Live",
      cls: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    },
    ended: {
      label: "Ended",
      cls: "border-white/15 bg-white/5 text-white/60",
    },
    cancelled: {
      label: "Cancelled",
      cls: "border-white/15 bg-white/5 text-white/40",
    },
  };
  const v = map[status] ?? {
    label: status,
    cls: "border-white/15 bg-white/5 text-white/60",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

interface DashboardViewProps {
  // Allow the parent landing to keep its own sign-out plumbing — the
  // dashboard itself never owns the auth lifecycle, so it just renders
  // a button that calls back into the page-level handler.
  onSignOut: () => void;
}

export function DashboardView({ onSignOut }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setError(null);
      try {
        // `getValidAccessToken` already handles silent refresh of an
        // expired access_token via the stored refresh_token. If it
        // returns null, the user is effectively signed out — surface
        // that as a soft prompt rather than a JS error.
        const token = await getValidAccessToken();
        if (!alive) return;
        if (!token) {
          setError("Your session expired. Please sign in again.");
          setLoading(false);
          return;
        }
        const resp = await fetch(`${API_URL}/api/quiz/me/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!alive) return;
        if (resp.status === 401) {
          // Token was rejected (e.g. user disabled, signed out from
          // Markets, or backend restart invalidated something) — same
          // soft-prompt UX as no-token.
          setError("Your session expired. Please sign in again.");
          setLoading(false);
          return;
        }
        if (!resp.ok) {
          setError(`Could not load your dashboard (HTTP ${resp.status}).`);
          setLoading(false);
          return;
        }
        const json = (await resp.json()) as DashboardData;
        setData(json);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not reach the Qorix Play servers.",
        );
        setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  // Friendly first-name slice — the API returns the full legal name
  // (used for KYC) but a dashboard greeting wants the casual form.
  const firstName = useMemo(() => {
    if (!data?.profile.fullName) return null;
    return data.profile.fullName.split(/\s+/)[0] ?? null;
  }, [data]);

  if (loading) {
    return (
      <div
        className="mx-auto flex max-w-4xl items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-white/70 backdrop-blur"
        data-testid="dashboard-loading"
      >
        <Loader2 className="h-5 w-5 animate-spin text-fuchsia-300" />
        <span>Loading your Qorix Play dashboard…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="mx-auto max-w-4xl rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100 backdrop-blur"
        data-testid="dashboard-error"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Couldn&apos;t load your dashboard</p>
            <p className="mt-1 text-sm text-rose-100/80">
              {error ?? "Please try again."}
            </p>
            <button
              onClick={onSignOut}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
              data-testid="dashboard-error-sign-out"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-5xl space-y-5"
      data-testid="dashboard-view"
    >
      {/* Greeting + wallet — the two pieces of info every player wants
          first: "is this me?" and "how much can I spend?". */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-cyan-500/10 p-5 backdrop-blur sm:flex-row sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/50">
            Welcome back
          </p>
          <h2
            className="mt-1 text-2xl font-black text-white sm:text-3xl"
            data-testid="dashboard-greeting"
          >
            {firstName ?? "Player"}
          </h2>
          <p className="mt-1 text-xs text-white/60">{data.profile.email}</p>
        </div>
        <div
          className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3"
          data-testid="dashboard-wallet"
        >
          <WalletIcon className="h-5 w-5 text-emerald-300" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">
              Wallet · {data.wallet.currency}
            </p>
            <p className="font-mono text-xl font-black text-emerald-100">
              {fmtMoney(data.wallet.mainBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Lifetime stats — three big numbers + best rank pill. We show
          0 explicitly for new players (instead of em-dash) because
          "0 wins so far" reads as inviting; "—" reads as broken. */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        data-testid="dashboard-stats"
      >
        <StatTile
          icon={<Hash className="h-4 w-4" />}
          label="Rounds played"
          value={String(data.stats.quizzesPlayed)}
        />
        <StatTile
          icon={<Trophy className="h-4 w-4" />}
          label="Rounds won"
          value={String(data.stats.quizzesWon)}
        />
        <StatTile
          icon={<Coins className="h-4 w-4" />}
          label={`Won (${data.stats.currency})`}
          value={fmtMoney(data.stats.totalWinnings)}
        />
        <StatTile
          icon={<Crown className="h-4 w-4" />}
          label="Best rank"
          value={
            data.stats.bestRank === null ? "—" : `#${data.stats.bestRank}`
          }
        />
      </div>

      {/* Play-now CTA — only renders when there's actually a quiz to
          play. We deliberately don't fake a "Coming soon" pseudo-CTA
          here; if the scheduler queue is empty, the slot below tells
          the player to check back, which is honest. */}
      {data.upcoming ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-cyan-500/15 p-5 backdrop-blur"
          data-testid="dashboard-upcoming"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <StatusPill status={data.upcoming.status} />
                <span className="text-[10px] uppercase tracking-wider text-white/60">
                  {data.upcoming.status === "live"
                    ? "Happening now"
                    : `Starts ${fmtRelative(data.upcoming.scheduledStartAt)}`}
                </span>
              </div>
              <h3 className="mt-2 text-xl font-black text-white">
                {data.upcoming.title}
              </h3>
              <p className="mt-1 text-sm text-white/70">
                Pool{" "}
                <span className="font-mono font-bold text-fuchsia-200">
                  {fmtMoney(data.upcoming.prizePool)}{" "}
                  {data.upcoming.prizeCurrency}
                </span>{" "}
                · Entry{" "}
                <span className="font-mono font-bold text-cyan-200">
                  {fmtMoney(data.upcoming.entryFee)}{" "}
                  {data.upcoming.prizeCurrency}
                </span>
              </p>
            </div>
            {/* The "Play Now" target lives on Qorix Markets PWA today
                (the actual quiz UI ships in a later batch on Markets);
                we deep-link there with the quiz id so the click does
                exactly the right thing once that screen lands. */}
            <a
              href={`${MARKETS_URL}/play/quiz/${data.upcoming.quizId}`}
              className="qp-cta inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.03] active:scale-[0.98]"
              data-testid="dashboard-play-cta"
            >
              <Flame className="h-4 w-4" />
              {data.upcoming.joined ? "Resume round" : "Play now"}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur"
          data-testid="dashboard-no-upcoming"
        >
          <p className="text-sm text-white/70">
            No live or scheduled rounds right now. Fresh quizzes drop
            throughout the day — check back soon.
          </p>
        </div>
      )}

      {/* Recent wins + Recent rounds — two-column on sm+, stacked on
          mobile. Both intentionally cap at 5 server-side; "View all"
          links would point at /play history pages once Markets ships
          those, so we avoid dead links by omitting them for now. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
          data-testid="dashboard-recent-wins"
        >
          <header className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">
              Recent wins
            </h3>
          </header>
          {data.recentWins.length === 0 ? (
            <p className="text-sm text-white/50">
              No wins yet. Your first prize is one round away.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recentWins.map((w) => (
                <li
                  key={`${w.quizId}-${w.rank}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold text-white"
                      title={w.title}
                    >
                      {w.title}
                    </p>
                    <p className="text-xs text-white/50">
                      Rank #{w.rank} · {fmtRelative(w.endedAt)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-300">
                    +{fmtMoney(w.prizeAmount)} {w.prizeCurrency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
          data-testid="dashboard-recent-rounds"
        >
          <header className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">
              Recent rounds
            </h3>
          </header>
          {data.recentRounds.length === 0 ? (
            <p className="text-sm text-white/50">
              Join your first round to see it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.recentRounds.map((r) => (
                <li
                  key={r.quizId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold text-white"
                      title={r.title}
                    >
                      {r.title}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-white/50">
                      <StatusPill status={r.status} />
                      <span>Score {r.myScore}</span>
                      {r.myRank !== null && <span>· #{r.myRank}</span>}
                    </p>
                  </div>
                  {r.myPrize ? (
                    <span className="font-mono text-xs font-bold text-emerald-300">
                      +{fmtMoney(r.myPrize.amount)} {r.myPrize.currency}
                    </span>
                  ) : (
                    <span className="text-xs text-white/30">—</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSignOut}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          data-testid="dashboard-sign-out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-mono text-xl font-black text-white">{value}</p>
    </div>
  );
}
