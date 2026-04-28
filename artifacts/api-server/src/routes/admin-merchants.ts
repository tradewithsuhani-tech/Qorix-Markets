import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  db,
  merchantsTable,
  paymentMethodsTable,
  inrDepositsTable,
  inrWithdrawalsTable,
  usersTable,
  adminAuditLogTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { auditAdminRequest, requireAdminPermission } from "../middlewares/admin-rbac";

const router = Router();

router.use("/admin/merchants", authMiddleware, adminMiddleware, requireAdminPermission, auditAdminRequest);

// List merchants with their owned-method count + INR wallet snapshot. Single
// SQL — no N+1. `inrBalance` is the on-chain wallet figure, `pendingHold` is
// the locked-in amount across pending user deposits assigned to this
// merchant's methods, and `available` is the spendable headroom for new
// deposits. Returned as strings (numeric) — frontend parses to number.
router.get("/admin/merchants", async (_req, res) => {
  const rows = await db
    .select({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      createdBy: merchantsTable.createdBy,
      lastLoginAt: merchantsTable.lastLoginAt,
      createdAt: merchantsTable.createdAt,
      inrBalance: merchantsTable.inrBalance,
      // NOTE: We use the fully-qualified literal `merchants.id` here instead
      // of `${merchantsTable.id}` because Drizzle interpolates a column
      // reference as the bare identifier `"id"`. Inside these correlated
      // subqueries, `payment_methods` also has its own `id` column, so the
      // bare `"id"` is ambiguous and Postgres raises
      // `column reference "id" is ambiguous`, 500ing the entire endpoint.
      methodCount: sql<number>`(
        select count(*)::int from payment_methods pm where pm.merchant_id = merchants.id
      )`,
      pendingHold: sql<string>`coalesce((
        select sum(d.amount_inr)::text
        from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = merchants.id and d.status = 'pending'
      ), '0')`,
    })
    .from(merchantsTable)
    .orderBy(merchantsTable.createdAt);
  // Compute available client-side from authoritative DB strings to avoid any
  // numeric drift in the SQL expression.
  const enriched = rows.map((r) => ({
    ...r,
    available: (parseFloat(r.inrBalance as string) - parseFloat(r.pendingHold)).toFixed(2),
  }));
  res.json({ merchants: enriched });
});

router.post("/admin/merchants", async (req: AuthRequest, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const fullName = String(req.body?.fullName ?? "").trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  // Optional initial INR security deposit / wallet balance.
  const initialInrBalanceRaw = req.body?.inrBalance;
  let inrBalance: string = "0";
  if (initialInrBalanceRaw !== undefined && initialInrBalanceRaw !== null && initialInrBalanceRaw !== "") {
    const n = Number(initialInrBalanceRaw);
    if (!Number.isFinite(n) || n < 0) {
      res.status(400).json({ error: "inrBalance must be a non-negative number" });
      return;
    }
    inrBalance = n.toFixed(2);
  }
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "email, password and fullName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  const existing = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.email, email))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "A merchant with this email already exists" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(merchantsTable)
    .values({
      email,
      passwordHash,
      fullName,
      phone,
      isActive: true,
      createdBy: req.userId ?? null,
      inrBalance,
    })
    .returning({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      inrBalance: merchantsTable.inrBalance,
      createdAt: merchantsTable.createdAt,
    });
  res.json({ merchant: created });
});

// Atomic top-up / debit of a merchant's INR balance. Positive `delta` credits,
// negative debits. Rejected if it would push the balance below 0.
router.post("/admin/merchants/:id/topup", async (req: AuthRequest, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400).json({ error: "delta must be a non-zero number (+credit / -debit)" });
    return;
  }
  const note = req.body?.note != null ? String(req.body.note).slice(0, 500) : null;
  const deltaStr = delta.toFixed(2);

  // Guard: if delta is negative, ensure resulting balance stays ≥ 0.
  const updated = await db
    .update(merchantsTable)
    .set({
      inrBalance: sql`${merchantsTable.inrBalance} + ${deltaStr}::numeric`,
      updatedAt: new Date(),
    })
    .where(
      delta < 0
        ? sql`${merchantsTable.id} = ${id} and ${merchantsTable.inrBalance} + ${deltaStr}::numeric >= 0`
        : eq(merchantsTable.id, id),
    )
    .returning({
      id: merchantsTable.id,
      inrBalance: merchantsTable.inrBalance,
    });
  if (!updated[0]) {
    if (delta < 0) {
      res.status(409).json({
        error: "insufficient_balance",
        message: "Debit blocked — would push merchant balance below 0.",
      });
      return;
    }
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  // Persist the structured detail so the audit-log middleware can attach
  // delta/note/before/after to the audit row. The activity feed below
  // reads these back to render the topup history line items.
  // CRITICAL: also set `auditTargetId` because this handler runs under
  // a router-level `auditAdminRequest` mounted at `/admin/merchants`
  // (no `:id` param at the mount point), so `req.params.id` is empty
  // when the middleware first snapshots it. Without this override, the
  // audit row's `target_id` stays null and the activity-feed branch
  // that filters by `target_type='merchant_topup' AND target_id=:id`
  // would never see top-up entries.
  const afterBalance = parseFloat(updated[0].inrBalance as string);
  const beforeBalance = afterBalance - delta;
  res.locals["auditTargetType"] = "merchant_topup";
  res.locals["auditTargetId"] = String(id);
  res.locals["auditSummary"] =
    `${delta >= 0 ? "Credited" : "Debited"} ₹${Math.abs(delta).toFixed(2)} ` +
    `(merchant #${id}${note ? `, note: ${note}` : ""})`;
  res.locals["auditMetadata"] = {
    delta: deltaStr,
    note,
    beforeBalance: beforeBalance.toFixed(2),
    afterBalance: afterBalance.toFixed(2),
  };
  res.json({
    merchant: updated[0],
    delta: Number(deltaStr),
    note,
  });
});

// Per-merchant audit / activity drawer. Returns:
//   - identity: profile snapshot (name, email, phone, isActive, lastLogin,
//     createdAt) plus the live wallet figures (balance, pendingHold, available)
//   - methods: every payment method this merchant owns with full bank/UPI
//     account details (admin-only — these are sensitive but the operator
//     ultimately needs to see exactly what the merchant is collecting on)
//   - activity: chronological credit/debit feed unioned across three sources
//       1. inr_deposits APPROVED via this merchant's methods → debits balance
//       2. inr_withdrawals APPROVED with assigned_merchant_id = this merchant
//          → credits balance (merchant pays out, gets reimbursed)
//       3. admin_audit_log entries for /admin/merchants/:id/topup → credit or
//          debit depending on the recorded delta. We read delta/note/before/
//          after directly from the audit metadata column so no separate
//          ledger table is needed.
//   Each row carries: at, kind, delta, amountInr, userName, userEmail,
//   reference (UTR / payout ref / audit row id), methodName, actorEmail,
//   actorKind, note. Frontend renders a colour-coded timeline.
router.get("/admin/merchants/:id/activity", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query["limit"]) || 100, 10), 500);

  // Identity + live wallet snapshot. Mirrors the list endpoint so the
  // drawer header doesn't drift from the card it was opened from.
  const ident = await db
    .select({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
      createdAt: merchantsTable.createdAt,
      lastLoginAt: merchantsTable.lastLoginAt,
      inrBalance: merchantsTable.inrBalance,
      pendingHold: sql<string>`coalesce((
        select sum(d.amount_inr)::text
        from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = merchants.id and d.status = 'pending'
      ), '0')`,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, id))
    .limit(1);
  if (!ident[0]) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  const merchant = {
    ...ident[0],
    available: (
      parseFloat(ident[0].inrBalance as string) - parseFloat(ident[0].pendingHold)
    ).toFixed(2),
  };

  // Owned payment methods, full sensitive detail.
  const methods = await db
    .select({
      id: paymentMethodsTable.id,
      type: paymentMethodsTable.type,
      displayName: paymentMethodsTable.displayName,
      accountHolder: paymentMethodsTable.accountHolder,
      accountNumber: paymentMethodsTable.accountNumber,
      ifsc: paymentMethodsTable.ifsc,
      bankName: paymentMethodsTable.bankName,
      upiId: paymentMethodsTable.upiId,
      minAmount: paymentMethodsTable.minAmount,
      maxAmount: paymentMethodsTable.maxAmount,
      isActive: paymentMethodsTable.isActive,
      createdAt: paymentMethodsTable.createdAt,
    })
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.merchantId, id))
    .orderBy(paymentMethodsTable.id);

  // Lifetime totals (computed on the same data we're listing). Useful at
  // a glance: "how much has this merchant settled in / paid out total".
  const totalsRes = await db.execute<{
    deposit_count: string;
    deposit_total: string;
    withdrawal_count: string;
    withdrawal_total: string;
  }>(sql`
    select
      coalesce((
        select count(*)::text from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = ${id} and d.status = 'approved'
      ), '0') as deposit_count,
      coalesce((
        select sum(d.amount_inr)::text from inr_deposits d
        join payment_methods pm on pm.id = d.payment_method_id
        where pm.merchant_id = ${id} and d.status = 'approved'
      ), '0') as deposit_total,
      coalesce((
        select count(*)::text from inr_withdrawals w
        where w.assigned_merchant_id = ${id} and w.status = 'approved'
      ), '0') as withdrawal_count,
      coalesce((
        select sum(w.amount_inr)::text from inr_withdrawals w
        where w.assigned_merchant_id = ${id} and w.status = 'approved'
      ), '0') as withdrawal_total
  `);
  const totals = totalsRes.rows[0];

  // Activity union. Three branches each cap their own slice so a merchant
  // with thousands of approved deposits doesn't starve the topup history
  // out of the merged feed. Final ORDER + LIMIT picks the freshest rows
  // across branches.
  const activityRes = await db.execute<{
    at: string;
    kind: string;
    delta: string;
    amount_inr: string;
    user_id: number | null;
    user_name: string | null;
    user_email: string | null;
    reference: string | null;
    method_name: string | null;
    actor_kind: string | null;
    actor_email: string | null;
    note: string | null;
    event_id: string;
  }>(sql`
    (
      select
        d.reviewed_at as at,
        'deposit_approved'::text as kind,
        ('-' || d.amount_inr::text)::numeric as delta,
        d.amount_inr::text as amount_inr,
        d.user_id,
        u.full_name as user_name,
        u.email as user_email,
        d.utr as reference,
        pm.display_name as method_name,
        d.reviewed_by_kind as actor_kind,
        case
          when d.reviewed_by_kind = 'admin' then admin_u.email
          when d.reviewed_by_kind = 'merchant' then merchant_r.email
          else null
        end as actor_email,
        d.admin_note as note,
        ('d:' || d.id::text) as event_id
      from inr_deposits d
      join payment_methods pm on pm.id = d.payment_method_id
      left join users u on u.id = d.user_id
      left join users admin_u
        on admin_u.id = d.reviewed_by and d.reviewed_by_kind = 'admin'
      left join merchants merchant_r
        on merchant_r.id = d.reviewed_by and d.reviewed_by_kind = 'merchant'
      where pm.merchant_id = ${id}
        and d.status = 'approved'
        and d.reviewed_at is not null
      order by d.reviewed_at desc
      limit ${limit}
    )
    union all
    (
      select
        w.reviewed_at as at,
        'withdrawal_approved'::text as kind,
        w.amount_inr::numeric as delta,
        w.amount_inr::text as amount_inr,
        w.user_id,
        u.full_name as user_name,
        u.email as user_email,
        coalesce(w.payout_reference, ('W' || w.id::text)) as reference,
        null::varchar as method_name,
        w.reviewed_by_kind as actor_kind,
        case
          when w.reviewed_by_kind = 'admin' then admin_u.email
          when w.reviewed_by_kind = 'merchant' then merchant_r.email
          else null
        end as actor_email,
        w.admin_note as note,
        ('w:' || w.id::text) as event_id
      from inr_withdrawals w
      left join users u on u.id = w.user_id
      left join users admin_u
        on admin_u.id = w.reviewed_by and w.reviewed_by_kind = 'admin'
      left join merchants merchant_r
        on merchant_r.id = w.reviewed_by and w.reviewed_by_kind = 'merchant'
      where w.assigned_merchant_id = ${id}
        and w.status = 'approved'
        and w.reviewed_at is not null
      order by w.reviewed_at desc
      limit ${limit}
    )
    union all
    (
      select
        a.created_at as at,
        case
          when (a.metadata::jsonb->>'delta')::numeric >= 0 then 'topup_credit'
          else 'topup_debit'
        end as kind,
        (a.metadata::jsonb->>'delta')::numeric as delta,
        abs((a.metadata::jsonb->>'delta')::numeric)::text as amount_inr,
        null::int as user_id,
        null::varchar as user_name,
        null::varchar as user_email,
        ('AUD-' || a.id::text) as reference,
        null::varchar as method_name,
        'admin'::varchar as actor_kind,
        a.admin_email as actor_email,
        a.metadata::jsonb->>'note' as note,
        ('a:' || a.id::text) as event_id
      from admin_audit_log a
      where a.target_type = 'merchant_topup'
        and a.target_id = ${String(id)}
        and a.module = 'merchants'
        and a.status_code between 200 and 299
        and a.metadata is not null
        -- Defensive: metadata is stored as text, not jsonb. Guard the
        -- cast against malformed values from any future route that
        -- accidentally writes non-JSON or non-numeric delta so the
        -- whole endpoint does not 500. We require the text to start
        -- with a JSON object brace and the extracted delta to be a
        -- plain numeric literal; the topup handler satisfies both.
        and a.metadata ~ '^\\s*\\{'
        and (a.metadata::jsonb->>'delta') ~ '^-?[0-9]+(\\.[0-9]+)?$'
      order by a.created_at desc
      limit ${limit}
    )
    order by at desc
    limit ${limit}
  `);

  res.json({
    merchant,
    methods,
    totals: {
      depositCount: Number(totals?.deposit_count ?? 0),
      depositTotalInr: totals?.deposit_total ?? "0",
      withdrawalCount: Number(totals?.withdrawal_count ?? 0),
      withdrawalTotalInr: totals?.withdrawal_total ?? "0",
    },
    activity: activityRes.rows.map((r) => ({
      at: r.at,
      kind: r.kind,
      delta: r.delta,
      amountInr: r.amount_inr,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      reference: r.reference,
      methodName: r.method_name,
      actorKind: r.actor_kind,
      actorEmail: r.actor_email,
      note: r.note,
      eventId: r.event_id,
    })),
  });
});

router.patch("/admin/merchants/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = req.body ?? {};
  const patch: Partial<typeof merchantsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if ("fullName" in body) patch.fullName = String(body.fullName);
  if ("phone" in body) patch.phone = body.phone ? String(body.phone) : null;
  if ("isActive" in body) patch.isActive = Boolean(body.isActive);
  if ("password" in body && body.password) {
    if (String(body.password).length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    patch.passwordHash = await bcrypt.hash(String(body.password), 12);
  }
  const [updated] = await db
    .update(merchantsTable)
    .set(patch)
    .where(eq(merchantsTable.id, id))
    .returning({
      id: merchantsTable.id,
      email: merchantsTable.email,
      fullName: merchantsTable.fullName,
      phone: merchantsTable.phone,
      isActive: merchantsTable.isActive,
    });
  if (!updated) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  res.json({ merchant: updated });
});

// DELETE is intentionally NOT exposed — disabling (isActive=false) is the
// recommended operation. Hard-deleting a merchant who already approved
// historical deposits would orphan the reviewedBy reference. If we need
// hard-delete later, add an explicit `?cascade=1` flag and null out
// payment_methods.merchant_id + leave reviewedBy in place.

// Reassign a payment method between merchants (used during the initial
// migration: existing admin-managed methods → first merchant).
router.post("/admin/merchants/:id/assign-method", async (req, res) => {
  const merchantId = Number(req.params["id"]);
  const methodId = Number(req.body?.methodId);
  if (!Number.isFinite(merchantId) || merchantId <= 0 || !Number.isFinite(methodId) || methodId <= 0) {
    res.status(400).json({ error: "Invalid merchantId or methodId" });
    return;
  }
  const merchantExists = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId))
    .limit(1);
  if (!merchantExists[0]) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }
  const [updated] = await db
    .update(paymentMethodsTable)
    .set({ merchantId, updatedAt: new Date() })
    .where(eq(paymentMethodsTable.id, methodId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Payment method not found" });
    return;
  }
  res.json({ method: updated });
});

// List unassigned payment methods (legacy admin-managed) so the admin can
// hand them off to a merchant from the UI. Gated explicitly because the
// router-level `use(/admin/merchants, ...)` above doesn't cover this prefix.
router.get(
  "/admin/payment-methods/unassigned",
  authMiddleware,
  adminMiddleware,
  requireAdminPermission,
  auditAdminRequest,
  async (_req, res) => {
    const rows = await db
      .select()
      .from(paymentMethodsTable)
      .where(sql`${paymentMethodsTable.merchantId} is null`)
      .orderBy(paymentMethodsTable.id);
    res.json({ methods: rows });
  },
);

export default router;
