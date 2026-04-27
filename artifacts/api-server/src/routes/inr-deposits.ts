import { Router } from "express";
import {
  db,
  walletsTable,
  transactionsTable,
  systemSettingsTable,
  paymentMethodsTable,
  inrDepositsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { transactionLogger, errorLogger } from "../lib/logger";
import { ensureUserAccounts, postJournalEntry, journalForTransaction } from "../lib/ledger-service";
import { sendTxnEmailToUser } from "../lib/email-service";
import { isSmokeTestUser } from "../lib/smoke-test-account";

const router = Router();

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = "85.0";

async function getInrRate(): Promise<number> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, INR_RATE_KEY))
    .limit(1);
  const raw = rows[0]?.value ?? DEFAULT_INR_RATE;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Number(DEFAULT_INR_RATE);
}

function publicMethod(m: typeof paymentMethodsTable.$inferSelect) {
  return {
    id: m.id,
    type: m.type,
    displayName: m.displayName,
    accountHolder: m.accountHolder,
    accountNumber: m.accountNumber,
    ifsc: m.ifsc,
    bankName: m.bankName,
    upiId: m.upiId,
    qrImageBase64: m.qrImageBase64,
    minAmount: parseFloat(m.minAmount as string),
    maxAmount: parseFloat(m.maxAmount as string),
    instructions: m.instructions,
    sortOrder: m.sortOrder,
  };
}

function adminMethod(m: typeof paymentMethodsTable.$inferSelect) {
  return { ...publicMethod(m), isActive: m.isActive, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() };
}

function formatInrDeposit(d: typeof inrDepositsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    paymentMethodId: d.paymentMethodId,
    amountInr: parseFloat(d.amountInr as string),
    amountUsdt: parseFloat(d.amountUsdt as string),
    rateUsed: parseFloat(d.rateUsed as string),
    utr: d.utr,
    proofImageBase64: d.proofImageBase64,
    status: d.status,
    adminNote: d.adminNote,
    reviewedBy: d.reviewedBy,
    reviewedAt: d.reviewedAt ? d.reviewedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PUBLIC (auth) endpoints — listed methods + user's INR deposits
// ---------------------------------------------------------------------------
router.get("/payment-methods", authMiddleware, async (_req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.isActive, true))
    .orderBy(paymentMethodsTable.sortOrder, paymentMethodsTable.id);
  const rate = await getInrRate();
  res.json({ methods: rows.map(publicMethod), rate });
});

router.get("/inr-deposits/mine", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(inrDepositsTable)
    .where(eq(inrDepositsTable.userId, req.userId!))
    .orderBy(desc(inrDepositsTable.createdAt))
    .limit(50);
  res.json({ deposits: rows.map(formatInrDeposit) });
});

router.post("/inr-deposits", authMiddleware, async (req: AuthRequest, res) => {
  if (await isSmokeTestUser(req.userId!)) {
    res.status(403).json({ error: "smoke_test_account_blocked", message: "INR deposits are disabled for the smoke-test account." });
    return;
  }
  const body = req.body ?? {};
  const paymentMethodId = Number(body.paymentMethodId);
  const amountInr = Number(body.amountInr);
  const utr = String(body.utr ?? "").trim();
  const proofImageBase64 = typeof body.proofImageBase64 === "string" ? body.proofImageBase64 : null;

  if (!Number.isFinite(paymentMethodId) || paymentMethodId <= 0) {
    res.status(400).json({ error: "Invalid paymentMethodId" });
    return;
  }
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    res.status(400).json({ error: "amountInr must be positive" });
    return;
  }
  if (utr.length < 6 || utr.length > 100) {
    res.status(400).json({ error: "UTR/reference must be 6–100 characters" });
    return;
  }
  if (proofImageBase64 && proofImageBase64.length > 2_000_000) {
    res.status(400).json({ error: "Proof image too large (max ~1.5MB)" });
    return;
  }

  const [method] = await db
    .select()
    .from(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.id, paymentMethodId), eq(paymentMethodsTable.isActive, true)))
    .limit(1);
  if (!method) {
    res.status(404).json({ error: "Payment method not found or inactive" });
    return;
  }
  const min = parseFloat(method.minAmount as string);
  const max = parseFloat(method.maxAmount as string);
  if (amountInr < min || amountInr > max) {
    res.status(400).json({ error: `Amount must be between ₹${min} and ₹${max}` });
    return;
  }

  // Dedupe UTR — partial unique index would race; do an explicit check first
  // and rely on the DB unique index as a backstop.
  const [existing] = await db.select().from(inrDepositsTable).where(eq(inrDepositsTable.utr, utr)).limit(1);
  if (existing) {
    res.status(409).json({ error: "This UTR/reference has already been submitted" });
    return;
  }

  const rate = await getInrRate();
  const amountUsdt = +(amountInr / rate).toFixed(6);

  try {
    const [row] = await db
      .insert(inrDepositsTable)
      .values({
        userId: req.userId!,
        paymentMethodId,
        amountInr: amountInr.toFixed(2),
        amountUsdt: amountUsdt.toFixed(6),
        rateUsed: rate.toFixed(4),
        utr,
        proofImageBase64,
      })
      .returning();
    await createNotification(
      req.userId!,
      "deposit",
      "INR deposit submitted",
      `Your INR deposit of ₹${amountInr.toFixed(2)} (≈$${amountUsdt.toFixed(2)} USDT) is awaiting admin review.`,
    );
    res.json({ deposit: formatInrDeposit(row!) });
  } catch (err: any) {
    if (String(err?.message ?? "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "This UTR/reference has already been submitted" });
      return;
    }
    errorLogger.error({ err, userId: req.userId }, "[inr-deposit] create failed");
    res.status(500).json({ error: "Failed to submit deposit" });
  }
});

// ---------------------------------------------------------------------------
// ADMIN endpoints
// ---------------------------------------------------------------------------
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

// Rate setting
router.get("/admin/inr-rate", async (_req, res) => {
  const rate = await getInrRate();
  res.json({ rate });
});
router.post("/admin/inr-rate", async (req, res) => {
  const rate = Number(req.body?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    res.status(400).json({ error: "rate must be a positive number" });
    return;
  }
  await db
    .insert(systemSettingsTable)
    .values({ key: INR_RATE_KEY, value: rate.toString() })
    .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: rate.toString(), updatedAt: new Date() } });
  res.json({ rate });
});

// Payment methods CRUD
router.get("/admin/payment-methods", async (_req, res) => {
  const rows = await db
    .select()
    .from(paymentMethodsTable)
    .orderBy(paymentMethodsTable.sortOrder, paymentMethodsTable.id);
  res.json({ methods: rows.map(adminMethod) });
});

router.post("/admin/payment-methods", async (req, res) => {
  const b = req.body ?? {};
  if (b.type !== "bank" && b.type !== "upi") {
    res.status(400).json({ error: "type must be 'bank' or 'upi'" });
    return;
  }
  const displayName = String(b.displayName ?? "").trim();
  if (!displayName) {
    res.status(400).json({ error: "displayName required" });
    return;
  }
  const [row] = await db
    .insert(paymentMethodsTable)
    .values({
      type: b.type,
      displayName,
      accountHolder: b.accountHolder ?? null,
      accountNumber: b.accountNumber ?? null,
      ifsc: b.ifsc ?? null,
      bankName: b.bankName ?? null,
      upiId: b.upiId ?? null,
      qrImageBase64: b.qrImageBase64 ?? null,
      minAmount: b.minAmount != null ? Number(b.minAmount).toFixed(2) : "100.00",
      maxAmount: b.maxAmount != null ? Number(b.maxAmount).toFixed(2) : "500000.00",
      instructions: b.instructions ?? null,
      isActive: b.isActive !== false,
      sortOrder: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0,
    })
    .returning();
  res.json({ method: adminMethod(row!) });
});

router.patch("/admin/payment-methods/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = req.body ?? {};
  const patch: Partial<typeof paymentMethodsTable.$inferInsert> & { updatedAt?: Date } = { updatedAt: new Date() };
  if (b.displayName !== undefined) patch.displayName = String(b.displayName);
  if (b.accountHolder !== undefined) patch.accountHolder = b.accountHolder;
  if (b.accountNumber !== undefined) patch.accountNumber = b.accountNumber;
  if (b.ifsc !== undefined) patch.ifsc = b.ifsc;
  if (b.bankName !== undefined) patch.bankName = b.bankName;
  if (b.upiId !== undefined) patch.upiId = b.upiId;
  if (b.qrImageBase64 !== undefined) patch.qrImageBase64 = b.qrImageBase64;
  if (b.minAmount !== undefined) patch.minAmount = Number(b.minAmount).toFixed(2);
  if (b.maxAmount !== undefined) patch.maxAmount = Number(b.maxAmount).toFixed(2);
  if (b.instructions !== undefined) patch.instructions = b.instructions;
  if (b.isActive !== undefined) patch.isActive = !!b.isActive;
  if (b.sortOrder !== undefined) patch.sortOrder = Number(b.sortOrder);
  const [row] = await db
    .update(paymentMethodsTable)
    .set(patch)
    .where(eq(paymentMethodsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ method: adminMethod(row) });
});

router.delete("/admin/payment-methods/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, id));
  res.json({ ok: true });
});

// INR deposits review
router.get("/admin/inr-deposits", async (req, res) => {
  const status = typeof req.query["status"] === "string" ? (req.query["status"] as string) : null;
  const where = status ? eq(inrDepositsTable.status, status) : undefined;
  const rows = await (where
    ? db.select().from(inrDepositsTable).where(where).orderBy(desc(inrDepositsTable.createdAt)).limit(200)
    : db.select().from(inrDepositsTable).orderBy(desc(inrDepositsTable.createdAt)).limit(200));
  // Pull user emails for the admin list (small N, single query)
  const ids = Array.from(new Set(rows.map((r) => r.userId)));
  const users = ids.length
    ? await db.select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName }).from(usersTable).where(sql`${usersTable.id} = ANY(${ids})`)
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json({
    deposits: rows.map((r) => ({
      ...formatInrDeposit(r),
      userEmail: byId.get(r.userId)?.email ?? null,
      userName: byId.get(r.userId)?.fullName ?? null,
    })),
  });
});

router.post("/admin/inr-deposits/:id/approve", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  const overrideUsdt = req.body?.amountUsdt != null ? Number(req.body.amountUsdt) : null;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Capture deposit details for the post-tx email/notification, but do NOT
  // act on its `status` here — the actual race-safe state transition happens
  // inside the transaction with a conditional UPDATE.
  const [depPreview] = await db.select().from(inrDepositsTable).where(eq(inrDepositsTable.id, id)).limit(1);
  if (!depPreview) {
    res.status(404).json({ error: "Deposit not found" });
    return;
  }
  if (depPreview.status !== "pending") {
    res.status(400).json({ error: `Deposit already ${depPreview.status}` });
    return;
  }

  let approvedDep: typeof depPreview | null = null;
  let creditedUsdt = 0;
  try {
    await db.transaction(async (tx) => {
      // Atomic claim: only the FIRST concurrent admin call flips pending →
      // approved. Subsequent attempts (or a concurrent reject) get 0 rows
      // back and the whole transaction is rolled back without touching the
      // wallet, ledger, or transactions table.
      const [claimed] = await tx
        .update(inrDepositsTable)
        .set({
          status: "approved",
          reviewedBy: req.userId!,
          reviewedAt: new Date(),
          adminNote: req.body?.adminNote ?? null,
        })
        .where(and(eq(inrDepositsTable.id, id), eq(inrDepositsTable.status, "pending")))
        .returning();
      if (!claimed) {
        throw new Error("ALREADY_REVIEWED");
      }
      approvedDep = claimed;

      const amountUsdt = overrideUsdt != null && overrideUsdt > 0
        ? overrideUsdt
        : parseFloat(claimed.amountUsdt as string);
      creditedUsdt = amountUsdt;

      // Persist the (possibly overridden) credited amount on the deposit row
      // so the user sees the actual credited value, not the pre-rate USDT.
      if (overrideUsdt != null && overrideUsdt > 0) {
        await tx
          .update(inrDepositsTable)
          .set({ amountUsdt: amountUsdt.toFixed(6) })
          .where(eq(inrDepositsTable.id, id));
      }

      await ensureUserAccounts(claimed.userId, tx);

      // Atomic balance increment via raw SQL — no read-modify-write window,
      // safe under any concurrent wallet mutation. The numeric column accepts
      // the +/- arithmetic directly and Postgres handles row locking.
      const updRes = await tx
        .update(walletsTable)
        .set({
          mainBalance: sql`${walletsTable.mainBalance} + ${amountUsdt.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, claimed.userId))
        .returning({ id: walletsTable.id });
      if (!updRes[0]) throw new Error("Wallet not found for user");

      const [txn] = await tx
        .insert(transactionsTable)
        .values({
          userId: claimed.userId,
          type: "deposit",
          amount: amountUsdt.toString(),
          status: "completed",
          description: `INR deposit ₹${parseFloat(claimed.amountInr as string).toFixed(2)} (UTR ${claimed.utr}) approved → $${amountUsdt.toFixed(2)} USDT`,
        })
        .returning();
      await postJournalEntry(
        journalForTransaction(txn!.id),
        [
          { accountCode: "platform:usdt_pool", entryType: "debit", amount: amountUsdt, description: `INR deposit approved for user ${claimed.userId}` },
          { accountCode: `user:${claimed.userId}:main`, entryType: "credit", amount: amountUsdt, description: `INR deposit credited (UTR ${claimed.utr})` },
        ],
        txn!.id,
        tx,
      );
    });
  } catch (err: any) {
    if (err?.message === "ALREADY_REVIEWED") {
      res.status(409).json({ error: "Deposit was already reviewed by another admin" });
      return;
    }
    errorLogger.error({ err, id }, "[inr-deposit] approve failed");
    res.status(500).json({ error: "Failed to approve deposit" });
    return;
  }

  if (!approvedDep) {
    res.status(500).json({ error: "Approve handler reached an inconsistent state" });
    return;
  }

  const dep = approvedDep as typeof depPreview;
  const amountUsdt = creditedUsdt;
  transactionLogger.info({ event: "inr_deposit_approved", id, userId: dep.userId, amountUsdt }, "INR deposit approved");
  await createNotification(
    dep.userId,
    "deposit",
    "INR deposit approved",
    `Your ₹${parseFloat(dep.amountInr as string).toFixed(2)} deposit has been approved. $${amountUsdt.toFixed(2)} USDT credited to your main balance.`,
  );
  sendTxnEmailToUser(
    dep.userId,
    "INR Deposit Approved",
    `Good news — your INR deposit has been approved and credited.\n\n` +
      `INR Amount: ₹${parseFloat(dep.amountInr as string).toFixed(2)}\n` +
      `Credited: $${amountUsdt.toFixed(2)} USDT\n` +
      `Reference (UTR): ${dep.utr}\n\n` +
      `You can now transfer funds to your Trading Balance and start earning.`,
  );
  res.json({ ok: true });
});

router.post("/admin/inr-deposits/:id/reject", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  const note = String(req.body?.adminNote ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Atomic claim: if a concurrent admin already approved/rejected, this
  // returns 0 rows and we surface the conflict instead of stomping state.
  const [rejected] = await db
    .update(inrDepositsTable)
    .set({ status: "rejected", reviewedBy: req.userId!, reviewedAt: new Date(), adminNote: note || null })
    .where(and(eq(inrDepositsTable.id, id), eq(inrDepositsTable.status, "pending")))
    .returning();
  if (!rejected) {
    const [existing] = await db.select().from(inrDepositsTable).where(eq(inrDepositsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }
    res.status(409).json({ error: `Deposit already ${existing.status}` });
    return;
  }
  const dep = rejected;
  await createNotification(
    dep.userId,
    "deposit",
    "INR deposit rejected",
    `Your ₹${parseFloat(dep.amountInr as string).toFixed(2)} deposit could not be verified.${note ? ` Reason: ${note}` : ""}`,
  );
  res.json({ ok: true });
});

export default router;
