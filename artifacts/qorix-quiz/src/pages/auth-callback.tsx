import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { API_URL, CLIENT_ID, getRedirectUri } from "@/lib/oauth-config";
import { storeToken } from "@/lib/auth-storage";
import {
  PKCE_RETURN_TO_KEY,
  PKCE_STATE_KEY,
  PKCE_VERIFIER_KEY,
} from "@/lib/start-login";

type ExchangeResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type ExchangeError = {
  error?: string;
  message?: string;
};

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  // Same one-shot guard as the Markets-side bounce page — React 18
  // strict-mode double-invokes effects in dev, and a slow network could
  // race two POSTs which would burn the code on the first request and
  // 400 on the second. We'd rather show a single clean failure.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);

    // Spec-compliant error path — Markets bounced us with
    // ?error=access_denied&error_description=... rather than a code.
    const oauthError = params.get("error");
    if (oauthError) {
      setError(
        params.get("error_description") ??
          (oauthError === "access_denied"
            ? "You cancelled the sign-in."
            : `Sign-in failed (${oauthError}).`),
      );
      return;
    }

    const code = params.get("code");
    const returnedState = params.get("state");

    let storedState: string | null = null;
    let storedVerifier: string | null = null;
    let storedReturnTo: string | null = null;
    try {
      storedState = sessionStorage.getItem(PKCE_STATE_KEY);
      storedVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      storedReturnTo = sessionStorage.getItem(PKCE_RETURN_TO_KEY);
    } catch {
      setError(
        "This browser blocks session storage, which is required to finish " +
          "signing in. Please disable private/incognito mode and try again.",
      );
      return;
    }

    // Atomically clear the verifier as soon as we read it — even if the
    // exchange below fails. PKCE verifiers are one-shot by design;
    // letting the user "retry" with the same verifier on a different
    // code would defeat the protection. Caller can press "Sign in
    // again" to mint a fresh one.
    try {
      sessionStorage.removeItem(PKCE_STATE_KEY);
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem(PKCE_RETURN_TO_KEY);
    } catch {
      // ignore — best-effort
    }

    if (!code) {
      setError("Authorization server did not return a code. Please try again.");
      return;
    }
    if (!storedState || !storedVerifier) {
      setError(
        "We lost the sign-in session before it could finish. " +
          "This can happen if the tab was reopened mid-flow. Please try again.",
      );
      return;
    }
    // Constant-time-ish state compare. Lengths are short and equal-length
    // when valid; a length mismatch is a guaranteed reject so a fast
    // path is fine here without timing-attack concerns.
    if (returnedState !== storedState) {
      setError(
        "Sign-in security check failed (state mismatch). For your safety we " +
          "stopped the flow. Please try again from the Sign in button.",
      );
      return;
    }

    (async () => {
      try {
        const resp = await fetch(`${API_URL}/api/oauth/quiz/token-public`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            client_id: CLIENT_ID,
            redirect_uri: getRedirectUri(),
            code_verifier: storedVerifier,
          }),
        });

        const body: ExchangeResponse | ExchangeError = await resp
          .json()
          .catch(() => ({ error: "invalid_response" }));

        if (!resp.ok || !("access_token" in body)) {
          const errBody = body as ExchangeError;
          setError(
            errBody.message ??
              (errBody.error === "invalid_grant"
                ? "Sign-in code expired or already used. Please try again."
                : `Sign-in failed (${errBody.error ?? resp.status}).`),
          );
          return;
        }

        storeToken(body.access_token, body.expires_in);
        // Replace (not push) so back-button doesn't return the user
        // to /auth/callback with a now-burned code in the URL.
        const dest = storedReturnTo && storedReturnTo.startsWith("/")
          ? storedReturnTo
          : "/";
        // Strip the query string from the URL bar visually before
        // navigating, in case the destination is the same page.
        window.history.replaceState({}, "", dest);
        setLocation(dest);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Could not reach the sign-in server: ${err.message}`
            : "Could not reach the sign-in server.",
        );
      }
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div
          className="mx-auto mb-6 w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base"
          style={{
            background:
              "linear-gradient(135deg, hsl(262 83% 65%), hsl(48 96% 58%))",
            color: "hsl(262 47% 7%)",
          }}
          data-testid="logo-mark"
        >
          Q
        </div>

        {error ? (
          <>
            <h1
              className="text-xl font-semibold tracking-tight"
              data-testid="text-callback-error-title"
            >
              Sign-in didn&apos;t complete
            </h1>
            <p
              className="mt-3 text-sm text-muted-foreground"
              data-testid="text-callback-error-message"
            >
              {error}
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  window.history.replaceState({}, "", "/");
                  setLocation("/");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm hover-elevate"
                data-testid="button-callback-back"
              >
                Back to Qorix Play
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <h1
              className="text-xl font-semibold tracking-tight"
              data-testid="text-callback-title"
            >
              Finishing sign-in…
            </h1>
            <p
              className="mt-3 text-sm text-muted-foreground"
              data-testid="text-callback-subtitle"
            >
              You&apos;ll be on the leaderboard in a second.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
