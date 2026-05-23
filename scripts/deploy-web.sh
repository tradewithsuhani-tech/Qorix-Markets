#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-web.sh — Deploy ONLY the web app (qorix-markets-web) to Fly.io.
#
# Usage: bash scripts/deploy-web.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# ── Track step results ────────────────────────────────────────────────────────
STEP_PREFLIGHT="Pre-flight checks:fail"
STEP_DEPLOY="Deploy Web → Fly.io:fail"
STEP_HEALTH="Web health check:fail"

finish() {
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    print_summary "success" \
      "$STEP_PREFLIGHT" "$STEP_DEPLOY" "$STEP_HEALTH"
  else
    print_summary "failed" \
      "$STEP_PREFLIGHT" "$STEP_DEPLOY" "$STEP_HEALTH"
  fi
  total_timer_end
  exit $exit_code
}
trap finish EXIT

# ─────────────────────────────────────────────────────────────────────────────
log_header "Qorix Markets — Deploy Web App Only"
timer_start
cd "$REPO_ROOT"

# ── Step 1: Pre-flight ────────────────────────────────────────────────────────
step_timer_start
run_preflight_checks "web" || exit 1
STEP_PREFLIGHT="Pre-flight checks:pass"
step_timer_end "Pre-flight"

# ── Step 2: Get previous image tag (for Docker layer cache) ───────────────────
log_step "[1/2] Fetching previous image tag (for build cache)..."
step_timer_start

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
  log_info "Cache image: $PREV_IMAGE"
else
  log_warn "No previous image found — first deploy or cache miss (slower build)"
fi
step_timer_end "Image lookup"

# ── Step 3: Deploy web to Fly.io ──────────────────────────────────────────────
log_step "[2/2] Deploying web app → Fly.io (qorix-markets-web)..."
step_timer_start
log_info "App:          qorix-markets-web"
log_info "API URL:      https://api.qorixmarkets.com"
log_info "Captcha:      turnstile"
log_info "Strategy:     rolling"
log_divider

if flyctl deploy \
  --config artifacts/qorix-markets/fly.toml \
  --dockerfile artifacts/qorix-markets/Dockerfile \
  --remote-only \
  --strategy rolling \
  --wait-timeout 300 \
  --build-arg VITE_API_URL="https://api.qorixmarkets.com" \
  --build-arg BASE_PATH="/" \
  --build-arg VITE_CAPTCHA_PROVIDER="turnstile" \
  --build-arg VITE_TURNSTILE_SITE_KEY="0x4AAAAAADF7hL3-sNctEdTJ" \
  $PREV_IMAGE_ARG; then
  log_ok "Web app deployed to Fly.io"
  STEP_DEPLOY="Deploy Web → Fly.io:pass"
else
  log_fatal "Web deploy FAILED — Fly.io reported an error."
  STEP_DEPLOY="Deploy Web → Fly.io:fail"
  exit 4
fi
step_timer_end "Fly deploy"

# ── Step 4: Health check ──────────────────────────────────────────────────────
log_step "[2/2] Web health check..."
step_timer_start

if check_web_health; then
  STEP_HEALTH="Web health check:pass"
else
  log_warn "Health check failed — CDN/Fly may still be warming up. Check manually:"
  log_info "  curl https://qorixmarkets.com/healthz"
  STEP_HEALTH="Web health check:fail"
  exit 5
fi
step_timer_end "Health check"
