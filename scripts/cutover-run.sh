#!/usr/bin/env bash
# One-shot cutover executor. Runs ONLY after qorix-api is scaled to 0
# (writes frozen). Dumps PROD -> restores NEON -> resets sequences ->
# runs verify-db-cutover. Exits non-zero on any failure so the operator
# sees a stop-the-line clearly.
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

echo "[$(date -u +%T)] step 1/5: pg_dump from PROD (data-only, custom format, -Z 6)..."
pg_dump "$PROD_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --data-only \
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
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "
  select format(
    'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from %I), 1), true);',
    table_name, column_name, column_name, table_name
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
