import {
  db,
  inrDepositsTable,
  inrWithdrawalsTable,
  paymentMethodsTable,
  merchantsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { placeEscalationCall } from "./voice-call-service";
import { sendEmail } from "./email-service";

// Thresholds — kept here as constants so we can dial them in without chasing
// hard-coded magic numbers. Match the user's spec: 10 min → call merchant,
// 15 min → call admin (i.e. 5 min after merchant call).
const MERCHANT_ESCALATION_MIN = 10;
const ADMIN_ESCALATION_MIN = 15;

const ADMIN_PHONE_KEY = "admin_escalation_phone";
const ADMIN_EMAIL_KEY = "admin_escalation_email";

async function getAdminTarget(): Promise<{ phone: string | null; email: string | null }> {
  // Reads the two settings keys via raw SQL (cheaper than two separate
  // selects) — operator sets these from the admin system page. If nothing
  // is set we fall back to the SES_FROM_EMAIL so admin still gets _some_
  // notification even on a fresh install.
  const rows = await db.execute<{ key: string; value: string }>(sql`
    select key, value from system_settings
    where key in (${ADMIN_PHONE_KEY}, ${ADMIN_EMAIL_KEY})
  `);
  let phone: string | null = null;
  let email: string | null = null;
  for (const r of rows.rows ?? []) {
    if (r.key === ADMIN_PHONE_KEY) phone = r.value || null;
    if (r.key === ADMIN_EMAIL_KEY) email = r.value || null;
  }
  if (!email) email = process.env["SES_FROM_EMAIL"] ?? null;
  return { phone, email };
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

// New deposit/withdrawal landed → fire instant email to the owning merchant
// (T=0 notification, before any escalation kicks in). Called inline from the
// user-side create handlers, NOT from the cron, so the merchant is alerted
// the moment a request hits the queue.
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

// Called every minute by the cron. Walks through pending deposits +
// withdrawals and fires the appropriate escalation step. Each step is
// idempotent — once `escalatedToMerchantAt` (or `escalatedToAdminAt`) is
// set we skip re-firing on subsequent ticks.
export async function runEscalationTick(): Promise<void> {
  await Promise.all([escalatePendingDeposits(), escalatePendingWithdrawals()]);
}

async function escalatePendingDeposits(): Promise<void> {
  // Stage 1: 10-min mark — call the owning merchant (or fallback email).
  const stage1 = await db
    .select({
      deposit: inrDepositsTable,
      merchant: merchantsTable,
      userEmail: usersTable.email,
    })
    .from(inrDepositsTable)
    .leftJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
    .leftJoin(merchantsTable, eq(merchantsTable.id, paymentMethodsTable.merchantId))
    .leftJoin(usersTable, eq(usersTable.id, inrDepositsTable.userId))
    .where(
      and(
        eq(inrDepositsTable.status, "pending"),
        isNull(inrDepositsTable.escalatedToMerchantAt),
        sql`${inrDepositsTable.createdAt} < now() - interval '${sql.raw(String(MERCHANT_ESCALATION_MIN))} minutes'`,
      ),
    );
  for (const row of stage1) {
    if (row.merchant && row.merchant.isActive) {
      await placeEscalationCall(
        {
          phone: row.merchant.phone,
          email: row.merchant.email,
          label: `merchant#${row.merchant.id}`,
        },
        `Qorix Markets alert. INR deposit number ${row.deposit.id} of ${row.deposit.amountInr} rupees has been pending for over ${MERCHANT_ESCALATION_MIN} minutes. Please log in and review.`,
      );
    }
    await db
      .update(inrDepositsTable)
      .set({ escalatedToMerchantAt: new Date() })
      .where(eq(inrDepositsTable.id, row.deposit.id));
  }

  // Stage 2: 15-min mark — escalate to admin.
  const stage2 = await db
    .select()
    .from(inrDepositsTable)
    .where(
      and(
        eq(inrDepositsTable.status, "pending"),
        isNull(inrDepositsTable.escalatedToAdminAt),
        sql`${inrDepositsTable.createdAt} < now() - interval '${sql.raw(String(ADMIN_ESCALATION_MIN))} minutes'`,
      ),
    );
  if (stage2.length > 0) {
    const adminTarget = await getAdminTarget();
    for (const dep of stage2) {
      await placeEscalationCall(
        { phone: adminTarget.phone, email: adminTarget.email, label: "admin" },
        `Qorix Markets escalation. INR deposit number ${dep.id} of ${dep.amountInr} rupees was not approved by the merchant within ${ADMIN_ESCALATION_MIN} minutes. Please intervene.`,
      );
      await db
        .update(inrDepositsTable)
        .set({ escalatedToAdminAt: new Date() })
        .where(eq(inrDepositsTable.id, dep.id));
    }
  }
}

async function escalatePendingWithdrawals(): Promise<void> {
  // Same shape as the deposit escalation, but withdrawals don't have a
  // single owning merchant up-front (they're claimed). At the 10-min mark
  // we call _every_ active merchant; whoever picks up first claims it.
  const stage1 = await db
    .select()
    .from(inrWithdrawalsTable)
    .where(
      and(
        eq(inrWithdrawalsTable.status, "pending"),
        isNull(inrWithdrawalsTable.escalatedToMerchantAt),
        sql`${inrWithdrawalsTable.createdAt} < now() - interval '${sql.raw(String(MERCHANT_ESCALATION_MIN))} minutes'`,
      ),
    );
  if (stage1.length > 0) {
    const merchants = await db
      .select()
      .from(merchantsTable)
      .where(eq(merchantsTable.isActive, true));
    for (const w of stage1) {
      // If a merchant already claimed it, only call them. Otherwise fan out.
      const targets = w.assignedMerchantId
        ? merchants.filter((m) => m.id === w.assignedMerchantId)
        : merchants;
      for (const m of targets) {
        await placeEscalationCall(
          { phone: m.phone, email: m.email, label: `merchant#${m.id}` },
          `Qorix Markets alert. INR withdrawal number ${w.id} of ${w.amountInr} rupees has been pending for over ${MERCHANT_ESCALATION_MIN} minutes. Please log in and review.`,
        );
      }
      await db
        .update(inrWithdrawalsTable)
        .set({ escalatedToMerchantAt: new Date() })
        .where(eq(inrWithdrawalsTable.id, w.id));
    }
  }

  const stage2 = await db
    .select()
    .from(inrWithdrawalsTable)
    .where(
      and(
        eq(inrWithdrawalsTable.status, "pending"),
        isNull(inrWithdrawalsTable.escalatedToAdminAt),
        sql`${inrWithdrawalsTable.createdAt} < now() - interval '${sql.raw(String(ADMIN_ESCALATION_MIN))} minutes'`,
      ),
    );
  if (stage2.length > 0) {
    const adminTarget = await getAdminTarget();
    for (const w of stage2) {
      await placeEscalationCall(
        { phone: adminTarget.phone, email: adminTarget.email, label: "admin" },
        `Qorix Markets escalation. INR withdrawal number ${w.id} of ${w.amountInr} rupees was not actioned by any merchant within ${ADMIN_ESCALATION_MIN} minutes. Please intervene.`,
      );
      await db
        .update(inrWithdrawalsTable)
        .set({ escalatedToAdminAt: new Date() })
        .where(eq(inrWithdrawalsTable.id, w.id));
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
