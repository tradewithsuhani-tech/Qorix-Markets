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
  // Used for log lines / debugging.
  label: string;
  // What we say in the TTS message — e.g. "Prem" or just "Admin".
  // Comes from the `label` column on admin_escalation_contacts when set;
  // otherwise we say "Admin" so the call still sounds personal.
  friendlyName: string;
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
      friendlyName: (r.label ?? "").trim() || "Admin",
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
  return phone ? [{ phone, email, label: "admin", friendlyName: "Admin" }] : [];
}

// Walks the admin contacts in priority order, calling each one and waiting
// to learn whether the call was answered. Stops at the first contact that
// picks up. The caller passes a message *builder* (not a fixed string) so
// each admin in the chain hears their own name in the greeting — e.g.
// "Hello dear Prem, …" for contact #1 and "Hello dear Suhani, …" for #2.
// If no provider is configured (email-fallback path) we cannot detect
// "answered", so the loop will email every contact in turn — that matches
// the user expectation of "make sure SOMEONE gets it".
async function runAdminCascade(
  buildMessage: (contactName: string) => string,
): Promise<void> {
  const contacts = await getAdminContacts();
  if (contacts.length === 0) {
    logger.warn("[escalation] admin cascade: no contacts configured, dropping");
    return;
  }
  for (const c of contacts) {
    try {
      const outcome = await placeEscalationCallAndAwaitOutcome(
        c,
        buildMessage(c.friendlyName),
      );
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
        user: usersTable,
      })
      .from(inrDepositsTable)
      .leftJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
      .leftJoin(merchantsTable, eq(merchantsTable.id, paymentMethodsTable.merchantId))
      .leftJoin(usersTable, eq(usersTable.id, inrDepositsTable.userId))
      .where(inArray(inrDepositsTable.id, ids));
    for (const row of rows) {
      if (!row.merchant || !row.merchant.isActive) continue;
      const merchantName = firstName(row.merchant.fullName) || "merchant";
      const userName = firstName(row.user?.fullName) || "ek user";
      const amount = fmtAmount(row.deposit.amountInr);
      const utrSpoken = spellOut(row.deposit.utr);
      const message =
        `Hello dear ${merchantName}. Qorix Markets se message hai. ` +
        `Aapko user ${userName} se ${amount} rupee ka deposit request aaya hai. ` +
        `UTR number ${utrSpoken} hai. ` +
        `Kripya payment check karne ke baad approve kare. Dhanyawaad.`;
      await placeEscalationCall(
        {
          phone: row.merchant.phone,
          email: row.merchant.email,
          label: `merchant#${row.merchant.id}`,
        },
        message,
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
    .returning({ id: inrDepositsTable.id });

  if (claimedStage2.length > 0) {
    // Pull the full row + joined user + merchant so the cascade message can
    // include user name, amount, UTR and merchant name — exactly what the
    // person picking up the phone needs to act on the case.
    const ids = claimedStage2.map((r) => r.id);
    const rows = await db
      .select({
        deposit: inrDepositsTable,
        merchant: merchantsTable,
        user: usersTable,
      })
      .from(inrDepositsTable)
      .leftJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
      .leftJoin(merchantsTable, eq(merchantsTable.id, paymentMethodsTable.merchantId))
      .leftJoin(usersTable, eq(usersTable.id, inrDepositsTable.userId))
      .where(inArray(inrDepositsTable.id, ids));
    // Fire-and-forget the cascade per claimed row so the cron tick stays
    // fast (each cascade can take up to ~270s for 3 contacts × 90s wait).
    for (const row of rows) {
      const userName = firstName(row.user?.fullName) || "ek user";
      const merchantName = firstName(row.merchant?.fullName) || null;
      const amount = fmtAmount(row.deposit.amountInr);
      const utrSpoken = spellOut(row.deposit.utr);
      const merchantPart = merchantName
        ? ` Merchant ${merchantName} ne 15 minute me approve nahi kiya.`
        : ` 15 minute me kisi merchant ne approve nahi kiya.`;
      const buildMsg = (adminName: string) =>
        `Hello dear ${adminName}. Qorix Markets escalation alert. ` +
        `User ${userName} ne ${amount} rupee ka deposit kiya hai. ` +
        `UTR number ${utrSpoken} hai.` +
        merchantPart +
        ` Kripya jaldi intervene kare. Dhanyawaad.`;
      setImmediate(() => {
        runAdminCascade(buildMsg).catch((err) =>
          logger.warn(
            { err: (err as Error).message, depositId: row.deposit.id },
            "[escalation] cascade failed",
          ),
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
    // Hydrate each claimed withdrawal with its requesting user so the call
    // can name them. We also pull accountHolder back from the row itself.
    const ids = claimedStage1.map((r) => r.id);
    const fullRows = await db
      .select({ w: inrWithdrawalsTable, user: usersTable })
      .from(inrWithdrawalsTable)
      .leftJoin(usersTable, eq(usersTable.id, inrWithdrawalsTable.userId))
      .where(inArray(inrWithdrawalsTable.id, ids));
    const byId = new Map(fullRows.map((r) => [r.w.id, r] as const));
    for (const w of claimedStage1) {
      const targets = w.assignedMerchantId
        ? merchants.filter((m) => m.id === w.assignedMerchantId)
        : merchants;
      const ctx = byId.get(w.id);
      const userName = firstName(ctx?.user?.fullName) || "ek user";
      const amount = fmtAmount(w.amountInr);
      const acctHolder = ctx?.w.accountHolder?.trim();
      const acctPart = acctHolder ? ` Account holder ka naam ${acctHolder} hai.` : "";
      for (const m of targets) {
        const merchantName = firstName(m.fullName) || "merchant";
        const message =
          `Hello dear ${merchantName}. Qorix Markets se message hai. ` +
          `User ${userName} ne ${amount} rupee ka withdrawal request kiya hai.` +
          acctPart +
          ` Kripya jaldi action lekar process kare. Dhanyawaad.`;
        await placeEscalationCall(
          { phone: m.phone, email: m.email, label: `merchant#${m.id}` },
          message,
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
    .returning({ id: inrWithdrawalsTable.id });

  if (claimedStage2.length > 0) {
    const ids = claimedStage2.map((r) => r.id);
    const rows = await db
      .select({ w: inrWithdrawalsTable, user: usersTable })
      .from(inrWithdrawalsTable)
      .leftJoin(usersTable, eq(usersTable.id, inrWithdrawalsTable.userId))
      .where(inArray(inrWithdrawalsTable.id, ids));
    for (const row of rows) {
      const userName = firstName(row.user?.fullName) || "ek user";
      const amount = fmtAmount(row.w.amountInr);
      const acctHolder = row.w.accountHolder?.trim();
      const acctPart = acctHolder ? ` Account holder ka naam ${acctHolder} hai.` : "";
      const buildMsg = (adminName: string) =>
        `Hello dear ${adminName}. Qorix Markets escalation alert. ` +
        `User ${userName} ne ${amount} rupee ka withdrawal request kiya hai.` +
        acctPart +
        ` 15 minute me kisi merchant ne action nahi liya. ` +
        `Kripya jaldi intervene kare. Dhanyawaad.`;
      setImmediate(() => {
        runAdminCascade(buildMsg).catch((err) =>
          logger.warn(
            { err: (err as Error).message, withdrawalId: row.w.id },
            "[escalation] cascade failed",
          ),
        );
      });
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

// "Prem Kumar" → "Prem". Calling someone by their first name in a TTS
// greeting feels personal without being awkwardly long. Returns null if
// the input is empty/whitespace so the caller can substitute a generic
// fallback like "ek user" / "merchant".
function firstName(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first ? first : null;
}

// "5000.00" → "5000", "1234.50" → "1234.50". Whole-rupee amounts shouldn't
// be read as "five thousand point zero zero" by the TTS engine.
function fmtAmount(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "0";
  const n = typeof s === "number" ? s : Number(s);
  if (!Number.isFinite(n)) return String(s);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// "ABC1234567" → "A B C 1 2 3 4 5 6 7". Forces the TTS engine to read each
// character individually instead of treating long digit runs as a single
// number ("twelve million three hundred forty…"). Spaces are pronounced as
// brief pauses by both the alice and Polly voices.
function spellOut(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .split("")
    .filter((c) => c.trim() !== "")
    .join(" ");
}
