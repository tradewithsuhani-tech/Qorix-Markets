// "Sign in with Qorix Markets" entry point.
//
// Called from the landing page button. Generates a fresh PKCE verifier
// + state, stashes them in sessionStorage so the callback page can pair
// them with the returned code, and full-page-redirects the browser to
// the Markets authorize endpoint. Returns void — caller doesn't need to
// await; the navigation kicks in synchronously after the redirect.

import {
  generateCodeChallengeS256,
  generateCodeVerifier,
  generateState,
} from "./pkce";
import {
  CLIENT_ID,
  MARKETS_URL,
  getRedirectUri,
} from "./oauth-config";

// sessionStorage keys — chosen to be obviously namespaced and hard to
// collide with anything Markets writes (different origin anyway, but
// this matters if we ever bring them under the same domain).
export const PKCE_VERIFIER_KEY = "qorixplay_pkce_verifier";
export const PKCE_STATE_KEY = "qorixplay_pkce_state";
export const PKCE_RETURN_TO_KEY = "qorixplay_pkce_return_to";

export type StartLoginOptions = {
  /**
   * Optional path inside the SPA to land on after a successful exchange.
   * Defaults to "/" — the landing page itself.
   */
  returnTo?: string;
};

export async function startLogin(opts: StartLoginOptions = {}): Promise<void> {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await generateCodeChallengeS256(verifier);

  // Stash the verifier + state BEFORE we navigate. If sessionStorage
  // throws (private mode, full quota) we abort the redirect — without
  // these values the callback page literally cannot exchange the code,
  // so silently navigating would leave the user staring at a broken
  // /auth/callback page after the round-trip.
  try {
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(PKCE_STATE_KEY, state);
    if (opts.returnTo) {
      sessionStorage.setItem(PKCE_RETURN_TO_KEY, opts.returnTo);
    } else {
      // Always clear the previous returnTo (if any) so a stale value
      // from a prior login attempt doesn't redirect us to the wrong
      // page after this one succeeds.
      sessionStorage.removeItem(PKCE_RETURN_TO_KEY);
    }
  } catch (err) {
    throw new Error(
      "Could not start sign-in: this browser blocks session storage. " +
        "Disable private/incognito mode and try again.",
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: "profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  // window.location.assign (not .href) makes the navigation behave
  // identically to a real link click — including pushing a history
  // entry — so the user can press the back button on the Markets login
  // page to return to qorixplay if they change their mind.
  window.location.assign(`${MARKETS_URL}/oauth/quiz/authorize?${params}`);
}
