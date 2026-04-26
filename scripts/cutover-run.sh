#!/usr/bin/env bash
# =============================================================================
# EMERGENCY-ONLY one-shot DB cutover executor.
#
# Cutover #41 (Replit/Neon-US -> Neon Singapore) is COMPLETE as of
# 2026-04-26 13:43 UTC. This script is retained ONLY as a reference /
# disaster-recovery shortcut. The canonical Phase B procedure in
# MUMBAI_DB_CUTOVER_RUNBOOK.md is MANUAL with human checkpoints between
# each step (scale-to-zero, dump, restore, sequence reset, verify, secret
# set, smoke). Do NOT use this script for routine planned cutovers; it
# bypasses those checkpoints and will hide problems that the runbook is
# designed to catch.
#
# If you must run this in an emergency:
#   1. Confirm qorix-api is scaled to 0 (writes frozen) FIRST.
#   2. Have the runbook open and stop the script if any step prints an
#      unexpected diff or row-count mismatch.
#   3. Re-read MUMBAI_DB_CUTOVER_RUNBOOK.md "Cutover actuals" before
#      reusing — Replit-managed Postgres quirks (restricted _system
#      schema, search_path) may not apply to the next source DB.
# =============================================================================
set -euo pipefail

if [[ -z "${PROD_DATABASE_URL:-}" || -z "${NEON_DATABASE_URL:-}" ]]; then
  echo "FATAL: PROD_DATABASE_URL or NEON_DATABASE_URL not set" >&2
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="/tmp/qorix-cutover-${TS}.dump"
LOG="/tmp/cutover-run-${TS}.log"

echo "[$(date -u +%T)] === CUTOVER START ts=${TS} ==="
echo "[$(date -u +%T)] dump file: ${DUMP}"
echo "[$(date -u +%T)] log file:  ${LOG}"

echo "[$(date -u +%T)] step 1/5: pg_dump from PROD (data-only, public schema only, custom format, -Z 6)..."
# --schema=public excludes the Replit-managed _system schema (only present on
# Replit-hosted Neon DBs); the target Neon DB does not have it and including
# it would make pg_restore exit with 'schema "_system" does not exist'.
pg_dump "$PROD_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --data-only \
  --schema=public \
  --file="$DUMP" 2>&1 | tee -a "$LOG"
ls -lh "$DUMP" | tee -a "$LOG"

echo "[$(date -u +%T)] step 2/5: TRUNCATE all NEON public tables (CASCADE, restart identity)..."
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  do \$\$
  declare r record;
  begin
    for r in
      select tablename from pg_tables where schemaname = 'public'
    loop
      execute format('truncate table %I restart identity cascade;', r.tablename);
    end loop;
  end \$\$;
" 2>&1 | tee -a "$LOG"

echo "[$(date -u +%T)] step 3/5: pg_restore into NEON (data-only, --exit-on-error, -j 4)..."
pg_restore \
  --dbname="$NEON_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --data-only \
  --jobs=4 \
  --exit-on-error \
  "$DUMP" 2>&1 | tee -a "$LOG"

echo "[$(date -u +%T)] step 4/5: reset all serial sequences on NEON..."
# Schema-qualify everything: NEON's default search_path is empty (unlike
# Replit-managed Neon which sets it to public), so unqualified "users" in
# 'select max(id) from users' fails with 'relation does not exist'.
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "
  select format(
    'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from public.%I), 1), true);',
    'public.' || table_name, column_name, column_name, table_name
  )
  from information_schema.columns
  where table_schema = 'public'
    and column_default like 'nextval(%';
" | psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -f - 2>&1 | tee -a "$LOG" | tail -5

echo "[$(date -u +%T)] step 5/5: verify-db-cutover (counts + wallet decrypt)..."
pnpm --filter @workspace/scripts run verify-db-cutover \
  -- --source "$PROD_DATABASE_URL" \
     --target "$NEON_DATABASE_URL" 2>&1 | tee -a "$LOG"

echo "[$(date -u +%T)] === CUTOVER LOAD COMPLETE — verify above for PASS ==="
echo "Saved log: $LOG"
echo "Saved dump: $DUMP"
