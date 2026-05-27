import cron from "node-cron";
import { db, dailyProfitRunsTable } from "@workspace/db";
import {
  promoRedemptionsTable,
  systemSettingsTable,
} from "@workspace/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { logger, profitLogger, errorLogger } from "./logger";
import { sweepSignalProfitsToProfitWallet, distributeAutoDailyProfit } from "./profit-service";
import { generateAllRiskSchedules, ensureCurrentMonthSchedules } from "./monthly-schedule-service";
import { tickAutoSignalEngine, closeMaturedAutoTrades, rehydrateAutoEngineState } from "./auto-signal-engine";
import { runEscalationTick } from "./escalation-cron";
import { chatFollowupTick } from "../workers/chat-followup-worker";
import { chatFollowup2Tick } from "../workers/chat-followup2-worker";
import { expireStaleP2POrders } from "./p2p-expiry";

const AUTO_ENGINE_ENABLED = (process.env.AUTO_SIGNAL_ENGINE_ENABLED ?? "1") !== "0";

const PROMO_REDEMPTION_TTL_HOURS = 24;

/** Returns true only when admin has explicitly enabled ROI auto-run via system_settings. */
async function isRoiAutoRunEnabled(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "roi_auto_run"))
      .limit(1);
    return row?.value === "true";
  } catch {
    return false;
  }
}

async function expireStalePromoRedemptions(): Promise<number> {
  const cutoff = new Date(Date.now() - PROMO_REDEMPTION_TTL_HOURS * 60 * 60 * 1000);
  const result = await db
    .update(promoRedemptionsTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(promoRedemptionsTable.status, "redeemed"),
        isNull(promoRedemptionsTable.creditedAt),
        lt(promoRedemptionsTable.redeemedAt, cutoff),
      ),
    )
    .returning({ id: promoRedemptionsTable.id, userId: promoRedemptionsTable.userId });
  return result.length;
}

export async function initCronJobs(): Promise<void> {
  // Auto daily profit accrual — runs every weekday (Mon–Fri) at 00:05 UTC
  // (5 min past midnight avoids node-cron "missed execution" at boundary).
  // Credits each active investment its pre-seeded NAV daily rate for that
  // risk bucket. The NAV engine is always authoritative — no admin override
  // bypass in this path (monthly targets are set via /admin/roi-schedule).
  cron.schedule("5 0 * * 1-5", async () => {
    const roiEnabled = await isRoiAutoRunEnabled();
    if (!roiEnabled) {
      profitLogger.info("Cron: daily profit accrual SKIPPED — roi_auto_run is not enabled (set to true in system_settings to activate)");
      return;
    }
    profitLogger.info("Cron: daily profit accrual — starting");
    try {
      const result = await distributeAutoDailyProfit();
      profitLogger.info(result, "Cron: auto daily profit accrual complete");
    } catch (err) {
      errorLogger.error({ err }, "Cron: failed to run daily profit accrual");
    }
  });

  cron.schedule("0 0 25 * *", async () => {
    logger.info("Cron: monthly trading→profit sweep starting");
    try {
      const result = await sweepSignalProfitsToProfitWallet();
      logger.info(
        {
          usersProcessed: result.usersProcessed,
          totalTransferred: result.totalTransferred,
        },
        "Cron: monthly trading→profit sweep complete",
      );
    } catch (err) {
      errorLogger.error({ err }, "Cron: monthly trading→profit sweep failed");
    }
  });

  // Generate next month's rate schedule on the last day of each month at 23:50 UTC
  // so it's ready before the 1st-of-month profit run fires.
  cron.schedule("50 23 28-31 * *", async () => {
    const now = new Date();
    // Only run on the actual last day of the month.
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    if (now.getUTCDate() !== lastDay) return;
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const nextYM = nextMonth.toISOString().slice(0, 7)!;
    profitLogger.info({ nextYM }, "Cron: generating next month's ROI rate schedule");
    try {
      const results = await generateAllRiskSchedules(nextYM);
      profitLogger.info({ nextYM, results }, "Cron: next month's ROI rate schedule generated");
    } catch (err) {
      errorLogger.error({ err, nextYM }, "Cron: failed to generate next month's ROI rate schedule");
    }
  });

  // Also ensure the current month's schedule exists on the 1st of each month
  // (catches the case where the end-of-month job missed or was redeployed).
  cron.schedule("0 1 1 * *", async () => {
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7)!;
    profitLogger.info({ yearMonth }, "Cron: ensuring current month's ROI rate schedule");
    try {
      await ensureCurrentMonthSchedules();
    } catch (err) {
      errorLogger.error({ err }, "Cron: failed to ensure current month's ROI rate schedule");
    }
  });

  // Hourly: expire stale promo redemptions (>24h old, never credited).
  // Frees up the UNIQUE(user_id) slot so the user can redeem a fresh offer.
  cron.schedule("0 * * * *", async () => {
    try {
      const expiredCount = await expireStalePromoRedemptions();
      if (expiredCount > 0) {
        logger.info({ expiredCount }, "Cron: promo redemptions expired");
      }
    } catch (err) {
      errorLogger.error({ err }, "Cron: failed to expire stale promo redemptions");
    }
  });

  // Run once at startup so any redemptions left stale across a restart get cleaned up immediately.
  void expireStalePromoRedemptions()
    .then((n) => {
      if (n > 0) logger.info({ expiredCount: n }, "Startup: promo redemptions expired");
    })
    .catch((err) => errorLogger.error({ err }, "Startup: promo expiry sweep failed"));

  // Auto Signal Engine — daily plan of 25 trades (12:30→20:30 UTC, 8h window)
  // Tick every minute: each tick executes the earliest pending-and-due slot.
  // Legacy closer kept for any v1 running trades.
  if (AUTO_ENGINE_ENABLED) {
    // Restore today's plan (or create it) so executed slots aren't duplicated
    // after a server restart.
    await rehydrateAutoEngineState().catch((err) =>
      errorLogger.error({ err }, "Startup: auto-engine rehydrate failed"),
    );

    cron.schedule("* * * * *", async () => {
      try {
        await tickAutoSignalEngine();
      } catch (err) {
        errorLogger.error({ err }, "Cron: auto-signal-engine tick failed");
      }
    });

    cron.schedule("* * * * *", async () => {
      try {
        await closeMaturedAutoTrades();
      } catch (err) {
        errorLogger.error({ err }, "Cron: auto-signal-engine closer failed");
      }
    });

    logger.info("Cron: auto-signal-engine v2 registered — tick + closer every 1min");
  } else {
    logger.info("Cron: auto-signal-engine DISABLED via AUTO_SIGNAL_ENGINE_ENABLED=0");
  }

  // Every minute: walk pending INR deposits/withdrawals and fire escalation
  // calls (merchant at 10min, admin at 15min). Idempotent — uses
  // escalatedToMerchantAt/escalatedToAdminAt timestamps to skip already-fired
  // steps so we don't spam recipients on every tick.
  cron.schedule("* * * * *", async () => {
    try {
      await runEscalationTick();
    } catch (err) {
      errorLogger.error({ err }, "Cron: INR escalation tick failed");
    }
  });

  // Every minute: scan chat_leads for unsent follow-ups whose delay window
  // has elapsed. Idempotent at the row level — chatFollowupTick stamps
  // follow_up_sent_at BEFORE sending so a second instance can't double-deliver.
  // No-ops fast when chat_settings.email_followup.enabled = false (default).
  cron.schedule("* * * * *", async () => {
    try {
      await chatFollowupTick();
    } catch (err) {
      errorLogger.error({ err }, "Cron: chat follow-up tick failed");
    }
  });

  // Batch L: every minute, scan chat_leads that already had the first
  // auto-nudge and still haven't converted/unsubscribed N hours later
  // (default 72h). Hard-capped at 2 total attempts via
  // follow_up_attempts < 2. Same idempotency guarantees as the first
  // worker — atomic UPDATE with attempts=1 in the WHERE blocks
  // double-sends across instances. No-ops fast when
  // chat_settings.email_followup.followup2.enabled = false (default).
  cron.schedule("* * * * *", async () => {
    try {
      await chatFollowup2Tick();
    } catch (err) {
      errorLogger.error({ err }, "Cron: chat follow-up #2 tick failed");
    }
  });

  logger.info(
    "Cron: jobs registered — daily profit (00:00), monthly trading→profit sweep (25th 00:00), hourly promo expiry, INR escalation (every 1min), chat lead follow-up (every 1min), chat lead 2nd nudge (every 1min)",
  );
  // Touch sql import so it isn't dropped by tooling — kept for future hourly maintenance jobs.
  void sql;

  // ── P2P order auto-expiry — runs every minute ──
  // Scans for pending P2P orders whose paymentDeadline has passed and
  // auto-cancels them, releasing seller's USDT back to the ad. Without
  // this job, abandoned orders would permanently lock seller funds.
  cron.schedule("* * * * *", async () => {
    try {
      await expireStaleP2POrders();
    } catch (err) {
      errorLogger.error({ err }, "Cron: p2p order expiry sweep failed");
    }
  });

  // ── Startup catch-up: run today's profit if server restarted after 00:05 UTC ──
  // node-cron only fires at the scheduled wall-clock time. If the server
  // restarts (deploy, OOM, Fly machine migration) after 00:05 UTC on a
  // weekday, the scheduled tick is missed for that day. This catch-up runs
  // once at startup: if today is Mon–Fri, current UTC time is past 00:05,
  // and no daily_profit_runs row exists for today, it distributes profit
  // automatically — exactly as the cron would have done.
  void catchUpTodaysProfitIfMissed();
  // Ensure this month's rate schedule exists at startup (idempotent).
  void ensureCurrentMonthSchedules()
    .then(() => profitLogger.info("Startup: monthly ROI rate schedule ensured"))
    .catch((err) => errorLogger.error({ err }, "Startup: failed to ensure monthly ROI rate schedule"));
}

async function catchUpTodaysProfitIfMissed(): Promise<void> {
  try {
    // Guard: only run if admin has explicitly enabled ROI auto-run
    const roiEnabled = await isRoiAutoRunEnabled();
    if (!roiEnabled) {
      profitLogger.info("Startup catch-up: SKIPPED — roi_auto_run is not enabled");
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    // Only catch up if the 00:05 UTC cron window has already passed
    if (utcHour === 0 && utcMinute < 5) return;

    const todayStr = now.toISOString().split("T")[0]!;

    const existing = await db
      .select({ id: dailyProfitRunsTable.id })
      .from(dailyProfitRunsTable)
      .where(eq(dailyProfitRunsTable.runDate, todayStr))
      .limit(1);

    if (existing.length > 0) {
      profitLogger.info({ runDate: todayStr }, "Startup catch-up: today's profit already distributed — skipping");
      return;
    }

    profitLogger.info({ runDate: todayStr }, "Startup catch-up: today's profit was missed — distributing now");
    const result = await distributeAutoDailyProfit();
    profitLogger.info(result, "Startup catch-up: auto daily profit distribution complete");
  } catch (err) {
    errorLogger.error({ err }, "Startup catch-up: failed to run daily profit distribution");
  }
}
