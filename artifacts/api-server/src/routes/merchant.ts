import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  db,
  merchantsTable,
  paymentMethodsTable,
  inrDepositsTable,
  inrWithdrawalsTable,
  walletsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { and, eq, desc, isNull, sql, or } from "drizzle-orm";
import {
  merchantAuthMiddleware,
  signMerchantToken,
  type MerchantAuthRequest,
} from "../middlewares/merchant-auth";
import { createNotification } from "../lib/notifications";
import { sendTxnEmailToUser } from "../lib/email-service";
import { transactionLogger, errorLogger } from "../lib/logger";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForTransaction,
} from "../lib/ledger-service";

const router = Router();

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = "85.0";

// ─── Auth ───────────────────────────────────────────────────────────────────
// Login is the ONLY public merchant endpoint. There is no signup, no forgot-
// password, no change-password — admin owns all merchant credentials and
// resets them from the admin-merchants page. This is by design (single
// pinch-point for offboarding a leaked password).
router.post("/merchant/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const rows = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.email, email))
    .limit(1);
  const merchant = rows[0];
  // Email not on file → generic invalid (we don't leak account existence).
  if (!merchant) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  // Verify password BEFORE the isActive gate, so a disabled merchant who
  // typed the wrong password still sees "invalid password" (don't leak that
  // a disabled-account exists to a stranger guessing emails) — but a disabled
  // merchant who typed the RIGHT password gets a precise, actionable message
  // ("Account is disabled, contact admin"). This was the entire user-reported
  // bug: the previous code lumped "disabled" and "wrong password" together as
  // "Invalid credentials", so merchants who got disabled assumed their
  // password was wrong, panic-typed wrong passwords, and then couldn't log in
  // even AFTER admin re-enabled them because they had lost track of which
  // password actually worked.
  const valid = await bcrypt.compare(password, merchant.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (!merchant.isActive) {
    res.status(403).json({
      error:
        "Your merchant account is disabled. Please contact the platform admin to re-enable it.",
      code: "ACCOUNT_DISABLED",
    });
    return;
  }
  await db
    .update(merchantsTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(merchantsTable.id, merchant.id));
  const token = signMerchantToken(merchant.id);
  res.json({
    token,
    merchant: {
      id: merchant.id,
      email: merchant.email,
      fullName: merchant.fullName,
      phone: merchant.phone,
    },
  });
});

// ─── All routes below require merchant auth ────────────────────────────────
router.use("/merchant", merchantAuthMiddleware);

router.get("/merchant/me", async (req: MerchantAuthRequest, res) => {
  const rows = await db
    .select({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      lastLoginAt: merchantsTable.lastLoginAt,
      createdAt: merchantsTable.createdAt,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, req.merchantId!))
    .limit(1);
  res.json({ merchant: rows[0] ?? null });
});

// ─── Dashboard KPI counts + INR wallet snapshot ────────────────────────────
// Returns the live action-queue counts AND the merchant's wallet balance so
// the merchant panel can show how much INR they have parked with the
// platform (admin top-ups land here) and how much is currently locked up
// against pending user deposits ("pendingHold"). `available` is the
// spendable headroom — what new user deposits can still be matched against
// this merchant before they have to top up again. Mirrors the shape that
// /admin/merchants returns per merchant so both panels stay in sync.
router.get("/merchant/dashboard", async (req: MerchantAuthRequest, res) => {
  const merchantId = req.merchantId!;
  // Pending deposits scoped to my methods
  const [{ pendingDeposits }] = await db
    .select({ pendingDeposits: sql<number>`count(*)::int` })
    .from(inrDepositsTable)
    .innerJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
    .where(
      and(
        eq(inrDepositsTable.status, "pending"),
        eq(paymentMethodsTable.merchantId, merchantId),
      ),
    );
  const [{ pendingWithdrawals }] = await db
    .select({ pendingWithdrawals: sql<number>`count(*)::int` })
    .from(inrWithdrawalsTable)
    .where(
      and(
        eq(inrWithdrawalsTable.status, "pending"),
        // Either assigned to me, or unclaimed (anyone can pick up).
        or(
          eq(inrWithdrawalsTable.assignedMerchantId, merchantId),
          isNull(inrWithdrawalsTable.assignedMerchantId),
        )!,
      ),
    );
  const [{ totalMethods }] = await db
    .select({ totalMethods: sql<number>`count(*)::int` })
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.merchantId, merchantId));
  // Wallet snapshot — same correlated-subquery pattern as
  // routes/admin-merchants.ts so the two surfaces never disagree. We use
  // the literal `merchants.id` inside the subquery (not a Drizzle column
  // ref) because a column ref renders as the bare identifier "id" which
  // would be ambiguous against payment_methods.id and 500 the endpoint —
  // exact same trap admin-merchants.ts comments call out.
  const [walletRow] = await db
    .select({
      inrBalance: merchantsTable.inrBalance,
      pendingHold: sql<string>`coalesce((
        select sum(d.amount_inr)::text
        from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = merchants.id and d.status = 'pending'
      ), '0')`,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId))
    .limit(1);
  const inrBalance = (walletRow?.inrBalance as string | null) ?? "0";
  const pendingHold = walletRow?.pendingHold ?? "0";
  const available = (parseFloat(inrBalance) - parseFloat(pendingHold)).toFixed(2);
  res.json({
    pendingDeposits,
    pendingWithdrawals,
    totalMethods,
    inrBalance,
    pendingHold,
    available,
  });
});

// ─── Payment methods (own only) ────────────────────────────────────────────
router.get("/merchant/payment-methods", async (req: MerchantAuthRequest, res) => {
  const rows = await db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.merchantId, req.merchantId!))
    .orderBy(paymentMethodsTable.sortOrder, paymentMethodsTable.id);
  res.json({ methods: rows });
});

router.post("/merchant/payment-methods", async (req: MerchantAuthRequest, res) => {
  const body = req.body ?? {};
  const type = String(body.type ?? "").trim();
  if (!["bank", "upi"].includes(type)) {
    res.status(400).json({ error: "type must be 'bank' or 'upi'" });
    return;
  }
  const displayName = String(body.displayName ?? "").trim();
  if (!displayName) {
    res.status(400).json({ error: "displayName required" });
    return;
  }
  const [created] = await db
    .insert(paymentMethodsTable)
    .values({
      type,
      displayName,
      accountHolder: body.accountHolder ?? null,
      accountNumber: body.accountNumber ?? null,
      ifsc: body.ifsc ?? null,
      bankName: body.bankName ?? null,
      upiId: body.upiId ?? null,
      qrImageBase64: body.qrImageBase64 ?? null,
      minAmount: body.minAmount?.toString() ?? "100",
      maxAmount: body.maxAmount?.toString() ?? "500000",
      instructions: body.instructions ?? null,
      isActive: body.isActive ?? true,
      sortOrder: Number(body.sortOrder ?? 0),
      merchantId: req.merchantId!,
    })
    .returning();
  res.json({ method: created });
});

router.patch("/merchant/payment-methods/:id", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const owned = await db
    .select({ id: paymentMethodsTable.id })
    .from(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.merchantId, req.merchantId!)))
    .limit(1);
  if (!owned[0]) {
    res.status(404).json({ error: "Method not found" });
    return;
  }
  const body = req.body ?? {};
  const patch: Partial<typeof paymentMethodsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  for (const k of [
    "displayName",
    "accountHolder",
    "accountNumber",
    "ifsc",
    "bankName",
    "upiId",
    "qrImageBase64",
    "instructions",
  ] as const) {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  }
  if ("minAmount" in body) patch.minAmount = body.minAmount?.toString();
  if ("maxAmount" in body) patch.maxAmount = body.maxAmount?.toString();
  if ("isActive" in body) patch.isActive = Boolean(body.isActive);
  if ("sortOrder" in body) patch.sortOrder = Number(body.sortOrder);
  const [updated] = await db
    .update(paymentMethodsTable)
    .set(patch)
    .where(eq(paymentMethodsTable.id, id))
    .returning();
  res.json({ method: updated });
});

router.delete("/merchant/payment-methods/:id", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const r = await db
    .delete(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.merchantId, req.merchantId!)))
    .returning({ id: paymentMethodsTable.id });
  if (!r[0]) {
    res.status(404).json({ error: "Method not found" });
    return;
  }
  res.json({ ok: true });
});

// ─── INR Rate (shared setting; merchant can update) ────────────────────────
router.get("/merchant/inr-rate", async (_req, res) => {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, INR_RATE_KEY))
    .limit(1);
  res.json({ rate: rows[0]?.value ?? DEFAULT_INR_RATE });
});

router.post("/merchant/inr-rate", async (req, res) => {
  const value = String(req.body?.rate ?? "").trim();
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    res.status(400).json({ error: "rate must be a positive number" });
    return;
  }
  await db
    .insert(systemSettingsTable)
    .values({ key: INR_RATE_KEY, value })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
  res.json({ rate: value });
});

// ─── INR deposits (scoped to my methods) ───────────────────────────────────
router.get("/merchant/inr-deposits", async (req: MerchantAuthRequest, res) => {
  const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const conds = [eq(paymentMethodsTable.merchantId, req.merchantId!)];
  if (status) conds.push(eq(inrDepositsTable.status, status));
  const rows = await db
    .select({
      id: inrDepositsTable.id,
      userId: inrDepositsTable.userId,
      paymentMethodId: inrDepositsTable.paymentMethodId,
      amountInr: inrDepositsTable.amountInr,
      amountUsdt: inrDepositsTable.amountUsdt,
      rateUsed: inrDepositsTable.rateUsed,
      utr: inrDepositsTable.utr,
      proofImageBase64: inrDepositsTable.proofImageBase64,
      status: inrDepositsTable.status,
      adminNote: inrDepositsTable.adminNote,
      reviewedAt: inrDepositsTable.reviewedAt,
      reviewedByKind: inrDepositsTable.reviewedByKind,
      escalatedToMerchantAt: inrDepositsTable.escalatedToMerchantAt,
      escalatedToAdminAt: inrDepositsTable.escalatedToAdminAt,
      createdAt: inrDepositsTable.createdAt,
      methodDisplayName: paymentMethodsTable.displayName,
      methodType: paymentMethodsTable.type,
    })
    .from(inrDepositsTable)
    .innerJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
    .where(and(...conds))
    .orderBy(desc(inrDepositsTable.createdAt))
    .limit(200);
  res.json({ deposits: rows });
});

router.post("/merchant/inr-deposits/:id/approve", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  const overrideUsdt =
    req.body?.amountUsdt != null ? Number(req.body.amountUsdt) : null;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Verify ownership BEFORE the transaction so we can return a clean 404
  // instead of a generic transaction failure when a merchant tries to
  // approve a deposit that lives on someone else's payment method.
  const ownership = await db
    .select({ depositId: inrDepositsTable.id, status: inrDepositsTable.status })
    .from(inrDepositsTable)
    .innerJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
    .where(
      and(
        eq(inrDepositsTable.id, id),
        eq(paymentMethodsTable.merchantId, req.merchantId!),
      ),
    )
    .limit(1);
  if (!ownership[0]) {
    res.status(404).json({ error: "Deposit not found on your payment methods" });
    return;
  }
  if (ownership[0].status !== "pending") {
    res.status(409).json({ error: `Deposit already ${ownership[0].status}` });
    return;
  }

  let approvedDep: typeof inrDepositsTable.$inferSelect | null = null;
  let creditedUsdt = 0;
  try {
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(inrDepositsTable)
        .set({
          status: "approved",
          reviewedBy: req.merchantId!,
          reviewedByKind: "merchant",
          reviewedAt: new Date(),
          adminNote: req.body?.adminNote ?? null,
        })
        .where(and(eq(inrDepositsTable.id, id), eq(inrDepositsTable.status, "pending")))
        .returning();
      if (!claimed) throw new Error("ALREADY_REVIEWED");
      approvedDep = claimed;

      // Debit this merchant's INR balance for the original amount the user
      // committed. Authoritative — guarded so we never go negative.
      const amountInrStr = parseFloat(claimed.amountInr as string).toFixed(2);
      const debit = await tx
        .update(merchantsTable)
        .set({
          inrBalance: sql`${merchantsTable.inrBalance} - ${amountInrStr}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          sql`${merchantsTable.id} = ${req.merchantId!} and ${merchantsTable.inrBalance} >= ${amountInrStr}::numeric`,
        )
        .returning({ id: merchantsTable.id });
      if (!debit[0]) {
        throw new Error("INSUFFICIENT_MERCHANT_BALANCE");
      }

      // Bound the merchant override: they can credit *less* than the
      // originally computed USDT amount (e.g. partial INR landed) but never
      // more — that would let a rogue/compromised merchant over-credit a
      // user. Cap at the value computed from the platform rate at submit
      // time. Also reject zero/negative overrides.
      const computed = parseFloat(claimed.amountUsdt as string);
      let amountUsdt = computed;
      if (overrideUsdt != null) {
        if (!Number.isFinite(overrideUsdt) || overrideUsdt <= 0) {
          throw new Error("BAD_OVERRIDE");
        }
        if (overrideUsdt > computed + 1e-6) {
          throw new Error("OVER_CREDIT_BLOCKED");
        }
        amountUsdt = overrideUsdt;
      }
      creditedUsdt = amountUsdt;
      if (overrideUsdt != null && Math.abs(overrideUsdt - computed) > 1e-6) {
        await tx
          .update(inrDepositsTable)
          .set({ amountUsdt: amountUsdt.toFixed(6) })
          .where(eq(inrDepositsTable.id, id));
      }
      await ensureUserAccounts(claimed.userId, tx);
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
          description: `INR deposit ₹${parseFloat(claimed.amountInr as string).toFixed(2)} (UTR ${claimed.utr}) approved by merchant → $${amountUsdt.toFixed(2)} USDT`,
        })
        .returning();
      await postJournalEntry(
        journalForTransaction(txn!.id),
        [
          {
            accountCode: "platform:usdt_pool",
            entryType: "debit",
            amount: amountUsdt,
            description: `INR deposit approved by merchant for user ${claimed.userId}`,
          },
          {
            accountCode: `user:${claimed.userId}:main`,
            entryType: "credit",
            amount: amountUsdt,
            description: `INR deposit credited (UTR ${claimed.utr})`,
          },
        ],
        txn!.id,
        tx,
      );
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "ALREADY_REVIEWED") {
      res.status(409).json({ error: "Deposit was already reviewed" });
      return;
    }
    if (msg === "INSUFFICIENT_MERCHANT_BALANCE") {
      res.status(409).json({
        error: "insufficient_merchant_balance",
        message: "Your INR balance is lower than this deposit. Top up via admin or reject this deposit.",
      });
      return;
    }
    if (msg === "BAD_OVERRIDE") {
      res.status(400).json({ error: "USDT override must be a positive number" });
      return;
    }
    if (msg === "OVER_CREDIT_BLOCKED") {
      res.status(400).json({
        error:
          "USDT override cannot exceed the originally quoted amount. Credit less if user paid less, never more.",
      });
      return;
    }
    errorLogger.error({ err, id }, "[merchant] approve deposit failed");
    res.status(500).json({ error: "Failed to approve deposit" });
    return;
  }
  if (!approvedDep) {
    res.status(500).json({ error: "Approve handler reached an inconsistent state" });
    return;
  }
  const dep = approvedDep as typeof inrDepositsTable.$inferSelect;
  transactionLogger.info(
    {
      event: "inr_deposit_approved_by_merchant",
      id,
      merchantId: req.merchantId,
      userId: dep.userId,
      amountUsdt: creditedUsdt,
    },
    "INR deposit approved by merchant",
  );
  await createNotification(
    dep.userId,
    "deposit",
    "INR deposit approved",
    `Your ₹${parseFloat(dep.amountInr as string).toFixed(2)} deposit has been approved. $${creditedUsdt.toFixed(2)} USDT credited to your main balance.`,
  );
  sendTxnEmailToUser(
    dep.userId,
    "INR Deposit Approved",
    `Your INR deposit has been approved and credited.\n\n` +
      `INR Amount: ₹${parseFloat(dep.amountInr as string).toFixed(2)}\n` +
      `Credited: $${creditedUsdt.toFixed(2)} USDT\n` +
      `Reference (UTR): ${dep.utr}\n`,
  );
  res.json({ ok: true });
});

router.post("/merchant/inr-deposits/:id/reject", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  const note = String(req.body?.adminNote ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ownership = await db
    .select({ depositId: inrDepositsTable.id })
    .from(inrDepositsTable)
    .innerJoin(paymentMethodsTable, eq(paymentMethodsTable.id, inrDepositsTable.paymentMethodId))
    .where(
      and(
        eq(inrDepositsTable.id, id),
        eq(paymentMethodsTable.merchantId, req.merchantId!),
      ),
    )
    .limit(1);
  if (!ownership[0]) {
    res.status(404).json({ error: "Deposit not found on your payment methods" });
    return;
  }
  const [rejected] = await db
    .update(inrDepositsTable)
    .set({
      status: "rejected",
      reviewedBy: req.merchantId!,
      reviewedByKind: "merchant",
      reviewedAt: new Date(),
      adminNote: note || null,
    })
    .where(and(eq(inrDepositsTable.id, id), eq(inrDepositsTable.status, "pending")))
    .returning();
  if (!rejected) {
    res.status(409).json({ error: "Deposit was already reviewed" });
    return;
  }
  await createNotification(
    rejected.userId,
    "deposit",
    "INR deposit rejected",
    `Your ₹${parseFloat(rejected.amountInr as string).toFixed(2)} deposit could not be verified.${
      note ? ` Reason: ${note}` : ""
    }`,
  );
  res.json({ ok: true });
});

// ─── INR withdrawals (any active merchant can claim+process) ───────────────
router.get("/merchant/inr-withdrawals", async (req: MerchantAuthRequest, res) => {
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "pending";
  // Pending: show unclaimed + claimed-by-me. Other statuses: only ones I
  // actioned (so my history doesn't show every other merchant's queue).
  let where;
  if (status === "pending") {
    where = and(
      eq(inrWithdrawalsTable.status, "pending"),
      or(
        eq(inrWithdrawalsTable.assignedMerchantId, req.merchantId!),
        isNull(inrWithdrawalsTable.assignedMerchantId),
      )!,
    );
  } else {
    where = and(
      eq(inrWithdrawalsTable.status, status),
      eq(inrWithdrawalsTable.assignedMerchantId, req.merchantId!),
    );
  }
  const rows = await db
    .select()
    .from(inrWithdrawalsTable)
    .where(where!)
    .orderBy(desc(inrWithdrawalsTable.createdAt))
    .limit(200);
  res.json({ withdrawals: rows });
});

router.post("/merchant/inr-withdrawals/:id/claim", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Atomic claim: only succeeds if assignedMerchantId is still NULL.
  const [claimed] = await db
    .update(inrWithdrawalsTable)
    .set({ assignedMerchantId: req.merchantId! })
    .where(
      and(
        eq(inrWithdrawalsTable.id, id),
        eq(inrWithdrawalsTable.status, "pending"),
        isNull(inrWithdrawalsTable.assignedMerchantId),
      ),
    )
    .returning();
  if (!claimed) {
    res.status(409).json({ error: "Withdrawal already claimed by another merchant" });
    return;
  }
  res.json({ withdrawal: claimed });
});

router.post("/merchant/inr-withdrawals/:id/approve", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  const payoutReference = String(req.body?.payoutReference ?? "").trim() || null;
  const adminNote = String(req.body?.adminNote ?? "").trim() || null;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Ownership: must either be already assigned to me, or I'm claiming it now.
  // Wrapped in a tx so the merchant credit lands atomically with the claim.
  let row: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    row = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(inrWithdrawalsTable)
        .set({
          status: "approved",
          reviewedBy: req.merchantId!,
          reviewedByKind: "merchant",
          reviewedAt: new Date(),
          payoutReference,
          adminNote,
          assignedMerchantId: req.merchantId!,
        })
        .where(
          and(
            eq(inrWithdrawalsTable.id, id),
            eq(inrWithdrawalsTable.status, "pending"),
            or(
              eq(inrWithdrawalsTable.assignedMerchantId, req.merchantId!),
              isNull(inrWithdrawalsTable.assignedMerchantId),
            )!,
          ),
        )
        .returning();
      if (!claimed) throw new Error("ALREADY_REVIEWED");

      // Credit merchant's INR balance — they paid the user offline so their
      // capacity grows back by the same amount.
      const amountInrStr = parseFloat(claimed.amountInr as string).toFixed(2);
      await tx
        .update(merchantsTable)
        .set({
          inrBalance: sql`${merchantsTable.inrBalance} + ${amountInrStr}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(merchantsTable.id, req.merchantId!));
      return claimed;
    });
  } catch (err: unknown) {
    if ((err as Error).message === "ALREADY_REVIEWED") {
      res.status(409).json({ error: "Withdrawal already actioned or assigned to another merchant" });
      return;
    }
    errorLogger.error({ err, id }, "[merchant] approve withdrawal failed");
    res.status(500).json({ error: "Failed to approve withdrawal" });
    return;
  }
  if (!row) {
    res.status(500).json({ error: "Approve handler reached an inconsistent state" });
    return;
  }
  await createNotification(
    row.userId,
    "withdrawal",
    "INR withdrawal paid",
    `Your INR withdrawal of ₹${parseFloat(row.amountInr as string).toFixed(2)} has been processed.${
      payoutReference ? ` Reference: ${payoutReference}` : ""
    }`,
  );
  sendTxnEmailToUser(
    row.userId,
    "INR Withdrawal Processed",
    `Your INR withdrawal has been paid out.\n\n` +
      `Amount: ₹${parseFloat(row.amountInr as string).toFixed(2)}\n` +
      `Method: ${row.payoutMethod.toUpperCase()}\n` +
      (payoutReference ? `Reference: ${payoutReference}\n` : "") +
      `\nIf you do not see the funds in 30 minutes, contact support.`,
  );
  res.json({ ok: true });
});

router.post("/merchant/inr-withdrawals/:id/reject", async (req: MerchantAuthRequest, res) => {
  const id = Number(req.params["id"]);
  const note = String(req.body?.adminNote ?? "").trim();
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  let refunded: typeof inrWithdrawalsTable.$inferSelect | undefined;
  try {
    refunded = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(inrWithdrawalsTable)
        .set({
          status: "rejected",
          reviewedBy: req.merchantId!,
          reviewedByKind: "merchant",
          reviewedAt: new Date(),
          adminNote: note || null,
          assignedMerchantId: req.merchantId!,
        })
        .where(
          and(
            eq(inrWithdrawalsTable.id, id),
            eq(inrWithdrawalsTable.status, "pending"),
            or(
              eq(inrWithdrawalsTable.assignedMerchantId, req.merchantId!),
              isNull(inrWithdrawalsTable.assignedMerchantId),
            )!,
          ),
        )
        .returning();
      if (!row) throw new Error("NOT_PENDING");
      await tx
        .update(walletsTable)
        .set({
          mainBalance: sql`${walletsTable.mainBalance} + ${row.amountUsdt}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(walletsTable.userId, row.userId));
      return row;
    });
  } catch (err: unknown) {
    if ((err as Error).message === "NOT_PENDING") {
      res.status(409).json({ error: "Withdrawal already actioned or assigned elsewhere" });
      return;
    }
    errorLogger.error({ err, id }, "[merchant] reject withdrawal failed");
    res.status(500).json({ error: "Failed to reject withdrawal" });
    return;
  }
  await createNotification(
    refunded!.userId,
    "withdrawal",
    "INR withdrawal rejected",
    `Your INR withdrawal of ₹${parseFloat(refunded!.amountInr as string).toFixed(2)} was rejected and the amount refunded to your Main Balance.${
      note ? ` Reason: ${note}` : ""
    }`,
  );
  res.json({ ok: true });
});

export default router;
