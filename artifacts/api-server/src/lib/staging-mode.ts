import { logger } from "./logger";

let warned = false;

export function isStagingMode(): boolean {
  return process.env.STAGING_MODE === "true" || process.env.STAGING_MODE === "1";
}

export function logStagingSkip(component: string): void {
  if (!warned) {
    logger.warn(
      "[staging-mode] STAGING_MODE=true — background workers, watchers, and crons are DISABLED. " +
        "This server will NOT mutate shared resources (Tron deposits, auto-trades, profit distribution, Telegram).",
    );
    warned = true;
  }
  logger.info({ component }, "[staging-mode] component skipped");
}
