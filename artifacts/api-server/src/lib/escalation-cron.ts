import {
  db,
  inrDepositsTable,
  inrWithdrawalsTable,
  paymentMethodsTable,
  merchantsTable,
  usersTable,
  adminEscalationContactsTable,
} from "@workspace/db";
import { and, asc, eq, isNull, isNotNull, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { placeEscalationCall, placeEscalationCallAndAwaitOutcome } from "./voice-call-service";
import { sendEmail } from "./email-service";

// Thresholds — kept here as constants so we can dial them in without chasing
// hard-coded magic numbers. Match the user's spec: 10 min → call merchant,
// 15 min → call admin (i.e. 5 min after merchant call).
const MERCHANT_ESCALATION_MIN = 10;
const ADMIN_ESCALATION_MIN = 15;

const ADMIN_PHONE_KEY = "admin_escalation_phone";
const ADMIN_EMAIL_KEY = "admin_escalation_email";

interface AdminContactTarget {
  phone: string;
  email: string | null;
  label: string;
}

// Returns the ordered admin contact chain for the cascade. Prefers the
// `admin_escalation_contacts` table (multiple numbers, priority-ordered).
// Falls back to the legacy single contact in `system_settings` for
// backwards compatibility — that way nothing breaks for installs that
// haven't populated the new table yet.
async function getAdminContacts(): Promise<AdminContactTarget[]> {
  const rows = await db
    .select()
    .from(adminEscalationContactsTable)
    .where(eq(adminEscalationContactsTable.isActive, true))
    .orderBy(asc(adminEscalationContactsTable.priority), asc(adminEscalationContactsTable.id));
  if (rows.length > 0) {
    return rows.map((r, idx) => ({
      phone: r.phone,
      email: r.email,
      label: r.label ? `admin:${r.label}` : `admin#${idx + 1}`,
    }));
  }
  // Legacy single-contact fallback.
  const settings = await db.execute<{ key: string; value: string }>(sql`
    select key, value from system_settings
    where key in (${ADMIN_PHONE_KEY}, ${ADMIN_EMAIL_KEY})
  `);
  let phone: string | null = null;
  let email: string | null = null;
  for (const r of settings.rows ?? []) {
    if (r.key === ADMIN_PHONE_KEY) phone = r.value || null;
    if (r.key === ADMIN_EMAIL_KEY) email = r.value || null;
  }
  if (!email) email = process.env["SES_FROM_EMAIL"] ?? null;
  return phone ? [{ phone, email, label: "admin" }] : [];
}

// Walks the admin contacts in priority order, calling each one and waiting
// to learn whether the call was answered. Stops at the first contact that
// picks up. If no provider is configured (email-fallback path) we cannot
// detect "answered", so the loop will email every contact in turn — that
// matches the user expectation of "make sure SOMEONE gets it".
async function runAdminCascade(message: string): Promise<void> {
  const contacts = await getAdminContacts();
  if (contacts.length === 0) {
    logger.warn("[escalation] admin cascade: no contacts configured, dropping");
    return;
  }
  for (const c of contacts) {
    try {
      const outcome = await placeEscalationCallAndAwaitOutcome(c, message);
      if (outcome.answered) {
        logger.info(
          { label: c.label, finalStatus: outcome.finalStatus },
          "[escalation] admin cascade — answered, stopping",
        );
        return;
      }
      logger.warn(
        { label: c.label, reason: outcome.reason ?? outcome.finalStatus },
        "[escalation] admin cascade — no answer, trying next",
      );
    } catch (err) {
      logger.warn(
        { label: c.label, err: (err as Error).message },
        "[escalation] admin cascade — call threw, trying next",
      );
    }
  }
  logger.error(
    { tried: contacts.length },
    "[escalation] admin cascade — exhausted, no admin picked up",
  );
}

async function notifyMerchantByEmail(
  merchantEmail: string,
  subject: string,
  body: string,
): Promise<void> {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px">
    <h2 style="color:#1f2937;margin:0 0 12px">${escapeHtml(subject)}</h2>
    <p style="color:#374151;font-size:14px;line-height:1.55">${escapeHtml(body)}</p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">Sign in at qorixmarkets.com/merchant to review.</p>
  </div>`;
  try {
    await sendEmail(merchantEmail, subject, body, html);
  } catch (err) {
    logger.warn({ err: (err as Error).message, merchantEmail }, "[escalation] merchant email failed");
  }
}

export async function notifyOwnerMerchantOfNewDeposit(depositId: number): Promise<void> {
  setImmediate(async () => {
    try {
      const rows = await db
        .select({
          deposit: inrDepositsTable,
          merchant: merchantsTable,
        })
        .from(inrDepositsTable)
        .leftJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
        .leftJoin(merchantsTable, eq(merchantsTable.id, paymentMethodsTable.merchantId))
        .where(eq(inrDepositsTable.id, depositId))
        .limit(1);
      const row = rows[0];
      if (!row || !row.merchant || !row.merchant.isActive) return;
      await notifyMerchantByEmail(
        row.merchant.email,
        `New INR deposit pending — ₹${row.deposit.amountInr}`,
        `A user just submitted an INR deposit of ₹${row.deposit.amountInr} (UTR ${row.deposit.utr}) on your payment method. Please review and approve within 10 minutes.`,
      );
    } catch (err) {
      logger.warn({ err: (err as Error).message, depositId }, "[escalation] new-deposit notify failed");
    }
  });
}

export async function notifyAllActiveMerchantsOfNewWithdrawal(
  withdrawalId: number,
): Promise<void> {
  setImmediate(async () => {
    try {
      const wRows = await db
        .select()
        .from(inrWithdrawalsTable)
        .where(eq(inrWithdrawalsTable.id, withdrawalId))
        .limit(1);
      const w = wRows[0];
      if (!w) return;
      const merchants = await db
        .select()
        .from(merchantsTable)
        .where(eq(merchantsTable.isActive, true));
      await Promise.all(
        merchants.map((m) =>
          notifyMerchantByEmail(
            m.email,
            `New INR withdrawal pending — ₹${w.amountInr}`,
            `A user has requested an INR withdrawal of ₹${w.amountInr}. First merchant to claim it from the panel becomes the owner.`,
          ),
        ),
      );
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, withdrawalId },
        "[escalation] new-withdrawal notify failed",
      );
    }
  });
}

// Called every minute by the cron. Each stage uses an atomic
// `UPDATE ... WHERE escalated_*_at IS NULL ... RETURNING id` to *claim*
// the rows it owns BEFORE sending any call/email. Two overlapping ticks
// (or two replicas) can't both claim the same row → no duplicate calls.
// If a downstream notification fails, the claim is preserved on purpose:
// retrying could spam the merchant; we'd rather miss a duplicate than
// over-page someone.
export async function runEscalationTick(): Promise<void> {
  await Promise.all([escalatePendingDeposits(), escalatePendingWithdrawals()]);
}

async function escalatePendingDeposits(): Promise<void> {
  // Stage 1: 10-min mark — atomically claim, then call owning merchant.
  const claimedStage1 = await db
    .update(inrDepositsTable)
    .set({ escalatedToMerchantAt: new Date() })
    .where(
      and(
        eq(inrDepositsTable.status, "pending"),
        isNull(inrDepositsTable.escalatedToMerchantAt),
        sql`${inrDepositsTable.createdAt} < now() - interval '${sql.raw(String(MERCHANT_ESCALATION_MIN))} minutes'`,
      ),
    )
    .returning({ id: inrDepositsTable.id });

  if (claimedStage1.length > 0) {
    const ids = claimedStage1.map((r) => r.id);
    const rows = await db
      .select({
        deposit: inrDepositsTable,
        merchant: merchantsTable,
      })
      .from(inrDepositsTable)
      .leftJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
      .leftJoin(merchantsTable, eq(merchantsTable.id, paymentMethodsTable.merchantId))
      .where(inArray(inrDepositsTable.id, ids));
    for (const row of rows) {
      if (!row.merchant || !row.merchant.isActive) continue;
      await placeEscalationCall(
        {
          phone: row.merchant.phone,
          email: row.merchant.email,
          label: `merchant#${row.merchant.id}`,
        },
        `Qorix Markets alert. INR deposit number ${row.deposit.id} of ${row.deposit.amountInr} rupees has been pending for over ${MERCHANT_ESCALATION_MIN} minutes. Please log in and review.`,
      );
    }
  }

  // Stage 2: 15-min mark — atomically claim, then escalate to admin.
  // SQL invariant: stage-2 can only fire if stage-1 already claimed
  // (escalatedToMerchantAt IS NOT NULL). This makes "merchant first, admin
  // second" a database-enforced rule rather than relying on call order.
  const claimedStage2 = await db
    .update(inrDepositsTable)
    .set({ escalatedToAdminAt: new Date() })
    .where(
      and(
        eq(inrDepositsTable.status, "pending"),
        isNull(inrDepositsTable.escalatedToAdminAt),
        isNotNull(inrDepositsTable.escalatedToMerchantAt),
        sql`${inrDepositsTable.createdAt} < now() - interval '${sql.raw(String(ADMIN_ESCALATION_MIN))} minutes'`,
      ),
    )
    .returning({ id: inrDepositsTable.id, amountInr: inrDepositsTable.amountInr });

  if (claimedStage2.length > 0) {
    // Fire-and-forget the cascade per claimed row so the cron tick stays
    // fast (each cascade can take up to ~270s for 3 contacts × 90s wait).
    for (const dep of claimedStage2) {
      const msg = `Qorix Markets escalation. INR deposit number ${dep.id} of ${dep.amountInr} rupees was not approved by the merchant within ${ADMIN_ESCALATION_MIN} minutes. Please intervene.`;
      setImmediate(() => {
        runAdminCascade(msg).catch((err) =>
          logger.warn({ err: (err as Error).message, depositId: dep.id }, "[escalation] cascade failed"),
        );
      });
    }
  }
}

async function escalatePendingWithdrawals(): Promise<void> {
  // Stage 1 — atomically claim, then call all active merchants (or just the
  // assigned one if a merchant has already grabbed the case).
  const claimedStage1 = await db
    .update(inrWithdrawalsTable)
    .set({ escalatedToMerchantAt: new Date() })
    .where(
      and(
        eq(inrWithdrawalsTable.status, "pending"),
        isNull(inrWithdrawalsTable.escalatedToMerchantAt),
        sql`${inrWithdrawalsTable.createdAt} < now() - interval '${sql.raw(String(MERCHANT_ESCALATION_MIN))} minutes'`,
      ),
    )
    .returning({
      id: inrWithdrawalsTable.id,
      amountInr: inrWithdrawalsTable.amountInr,
      assignedMerchantId: inrWithdrawalsTable.assignedMerchantId,
    });

  if (claimedStage1.length > 0) {
    const merchants = await db
      .select()
      .from(merchantsTable)
      .where(eq(merchantsTable.isActive, true));
    for (const w of claimedStage1) {
      const targets = w.assignedMerchantId
        ? merchants.filter((m) => m.id === w.assignedMerchantId)
        : merchants;
      for (const m of targets) {
        await placeEscalationCall(
          { phone: m.phone, email: m.email, label: `merchant#${m.id}` },
          `Qorix Markets alert. INR withdrawal number ${w.id} of ${w.amountInr} rupees has been pending for over ${MERCHANT_ESCALATION_MIN} minutes. Please log in and review.`,
        );
      }
    }
  }

  // Stage 2 — atomically claim, then escalate to admin. Same SQL invariant
  // as deposits: admin escalation requires prior merchant-stage claim.
  const claimedStage2 = await db
    .update(inrWithdrawalsTable)
    .set({ escalatedToAdminAt: new Date() })
    .where(
      and(
        eq(inrWithdrawalsTable.status, "pending"),
        isNull(inrWithdrawalsTable.escalatedToAdminAt),
        isNotNull(inrWithdrawalsTable.escalatedToMerchantAt),
        sql`${inrWithdrawalsTable.createdAt} < now() - interval '${sql.raw(String(ADMIN_ESCALATION_MIN))} minutes'`,
      ),
    )
    .returning({ id: inrWithdrawalsTable.id, amountInr: inrWithdrawalsTable.amountInr });

  if (claimedStage2.length > 0) {
    for (const w of claimedStage2) {
      const msg = `Qorix Markets escalation. INR withdrawal number ${w.id} of ${w.amountInr} rupees was not actioned by any merchant within ${ADMIN_ESCALATION_MIN} minutes. Please intervene.`;
      setImmediate(() => {
        runAdminCascade(msg).catch((err) =>
          logger.warn({ err: (err as Error).message, withdrawalId: w.id }, "[escalation] cascade failed"),
        );
      });
    }
  }
}

// Suppress the "user param read but never assigned to" lint by genuinely
// using usersTable elsewhere — we keep the import for future per-user
// notifications (e.g. when we add a "your deposit is delayed" email).
void usersTable;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
