import cron from "node-cron";
import { db } from "@workspace/db";
import {
  promoRedemptionsTable,
  quizOauthRefreshTokensTable,
} from "@workspace/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { logger, profitLogger, errorLogger } from "./logger";
import { getLastDailyProfitPercent, sweepSignalProfitsToProfitWallet } from "./profit-service";
import { emitProfitDistribution } from "./event-bus";
import { tickAutoSignalEngine, closeMaturedAutoTrades, rehydrateAutoEngineState } from "./auto-signal-engine";
import { runEscalationTick } from "./escalation-cron";

const AUTO_ENGINE_ENABLED = (process.env.AUTO_SIGNAL_ENGINE_ENABLED ?? "1") !== "0";

const PROMO_REDEMPTION_TTL_HOURS = 24;

// ─── B36 follow-up: Qorixplay refresh-token cleanup sweep ─────────────
//
// The B36 rotation chain stores one row in `quiz_oauth_refresh_tokens`
// per refresh — long-lived (30d) but rotated on every use. Even after a
// row's `expires_at` passes, the row sits around forever; over months
// this table would grow unbounded with rows that have zero forensic or
// audit value (any plausible reuse-detection window is well under 7d).
//
// Sweep deletes rows whose `expires_at` is more than 7 days in the past.
// We keep the 7-day buffer (rather than deleting the moment a token
// expires) so:
//   • a forensic question like "did this user's session die at 02:14
//     last night?" is still answerable for a week, and
//   • the partial active-rows index in the schema only has to skip
//     true ancients, not freshly-expired-but-investigable rows.
//
// Idempotent — DELETE … WHERE expires_at < cutoff is naturally a no-op
// once the table is clean. Logged only when rows were actually removed
// to keep the daily logs quiet on small installs.
const REFRESH_TOKEN_RETENTION_DAYS = 7;

async function cleanupExpiredQuizRefreshTokens(): Promise<number> {
  const cutoff = new Date(
    Date.now() - REFRESH_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await db
    .delete(quizOauthRefreshTokensTable)
    .where(lt(quizOauthRefreshTokensTable.expiresAt, cutoff))
    .returning({ tokenHash: quizOauthRefreshTokensTable.tokenHash });
  return result.length;
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

  // Daily 03:00 UTC: prune Qorixplay refresh-token rows whose `expires_at`
  // is more than 7 days in the past. Off-peak time chosen so the DELETE
  // doesn't compete with the 00:00 UTC daily-profit distribution job.
  // Single-instance gating already happens upstream via RUN_BACKGROUND_JOBS
  // (see index.ts) — only the cron-owning machine ever calls this.
  cron.schedule("0 3 * * *", async () => {
    try {
      const removed = await cleanupExpiredQuizRefreshTokens();
      if (removed > 0) {
        logger.info(
          { removed, retentionDays: REFRESH_TOKEN_RETENTION_DAYS },
          "Cron: expired Qorixplay refresh tokens pruned",
        );
      }
    } catch (err) {
      errorLogger.error(
        { err },
        "Cron: failed to prune expired Qorixplay refresh tokens",
      );
    }
  });

  // Run once at startup so a server that has been down for a while
  // catches up on cleanup immediately instead of waiting for 03:00 UTC.
  // Failure here must NOT block boot — log and move on.
  void cleanupExpiredQuizRefreshTokens()
    .then((n) => {
      if (n > 0) {
        logger.info(
          { removed: n, retentionDays: REFRESH_TOKEN_RETENTION_DAYS },
          "Startup: expired Qorixplay refresh tokens pruned",
        );
      }
    })
    .catch((err) =>
      errorLogger.error(
        { err },
        "Startup: Qorixplay refresh-token cleanup sweep failed",
      ),
    );

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

  logger.info(
    "Cron: jobs registered — daily profit (00:00), monthly trading→profit sweep (25th 00:00), hourly promo expiry, daily Qorixplay refresh-token prune (03:00), INR escalation (every 1min)",
  );
  // Touch sql import so it isn't dropped by tooling — kept for future hourly maintenance jobs.
  void sql;
}
