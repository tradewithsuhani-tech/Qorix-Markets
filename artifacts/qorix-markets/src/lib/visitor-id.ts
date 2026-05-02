// Stable per-browser anonymous identifier for the chat widget's guest mode.
//
// Used as the `x-visitor-id` header on every /api/chat/guest-* call so the
// API server can scope sessions / messages / leads to a single visitor
// without requiring auth. The same value lives in localStorage across page
// reloads / new tabs so the visitor's chat history follows them around the
// landing pages until they sign up.
//
// On sign-in the client posts this value to /api/chat/guest-session/claim
// which migrates the most-recent guest session to the new userId — the
// visitor doesn't lose their chat history at the auth boundary.
//
// The format constraint (16–64 chars, [A-Za-z0-9_-]) matches the regex the
// API server validates against in routes/chat.ts → VISITOR_ID_RE. Any junk
// stored from a previous version of this file is rejected and a fresh ID
// is minted.

const STORAGE_KEY = "qorix_visitor_id";
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

let memoryFallback: string | null = null;

function generateVisitorId(): string {
  // Prefer the standard crypto.randomUUID() (available everywhere we ship —
  // it lands in Safari 15.4+, Chrome 92+, Firefox 95+). Strip the dashes so
  // we end up with a clean 32-char alnum token that satisfies the API regex
  // with room to spare.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback: 32 random alnum chars from getRandomValues.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
  // Last-ditch fallback for ancient browsers — Math.random is fine here
  // because this is purely a session-scoping key, not a security token.
  let s = "";
  while (s.length < 32) s += Math.random().toString(36).slice(2);
  return s.slice(0, 32);
}

export function getOrCreateVisitorId(): string {
  // Memory cache first so we don't re-read localStorage on every chat tick.
  if (memoryFallback && VISITOR_ID_RE.test(memoryFallback)) return memoryFallback;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && VISITOR_ID_RE.test(existing)) {
      memoryFallback = existing;
      return existing;
    }
  } catch {
    // localStorage may throw in privacy-mode Safari — fall through and
    // generate a memory-only ID. The session is still scoped correctly for
    // the lifetime of the tab; it just won't survive a reload.
  }
  const fresh = generateVisitorId();
  try {
    localStorage.setItem(STORAGE_KEY, fresh);
  } catch {
    // ignore — memory fallback is sufficient
  }
  memoryFallback = fresh;
  return fresh;
}
