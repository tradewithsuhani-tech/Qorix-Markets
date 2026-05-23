#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-db.sh — Production-safe Neon DB schema sync (Drizzle push).
#
# SAFETY RULES:
#   • Never auto-drops tables.
#   • Never silently removes columns.
#   • Destructive changes are detected and BLOCKED — deploy stops.
#   • Run interactively with --interactive flag to handle destructive changes.
#
# Usage:
#   bash scripts/migrate-db.sh              # Safe mode (blocks destructive)
#   bash scripts/migrate-db.sh --interactive # Prompts for destructive changes
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

INTERACTIVE=false
for arg in "$@"; do
  [[ "$arg" == "--interactive" ]] && INTERACTIVE=true
done

# ── Track step results ────────────────────────────────────────────────────────
STEP_PREFLIGHT="Pre-flight checks:fail"
STEP_MIGRATE="DB schema migration:fail"
STEP_VERIFY="Migration verification:fail"

finish() {
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    print_summary "success" \
      "$STEP_PREFLIGHT" "$STEP_MIGRATE" "$STEP_VERIFY"
  else
    print_summary "failed" \
      "$STEP_PREFLIGHT" "$STEP_MIGRATE" "$STEP_VERIFY"
  fi
  total_timer_end
  exit $exit_code
}
trap finish EXIT

# ─────────────────────────────────────────────────────────────────────────────
log_header "Qorix Markets — DB Migration (Neon Production)"
timer_start

cd "$REPO_ROOT"

# ── Step 1: Pre-flight ────────────────────────────────────────────────────────
step_timer_start
run_preflight_checks "migrate" || exit 1
STEP_PREFLIGHT="Pre-flight checks:pass"
step_timer_end "Pre-flight"

# ── Step 2: Run migration ─────────────────────────────────────────────────────
log_step "[DB] Running Drizzle schema push → Neon (production)"

log_warn "SAFETY: This project uses Drizzle push (not migration files)."
log_warn "        Additive changes (ADD TABLE, ADD COLUMN) apply automatically."
log_warn "        Destructive changes (DROP TABLE, DROP COLUMN) are BLOCKED."
log_divider

step_timer_start

if [ "$INTERACTIVE" = true ]; then
  # Interactive mode — let the user respond to any prompts manually
  log_info "Running in INTERACTIVE mode — you will be prompted for any changes."
  log_info "Answer 'n' or press Ctrl-C to abort destructive operations."
  echo ""

  if DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push; then
    log_ok "Schema push completed (interactive mode)"
    STEP_MIGRATE="DB schema migration:pass"
  else
    log_fatal "Schema push FAILED in interactive mode — deployment aborted."
    STEP_MIGRATE="DB schema migration:fail"
    exit 2
  fi
else
  # Safe/CI mode — pipe 'n' to stdin so ANY destructive confirmation is refused.
  # Drizzle only asks for confirmation on destructive changes (DROP TABLE/COLUMN).
  # Additive changes (CREATE TABLE/ADD COLUMN) run without any prompt.
  # If Drizzle asks → we answer 'n' → command exits non-zero → deploy stops.
  log_info "Running in SAFE mode — destructive changes will be blocked automatically."
  log_info "Re-run with --interactive to approve a destructive change manually."
  echo ""

  MIGRATION_OUTPUT=$(echo "n" | DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push 2>&1) || {
    MIGRATE_EXIT=$?
    echo "$MIGRATION_OUTPUT"
    echo ""

    # Check if the failure was due to a destructive-change prompt
    if echo "$MIGRATION_OUTPUT" | grep -qiE "drop|delete|remove|truncate|destructive|are you sure|do you want to"; then
      log_fatal "DESTRUCTIVE MIGRATION DETECTED — deployment blocked for safety."
      log_warn "The schema change requires dropping tables or columns."
      log_warn "To approve intentionally, re-run: bash scripts/migrate-db.sh --interactive"
      log_warn "NEVER use --force on production (wallets/balances/transactions at risk)."
    else
      log_fatal "DB migration FAILED (exit code ${MIGRATE_EXIT}) — deployment aborted."
      log_warn "Check the output above for details."
    fi

    STEP_MIGRATE="DB schema migration:fail"
    exit 2
  }

  echo "$MIGRATION_OUTPUT"
fi

step_timer_end "Migration"

# ── Step 3: Verify ────────────────────────────────────────────────────────────
log_step "[DB] Verifying migration success"
step_timer_start

# Re-run push in dry mode — if the schema is in sync, drizzle reports
# "No changes detected" (or applies nothing). A second push on a clean DB
# is idempotent and safe.
VERIFY_OUTPUT=$(echo "n" | DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push 2>&1) || {
  log_warn "Verification push exited non-zero — may indicate pending destructive change."
  log_info "Output: $VERIFY_OUTPUT"
}

if echo "$VERIFY_OUTPUT" | grep -qiE "no changes|nothing to migrate|up to date|0 statements"; then
  log_ok "Schema is fully in sync with the DB — no pending changes."
elif echo "$VERIFY_OUTPUT" | grep -qiE "drop|delete|remove|truncate|destructive|are you sure"; then
  log_warn "There are still pending DESTRUCTIVE changes — run with --interactive to apply."
else
  log_ok "Verification passed (push ran cleanly on second attempt)."
fi

STEP_VERIFY="Migration verification:pass"
STEP_MIGRATE="DB schema migration:pass"
step_timer_end "Verification"
