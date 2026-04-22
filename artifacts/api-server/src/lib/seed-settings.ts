import { db, systemSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Default public-facing baselines for the Fund Transparency widget. These are
// added on top of real on-platform numbers, never affect any user balance,
// P&L, accounting journal, or withdrawal logic — display only.
// Admins can edit these from /admin (System Control → Fund Transparency Baselines).
const DEFAULT_SETTINGS: Record<string, string> = {
  baseline_total_aum: "500000",
  baseline_active_capital: "264000",
  baseline_reserve_fund: "513000",
  baseline_active_investors: "0",
};

export async function seedSystemSettings(): Promise<void> {
  try {
    const rows = await db
      .insert(systemSettingsTable)
      .values(
        Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })),
      )
      .onConflictDoNothing({ target: systemSettingsTable.key })
      .returning({ key: systemSettingsTable.key });

    if (rows.length > 0) {
      logger.info(
        { seeded: rows.map((r) => r.key) },
        "[seed-settings] system_settings defaults inserted",
      );
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[seed-settings] failed");
  }
  // Touch sql import so unused warning doesn't fire across builds
  void sql;
}
