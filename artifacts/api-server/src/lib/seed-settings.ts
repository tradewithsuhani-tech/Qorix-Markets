import { db, systemSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// Public-facing display values for the Fund Transparency widget and the
// Conversion-Mode dashboard. These NEVER affect any user balance, P&L,
// accounting journal, or withdrawal logic — display only.
// Admins can edit these from /admin (System Control).
const DEFAULT_SETTINGS: Record<string, string> = {
  // Fund Transparency baselines (added on top of real on-platform numbers)
  baseline_total_aum: "500000",
  baseline_active_capital: "264000",
  baseline_reserve_fund: "513000",
  baseline_active_investors: "124",

  // Market indicators baselines (added on top of real numbers, shown on dashboard).
  // Keep these consistent with baseline_total_aum / baseline_active_investors so
  // the public numbers tell a coherent story (e.g. $500K AUM ÷ 124 investors ≈ $4K avg).
  baseline_users_earning_now: "87",
  baseline_withdrawals_24h: "12840",
  baseline_avg_monthly_return: "6.2",

  // Conversion / demo mode
  demo_mode_enabled: "true",
  demo_profit_value: "28.45",
  demo_profit_enabled: "true",

  // FOMO ticker — JSON array of short strings shown rotating on dashboard
  fomo_messages: JSON.stringify([
    "+3 investors joined today",
    "$2,140 invested in last 24h",
    "Strategy capacity 72% filled",
    "+5 withdrawals processed in last hour",
    "New investor from Mumbai just activated trading",
  ]),

  // Login popup (consumed by AdminPopup component)
  popup_mode: "once",
  popup_title: "🚀 Start Your Investment Journey",
  popup_message:
    "You are currently exploring demo performance.\n\nActivate live trading to start earning real profits.\n\nStart small. Scale anytime.",
  popup_button_text: "Start with $10",
  popup_redirect_link: "/deposit",
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
  void sql;
}
