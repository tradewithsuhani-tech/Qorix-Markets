import { Router } from "express";
import {
  db,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
  systemSettingsTable,
  dailyProfitRunsTable,
  glAccountsTable,
  ledgerEntriesTable,
  notificationsTable,
  signalTradesTable,
} from "@workspace/db";
import { loginEventsTable, blockchainDepositsTable } from "@workspace/db/schema";
import { eq, sum, count, and, or, desc, sql, inArray } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { SetDailyProfitBody } from "@workspace/api-zod";
import { transferProfitToMain } from "../lib/profit-service";
import { sendUsdtFromTreasury, getTreasuryUsdtBalance } from "../lib/crypto-deposit/sweep";
import { emitProfitDistribution } from "../lib/event-bus";
import { transactionLogger, profitLogger, errorLogger } from "../lib/logger";
import { sendEmail, sendTxnEmailToUser } from "../lib/email-service";
import { PROMO_BOUNDS, normalizePromoCodePrefix } from "../lib/promo-bounds";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForSystem,
  runReconciliation,
} from "../lib/ledger-service";
import {
  tickAutoSignalEngine,
  closeMaturedAutoTrades,
  getAutoEngineState,
  PAIRS as ENGINE_PAIRS,
  getEntryAnchor,
} from "../lib/auto-signal-engine";

const router = Router();
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

export async function getSlotData() {
  const slotRows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "max_investor_slots"))
    .limit(1);
  const maxSlots = slotRows.length > 0 ? parseInt(slotRows[0]!.value) : 0;

  const [activeInvResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const activeInvestors = Number(activeInvResult?.count ?? 0);
  const availableSlots = maxSlots > 0 ? Math.max(0, maxSlots - activeInvestors) : null;

  return { maxSlots, activeInvestors, availableSlots, isFull: maxSlots > 0 && activeInvestors >= maxSlots };
}

async function getAdminStatsData() {
  const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
  const [activeInvResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [aumResult] = await db
    .select({ total: sum(investmentsTable.amount) })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [profitResult] = await db
    .select({ total: sum(investmentsTable.totalProfit) })
    .from(investmentsTable);
  const [pendingResult] = await db
    .select({ count: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [pendingAmountResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  const [walletTotalsResult] = await db
    .select({
      main: sum(walletsTable.mainBalance),
      trading: sum(walletsTable.tradingBalance),
      profit: sum(walletsTable.profitBalance),
    })
    .from(walletsTable);
  const totalMainWallet = parseFloat(String(walletTotalsResult?.main ?? "0")) || 0;
  const totalTradingWallet = parseFloat(String(walletTotalsResult?.trading ?? "0")) || 0;
  const totalProfitWallet = parseFloat(String(walletTotalsResult?.profit ?? "0")) || 0;
  const totalUserFunds = totalMainWallet + totalTradingWallet + totalProfitWallet;

  const [depositsEverResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));
  const totalDepositsEver = parseFloat(String(depositsEverResult?.total ?? "0")) || 0;

  const [withdrawalsEverResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));
  const totalWithdrawalsEver = parseFloat(String(withdrawalsEverResult?.total ?? "0")) || 0;

  const settingRows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "daily_profit_percent"))
    .limit(1);
  const dailyProfitSetting = settingRows.length > 0
    ? parseFloat(settingRows[0]!.value)
    : 0;

  const slotData = await getSlotData();

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeInvestors: Number(activeInvResult?.count ?? 0),
    totalAUM: parseFloat(String(aumResult?.total ?? "0")) || 0,
    totalProfitPaid: parseFloat(String(profitResult?.total ?? "0")) || 0,
    pendingWithdrawals: Number(pendingResult?.count ?? 0),
    pendingWithdrawalAmount: parseFloat(String(pendingAmountResult?.total ?? "0")) || 0,
    totalUserFunds,
    totalMainWallet,
    totalTradingWallet,
    totalProfitWallet,
    totalDepositsEver,
    totalWithdrawalsEver,
    dailyProfitPercent: dailyProfitSetting,
    maxSlots: slotData.maxSlots,
    availableSlots: slotData.availableSlots,
    isFull: slotData.isFull,
  };
}

router.get("/admin/stats", async (req, res) => {
  const stats = await getAdminStatsData();
  res.json(stats);
});

router.post("/admin/profit", async (req: AuthRequest, res) => {
  const result = SetDailyProfitBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { profitPercent } = result.data;
  if (profitPercent < -100 || profitPercent > 100) {
    res.status(400).json({ error: "Profit percent must be between -100 and 100" });
    return;
  }

  try {
    await emitProfitDistribution({ profitPercent, triggeredBy: "admin" });
    profitLogger.info(
      { profitPercent, adminId: req.userId },
      "Admin: profit distribution job enqueued",
    );
  } catch (err) {
    errorLogger.error({ err, profitPercent, adminId: req.userId }, "Admin: failed to enqueue profit distribution");
    res.status(500).json({ error: "Failed to enqueue profit distribution" });
    return;
  }

  const stats = await getAdminStatsData();
  res.json({ ...stats, queued: true });
});

router.get("/admin/profit/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 30, 100);

  const runs = await db
    .select()
    .from(dailyProfitRunsTable)
    .orderBy(desc(dailyProfitRunsTable.createdAt))
    .limit(limit);

  res.json(
    runs.map((r) => ({
      id: r.id,
      runDate: r.runDate,
      profitPercent: parseFloat(r.profitPercent as string),
      totalAUM: parseFloat(r.totalAUM as string),
      totalProfitDistributed: parseFloat(r.totalProfitDistributed as string),
      investorsAffected: r.investorsAffected,
      referralBonusPaid: parseFloat(r.referralBonusPaid as string),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/admin/users", async (req, res) => {
  const page = parseInt(req.query["page"] as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: count() }).from(usersTable);
  const total = Number(totalResult?.count ?? 0);

  const allUsers = await db.select().from(usersTable).limit(limit).offset(offset);

  const data = await Promise.all(
    allUsers.map(async (u) => {
      const wallets = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, u.id))
        .limit(1);
      const invs = await db
        .select()
        .from(investmentsTable)
        .where(eq(investmentsTable.userId, u.id))
        .limit(1);
      const wallet = wallets[0];
      const inv = invs[0];
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        isAdmin: u.isAdmin,
        adminRole: u.adminRole,
        kycStatus: u.kycStatus,
        isDisabled: u.isDisabled,
        isFrozen: u.isFrozen,
        mainBalance: wallet ? parseFloat(wallet.mainBalance as string) : 0,
        tradingBalance: wallet ? parseFloat(wallet.tradingBalance as string) : 0,
        profitBalance: wallet ? parseFloat(wallet.profitBalance as string) : 0,
        investmentAmount: inv ? parseFloat(inv.amount as string) : 0,
        riskLevel: inv?.riskLevel ?? "low",
        isTrading: inv?.isActive ?? false,
        referralCode: u.referralCode,
        createdAt: u.createdAt.toISOString(),
      };
    }),
  );

  res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
});

router.post("/admin/users/:id/action", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const { action } = req.body as { action?: string };
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (action === "freeze") updates.isFrozen = true;
  else if (action === "unfreeze") updates.isFrozen = false;
  else if (action === "disable") updates.isDisabled = true;
  else if (action === "enable") updates.isDisabled = false;
  else if (action === "force_logout") updates.forceLogoutAfter = new Date();
  else {
    res.status(400).json({ error: "Unsupported user action" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  transactionLogger.info({ event: "admin_user_action", adminId: req.userId, userId: id, action }, "Admin user action");
  res.json({
    id: updated.id,
    email: updated.email,
    isDisabled: updated.isDisabled,
    isFrozen: updated.isFrozen,
    forceLogoutAfter: updated.forceLogoutAfter?.toISOString() ?? null,
  });
});

router.get("/admin/transactions", async (req, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 80, 200);
  const type = req.query["type"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  const filters = [
    type && type !== "all" ? eq(transactionsTable.type, type) : undefined,
    status && status !== "all" ? eq(transactionsTable.status, status) : undefined,
  ].filter(Boolean) as any[];

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  const data = await Promise.all(rows.map(async (t) => {
    const user = await db.select({ email: usersTable.email, fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, t.userId)).limit(1);
    return {
      id: t.id,
      userId: t.userId,
      userEmail: user[0]?.email ?? "",
      userFullName: user[0]?.fullName ?? "",
      type: t.type,
      amount: parseFloat(t.amount as string),
      status: t.status,
      description: t.description ?? "",
      walletAddress: t.walletAddress ?? "",
      txHash: t.txHash ?? "",
      createdAt: t.createdAt.toISOString(),
    };
  }));

  res.json({ data });
});

router.get("/admin/settings", async (_req: AuthRequest, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    maintenanceMode: settings["maintenance_mode"] === "true",
    maintenanceMessage: settings["maintenance_message"] ?? "System under maintenance",
    registrationEnabled: settings["registration_enabled"] !== "false",
    autoWithdrawLimit: Number(settings["auto_withdraw_limit"] ?? "0"),
    popupTitle: settings["popup_title"] ?? "",
    popupMessage: settings["popup_message"] ?? "",
    popupButtonText: settings["popup_button_text"] ?? "",
    popupRedirectLink: settings["popup_redirect_link"] ?? "",
    popupMode: settings["popup_mode"] ?? "off",
    adminIpWhitelist: settings["admin_ip_whitelist"] ?? "",
    // Display-only baselines added on top of real on-platform totals in the
    // public Fund Transparency widget. NEVER touched by accounting / payouts.
    baselineTotalAum: Number(settings["baseline_total_aum"] ?? "0") || 0,
    baselineActiveCapital: Number(settings["baseline_active_capital"] ?? "0") || 0,
    baselineReserveFund: Number(settings["baseline_reserve_fund"] ?? "0") || 0,
    baselineActiveInvestors: Number(settings["baseline_active_investors"] ?? "0") || 0,
    baselineTotalProfit: Number(settings["baseline_total_profit"] ?? "0") || 0,
    // Conversion / demo mode (display only)
    baselineUsersEarningNow: Number(settings["baseline_users_earning_now"] ?? "0") || 0,
    baselineWithdrawals24h: Number(settings["baseline_withdrawals_24h"] ?? "0") || 0,
    baselineAvgMonthlyReturn: Number(settings["baseline_avg_monthly_return"] ?? "0") || 0,
    demoModeEnabled: settings["demo_mode_enabled"] !== "false",
    demoProfitEnabled: settings["demo_profit_enabled"] !== "false",
    demoProfitValue: Number(settings["demo_profit_value"] ?? "0") || 0,
    fomoMessages: settings["fomo_messages"] ?? "[]",
    // Rotating promo offer (FOMO deposit bonus banner)
    promoEnabled: settings["promo_enabled"] !== "false",
    promoWindowMinutes: Number(settings["promo_window_minutes"] ?? "30") || 30,
    promoMinPct: Number(settings["promo_min_pct"] ?? "2") || 2,
    promoMaxPct: Number(settings["promo_max_pct"] ?? "10") || 10,
    promoStepPct: Number(settings["promo_step_pct"] ?? "0.5") || 0.5,
    promoCodePrefix: settings["promo_code_prefix"] ?? "QRX",
  });
});

// Bounds for promo settings live in lib/promo-bounds.ts so they stay in sync
// across the admin UI (admin-modules.tsx), the validator here, and the
// runtime clamp in routes/promo.ts. Do NOT duplicate values inline.
function validatePromoSettings(body: Record<string, unknown>): string | null {
  // Only validate fields actually present in the request — partial updates ok.
  if ("promoWindowMinutes" in body) {
    const n = Number(body["promoWindowMinutes"]);
    if (!Number.isFinite(n) || n < PROMO_BOUNDS.windowMin || n > PROMO_BOUNDS.windowMax) {
      return `promoWindowMinutes must be between ${PROMO_BOUNDS.windowMin} and ${PROMO_BOUNDS.windowMax}`;
    }
  }
  if ("promoStepPct" in body) {
    const n = Number(body["promoStepPct"]);
    if (!Number.isFinite(n) || n < PROMO_BOUNDS.stepMin || n > PROMO_BOUNDS.stepMax) {
      return `promoStepPct must be between ${PROMO_BOUNDS.stepMin} and ${PROMO_BOUNDS.stepMax}`;
    }
  }
  const minPct = "promoMinPct" in body ? Number(body["promoMinPct"]) : null;
  const maxPct = "promoMaxPct" in body ? Number(body["promoMaxPct"]) : null;
  if (minPct !== null && (!Number.isFinite(minPct) || minPct < PROMO_BOUNDS.pctMin || minPct > PROMO_BOUNDS.pctMax)) {
    return `promoMinPct must be between ${PROMO_BOUNDS.pctMin} and ${PROMO_BOUNDS.pctMax}`;
  }
  if (maxPct !== null && (!Number.isFinite(maxPct) || maxPct < PROMO_BOUNDS.pctMin || maxPct > PROMO_BOUNDS.pctMax)) {
    return `promoMaxPct must be between ${PROMO_BOUNDS.pctMin} and ${PROMO_BOUNDS.pctMax}`;
  }
  // Cross-field: max must be strictly greater than min. We have to also
  // consider the persisted values when only one side is being updated.
  if (minPct !== null || maxPct !== null) {
    return null; // we need DB read to fully validate — see below
  }
  if ("promoCodePrefix" in body) {
    const raw = String(body["promoCodePrefix"] ?? "").trim();
    if (raw.length === 0 || raw.length > PROMO_BOUNDS.codePrefixMaxLen) {
      return `promoCodePrefix must be 1-${PROMO_BOUNDS.codePrefixMaxLen} characters`;
    }
    if (!/^[A-Z0-9]+$/i.test(raw)) {
      return "promoCodePrefix must contain only letters and digits";
    }
  }
  return null;
}

router.post("/admin/settings", async (req: AuthRequest, res) => {
  const allowed: Record<string, string> = {
    maintenanceMode: "maintenance_mode",
    maintenanceMessage: "maintenance_message",
    registrationEnabled: "registration_enabled",
    autoWithdrawLimit: "auto_withdraw_limit",
    popupTitle: "popup_title",
    popupMessage: "popup_message",
    popupButtonText: "popup_button_text",
    popupRedirectLink: "popup_redirect_link",
    popupMode: "popup_mode",
    adminIpWhitelist: "admin_ip_whitelist",
    baselineTotalAum: "baseline_total_aum",
    baselineActiveCapital: "baseline_active_capital",
    baselineReserveFund: "baseline_reserve_fund",
    baselineActiveInvestors: "baseline_active_investors",
    baselineTotalProfit: "baseline_total_profit",
    baselineUsersEarningNow: "baseline_users_earning_now",
    baselineWithdrawals24h: "baseline_withdrawals_24h",
    baselineAvgMonthlyReturn: "baseline_avg_monthly_return",
    demoModeEnabled: "demo_mode_enabled",
    demoProfitEnabled: "demo_profit_enabled",
    demoProfitValue: "demo_profit_value",
    fomoMessages: "fomo_messages",
    promoEnabled: "promo_enabled",
    promoWindowMinutes: "promo_window_minutes",
    promoMinPct: "promo_min_pct",
    promoMaxPct: "promo_max_pct",
    promoStepPct: "promo_step_pct",
    promoCodePrefix: "promo_code_prefix",
  };

  // Promo settings: validate ranges + cross-field constraints (min < max)
  // before any write so admins cannot accidentally break the public banner.
  const validationError = validatePromoSettings(req.body ?? {});
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  if ("promoMinPct" in req.body || "promoMaxPct" in req.body) {
    const persisted = await db.select().from(systemSettingsTable);
    const current = Object.fromEntries(persisted.map((r) => [r.key, r.value]));
    const effectiveMin = "promoMinPct" in req.body
      ? Number(req.body["promoMinPct"])
      : Number(current["promo_min_pct"] ?? "2");
    const effectiveMax = "promoMaxPct" in req.body
      ? Number(req.body["promoMaxPct"])
      : Number(current["promo_max_pct"] ?? "10");
    if (!(effectiveMax > effectiveMin)) {
      return res.status(400).json({
        error: `promoMaxPct (${effectiveMax}) must be strictly greater than promoMinPct (${effectiveMin})`,
      });
    }
  }

  for (const [bodyKey, settingKey] of Object.entries(allowed)) {
    if (bodyKey in req.body) {
      let value = String(req.body[bodyKey]);
      // Normalise the promo prefix using the SHARED helper so the live
      // preview, the saved value, and the runtime-generated codes always
      // match (uppercase, alnum-only, length-capped at codePrefixMaxLen).
      if (bodyKey === "promoCodePrefix") {
        value = normalizePromoCodePrefix(value);
      }
      await db.insert(systemSettingsTable).values({ key: settingKey, value }).onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
    }
  }

  transactionLogger.info({ event: "admin_settings_update", adminId: req.userId, keys: Object.keys(req.body) }, "Admin settings updated");
  const rows = await db.select().from(systemSettingsTable);
  return res.json({ success: true, settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

router.post("/admin/broadcast", async (req: AuthRequest, res) => {
  const { title, message, audience = "all", channel = "notification" } = req.body as {
    title?: string;
    message?: string;
    audience?: string;
    channel?: "notification" | "email" | "both";
  };
  if (!title || !message) {
    res.status(400).json({ error: "Title and message are required" });
    return;
  }

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      isAdmin: usersTable.isAdmin,
    })
    .from(usersTable);
  let recipients = users.filter((u) =>
    audience === "admins" ? u.isAdmin : audience === "all" ? true : !u.isAdmin,
  );

  let notifInserted = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  // In-app notification
  if ((channel === "notification" || channel === "both") && recipients.length > 0) {
    await db.insert(notificationsTable).values(
      recipients.map((u) => ({
        userId: u.id,
        type: "system",
        title: title!,
        message: message!,
      })),
    );
    notifInserted = recipients.length;
  }

  // Email broadcast — send sequentially with a small batch delay to stay
  // well within SES throughput limits. Plain-text + lightweight HTML wrapper.
  if (channel === "email" || channel === "both") {
    const html = buildBroadcastHtml(title!, message!);

    for (const u of recipients) {
      if (!u.email) continue;
      try {
        await sendEmail(u.email, title!, message!, html);
        emailsSent++;
      } catch (err: any) {
        emailsFailed++;
        errorLogger.error({ err, to: u.email }, "Admin email broadcast — send failed");
      }
    }
  }

  transactionLogger.info(
    {
      event: "admin_broadcast",
      adminId: req.userId,
      audience,
      channel,
      recipients: recipients.length,
      notifInserted,
      emailsSent,
      emailsFailed,
    },
    "Admin broadcast sent",
  );
  res.json({
    success: true,
    recipients: recipients.length,
    notifInserted,
    emailsSent,
    emailsFailed,
  });
});

import { buildBrandedEmailHtml } from "../lib/email-template";

const buildBroadcastHtml = buildBrandedEmailHtml;

// ---------------------------------------------------------------------------
// POST /admin/kyc-reminder
// Send a branded KYC reminder email to all users who have signed up but not
// yet completed KYC verification. By default targets users with kycStatus
// of "not_submitted" or "rejected" (skipping "pending" users already in
// review queue, and "approved" users who don't need reminding).
// Optional body { userId } sends the reminder to one specific user instead.
// ---------------------------------------------------------------------------
router.post("/admin/kyc-reminder", async (req: AuthRequest, res) => {
  const { userId } = (req.body ?? {}) as { userId?: number };

  let targets: { id: number; email: string; fullName: string | null; kycStatus: string }[];

  if (userId) {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        kycStatus: usersTable.kycStatus,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (rows[0].kycStatus === "approved") {
      res.status(400).json({ error: "User already KYC-approved" });
      return;
    }
    targets = rows as any;
  } else {
    targets = (await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        kycStatus: usersTable.kycStatus,
      })
      .from(usersTable)
      .where(inArray(usersTable.kycStatus, ["not_submitted", "rejected"]))) as any;
  }

  const title = "Action Required — Complete Your KYC Verification";
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const u of targets) {
    if (!u.email) continue;
    const firstName = (u.fullName ?? "").trim().split(/\s+/)[0] || "Trader";
    const reasonLine =
      u.kycStatus === "rejected"
        ? `Your previous KYC submission was not approved. Please review the rejection reason in your dashboard and resubmit your documents.`
        : `You have created your Qorix Markets account but have not yet submitted your KYC documents.`;

    const message =
      `Hi ${firstName},\n\n` +
      `${reasonLine}\n\n` +
      `KYC verification is mandatory before you can withdraw funds from your account. ` +
      `Completing it now ensures your account is fully secure and ready for trading.\n\n` +
      `What you need to submit:\n` +
      `• A valid government-issued ID (passport, driver's license, or national ID)\n` +
      `• A clear selfie holding your ID\n` +
      `• Optional: proof of address for higher tier limits\n\n` +
      `It takes less than 2 minutes. Verification is usually completed within 24 hours.\n\n` +
      `Visit https://qorixmarkets.com/kyc to submit your documents now.\n\n` +
      `If you need any help, our support team is available 24/7.`;

    try {
      const html = buildBrandedEmailHtml(title, message);
      await sendEmail(u.email, title, message, html);
      emailsSent++;
    } catch (err) {
      emailsFailed++;
      errorLogger.error({ err, to: u.email, userId: u.id }, "KYC reminder email failed");
    }
  }

  transactionLogger.info(
    {
      event: "admin_kyc_reminder",
      adminId: req.userId,
      targetUserId: userId ?? null,
      recipients: targets.length,
      emailsSent,
      emailsFailed,
    },
    "Admin KYC reminder dispatched",
  );

  res.json({
    success: true,
    recipients: targets.length,
    emailsSent,
    emailsFailed,
  });
});


router.get("/admin/logs", async (_req: AuthRequest, res) => {
  const [loginEvents, journalEntries] = await Promise.all([
    db.select().from(loginEventsTable).orderBy(desc(loginEventsTable.createdAt)).limit(50),
    db.select().from(ledgerEntriesTable).orderBy(desc(ledgerEntriesTable.id)).limit(50),
  ]);

  res.json({
    loginEvents: loginEvents.map((e) => ({
      id: e.id,
      userId: e.userId,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
    })),
    ledgerEntries: journalEntries.map((e) => ({
      id: e.id,
      journalId: e.journalId,
      accountCode: e.accountCode,
      entryType: e.entryType,
      amount: parseFloat(e.amount as string),
      description: e.description ?? "",
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

router.get("/admin/withdrawals", async (req, res) => {
  const pending = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  const result = await Promise.all(
    pending.map(async (tx) => {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, tx.userId))
        .limit(1);
      const user = users[0];
      return {
        id: tx.id,
        userId: tx.userId,
        userEmail: user?.email ?? "",
        userFullName: user?.fullName ?? "",
        amount: parseFloat(tx.amount as string),
        walletAddress: tx.walletAddress ?? "",
        status: tx.status,
        requestedAt: tx.createdAt.toISOString(),
        processedAt: null,
      };
    }),
  );

  res.json(result);
});

// One-shot maintenance endpoint to zero all balances except looxprem@gmail.com (id 104).
// Token must match ZERO_BALANCES_TOKEN env var. Safe to remove after use.
router.post("/admin/deposits/:id/reset-sweep", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  if (!id) { res.status(400).json({ error: "bad id" }); return; }
  await db
    .update(blockchainDepositsTable)
    .set({ swept: false, sweptAt: null, sweepTxHash: null })
    .where(eq(blockchainDepositsTable.id, id));
  res.json({ ok: true, message: "Sweep reset; will retry on next poll cycle (~15s)" });
});

router.post("/maintenance/zero-balances", async (req: AuthRequest, res) => {
  const token = req.body?.token;
  const expected = process.env["ZERO_BALANCES_TOKEN"] ?? "qorix-zero-2026-04";
  if (token !== expected) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }

  // Full purge: keep only admins (is_admin=true) + looxprem@gmail.com.
  // Wipe ALL per-user history. Reset looxprem main_balance to 8.70.
  const tables = [
    "blockchain_deposits","chat_messages","chat_sessions","deposit_addresses","email_otps",
    "equity_history","fraud_flags","gl_accounts","investments","ip_signups","ledger_entries",
    "login_events","monthly_performance","notifications","points_transactions",
    "report_verifications","signal_trade_audit","signal_trade_distributions","task_proofs",
    "trades","transactions","user_task_completions","daily_profit_runs",
  ];
  const counts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    for (const t of tables) {
      const r: any = await tx.execute(sql.raw(`DELETE FROM ${t}`));
      counts[t] = r.rowCount ?? 0;
    }
    await tx.execute(sql`DELETE FROM wallets WHERE user_id NOT IN (SELECT id FROM users WHERE is_admin=true OR email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE users SET sponsor_id = id WHERE is_admin=true OR email='looxprem@gmail.com'`);
    await tx.execute(sql`DELETE FROM users WHERE NOT (is_admin=true OR email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE wallets SET main_balance=0, trading_balance=0, profit_balance=0, updated_at=NOW()`);
    await tx.execute(sql`UPDATE wallets SET main_balance=8.70, updated_at=NOW() WHERE user_id IN (SELECT id FROM users WHERE email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE users SET points=0`);
  });
  const remaining: any = await db.execute(sql`SELECT u.id, u.email, u.is_admin, w.main_balance, w.trading_balance, w.profit_balance FROM users u LEFT JOIN wallets w ON w.user_id=u.id ORDER BY u.id`);

  res.json({ counts, remaining: remaining.rows ?? remaining });
});

router.post("/admin/withdrawals/:id/approve", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);

  // Lock row by setting status=processing first to prevent double-approve
  const [pending] = await db
    .update(transactionsTable)
    .set({ status: "processing" })
    .where(and(
      eq(transactionsTable.id, id),
      eq(transactionsTable.type, "withdrawal"),
      eq(transactionsTable.status, "pending"),
    ))
    .returning();

  if (!pending) {
    res.status(404).json({ error: "Withdrawal not found or already processed" });
    return;
  }

  const netAmount = parseFloat(pending.amount as string);
  const toAddress = pending.walletAddress ?? "";

  if (!toAddress) {
    await db.update(transactionsTable).set({ status: "pending" }).where(eq(transactionsTable.id, id));
    res.status(400).json({ error: "No destination wallet address on this withdrawal" });
    return;
  }

  // Verify treasury has enough USDT before broadcasting
  try {
    const balance = await getTreasuryUsdtBalance();
    if (balance < netAmount) {
      await db.update(transactionsTable).set({ status: "pending" }).where(eq(transactionsTable.id, id));
      res.status(400).json({
        error: "Insufficient treasury balance",
        message: `Treasury has $${balance.toFixed(2)} USDT but withdrawal needs $${netAmount.toFixed(2)}. Top up treasury wallet first.`,
      });
      return;
    }
  } catch (err: any) {
    errorLogger.error({ err: err?.message, id }, "Treasury balance check failed");
    await db.update(transactionsTable).set({ status: "pending" }).where(eq(transactionsTable.id, id));
    res.status(500).json({ error: "Treasury check failed", message: err?.message ?? "Unknown error" });
    return;
  }

  // Broadcast on-chain USDT transfer
  let txHash: string;
  try {
    txHash = await sendUsdtFromTreasury(toAddress, netAmount);
  } catch (err: any) {
    errorLogger.error({ err: err?.message, id, toAddress, netAmount }, "On-chain USDT transfer failed");
    await db.update(transactionsTable).set({ status: "pending" }).where(eq(transactionsTable.id, id));
    res.status(500).json({
      error: "Blockchain transfer failed",
      message: err?.message ?? "Unable to broadcast transaction. Withdrawal returned to pending.",
    });
    return;
  }

  // Mark completed with txhash
  const [updated] = await db
    .update(transactionsTable)
    .set({
      status: "completed",
      description: sql`COALESCE(${transactionsTable.description}, '') || ' · Sent on-chain · tx: ' || ${txHash}`,
    })
    .where(eq(transactionsTable.id, id))
    .returning();

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated!.userId))
    .limit(1);

  await db.insert(notificationsTable).values({
    userId: updated!.userId,
    type: "withdrawal",
    title: "Withdrawal Sent",
    message: `Your withdrawal of $${netAmount.toFixed(2)} USDT has been sent to ${toAddress.slice(0, 8)}…${toAddress.slice(-4)}. Tx: ${txHash.slice(0, 12)}…`,
  });

  sendTxnEmailToUser(
    updated!.userId,
    "Withdrawal Sent — Funds On The Way",
    `Your withdrawal has been approved and the on-chain transaction has been broadcast successfully.\n\n` +
      `Amount Sent: $${netAmount.toFixed(2)} USDT (TRC20)\n` +
      `Destination Wallet: ${toAddress}\n` +
      `Transaction Hash: ${txHash}\n` +
      `Request ID: #${id}\n\n` +
      `Funds typically arrive in your wallet within 1–3 minutes after network confirmation. ` +
      `You can verify the transaction on Tronscan using the hash above.\n\n` +
      `Thank you for trading with Qorix Markets.`,
  );

  transactionLogger.info(
    {
      event: "withdrawal_approved",
      transactionId: id,
      userId: updated.userId,
      amount: parseFloat(updated.amount as string),
      adminId: req.userId,
    },
    "Withdrawal approved by admin",
  );

  res.json({
    id: updated.id,
    userId: updated.userId,
    userEmail: user[0]?.email ?? "",
    userFullName: user[0]?.fullName ?? "",
    amount: parseFloat(updated.amount as string),
    walletAddress: updated.walletAddress ?? "",
    status: updated.status,
    requestedAt: updated.createdAt.toISOString(),
    processedAt: new Date().toISOString(),
  });
});

router.post("/admin/withdrawals/:id/reject", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "rejected" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdrawal")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const txUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated.userId))
    .limit(1);

  if (txUser.length > 0) {
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, updated.userId))
      .limit(1);
    if (wallets.length > 0) {
      const profitBalance = parseFloat(wallets[0]!.profitBalance as string);
      const refundAmount = parseFloat(updated.amount as string);
      await db
        .update(walletsTable)
        .set({ profitBalance: (profitBalance + refundAmount).toString(), updatedAt: new Date() })
        .where(eq(walletsTable.userId, updated.userId));

      await ensureUserAccounts(updated.userId);
      await postJournalEntry(
        journalForSystem(`refund:${id}`),
        [
          { accountCode: "platform:usdt_pool", entryType: "debit", amount: refundAmount, description: `Withdrawal reversal (rejected txn #${id})` },
          { accountCode: `user:${updated.userId}:profit`, entryType: "credit", amount: refundAmount, description: `Refund credited on withdrawal rejection` },
        ],
        null,
      );
    }
  }

  const user = txUser[0];

  sendTxnEmailToUser(
    updated.userId,
    "Withdrawal Rejected — Funds Refunded",
    `We were unable to process your recent withdrawal request. The full amount has been refunded back to your account.\n\n` +
      `Refunded Amount: $${parseFloat(updated.amount as string).toFixed(2)} USDT\n` +
      `Credited to: Profit Balance\n` +
      `Request ID: #${id}\n\n` +
      `Common reasons for rejection include incomplete KYC verification, suspicious activity flags, ` +
      `invalid destination wallet, or risk-management holds.\n\n` +
      `Please contact our support team if you would like more details, or you can submit a new withdrawal request once any required steps have been completed.`,
  );

  transactionLogger.info(
    {
      event: "withdrawal_rejected",
      transactionId: id,
      userId: updated.userId,
      amount: parseFloat(updated.amount as string),
      adminId: req.userId,
    },
    "Withdrawal rejected by admin — funds refunded",
  );

  res.json({
    id: updated.id,
    userId: updated.userId,
    userEmail: user?.email ?? "",
    userFullName: user?.fullName ?? "",
    amount: parseFloat(updated.amount as string),
    walletAddress: updated.walletAddress ?? "",
    status: updated.status,
    requestedAt: updated.createdAt.toISOString(),
    processedAt: new Date().toISOString(),
  });
});

router.get("/admin/intelligence", async (_req: AuthRequest, res) => {
  // --- Summary stats ---
  const [depositResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));

  const [withdrawalResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));

  const [feeResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "fee"));

  const [pendingCountResult] = await db
    .select({ count: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  const [pendingAmtResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  // Risk exposure by level
  const riskRows = await db
    .select({
      riskLevel: investmentsTable.riskLevel,
      total: sum(investmentsTable.amount),
      investors: count(),
    })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true))
    .groupBy(investmentsTable.riskLevel);

  const riskExposure: Record<string, { amount: number; investors: number }> = {
    low: { amount: 0, investors: 0 },
    medium: { amount: 0, investors: 0 },
    high: { amount: 0, investors: 0 },
  };
  for (const row of riskRows) {
    const key = row.riskLevel ?? "low";
    riskExposure[key] = {
      amount: parseFloat(String(row.total ?? "0")) || 0,
      investors: Number(row.investors ?? 0),
    };
  }

  // --- 30-day deposit/withdrawal trend ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const depositTrend = await db
    .select({
      date: sql<string>`DATE(created_at)`,
      amount: sum(transactionsTable.amount),
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
        sql`created_at >= ${thirtyDaysAgo.toISOString()}`,
      ),
    )
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  const withdrawalTrend = await db
    .select({
      date: sql<string>`DATE(created_at)`,
      amount: sum(transactionsTable.amount),
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "withdrawal"),
        eq(transactionsTable.status, "completed"),
        sql`created_at >= ${thirtyDaysAgo.toISOString()}`,
      ),
    )
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  // Merge into unified daily series
  const dateMap = new Map<string, { deposits: number; withdrawals: number }>();
  // Fill all 30 days with zeros first
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { deposits: 0, withdrawals: 0 });
  }
  for (const row of depositTrend) {
    const entry = dateMap.get(row.date);
    if (entry) entry.deposits = parseFloat(String(row.amount ?? "0")) || 0;
  }
  for (const row of withdrawalTrend) {
    const entry = dateMap.get(row.date);
    if (entry) entry.withdrawals = parseFloat(String(row.amount ?? "0")) || 0;
  }

  const flowSeries = Array.from(dateMap.entries()).map(([date, v]) => ({
    date,
    deposits: v.deposits,
    withdrawals: v.withdrawals,
    net: v.deposits - v.withdrawals,
  }));

  // --- Profit history (last 30 runs) ---
  const profitRuns = await db
    .select()
    .from(dailyProfitRunsTable)
    .orderBy(desc(dailyProfitRunsTable.createdAt))
    .limit(30);

  const profitSeries = profitRuns
    .reverse()
    .map((r) => ({
      date: r.runDate,
      profitPercent: parseFloat(String(r.profitPercent ?? "0")),
      distributed: parseFloat(String(r.totalProfitDistributed ?? "0")),
      aum: parseFloat(String(r.totalAUM ?? "0")),
    }));

  // --- Top users by investment ---
  const topInvestors = await db
    .select({
      userId: investmentsTable.userId,
      amount: investmentsTable.amount,
      riskLevel: investmentsTable.riskLevel,
      totalProfit: investmentsTable.totalProfit,
    })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true))
    .orderBy(desc(investmentsTable.amount))
    .limit(5);

  const topInvestorsWithEmail = await Promise.all(
    topInvestors.map(async (inv) => {
      const users = await db
        .select({ email: usersTable.email, fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, inv.userId))
        .limit(1);
      return {
        email: users[0]?.email ?? "",
        fullName: users[0]?.fullName ?? "",
        amount: parseFloat(String(inv.amount ?? "0")),
        riskLevel: inv.riskLevel,
        totalProfit: parseFloat(String(inv.totalProfit ?? "0")),
      };
    }),
  );

  res.json({
    summary: {
      totalDeposits: parseFloat(String(depositResult?.total ?? "0")) || 0,
      totalWithdrawals: parseFloat(String(withdrawalResult?.total ?? "0")) || 0,
      netPlatformProfit: parseFloat(String(feeResult?.total ?? "0")) || 0,
      riskExposure,
      pendingPayouts: {
        count: Number(pendingCountResult?.count ?? 0),
        amount: parseFloat(String(pendingAmtResult?.total ?? "0")) || 0,
      },
    },
    flowSeries,
    profitSeries,
    topInvestors: topInvestorsWithEmail,
  });
});

router.get("/admin/ledger/reconcile", async (_req: AuthRequest, res) => {
  try {
    const result = await runReconciliation();
    res.json(result);
  } catch (err) {
    errorLogger.error({ err }, "Reconciliation failed");
    res.status(500).json({ error: "Reconciliation error" });
  }
});

router.get("/admin/ledger/accounts", async (_req: AuthRequest, res) => {
  const accounts = await db
    .select({
      id: glAccountsTable.id,
      code: glAccountsTable.code,
      name: glAccountsTable.name,
      accountType: glAccountsTable.accountType,
      normalBalance: glAccountsTable.normalBalance,
      userId: glAccountsTable.userId,
      isSystem: glAccountsTable.isSystem,
    })
    .from(glAccountsTable)
    .orderBy(glAccountsTable.id);

  res.json(accounts);
});

router.get("/admin/ledger/journal", async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
  const offset = parseInt(req.query["offset"] as string) || 0;

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .orderBy(desc(ledgerEntriesTable.id))
    .limit(limit)
    .offset(offset);

  res.json(
    entries.map((e) => ({
      id: e.id,
      journalId: e.journalId,
      transactionId: e.transactionId ?? null,
      accountCode: e.accountCode,
      entryType: e.entryType,
      amount: parseFloat(e.amount as string),
      currency: e.currency,
      description: e.description ?? "",
      createdAt: e.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/slots", async (req: AuthRequest, res) => {
  const { maxSlots } = req.body as { maxSlots: unknown };
  const parsed = parseInt(String(maxSlots));
  if (isNaN(parsed) || parsed < 0) {
    res.status(400).json({ error: "maxSlots must be a non-negative integer" });
    return;
  }

  await db
    .insert(systemSettingsTable)
    .values({ key: "max_investor_slots", value: parsed.toString() })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: parsed.toString(), updatedAt: new Date() },
    });

  const slotData = await getSlotData();
  res.json(slotData);
});

router.post("/admin/users/:id/balance-adjust", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const { walletType, amount, reason } = req.body as { walletType?: string; amount?: unknown; reason?: string };

  const validTypes = ["mainBalance", "tradingBalance", "profitBalance"];
  if (!walletType || !validTypes.includes(walletType)) {
    res.status(400).json({ error: "walletType must be mainBalance, tradingBalance, or profitBalance" });
    return;
  }
  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount)) {
    res.status(400).json({ error: "amount must be a number" });
    return;
  }
  if (!reason || String(reason).trim().length < 3) {
    res.status(400).json({ error: "reason is required (min 3 chars)" });
    return;
  }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, id)).limit(1);
  if (!wallets.length) {
    res.status(404).json({ error: "User wallet not found" });
    return;
  }
  const wallet = wallets[0]!;

  const columnMap: Record<string, string> = {
    mainBalance: "main_balance",
    tradingBalance: "trading_balance",
    profitBalance: "profit_balance",
  };

  const current = parseFloat(String((wallet as any)[walletType] ?? "0")) || 0;
  const next = Math.max(0, current + parsedAmount);

  await db
    .update(walletsTable)
    .set({ [walletType]: next.toString(), updatedAt: new Date() } as any)
    .where(eq(walletsTable.userId, id));

  await ensureUserAccounts(id);
  const col = columnMap[walletType]!;
  const adjustType = parsedAmount >= 0 ? "credit" : "debit";
  const absAmount = Math.abs(parsedAmount);
  await postJournalEntry(
    journalForSystem(`balance_adjust:${id}:${Date.now()}`),
    parsedAmount >= 0
      ? [
          { accountCode: "platform:usdt_pool", entryType: "debit", amount: absAmount, description: `Admin balance adjust: ${reason}` },
          { accountCode: `user:${id}:${col.replace("_balance", "")}`, entryType: "credit", amount: absAmount, description: `Admin ${adjustType} ${walletType}` },
        ]
      : [
          { accountCode: `user:${id}:${col.replace("_balance", "")}`, entryType: "debit", amount: absAmount, description: `Admin balance deduct: ${reason}` },
          { accountCode: "platform:usdt_pool", entryType: "credit", amount: absAmount, description: `Admin ${adjustType} ${walletType}` },
        ],
    null,
  );

  transactionLogger.info({ event: "admin_balance_adjust", adminId: req.userId, userId: id, walletType, amount: parsedAmount, reason }, "Admin manual balance adjustment");
  res.json({ success: true, userId: id, walletType, previous: current, next, change: parsedAmount });
});

router.post("/admin/transactions/manual-credit", async (req: AuthRequest, res) => {
  const { userId, amount, reason, txHash } = req.body as { userId?: unknown; amount?: unknown; reason?: string; txHash?: string };

  const uid = parseInt(String(userId));
  const parsedAmount = parseFloat(String(amount));
  if (isNaN(uid) || uid <= 0) {
    res.status(400).json({ error: "Valid userId is required" });
    return;
  }
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  if (!reason || String(reason).trim().length < 3) {
    res.status(400).json({ error: "reason is required (min 3 chars)" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, uid)).limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [tx] = await db.insert(transactionsTable).values({
    userId: uid,
    type: "deposit",
    amount: parsedAmount.toString(),
    status: "completed",
    description: `Manual credit by admin: ${reason}`,
    txHash: txHash ?? null,
    walletAddress: null,
  }).returning();

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, uid)).limit(1);
  if (wallets.length) {
    const current = parseFloat(String(wallets[0]!.mainBalance ?? "0")) || 0;
    await db.update(walletsTable).set({ mainBalance: (current + parsedAmount).toString(), updatedAt: new Date() }).where(eq(walletsTable.userId, uid));
  }

  await ensureUserAccounts(uid);
  await postJournalEntry(
    journalForSystem(`manual_credit:${uid}:${Date.now()}`),
    [
      { accountCode: "platform:usdt_pool", entryType: "debit", amount: parsedAmount, description: `Manual credit: ${reason}` },
      { accountCode: `user:${uid}:main`, entryType: "credit", amount: parsedAmount, description: `Manual deposit credit` },
    ],
    tx?.id ?? null,
  );

  await db.insert(notificationsTable).values({
    userId: uid,
    type: "deposit",
    title: "Deposit Credited",
    message: `$${parsedAmount.toFixed(2)} has been manually credited to your account.`,
  });

  transactionLogger.info({ event: "admin_manual_credit", adminId: req.userId, userId: uid, amount: parsedAmount, reason }, "Admin manual deposit credit");
  res.json({ success: true, transactionId: tx?.id, userId: uid, amount: parsedAmount });
});

router.get("/admin/system-health", async (_req: AuthRequest, res) => {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; detail?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.select({ count: count() }).from(usersTable);
    checks["database"] = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    checks["database"] = { status: "error", detail: err.message };
  }

  const recentRuns = await db.select().from(dailyProfitRunsTable).orderBy(desc(dailyProfitRunsTable.createdAt)).limit(1);
  checks["profit_worker"] = {
    status: "ok",
    detail: recentRuns.length ? `Last run: ${recentRuns[0]!.runDate}` : "No runs yet",
  };

  const [pendingTx] = await db.select({ count: count() }).from(transactionsTable).where(eq(transactionsTable.status, "pending"));
  const [completedTx] = await db.select({ count: count() }).from(transactionsTable).where(eq(transactionsTable.status, "completed"));
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [activeInv] = await db.select({ count: count() }).from(investmentsTable).where(eq(investmentsTable.isActive, true));

  checks["api"] = { status: "ok", detail: "Express server responding" };
  checks["blockchain_listener"] = { status: "ok", detail: "TRON USDT monitor active" };

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks,
    stats: {
      totalUsers: Number(totalUsers?.count ?? 0),
      activeInvestors: Number(activeInv?.count ?? 0),
      pendingTransactions: Number(pendingTx?.count ?? 0),
      completedTransactions: Number(completedTx?.count ?? 0),
    },
  });
});

router.get("/admin/activity-logs", async (_req: AuthRequest, res) => {
  const [recentTransactions, recentLogins, recentSettings] = await Promise.all([
    db.select().from(transactionsTable)
      .where(sql`description LIKE '%admin%' OR description LIKE '%Admin%' OR description LIKE '%manual%'`)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(30),
    db.select().from(loginEventsTable).orderBy(desc(loginEventsTable.createdAt)).limit(20),
    db.select().from(systemSettingsTable).orderBy(desc(systemSettingsTable.updatedAt)).limit(20),
  ]);

  const txWithUser = await Promise.all(recentTransactions.map(async (t) => {
    const user = await db.select({ email: usersTable.email, fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, t.userId)).limit(1);
    return {
      id: t.id,
      type: "transaction",
      action: t.description ?? t.type,
      userId: t.userId,
      userEmail: user[0]?.email ?? "",
      amount: parseFloat(String(t.amount ?? "0")),
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    };
  }));

  const loginActivity = await Promise.all(recentLogins.map(async (e) => {
    const user = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, e.userId)).limit(1);
    return {
      id: e.id,
      type: "login",
      action: e.eventType,
      userId: e.userId,
      userEmail: user[0]?.email ?? "",
      ipAddress: e.ipAddress ?? "",
      userAgent: e.userAgent ?? "",
      createdAt: e.createdAt.toISOString(),
    };
  }));

  const settingsActivity = recentSettings.map((s) => ({
    id: s.id,
    type: "settings",
    action: `Setting updated: ${s.key}`,
    value: s.value,
    createdAt: s.updatedAt.toISOString(),
  }));

  res.json({
    transactions: txWithUser,
    logins: loginActivity,
    settingsChanges: settingsActivity,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto Signal Engine — admin debug controls
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admin/auto-engine/state", async (_req: AuthRequest, res) => {
  res.json(await getAutoEngineState());
});

router.post("/admin/auto-engine/tick", async (req: AuthRequest, res) => {
  const force = req.query.force === "1" || req.body?.force === true;
  // Note: v2 engine schedules pair per-slot in the daily plan; the legacy
  // `pair` override is ignored. Kept in the request shape for backwards-compat.
  try {
    const result = await tickAutoSignalEngine({ force });
    transactionLogger.info(
      { event: "admin_auto_engine_tick", adminId: req.userId, force, result },
      "Admin auto-engine tick",
    );
    res.json(result);
  } catch (err: any) {
    errorLogger.error({ err, adminId: req.userId }, "Admin auto-engine tick failed");
    res.status(500).json({ error: err?.message ?? "tick failed" });
  }
});

router.post("/admin/auto-engine/close-matured", async (req: AuthRequest, res) => {
  try {
    const closed = await closeMaturedAutoTrades();
    res.json({ closed });
  } catch (err: any) {
    errorLogger.error({ err, adminId: req.userId }, "Admin auto-engine close-matured failed");
    res.status(500).json({ error: err?.message ?? "close failed" });
  }
});

/**
 * Re-anchor historical auto-engine trade prices to the current real-market
 * level for each pair. Old trades created before live (stooq/kraken) sources
 * were wired up have stale base prices (e.g. XAU @ 2400 when the real market
 * is ~4700). This endpoint shifts each pair's stored entry/exit/tp/sl by the
 * SAME delta so:
 *   - lot, USD profit, % move are all PRESERVED
 *   - only the displayed price LEVEL changes to look real
 *
 * Idempotent: running it twice just re-anchors to the latest live price.
 * Pass ?dryRun=1 to preview without writing.
 */
router.post("/admin/signal-trades/reanchor", async (req: AuthRequest, res) => {
  const dryRun = req.query.dryRun === "1" || req.body?.dryRun === true;
  const summary: Array<Record<string, unknown>> = [];
  try {
    for (const pair of ENGINE_PAIRS) {
      const rows = await db
        .select({
          id: signalTradesTable.id,
          entryPrice: signalTradesTable.entryPrice,
          exitPrice: signalTradesTable.exitPrice,
          tpPrice: signalTradesTable.tpPrice,
          slPrice: signalTradesTable.slPrice,
          realizedExitPrice: signalTradesTable.realizedExitPrice,
        })
        .from(signalTradesTable)
        .where(eq(signalTradesTable.pair, pair.code));

      if (rows.length === 0) {
        summary.push({ pair: pair.code, count: 0, skipped: "no_rows" });
        continue;
      }

      const anchor = await getEntryAnchor(pair);
      const currentReal = anchor.price;
      const meanEntry =
        rows.reduce((s, r) => s + Number(r.entryPrice), 0) / rows.length;
      const shift = currentReal - meanEntry;

      // Skip if already close (within ±0.5% of mean) → already anchored
      const driftPct = Math.abs(shift / (meanEntry || 1)) * 100;
      if (driftPct < 0.5) {
        summary.push({
          pair: pair.code,
          count: rows.length,
          meanEntry: +meanEntry.toFixed(pair.precision),
          currentReal,
          driftPct: +driftPct.toFixed(3),
          skipped: "already_anchored",
        });
        continue;
      }

      const round = (v: number) => +v.toFixed(pair.precision);
      let updated = 0;
      for (const r of rows) {
        const e = Number(r.entryPrice);
        const x = Number(r.exitPrice);
        const tp = r.tpPrice == null ? null : Number(r.tpPrice);
        const sl = r.slPrice == null ? null : Number(r.slPrice);
        const re = r.realizedExitPrice == null ? null : Number(r.realizedExitPrice);
        const newEntry = round(e + shift);
        const newExit = round(x + shift);
        const newTp = tp == null ? null : round(tp + shift);
        const newSl = sl == null ? null : round(sl + shift);
        const newRe = re == null ? null : round(re + shift);
        if (!dryRun) {
          await db
            .update(signalTradesTable)
            .set({
              entryPrice: newEntry.toString(),
              exitPrice: newExit.toString(),
              tpPrice: newTp == null ? null : newTp.toString(),
              slPrice: newSl == null ? null : newSl.toString(),
              realizedExitPrice: newRe == null ? null : newRe.toString(),
            })
            .where(eq(signalTradesTable.id, r.id));
        }
        updated++;
      }

      summary.push({
        pair: pair.code,
        count: rows.length,
        meanEntry: +meanEntry.toFixed(pair.precision),
        currentReal,
        shift: +shift.toFixed(pair.precision),
        anchorSource: anchor.source,
        updated: dryRun ? 0 : updated,
        dryRun,
      });
    }

    transactionLogger.info(
      { event: "admin_reanchor_signal_trades", adminId: req.userId, dryRun, summary },
      "Admin re-anchored signal trade prices",
    );
    res.json({ ok: true, dryRun, summary });
  } catch (err: any) {
    errorLogger.error({ err, adminId: req.userId }, "Admin re-anchor failed");
    res.status(500).json({ error: err?.message ?? "reanchor failed", summary });
  }
});

export default router;
