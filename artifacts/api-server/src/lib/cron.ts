import cron from "node-cron";
import { db } from "@workspace/db";
import {
  promoRedemptionsTable,
} from "@workspace/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { logger, profitLogger, errorLogger } from "./logger";
import { getLastDailyProfitPercent, sweepSignalProfitsToProfitWallet } from "./profit-service";
import { emitProfitDistribution } from "./event-bus";
import { tickAutoSignalEngine, closeMaturedAutoTrades, rehydrateAutoEngineState } from "./auto-signal-engine";
import { runEscalationTick } from "./escalation-cron";
import { chatFollowupTick } from "../workers/chat-followup-worker";

const AUTO_ENGINE_ENABLED = (process.env.AUTO_SIGNAL_ENGINE_ENABLED ?? "1") !== "0";

const PROMO_REDEMPTION_TTL_HOURS = 24;

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
  cron.schedule("0 0 * * *", async () => {
    profitLogger.info("Cron: daily profit distribution — enqueuing job");
    try {
      const profitPercent = await getLastDailyProfitPercent();
      if (profitPercent === 0) {
        profitLogger.info("Cron: daily profit distribution skipped — no profit rate configured");
        return;
      }
      await emitProfitDistribution({ profitPercent, triggeredBy: "cron" });
      profitLogger.info({ profitPercent }, "Cron: profit distribution job enqueued");
    } catch (err) {
      errorLogger.error({ err }, "Cron: failed to enqueue daily profit distribution");
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

  logger.info(
    "Cron: jobs registered — daily profit (00:00), monthly trading→profit sweep (25th 00:00), hourly promo expiry, INR escalation (every 1min), chat lead follow-up (every 1min)",
  );
  // Touch sql import so it isn't dropped by tooling — kept for future hourly maintenance jobs.
  void sql;
}
