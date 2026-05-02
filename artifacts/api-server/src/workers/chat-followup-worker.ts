// Chat lead follow-up worker (Task #145, Batch D).
//
// Scans `chat_leads` rows that:
//   1. have an email captured                           (email IS NOT NULL — schema-required)
//   2. have not yet had a follow-up email sent          (follow_up_sent_at IS NULL)
//   3. have not unsubscribed                            (unsubscribed_at IS NULL)
//   4. were captured at least `delayMinutes` ago        (created_at < now - delay)
//   5. have not yet converted into a real user signup   (converted_at IS NULL)
//
// For each match it sends a single SES email using the configured copy
// (chat_settings.email_followup) — placeholders {{name}} and {{cta_url}}
// are substituted before send. The lead row is then marked with
// follow_up_sent_at = now() so the next tick won't re-send.
//
// All copy is admin-editable via the /admin/chats → AI Settings tab
// (Task #145, Batch C) and applied within ~60s of save (chat-settings-cache
// TTL). The worker calls getChatSettings() so it picks up the latest
// values automatically.

import { db, chatLeadsTable, chatMessagesTable } from "@workspace/db";
import { and, isNull, lt, sql } from "drizzle-orm";
import { logger, errorLogger } from "../lib/logger";
import { getChatSettings } from "../lib/chat-settings-cache";
import { sendEmail } from "../lib/email-service";
import { buildUnsubscribeUrl } from "../lib/chat-unsubscribe-token";

const DEFAULT_DELAY_MINUTES = 60;
const DEFAULT_SUBJECT = "Following up from Qorix Markets";
const DEFAULT_BODY =
  "Hi {{name}},\n\nThanks for chatting with us at Qorix Markets. " +
  "Whenever you're ready, you can pick up where we left off and start with a small position — fully reversible, no commitment.\n\n" +
  "{{cta_url}}\n\n— The Qorix Markets team";

// Per-tick cap — under normal load the worker sees a handful of leads per
// minute; this ceiling protects SES from a runaway burst (a botnet leaving
// 10k fake leads, a misconfigured delay set to 0, etc) and keeps each tick
// bounded.
const MAX_PER_TICK = 50;

// Light-weight {{placeholder}} substitution. Kept tiny on purpose — admins
// only need name + cta_url + (in future) email. Anything fancier would
// duplicate the email-template helper without buying us much.
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
  // The admin types plain text — render it as basic HTML with line breaks
  // and clickable URLs. Escape HTML-meaningful chars first so a user-typed
  // angle bracket can't break out of the wrapping container.
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Linkify bare URLs so {{cta_url}} substitutions render as clickable.
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (m) => `<a href="${m}" style="color:#3b82f6;">${m}</a>`,
  );
  // Compliance footer (Task #145 Batch F). Required by CAN-SPAM / SES
  // best-practice — every unsolicited follow-up must offer a one-click
  // opt-out. The URL is HMAC-signed (lib/chat-unsubscribe-token.ts) so
  // unsubscribe state survives without a token column on chat_leads.
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

// One sweep — exported so the cron module can call us on its own schedule
// (matches the rest of the codebase's pattern: workers expose a tick
// function and `cron.ts` registers the cadence).
export async function chatFollowupTick(): Promise<{ sent: number; skipped: number }> {
  const settings = await getChatSettings();
  const followup = settings.emailFollowup ?? {};

  // Disabled by default: the admin must explicitly opt in via the AI
  // Settings tab. This keeps brand-new deployments from spamming leads
  // before the team has reviewed the copy.
  if (followup.enabled !== true) {
    return { sent: 0, skipped: 0 };
  }

  // SMTP not configured — bail early instead of churning. The startup log
  // (index.ts) already warns the operator about this.
  if (!process.env.SES_FROM_EMAIL || !process.env.SMTP_PASS) {
    return { sent: 0, skipped: 0 };
  }

  const delayMinutes =
    typeof followup.delayMinutes === "number" && followup.delayMinutes > 0
      ? followup.delayMinutes
      : DEFAULT_DELAY_MINUTES;
  const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000);

  // Batch P suppression: skip leads whose visitor came back and chatted
  // AFTER handing over their email. The email-capture flow already
  // recorded their address — if they're still active in the session
  // (e.g. asked a follow-up question, opened a deposit CTA), a nudge
  // email risks duplicating what the bot already said and reads as
  // spam. NOT EXISTS keeps it as a single SQL round-trip; the
  // candidate cohort is already bounded by isNull(followUpSentAt) so
  // the correlated subquery only fires for unprocessed leads. No
  // index on chat_messages.session_id today — at current chat
  // volumes Postgres handles this with a hash anti-join over the
  // small candidate set, so it's fine; revisit if MAX_PER_TICK ever
  // grows or chat traffic spikes 10x.
  const reEngaged = sql`EXISTS (
    SELECT 1 FROM ${chatMessagesTable} cm
    WHERE cm.session_id = ${chatLeadsTable.sessionId}
      AND cm.sender_type = 'user'
      AND cm.created_at > ${chatLeadsTable.createdAt}
  )`;

  // Find candidate leads. Order by oldest-first so a backlog drains FIFO
  // instead of starving the earliest opt-ins.
  const candidates = await db
    .select()
    .from(chatLeadsTable)
    .where(
      and(
        isNull(chatLeadsTable.followUpSentAt),
        isNull(chatLeadsTable.unsubscribedAt),
        isNull(chatLeadsTable.convertedAt),
        lt(chatLeadsTable.createdAt, cutoff),
        sql`NOT ${reEngaged}`,
      ),
    )
    .orderBy(chatLeadsTable.createdAt)
    .limit(MAX_PER_TICK);

  if (candidates.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const subjectTpl = (followup.subject ?? "").trim() || DEFAULT_SUBJECT;
  const bodyTpl = (followup.body ?? "").trim() || DEFAULT_BODY;
  // ctaUrl is optional — if the admin didn't set one, the {{cta_url}}
  // placeholder collapses to an empty string and the body still reads OK.
  const ctaUrl = (followup.ctaUrl ?? "").trim();

  let sent = 0;
  let skipped = 0;

  for (const lead of candidates) {
    try {
      const unsubscribeUrl = buildUnsubscribeUrl(lead.id, lead.createdAt);
      const subject = applyPlaceholders(subjectTpl, { name: lead.name, ctaUrl });
      const renderedBody = applyPlaceholders(bodyTpl, { name: lead.name, ctaUrl });
      // Plain-text body still gets a line about unsubscribing — many
      // mail clients render only the text/plain part on small screens.
      const body =
        renderedBody +
        `\n\n— — —\nYou received this because you chatted with us at Qorix Markets.\n` +
        `Unsubscribe: ${unsubscribeUrl}`;
      const html = bodyToHtml(renderedBody, unsubscribeUrl);

      // Optimistic claim: bump attempts + stamp follow_up_sent_at BEFORE
      // sending so a second worker instance (or a retry of this same tick
      // after a partial failure) doesn't double-send. If the sendEmail
      // call later throws, we leave the row claimed — the operator can
      // inspect attempts via SQL and re-arm manually if needed. Better
      // than silent duplicates landing in the inbox.
      const claimed = await db
        .update(chatLeadsTable)
        .set({
          followUpSentAt: new Date(),
          followUpAttempts: sql`${chatLeadsTable.followUpAttempts} + 1`,
        })
        .where(
          and(
            sql`${chatLeadsTable.id} = ${lead.id}`,
            isNull(chatLeadsTable.followUpSentAt),
          ),
        )
        .returning({ id: chatLeadsTable.id });

      if (claimed.length === 0) {
        // Another worker beat us to it — skip without sending.
        skipped += 1;
        continue;
      }

      await sendEmail(lead.email, subject, body, html);
      sent += 1;
    } catch (err) {
      errorLogger.error(
        { err: (err as Error).message, leadId: lead.id },
        "[chat-followup] failed to send follow-up email",
      );
      // followUpSentAt is already stamped by the optimistic claim above;
      // we don't roll it back because retrying the same address from a
      // failed SMTP attempt risks double delivery (provider may have
      // accepted the message before throwing on the connection close).
      skipped += 1;
    }
  }

  if (sent > 0 || skipped > 0) {
    logger.info({ sent, skipped, candidates: candidates.length }, "[chat-followup] tick complete");
  }
  return { sent, skipped };
}
