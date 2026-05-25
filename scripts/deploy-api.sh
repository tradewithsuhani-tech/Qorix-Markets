#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-api.sh — Deploy ONLY the API server (qorix-api) to Fly.io.
#
# Usage: bash scripts/deploy-api.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# ── Track step results ────────────────────────────────────────────────────────
STEP_PREFLIGHT="Pre-flight checks:fail"
STEP_BUILD="Build API server:fail"
STEP_DEPLOY="Deploy API → Fly.io:fail"
STEP_HEALTH="API health check:fail"

finish() {
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    print_summary "success" \
      "$STEP_PREFLIGHT" "$STEP_BUILD" "$STEP_DEPLOY" "$STEP_HEALTH"
  else
    print_summary "failed" \
      "$STEP_PREFLIGHT" "$STEP_BUILD" "$STEP_DEPLOY" "$STEP_HEALTH"
  fi
  total_timer_end
  exit $exit_code
}
trap finish EXIT

# ─────────────────────────────────────────────────────────────────────────────
log_header "Qorix Markets — Deploy API Server Only"
timer_start
cd "$REPO_ROOT"

# ── Step 1: Pre-flight ────────────────────────────────────────────────────────
step_timer_start
run_preflight_checks "api" || exit 1
STEP_PREFLIGHT="Pre-flight checks:pass"
step_timer_end "Pre-flight"

# ── Step 2: Build API locally to catch compile errors early ──────────────────
log_step "[1/3] Building API server (compile check)..."
step_timer_start

if pnpm --filter @workspace/api-server run build; then
  log_ok "API build succeeded locally"
  STEP_BUILD="Build API server:pass"
else
  log_fatal "API build FAILED — fix compile errors before deploying."
  STEP_BUILD="Build API server:fail"
  exit 3
fi
step_timer_end "API build"

# ── Step 3: Deploy API to Fly.io ─────────────────────────────────────────────
log_step "[2/3] Deploying API server → Fly.io (qorix-api)..."
step_timer_start
log_info "App:      qorix-api"
log_info "Region:   bom (Mumbai)"
log_info "Strategy: rolling"
log_divider

if flyctl deploy \
  --config artifacts/api-server/fly.toml \
  --dockerfile artifacts/api-server/Dockerfile \
  --remote-only \
  --depot=false \
  --strategy rolling \
  --wait-timeout 300; then
  log_ok "API deployed to Fly.io"
  STEP_DEPLOY="Deploy API → Fly.io:pass"
else
  log_fatal "API deploy FAILED — Fly.io reported an error."
  STEP_DEPLOY="Deploy API → Fly.io:fail"
  exit 4
fi
step_timer_end "Fly deploy"

# ── Step 4: Health check ──────────────────────────────────────────────────────
log_step "[3/3] API health check..."
step_timer_start

if check_api_health; then
  STEP_HEALTH="API health check:pass"
else
  log_warn "Health check failed — Fly may still be routing. Check manually:"
  log_info "  curl https://api.qorixmarkets.com/api/healthz"
  STEP_HEALTH="API health check:fail"
  exit 5
fi
step_timer_end "Health check"
