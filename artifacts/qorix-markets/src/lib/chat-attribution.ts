// Helpers for attributing deposit-page conversions back to a Qorix Assistant
// chat session. The chat embeds `?src=chat&sid=<sessionId>` on the deposit
// CTA href; we capture that on first deposit-page load (storing in
// sessionStorage so refreshes / tab switches survive), POST a deposit_visit
// event, and then POST deposit_completed once a deposit confirms.
//
// All calls are fire-and-forget — chat attribution must NEVER block a
// real deposit flow.

import { authFetch } from "./auth-fetch";

const STORAGE_KEY = "qorix_chat_attribution_sid";
const VISITED_KEY = "qorix_chat_deposit_visited";

export function captureChatAttributionFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src");
    const sid = params.get("sid");
    if (src === "chat" && sid && /^\d+$/.test(sid)) {
      sessionStorage.setItem(STORAGE_KEY, sid);
      // Reset the once-per-visit guard on each fresh URL hit so two CTA
      // clicks in the same tab still log as two visits.
      sessionStorage.removeItem(VISITED_KEY);
      return parseInt(sid, 10);
    }
  } catch {
    // sessionStorage can throw in strict privacy modes — silently skip.
  }
  return getStoredChatSessionId();
}

export function getStoredChatSessionId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && /^\d+$/.test(raw)) return parseInt(raw, 10);
  } catch {
    // ignore
  }
  return null;
}

export function logChatDepositVisit(): void {
  const sid = getStoredChatSessionId();
  if (!sid) return;
  try {
    if (sessionStorage.getItem(VISITED_KEY) === String(sid)) return;
    sessionStorage.setItem(VISITED_KEY, String(sid));
  } catch {
    // ignore
  }
  authFetch("/api/chat/deposit-visit", {
    method: "POST",
    body: JSON.stringify({ sessionId: sid }),
  }).catch(() => {});
}

export function logChatDepositComplete(amount?: string | number | null): void {
  const sid = getStoredChatSessionId();
  if (!sid) return;
  authFetch("/api/chat/deposit-complete", {
    method: "POST",
    body: JSON.stringify({ sessionId: sid, amount: amount ?? null }),
  }).catch(() => {});
  // Don't clear the stored sid — a single chat session can drive multiple
  // deposits over a few days, and we want every one of them attributed.
}
