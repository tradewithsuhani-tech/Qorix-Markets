/**
 * Admin module catalog — kept in sync with `MODULE_MAP` /
 * `SUPER_ONLY_MODULES` in `artifacts/api-server/src/middlewares/admin-rbac.ts`.
 *
 * Each entry maps a backend module slug to a friendly label + short
 * description for the Sub-Admin permission matrix UI. The slug is the
 * source of truth for what the backend gates on; labels are display-only.
 */
export interface AdminModule {
  slug: string;
  label: string;
  description: string;
  /** Reserved for super admins — never grantable to sub-admins. */
  superOnly?: boolean;
}

export const ADMIN_MODULES: readonly AdminModule[] = [
  { slug: "sub-admins",      label: "Sub-Admins",        description: "Promote / revoke sub-admins and assign module permissions.", superOnly: true },
  { slug: "audit-log",       label: "Audit Log",         description: "View every admin action across the platform.", superOnly: true },
  { slug: "dashboard",       label: "Dashboard",         description: "Platform stats, profit summaries, KPI tiles." },
  { slug: "users",           label: "Users",             description: "Browse, freeze, disable, and inspect user accounts." },
  { slug: "wallet",          label: "Wallet",            description: "Manual credits/debits, ledger, slot adjustments, balance fixes." },
  { slug: "transactions",    label: "Transactions",      description: "View and search the full transaction history." },
  { slug: "deposits",        label: "Deposits",          description: "Review crypto + INR deposits and on-chain detection." },
  { slug: "withdrawals",     label: "Withdrawals",       description: "Approve / reject crypto and INR withdrawal requests." },
  { slug: "payment-methods", label: "INR / Payments",    description: "Bank / UPI methods, INR→USDT rate, payment instructions." },
  { slug: "kyc",             label: "KYC",               description: "Review and approve user identity verification documents." },
  { slug: "fraud",           label: "Fraud Monitor",     description: "Multi-account, device, and IP fraud signals + flag review." },
  { slug: "intelligence",    label: "Intelligence",      description: "Cross-user analytics, cohort views, behaviour insights." },
  { slug: "trading",         label: "Trading",           description: "Auto-engine, manual trade controls, trade desk admin." },
  { slug: "signal-trades",   label: "Signal Trades",     description: "Publish / edit / cancel signal trades for users." },
  { slug: "subscriptions",   label: "Subscriptions",     description: "Manage paid subscription tiers and active subscribers." },
  { slug: "task-proofs",     label: "Task Proofs",       description: "Verify user-submitted task proofs and award points." },
  { slug: "communication",   label: "Communication",     description: "Email broadcasts, notifications, KYC reminders." },
  { slug: "content",         label: "Content",           description: "Public site content, banners, announcements." },
  { slug: "chats",           label: "Support Chats",     description: "Reply to user support conversations." },
  { slug: "system",          label: "System Settings",   description: "Global toggles, maintenance mode, system parameters." },
  { slug: "logs",            label: "Logs",              description: "Activity logs, system logs, debug output." },
  { slug: "hidden-features", label: "Hidden Features",   description: "Internal feature flags and experiments." },
  { slug: "test",            label: "Test Mode",         description: "Test-mode toggles and smoke-test utilities." },
];

/**
 * Modules that can be granted to a sub-admin. Excludes the two super-only
 * modules (sub-admins + audit-log) — the backend will reject any attempt
 * to grant these via `SUPER_ONLY_MODULES`.
 */
export const GRANTABLE_MODULES: readonly AdminModule[] = ADMIN_MODULES.filter(
  (m) => !m.superOnly,
);
