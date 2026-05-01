import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// Defense-in-depth: even though the API server enforces an exact-match
// allow-list for redirect_uri, we double-check client-side that it points
// at one of our known Qorixplay surfaces. Stops obvious phishing /
// open-redirect attempts from ever reaching the network — and, more
// importantly, protects users whose JWT could otherwise be silently
// converted into a code that gets handed to evil.com if a misconfigured
// API ever loosened the allow-list.
const ALLOWED_REDIRECT_PREFIXES = [
  "https://qorixplay.com/",
  "https://qorix-quiz.fly.dev/",
];

function isAllowedRedirectUri(uri: string): boolean {
  if (!uri || uri.length > 2048) return false;
  try {
    const u = new URL(uri);
    if (u.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return ALLOWED_REDIRECT_PREFIXES.some((p) => uri.startsWith(p));
}

// We exit through the OAuth callback even on failure, per RFC 6749 §4.1.2.1
// — the SPA at the other end can render a friendly "Couldn't sign in"
// screen using the standard `?error=` + `?error_description=` params, and
// users don't get stranded on a Markets URL after clicking "Sign in" on
// Qorixplay.
function buildRedirect(
  redirectUri: string,
  params: Record<string, string | undefined>,
): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, v);
  }
  return u.toString();
}

export default function OauthQuizAuthorizePage() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  // Make sure we only attempt the exchange once per page mount, even if a
  // re-render fires the effect again. Without this guard a slow network
  // could end up double-minting codes (or, worse, double-burning the user's
  // first code by racing two POSTs).
  const startedRef = useRef(false);

  // Pull params once on mount — useLocation() in wouter doesn't expose query
  // string, and we need the raw window.location.search anyway.
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? undefined;
  const codeChallenge = params.get("code_challenge") ?? undefined;
  const codeChallengeMethod = params.get("code_challenge_method") ?? undefined;
  const scope = params.get("scope") ?? undefined;
  const clientId = params.get("client_id") ?? "qorixplay";

  useEffect(() => {
    // Wait for AuthProvider to finish hydrating its /me query before
    // making any decision. Otherwise we'd flash "redirect to login" for
    // a logged-in user on a hard refresh.
    if (isLoading) return;
    if (startedRef.current) return;

    // 1. Hard-fail invalid redirect_uri locally — no need to round-trip.
    if (!isAllowedRedirectUri(redirectUri)) {
      startedRef.current = true;
      setError(
        "This sign-in link is not for a recognized Qorix Play surface. " +
          "Please return to qorixplay.com and try again.",
      );
      return;
    }

    // 2. Unauthenticated → stash the full URL and bounce to /login.
    //    The post-login hook in AuthProvider will resume us here once the
    //    user signs in, so they don't have to click "Sign in with Qorix
    //    Markets" a second time.
    if (!user || !token) {
      try {
        sessionStorage.setItem(
          "qorix_oauth_resume_url",
          window.location.pathname + window.location.search,
        );
      } catch {
        // sessionStorage can be disabled in private mode — without it the
        // user just lands on /dashboard after login and clicks "Sign in"
        // again on Qorixplay. Acceptable degradation.
      }
      startedRef.current = true;
      setLocation("/login");
      return;
    }

    // 3. Authenticated → mint the code and redirect.
    startedRef.current = true;
    (async () => {
      try {
        const resp = await authFetch<{ code: string; expires_in: number }>(
          `${BASE_URL}/api/oauth/quiz/authorize`,
          {
            method: "POST",
            body: JSON.stringify({
              redirect_uri: redirectUri,
              client_id: clientId,
              scope,
              code_challenge: codeChallenge,
              code_challenge_method: codeChallengeMethod,
            }),
          },
        );

        if (!resp || typeof resp.code !== "string") {
          // authFetch may return the parsed error body on a 4xx — translate
          // anything that isn't `{ code }` into an OAuth-spec error redirect
          // so the Quiz side can render a clean message.
          const errCode =
            (resp as any)?.error === "invalid_redirect_uri"
              ? "invalid_request"
              : "server_error";
          const errMsg =
            (resp as any)?.message ??
            "Authorization server did not return a code.";
          window.location.replace(
            buildRedirect(redirectUri, {
              error: errCode,
              error_description: errMsg,
              state,
            }),
          );
          return;
        }

        // window.location.replace (not href) so the consent URL doesn't
        // pollute back-button history — pressing "back" from Qorix Play
        // shouldn't drop the user onto a stale code we already burned.
        window.location.replace(
          buildRedirect(redirectUri, { code: resp.code, state }),
        );
      } catch (err) {
        // Network / unexpected error — stay on Markets so the user can
        // see what happened and retry, instead of bouncing to a Quiz
        // callback that has no useful context.
        setError(
          err instanceof Error
            ? err.message
            : "Could not contact the authorization server.",
        );
      }
    })();
  }, [
    isLoading,
    user,
    token,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    scope,
    clientId,
    setLocation,
  ]);

  // ─── UI ────────────────────────────────────────────────────────────────
  // Deliberately minimal — this is a transient bounce screen, not a
  // destination. A spinner + a friendly line is enough; the heavy lifting
  // happens in the effect above and we navigate away within ~200ms.
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-amber-400 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-500/30">
          Q
        </div>

        {error ? (
          <>
            <h1
              className="text-xl font-semibold tracking-tight"
              data-testid="text-oauth-error-title"
            >
              Sign-in couldn&apos;t complete
            </h1>
            <p
              className="mt-3 text-sm text-muted-foreground"
              data-testid="text-oauth-error-message"
            >
              {error}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setLocation("/dashboard")}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm hover-elevate"
                data-testid="button-oauth-back-to-markets"
              >
                Back to Qorix Markets
              </button>
              {isAllowedRedirectUri(redirectUri) && (
                <a
                  href={buildRedirect(redirectUri, {
                    error: "access_denied",
                    state,
                  })}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700"
                  data-testid="link-oauth-cancel"
                >
                  Return to Qorix Play
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <h1
              className="text-xl font-semibold tracking-tight"
              data-testid="text-oauth-title"
            >
              Signing you into Qorix Play…
            </h1>
            <p
              className="mt-3 text-sm text-muted-foreground"
              data-testid="text-oauth-subtitle"
            >
              You&apos;ll be returned to Qorix Play in a moment.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
