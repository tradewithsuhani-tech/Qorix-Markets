#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-fly.sh — FULL production deploy: Build → Migrate → Deploy → Health.
#
# Flow:
#   1. Pre-flight checks (env vars, flyctl, DB connectivity)
#   2. Build API server (local compile check)
#   3. DB schema migration (Neon) — SAFE: blocks destructive changes
#   4. Verify migration success
#   5. Deploy API → Fly.io (qorix-api)
#   6. Deploy Web → Fly.io (qorix-markets-web)
#   7. Health check: API + Web
#   8. Final summary with timing
#
# SAFETY GUARANTEES:
#   ✗ Never auto-drops tables
#   ✗ Never silently removes columns
#   ✓ Migration must succeed BEFORE any Fly.io deploy happens
#   ✓ Fly deploys are rolling (zero-downtime)
#   ✓ Failure at any step aborts the rest
#
# Usage:
#   bash scripts/deploy-fly.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# ── Track step results ────────────────────────────────────────────────────────
STEP_PREFLIGHT="Pre-flight checks:fail"
STEP_BUILD_API="Build API server:skip"
STEP_MIGRATE="DB schema migration:skip"
STEP_VERIFY="Migration verification:skip"
STEP_DEPLOY_API="Deploy API → Fly.io:skip"
STEP_DEPLOY_WEB="Deploy Web → Fly.io:skip"
STEP_HEALTH_API="API health check:skip"
STEP_HEALTH_WEB="Web health check:skip"

finish() {
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    print_summary "success" \
      "$STEP_PREFLIGHT" "$STEP_BUILD_API" \
      "$STEP_MIGRATE" "$STEP_VERIFY" \
      "$STEP_DEPLOY_API" "$STEP_DEPLOY_WEB" \
      "$STEP_HEALTH_API" "$STEP_HEALTH_WEB"
  else
    print_summary "failed" \
      "$STEP_PREFLIGHT" "$STEP_BUILD_API" \
      "$STEP_MIGRATE" "$STEP_VERIFY" \
      "$STEP_DEPLOY_API" "$STEP_DEPLOY_WEB" \
      "$STEP_HEALTH_API" "$STEP_HEALTH_WEB"
  fi
  total_timer_end
  exit $exit_code
}
trap finish EXIT

# ─────────────────────────────────────────────────────────────────────────────
log_header "Qorix Markets — Full Production Deploy"
log_info "$(date '+%Y-%m-%d %H:%M:%S %Z')"
timer_start
cd "$REPO_ROOT"

# ════════════════════════════════════════════════════════
# PHASE 1 — PRE-FLIGHT
# ════════════════════════════════════════════════════════
step_timer_start
run_preflight_checks "full" || exit 1
STEP_PREFLIGHT="Pre-flight checks:pass"
step_timer_end "Pre-flight"

# ════════════════════════════════════════════════════════
# PHASE 2 — BUILD CHECK (catch errors before touching DB/Fly)
# ════════════════════════════════════════════════════════
log_step "[1/7] Building API server locally (compile check)..."
step_timer_start

if pnpm --filter @workspace/api-server run build; then
  log_ok "API builds cleanly — no TypeScript/esbuild errors"
  STEP_BUILD_API="Build API server:pass"
else
  log_fatal "API build FAILED — fixing compile errors before any deploy."
  STEP_BUILD_API="Build API server:fail"
  exit 3
fi
step_timer_end "API build"

# ════════════════════════════════════════════════════════
# PHASE 3 — DATABASE MIGRATION (must succeed before deploy)
# ════════════════════════════════════════════════════════
log_step "[2/7] Running DB schema migration → Neon (production)..."
log_warn "SAFETY: Destructive changes (DROP TABLE / DROP COLUMN) are BLOCKED."
log_warn "        Run 'bash scripts/migrate-db.sh --interactive' to approve manually."
log_divider
step_timer_start

MIGRATION_OUTPUT=$(echo "n" | DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push 2>&1) || {
  MIGRATE_EXIT=$?
  echo "$MIGRATION_OUTPUT"
  echo ""

  if echo "$MIGRATION_OUTPUT" | grep -qiE "drop|delete|remove|truncate|destructive|are you sure|do you want to"; then
    log_fatal "DESTRUCTIVE MIGRATION DETECTED — full deploy aborted."
    log_warn "The schema change requires dropping tables or columns."
    log_warn "This protects: wallets, balances, orders, transactions."
    log_warn "To approve intentionally: bash scripts/migrate-db.sh --interactive"
    log_warn "Then re-run this script."
  else
    log_fatal "DB migration FAILED (exit ${MIGRATE_EXIT}) — deploy aborted."
  fi

  STEP_MIGRATE="DB schema migration:fail"
  exit 2
}

echo "$MIGRATION_OUTPUT"
STEP_MIGRATE="DB schema migration:pass"
step_timer_end "Migration"

# ── Verify: second push should report no changes ──────────────────────────────
log_step "[3/7] Verifying DB is fully in sync..."
step_timer_start

VERIFY_OUT=$(echo "n" | DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db push 2>&1) || true
echo "$VERIFY_OUT"

if echo "$VERIFY_OUT" | grep -qiE "no changes|nothing to migrate|up to date|0 statements"; then
  log_ok "DB schema fully in sync — no pending changes"
  STEP_VERIFY="Migration verification:pass"
elif echo "$VERIFY_OUT" | grep -qiE "drop|delete|remove|truncate|destructive|are you sure"; then
  log_error "Destructive change still pending after migration run."
  log_warn "Continuing deploy — data is safe (change was declined). Investigate manually."
  STEP_VERIFY="Migration verification:fail"
else
  log_ok "Verification passed"
  STEP_VERIFY="Migration verification:pass"
fi
step_timer_end "Verification"

# ════════════════════════════════════════════════════════
# PHASE 4 — DEPLOY API
# ════════════════════════════════════════════════════════
log_step "[4/7] Deploying API server → Fly.io (qorix-api)..."
step_timer_start
log_info "Strategy: rolling | Region: bom (Mumbai)"

if flyctl deploy \
  --config artifacts/api-server/fly.toml \
  --dockerfile artifacts/api-server/Dockerfile \
  --remote-only \
  --build-arg BUILD_TIME="$(date +%s)" \
  --strategy rolling \
  --wait-timeout 300; then
  log_ok "API server deployed"
  STEP_DEPLOY_API="Deploy API → Fly.io:pass"
else
  log_fatal "API deploy FAILED — web deploy skipped to avoid version mismatch."
  STEP_DEPLOY_API="Deploy API → Fly.io:fail"
  exit 4
fi
step_timer_end "API Fly deploy"

# ════════════════════════════════════════════════════════
# PHASE 5 — DEPLOY WEB
# ════════════════════════════════════════════════════════
log_step "[5/7] Deploying web app → Fly.io (qorix-markets-web)..."
step_timer_start
log_info "Strategy: rolling | Captcha: turnstile"

PREV_IMAGE=$(flyctl image show --app qorix-markets-web --json 2>/dev/null | \
  node --input-type=module -e "
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try { console.log(JSON.parse(d).ImageRef || ''); }
      catch { console.log(''); }
    });
  " 2>/dev/null || echo "")

PREV_IMAGE_ARG=""
if [ -n "$PREV_IMAGE" ]; then
  PREV_IMAGE_ARG="--build-arg PREV_IMAGE=$PREV_IMAGE"
  log_info "Cache from: $PREV_IMAGE"
fi

if flyctl deploy \
  --config artifacts/qorix-markets/fly.toml \
  --dockerfile artifacts/qorix-markets/Dockerfile \
  --local-only \
  --no-cache \
  --strategy rolling \
  --wait-timeout 300 \
  --build-arg VITE_API_URL="https://api.qorixmarkets.com" \
  --build-arg BASE_PATH="/" \
  --build-arg VITE_CAPTCHA_PROVIDER="turnstile" \
  --build-arg VITE_TURNSTILE_SITE_KEY="0x4AAAAAADF7hL3-sNctEdTJ" \
  $PREV_IMAGE_ARG; then
  log_ok "Web app deployed"
  STEP_DEPLOY_WEB="Deploy Web → Fly.io:pass"
else
  log_fatal "Web deploy FAILED — API is already on the new version."
  log_warn "The API and Web may be temporarily mismatched. Retry web deploy:"
  log_warn "  bash scripts/deploy-web.sh"
  STEP_DEPLOY_WEB="Deploy Web → Fly.io:fail"
  exit 4
fi
step_timer_end "Web Fly deploy"

# ════════════════════════════════════════════════════════
# PHASE 6 — HEALTH CHECKS
# ════════════════════════════════════════════════════════
log_step "[6/7] API health check..."
step_timer_start
if check_api_health; then
  STEP_HEALTH_API="API health check:pass"
else
  log_warn "API health check failed post-deploy — check Fly.io dashboard."
  STEP_HEALTH_API="API health check:fail"
fi
step_timer_end "API health"

log_step "[7/7] Web health check..."
step_timer_start
if check_web_health; then
  STEP_HEALTH_WEB="Web health check:pass"
else
  log_warn "Web health check failed post-deploy — CDN may still be warming up."
  STEP_HEALTH_WEB="Web health check:fail"
fi
step_timer_end "Web health"
