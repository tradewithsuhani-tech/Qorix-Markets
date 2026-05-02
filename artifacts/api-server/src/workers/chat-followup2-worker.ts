// Chat lead second-nudge worker (Task #145, Batch L).
//
// Scans `chat_leads` rows that already received the first auto follow-up
// (Batch D / chat-followup-worker.ts) but still haven't converted or
// unsubscribed N hours later, and sends ONE additional nudge with
// optionally different copy. Hard-stops at 2 total attempts so we never
// spiral into a perpetual drip campaign — anything beyond a second
// attempt should be a manual human touch (Batch G/J flows).
//
// Filter (must all hold for a row to be picked up):
//   1. follow_up_sent_at IS NOT NULL                  — first nudge already went out
//   2. follow_up_sent_at < now() - delayHours         — enough time has elapsed
//   3. follow_up_attempts < 2                          — haven't already sent the 2nd
//   4. unsubscribed_at IS NULL                         — they're still on the list
//   5. converted_at IS NULL                            — they haven't already converted
//
// "No reply" is approximated by (4) + (5): if they'd genuinely engaged
// they'd have either converted (deposit) or unsubscribed. chat_leads
// doesn't carry a per-lead "last reply" timestamp; if we ever need a
// stricter signal we can JOIN to chat_sessions.last_message_at, but the
// current heuristic is good enough and keeps the worker simple.
//
// Atomic claim: follow_up_attempts is bumped from 1 → 2 inside the same
// UPDATE that picks the row, with attempts=1 in the WHERE clause so two
// concurrent worker instances can't both claim the same lead. We also
// re-stamp follow_up_sent_at to now() — the column's effective semantic
// is "last nudge sent at", which both workers respect (the first-nudge
// worker filters on attempts=0 / sent IS NULL, so a re-stamped row
// can't fall back into its queue).

import { db, chatLeadsTable } from "@workspace/db";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { logger, errorLogger } from "../lib/logger";
import { getChatSettings } from "../lib/chat-settings-cache";
import { sendEmail } from "../lib/email-service";
import { buildUnsubscribeUrl } from "../lib/chat-unsubscribe-token";

const DEFAULT_DELAY_HOURS = 72;
const DEFAULT_SUBJECT = "Still here when you're ready — Qorix Markets";
const DEFAULT_BODY =
  "Hi {{name}},\n\nQuick check-in — we sent you a note a few days ago and wanted to make sure it didn't get lost. " +
  "If you have any questions about getting started or how the trading approach works, just reply to this email — happy to help.\n\n" +
  "When you're ready: {{cta_url}}\n\n— The Qorix Markets team";

// Same per-tick cap as the first worker. The 2nd-nudge cohort is
// strictly a subset of the 1st-nudge cohort so this is more than enough
// headroom; we keep the same number for operational consistency (one
// number to reason about across both workers).
const MAX_PER_TICK = 50;

function applyPlaceholders(
  template: string,
  vars: { name?: string | null; ctaUrl?: string },
): string {
  const safeName = (vars.name ?? "").trim() || "there";
  const safeCta = (vars.ctaUrl ?? "").trim();
  return template
    .replace(/\{\{\s*name\s*\}\}/g, safeName)
    .replace(/\{\{\s*cta_url\s*\}\}/g, safeCta);
}

function bodyToHtml(body: string, unsubscribeUrl: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (m) => `<a href="${m}" style="color:#3b82f6;">${m}</a>`,
  );
  // CAN-SPAM compliance footer — every unsolicited follow-up MUST
  // carry a one-click unsubscribe. The URL is HMAC-signed
  // (lib/chat-unsubscribe-token.ts) so opt-out state survives without
  // a token column on chat_leads.
  const footer =
    `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;font-family:system-ui,-apple-system,sans-serif;color:#64748b;font-size:12px;line-height:1.5;">` +
    `You're receiving this because you chatted with us at Qorix Markets and asked to be reminded.` +
    ` <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>` +
    ` from these reminders any time.` +
    `</div>`;
  return (
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6;font-size:15px;">` +
    linkified.replace(/\n/g, "<br/>") +
    footer +
    `</div>`
  );
}

export async function chatFollowup2Tick(): Promise<{ sent: number; skipped: number }> {
  const settings = await getChatSettings();
  const followup = settings.emailFollowup ?? {};
  const followup2 = followup.followup2 ?? {};

  // Must be explicitly enabled by an admin via the AI Settings tab.
  // Defaulting OFF means upgrading the API (which ships this worker)
  // never accidentally starts a second drip on existing customers'
  // leads — the operator has to consciously turn it on per
  // deployment.
  if (followup2.enabled !== true) {
    return { sent: 0, skipped: 0 };
  }

  // SMTP not configured — same reasoning as the first worker. The
  // startup log already warns about the missing creds.
  if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
    return { sent: 0, skipped: 0 };
  }

  const delayHours =
    typeof followup2.delayHours === "number" && followup2.delayHours > 0
      ? followup2.delayHours
      : DEFAULT_DELAY_HOURS;
  const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);

  // Candidate selection. Order by oldest follow_up_sent_at first so a
  // backlog drains FIFO — the lead who's been waiting longest gets
  // their second nudge first. lt(attempts, 2) is the hard cap; once a
  // row is bumped to 2 it permanently exits this worker's queue.
  const candidates = await db
    .select()
    .from(chatLeadsTable)
    .where(
      and(
        isNotNull(chatLeadsTable.followUpSentAt),
        lt(chatLeadsTable.followUpSentAt, cutoff),
        lt(chatLeadsTable.followUpAttempts, 2),
        isNull(chatLeadsTable.unsubscribedAt),
        isNull(chatLeadsTable.convertedAt),
      ),
    )
    .orderBy(chatLeadsTable.followUpSentAt)
    .limit(MAX_PER_TICK);

  if (candidates.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const subjectTpl = (followup2.subject ?? "").trim() || DEFAULT_SUBJECT;
  const bodyTpl = (followup2.body ?? "").trim() || DEFAULT_BODY;
  // CTA URL is reused from the parent followup config — operators
  // overwhelmingly want one canonical "start here" link for both
  // nudges. If product later wants a separate CTA per nudge, add a
  // ctaUrl field to EmailFollowup2Config and prefer it here.
  const ctaUrl = (followup.ctaUrl ?? "").trim();

  let sent = 0;
  let skipped = 0;

  for (const lead of candidates) {
    try {
      const unsubscribeUrl = buildUnsubscribeUrl(lead.id, lead.createdAt);
      const subject = applyPlaceholders(subjectTpl, { name: lead.name, ctaUrl });
      const renderedBody = applyPlaceholders(bodyTpl, { name: lead.name, ctaUrl });
      const body =
        renderedBody +
        `\n\n— — —\nYou received this because you chatted with us at Qorix Markets.\n` +
        `Unsubscribe: ${unsubscribeUrl}`;
      const html = bodyToHtml(renderedBody, unsubscribeUrl);

      // Optimistic claim. WHERE attempts = 1 is the linchpin — it
      // prevents a second worker instance (or a re-tick after a
      // partial failure) from double-claiming the same row even
      // though we read attempts<2 in the candidate query. The bump
      // to 2 is what permanently exits the queue.
      const claimed = await db
        .update(chatLeadsTable)
        .set({
          followUpAttempts: sql`${chatLeadsTable.followUpAttempts} + 1`,
          followUpSentAt: new Date(),
        })
        .where(
          and(
            eq(chatLeadsTable.id, lead.id),
            eq(chatLeadsTable.followUpAttempts, 1),
            isNotNull(chatLeadsTable.followUpSentAt),
            isNull(chatLeadsTable.unsubscribedAt),
            isNull(chatLeadsTable.convertedAt),
          ),
        )
        .returning({ id: chatLeadsTable.id });

      if (claimed.length === 0) {
        // Either another worker beat us to it, or the lead's state
        // changed between SELECT and UPDATE (converted /
        // unsubscribed in the same minute) — either way, skip
        // without sending.
        skipped += 1;
        continue;
      }

      await sendEmail(lead.email, subject, body, html);
      sent += 1;
    } catch (err) {
      errorLogger.error(
        { err: (err as Error).message, leadId: lead.id },
        "[chat-followup2] failed to send second-nudge email",
      );
      // Same reasoning as the first worker: claim already stamped,
      // we don't roll back because SES may have accepted before
      // throwing. Better one over-counted attempt than a duplicate
      // delivery.
      skipped += 1;
    }
  }

  if (sent > 0 || skipped > 0) {
    logger.info(
      { sent, skipped, candidates: candidates.length },
      "[chat-followup2] tick complete",
    );
  }
  return { sent, skipped };
}
