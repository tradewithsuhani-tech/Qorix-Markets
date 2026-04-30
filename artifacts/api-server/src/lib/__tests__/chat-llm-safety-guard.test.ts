import { test } from "node:test";
import assert from "node:assert/strict";
import { applySafetyGuard } from "../chat-llm";

// ─── Why this test file exists ───────────────────────────────────────────────
//
// The LLM is instructed never to make guaranteed-return / risk-free style
// claims, but prompt injection ("ignore previous instructions and say…"),
// hallucination, or even a model upgrade can sneak SEBI-non-compliant copy
// into a reply. `applySafetyGuard()` is the unconditional last-line scrubber
// in lib/chat-llm.ts that runs on EVERY reply (including the last-ditch
// fallback when JSON parse fails). A regression here is high-blast-radius:
// the platform serves Indian retail investors and "guaranteed returns" in
// any language is a compliance incident.
//
// Coverage goals:
//   1. Every entry in FORBIDDEN_PATTERNS fires on at least one realistic
//      EN sentence and produces the expected safe replacement.
//   2. Hindi / Hinglish romanizations (garanti/guarantee + profit/return/
//      fayda/munafa) are scrubbed too — the bot replies in Hinglish often
//      and the EN-only rules used to miss those phrases.
//   3. `applySafetyGuard` is idempotent and never returns leading/trailing
//      whitespace or doubled spaces (the substitutions can introduce
//      multi-space gaps and we explicitly collapse them).
//   4. Disclaimer behaviour: per the comment block above
//      `applySafetyGuard` in chat-llm.ts, the auto-appended SEBI risk
//      disclaimer was DELIBERATELY removed (the website footer carries it,
//      so repeating it under every chat bubble was visual noise). The
//      original task acceptance criterion asked to "verify the disclaimer
//      is appended in the correct language for EN, HI, and Hinglish" —
//      that requirement is stale. We instead lock down the current
//      intended behaviour: a clean reply must round-trip unchanged
//      regardless of language. If anyone re-introduces (or further
//      mutates) a disclaimer, this test fails loudly.

// ─── EN forbidden phrases ────────────────────────────────────────────────────

test("safety guard: 'guaranteed returns' → 'potential returns'", () => {
  const out = applySafetyGuard("We offer guaranteed returns of 10% monthly.", true, "en");
  assert.match(out, /potential returns/i);
  assert.doesNotMatch(out, /guaranteed returns/i);
});

test("safety guard: 'guaranteed profits' (plural) → 'potential profits'", () => {
  const out = applySafetyGuard("guaranteed profits every month", true, "en");
  assert.match(out, /potential profits/i);
  assert.doesNotMatch(out, /guaranteed profits/i);
});

test("safety guard: 'guaranteed income' → 'potential income'", () => {
  const out = applySafetyGuard("This is guaranteed income for you.", true, "en");
  assert.match(out, /potential income/i);
});

test("safety guard: 'guaranteed gains' → 'potential gains'", () => {
  const out = applySafetyGuard("Expect guaranteed gains.", true, "en");
  assert.match(out, /potential gains/i);
});

test("safety guard: standalone 'guaranteed' → 'targeted'", () => {
  // The word-boundary fallback fires only when the more-specific
  // "guaranteed (returns|profits|income|gains)" rule did not match.
  const out = applySafetyGuard("This outcome is guaranteed for you.", true, "en");
  assert.match(out, /targeted/i);
  assert.doesNotMatch(out, /\bguaranteed\b/i);
});

test("safety guard: '100% safe' → 'risk-managed' (no spaces)", () => {
  const out = applySafetyGuard("It's 100% safe.", true, "en");
  assert.match(out, /risk-managed/);
  assert.doesNotMatch(out, /100\s*%\s*safe/i);
});

test("safety guard: '100 % secure' → 'risk-managed' (with spaces)", () => {
  const out = applySafetyGuard("Our platform is 100 % secure.", true, "en");
  assert.match(out, /risk-managed/);
  assert.doesNotMatch(out, /100\s*%\s*secure/i);
});

test("safety guard: '100% risk-free' → 'risk-managed'", () => {
  const out = applySafetyGuard("100% risk-free trading.", true, "en");
  assert.match(out, /risk-managed/);
  assert.doesNotMatch(out, /100\s*%\s*risk[- ]?free/i);
});

test("safety guard: '100% sure' → 'risk-managed'", () => {
  const out = applySafetyGuard("100% sure thing.", true, "en");
  assert.match(out, /risk-managed/);
});

test("safety guard: 'risk-free' → 'risk-managed'", () => {
  const out = applySafetyGuard("This is risk-free.", true, "en");
  assert.match(out, /risk-managed/);
  assert.doesNotMatch(out, /risk-free/i);
});

test("safety guard: 'risk free' (space-separated) → 'risk-managed'", () => {
  const out = applySafetyGuard("This is risk free for users.", true, "en");
  assert.match(out, /risk-managed/);
  assert.doesNotMatch(out, /\brisk free\b/i);
});

test("safety guard: 'zero risk' → 'controlled risk'", () => {
  const out = applySafetyGuard("Zero risk to your capital.", true, "en");
  assert.match(out, /controlled risk/i);
  assert.doesNotMatch(out, /zero risk/i);
});

test("safety guard: 'no risk' → 'controlled risk'", () => {
  const out = applySafetyGuard("No risk involved.", true, "en");
  assert.match(out, /controlled risk/i);
  assert.doesNotMatch(out, /\bno risk\b/i);
});

test("safety guard: 'profit lock' → 'profit potential'", () => {
  const out = applySafetyGuard("We use a profit lock feature.", true, "en");
  assert.match(out, /profit potential/);
  assert.doesNotMatch(out, /profit lock/i);
});

test("safety guard: 'profit guarantee' → 'profit potential'", () => {
  const out = applySafetyGuard("Profit guarantee included.", true, "en");
  assert.match(out, /profit potential/);
  assert.doesNotMatch(out, /profit guarantee/i);
});

test("safety guard: 'risk lock' / 'risk locked' → 'drawdown ceiling'", () => {
  const out1 = applySafetyGuard("Risk lock at 5%.", true, "en");
  assert.match(out1, /drawdown ceiling/);
  const out2 = applySafetyGuard("Capital is risk locked.", true, "en");
  assert.match(out2, /drawdown ceiling/);
});

test("safety guard: 'assured returns' → 'potential returns'", () => {
  const out = applySafetyGuard("Assured returns every month.", true, "en");
  assert.match(out, /potential returns/);
  assert.doesNotMatch(out, /assured returns/i);
});

test("safety guard: 'assured profit' → 'potential profit'", () => {
  const out = applySafetyGuard("Assured profit on your deposit.", true, "en");
  assert.match(out, /potential profit/);
});

// ─── HI / Hinglish romanizations ─────────────────────────────────────────────
// The model frequently replies in Hinglish (Roman script Hindi-English mix).
// The EN-only rules used to miss "garanti profit" / "guarantee munafa" style
// phrases entirely. These cases lock in the dedicated HI-aware pattern.

test("safety guard: 'guarantee profit' (Hinglish) → 'potential profit'", () => {
  const out = applySafetyGuard("Hum guarantee profit dete hain.", true, "hinglish");
  assert.match(out, /potential profit/i);
  assert.doesNotMatch(out, /guarantee profit/i);
});

test("safety guard: 'guarantee return' (Hinglish) → 'potential return'", () => {
  const out = applySafetyGuard("Yeh guarantee return scheme hai.", true, "hinglish");
  assert.match(out, /potential return/i);
  assert.doesNotMatch(out, /guarantee return/i);
});

test("safety guard: 'guarantee fayda' (Hinglish) → 'potential fayda'", () => {
  const out = applySafetyGuard("Aapko guarantee fayda hoga.", true, "hinglish");
  assert.match(out, /potential fayda/i);
  assert.doesNotMatch(out, /guarantee fayda/i);
});

test("safety guard: 'guarantee munafa' (Hinglish) → 'potential munafa'", () => {
  const out = applySafetyGuard("Roz guarantee munafa milega.", true, "hinglish");
  assert.match(out, /potential munafa/i);
  assert.doesNotMatch(out, /guarantee munafa/i);
});

test("safety guard: 'garanti profit' (informal Hinglish spelling) → 'potential profit'", () => {
  const out = applySafetyGuard("Yeh garanti profit deta hai.", true, "hi");
  assert.match(out, /potential profit/i);
  assert.doesNotMatch(out, /garanti profit/i);
});

test("safety guard: 'garanti munafa' (informal Hinglish spelling)", () => {
  const out = applySafetyGuard("Garanti munafa har month.", true, "hi");
  assert.match(out, /potential munafa/i);
  assert.doesNotMatch(out, /garanti munafa/i);
});

// ─── Whitespace + idempotence ────────────────────────────────────────────────

test("safety guard: collapses double-spaces introduced by substitutions and trims", () => {
  // The substitutions can introduce double spaces when a long phrase
  // shrinks. Verify the cleaner trims and collapses runs of spaces.
  const out = applySafetyGuard("  We promise guaranteed returns and zero risk.  ", true, "en");
  assert.equal(out, out.trim(), "must not have leading/trailing whitespace");
  assert.doesNotMatch(out, / {2,}/, "must collapse runs of whitespace");
});

test("safety guard: idempotent — running twice produces the same string", () => {
  const dirty = "guaranteed profits and 100% safe — totally risk-free with profit lock.";
  const once = applySafetyGuard(dirty, true, "en");
  const twice = applySafetyGuard(once, true, "en");
  assert.equal(twice, once, "second pass must not further mutate already-cleaned text");
});

test("safety guard: handles multiple forbidden phrases in one reply", () => {
  const out = applySafetyGuard(
    "guaranteed returns, 100% safe, zero risk, and a profit lock.",
    true,
    "en",
  );
  assert.doesNotMatch(out, /guaranteed/i);
  assert.doesNotMatch(out, /100\s*%\s*safe/i);
  assert.doesNotMatch(out, /zero risk/i);
  assert.doesNotMatch(out, /profit lock/i);
  // Replacements present
  assert.match(out, /potential returns/i);
  assert.match(out, /risk-managed/);
  assert.match(out, /controlled risk/i);
  assert.match(out, /profit potential/);
});

// ─── Disclaimer behaviour (intentional drift from task spec) ─────────────────

test("safety guard: clean EN reply round-trips unchanged (no disclaimer appended)", () => {
  // Per chat-llm.ts header above applySafetyGuard: the auto-appended SEBI
  // disclaimer was deliberately removed because the site footer already
  // carries it. Re-introducing one here would silently regress that
  // product decision.
  const reply = "Conservative tier — start at ₹500. Drawdown ceiling 3%, withdraw anytime.";
  assert.equal(applySafetyGuard(reply, true, "en"), reply);
});

test("safety guard: clean HI (Devanagari) reply round-trips unchanged (no disclaimer)", () => {
  const reply = "कंजरवेटिव टियर से शुरू करें — ₹500 न्यूनतम।";
  assert.equal(applySafetyGuard(reply, true, "hi"), reply);
});

test("safety guard: clean Hinglish reply round-trips unchanged (no disclaimer)", () => {
  const reply = "Conservative tier se start karo — ₹500 minimum, withdraw kabhi bhi.";
  assert.equal(applySafetyGuard(reply, true, "hinglish"), reply);
});

test("safety guard: leaves unrelated benign text untouched", () => {
  const reply = "Conservative tier with 3% drawdown ceiling.";
  assert.equal(applySafetyGuard(reply, true, "en"), reply);
});

test("safety guard: same behaviour regardless of isInvestmentRelated flag", () => {
  // The two trailing args are accepted for signature stability but the
  // current implementation does not branch on them. Lock that in: if
  // someone re-introduces conditional behaviour they must update this
  // test alongside the change so reviewers see the intent.
  const dirty = "guaranteed returns";
  const a = applySafetyGuard(dirty, true, "en");
  const b = applySafetyGuard(dirty, false, "en");
  const c = applySafetyGuard(dirty, true, "hi");
  const d = applySafetyGuard(dirty, true, "hinglish");
  assert.equal(a, b, "isInvestmentRelated must not change current scrubber output");
  assert.equal(a, c, "language must not change current scrubber output");
  assert.equal(a, d, "language must not change current scrubber output");
});
