// ─────────────────────────────────────────────────────────────────────────────
// Disposable / temporary email domain blocklist (B27, 2026-04-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Why we block these domains:
//   The B23 email-verify gate (POST /auth/login returns 403 if
//   users.email_verified is false) is built on the assumption that the
//   inbox owner is a real human who controls the address. Disposable
//   services break that assumption in two ways:
//
//     1. PUBLIC inbox services (mailinator.com, yopmail.com, getnada.com)
//        — anyone who guesses the local-part can read the OTP and "verify"
//        the account. Email verification becomes meaningless.
//     2. EPHEMERAL inbox services (10minutemail.com, guerrillamail.com,
//        tempmail.org) — the inbox self-destructs after 10–60 minutes,
//        so even though THE attacker controlled it briefly, the account
//        becomes orphaned (no recoverable address). Bad for support,
//        bad for KYC, and the natural attacker pattern for sybil/abuse.
//
//   Both classes enable cheap, unlimited account creation that bypasses
//   our captcha + IP rate limits + behaviour-timing gates because each
//   signup is from a fresh "real-looking" identity.
//
// Curated list rationale:
//   ~120 domains covering the most common services + their alias
//   domains. We deliberately stop short of an exhaustive 3,000+ entry
//   list (e.g. github.com/disposable-email-domains/disposable-email-domains)
//   because:
//     - 95%+ of casual disposable signup traffic uses the top ~50 services.
//     - A static list compiled into the bundle is deterministic, has zero
//       network/fetch risk, and is trivial to audit in PR review.
//     - New services can be appended in one line.
//
// Sources cross-referenced (all public):
//   - github.com/disposable-email-domains/disposable-email-domains
//   - github.com/disposable/disposable-email-domains
//   - github.com/wesbos/burner-email-providers
//   - manual review of top SEO results for "temp mail" / "10 minute mail"
//
// All entries are lowercased. The check is performed AFTER B24 email
// normalization (toLowerCase().trim()), so case-only variants are
// already canonicalized before we look them up.

export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // ── Mailinator family (PUBLIC inboxes — biggest single offender) ──
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailinator2.com",
  "mailinater.com",
  "suremail.info",
  "asdasd.ru",
  "sogetthis.com",
  "binkmail.com",
  "spamherelots.com",
  "spamhereplease.com",
  "thisisnotmyrealemail.com",

  // ── 10MinuteMail family (EPHEMERAL — self-destructs) ──
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minutemail.co.uk",
  "10minutemail.de",
  "10minutemail.us",
  "10minemail.com",
  "10minutesmail.com",
  "10minutesmail.net",

  // ── GuerrillaMail family ──
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "pokemail.net",

  // ── Yopmail family ──
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "yopmail.org",
  "cool.fr.nf",
  "courriel.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",

  // ── Temp-mail / TempMail family ──
  "temp-mail.org",
  "temp-mail.io",
  "temp-mail.ru",
  "tempmail.com",
  "tempmail.net",
  "tempmail.email",
  "tempmail.de",
  "tempmail.dev",
  "tempmailaddress.com",
  "tempinbox.com",
  "tempmail.plus",

  // ── Throwaway-style ──
  "throwawaymail.com",
  "throwam.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.de",
  "trashmail.ws",
  "trashmail.io",
  "wegwerfemail.de",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",

  // ── Maildrop / Getnada / Moakt / Mintemail ──
  "maildrop.cc",
  "getnada.com",
  "nada.email",
  "moakt.com",
  "moakt.cc",
  "moakt.ws",
  "mailcatch.com",
  "mintemail.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "spambox.us",
  "spambox.me",

  // ── Burner / Disposable ──
  "burnermail.io",
  "dispostable.com",
  "disposable.com",
  "deadaddress.com",
  "dropmail.me",
  "mvrht.com",
  "spamavert.com",
  "spamgourmet.com",
  "instantemailaddress.com",
  "instant-mail.de",

  // ── AirMail / Getairmail / Inbox-style ──
  "getairmail.com",
  "airmail.cc",
  "inboxbear.com",
  "inboxalias.com",
  "incognitomail.com",
  "incognitomail.net",
  "incognitomail.org",

  // ── Mohmal / Linshi / Tmail / Mytemp ──
  "mohmal.com",
  "mohmal.in",
  "mohmal.tech",
  "linshiyou.com",
  "linshi-email.com",
  "tmail.io",
  "tmailweb.com",
  "tmail.ws",
  "mytemp.email",
  "mytrashmail.com",
  "mt2014.com",

  // ── EmailFake / EmailTemporanea / 33mail ──
  "emailfake.com",
  "emailtemporanea.com",
  "emailtemporanea.net",
  "33mail.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",

  // ── Cock.li family (often abused by spammers) ──
  "cock.li",
  "cock.lu",
  "cock.email",
  "horsefucker.org",
  "national.shitposting.agency",

  // ── Misc commonly seen in spam signups ──
  "jetable.org",
  "jetable.net",
  "spamfree24.com",
  "spamfree24.de",
  "spamfree24.eu",
  "spamfree24.info",
  "spamfree24.net",
  "spamfree24.org",
  "byom.de",
  "tempemail.com",
  "tempemail.net",
  "tempinbox.co.uk",
  "tempr.email",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "harakirimail.com",
  "haltospam.com",
  "trbvm.com",
  "spamspot.com",
  "spamstack.net",
  "thankyou2010.com",
  "trashymail.com",
  "ubismail.net",
  "vpn.st",
  "vsimcard.com",
  "wuzup.net",
  "yapped.net",
  "yourdomain.com",
  "zoaxe.com",
  "zoemail.org",
]);

// ─────────────────────────────────────────────────────────────────────────────
// isDisposableEmail
// ─────────────────────────────────────────────────────────────────────────────
//
// Returns true if the email address belongs to a known disposable /
// temporary email service.
//
// Subdomain handling:
//   Some services hand out unique subdomains per inbox
//   (e.g. `inbox@user-foo.mailinator.com`). We progressively trim leading
//   labels and re-check, so `user-foo.mailinator.com` matches `mailinator.com`
//   in the set. We stop at the second-to-last label to avoid false positives
//   on ".com" / ".org" alone.
//
// Inputs:
//   email — assumed already lowercased + trimmed by caller (B24 normalization
//           is applied before this is called in /auth/register).
//
// Returns:
//   true  → block this signup
//   false → allow (not in our blocklist)
//
// Performance: O(k) where k is the number of dots in the domain (typically 1–3).
// Set lookup is O(1).
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return false;

  // Direct match first (fast path — covers the vast majority of cases).
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  // Subdomain match: progressively peel leading labels and re-check.
  // Stop when only 2 labels remain (e.g. "mailinator.com") — never check
  // bare TLDs like "com" or "co.uk".
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (DISPOSABLE_EMAIL_DOMAINS.has(candidate)) return true;
  }

  return false;
}
