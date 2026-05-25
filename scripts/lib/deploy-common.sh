#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-common.sh — Shared functions for all Qorix deploy scripts.
# Source this file at the top of every deploy script:
#   source "$(dirname "$0")/lib/deploy-common.sh"
# ─────────────────────────────────────────────────────────────────────────────

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Logging helpers ───────────────────────────────────────────────────────────
log_header() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${BLUE}  $1${RESET}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
}

log_step() {
  echo ""
  echo -e "${BOLD}${CYAN}▶ $1${RESET}"
}

log_info() {
  echo -e "  ${DIM}$1${RESET}"
}

log_ok() {
  echo -e "  ${GREEN}✅ $1${RESET}"
}

log_warn() {
  echo -e "  ${YELLOW}⚠️  $1${RESET}"
}

log_error() {
  echo -e "  ${RED}❌ $1${RESET}"
}

log_fatal() {
  echo ""
  echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${RED}${BOLD}  FATAL: $1${RESET}"
  echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

log_divider() {
  echo -e "${DIM}  ──────────────────────────────────────────────────────${RESET}"
}

# ── Timing helpers ────────────────────────────────────────────────────────────
DEPLOY_START_TIME=""
STEP_START_TIME=""

timer_start() {
  DEPLOY_START_TIME=$(date +%s)
}

step_timer_start() {
  STEP_START_TIME=$(date +%s)
}

step_timer_end() {
  local label="$1"
  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - STEP_START_TIME))
  echo -e "  ${DIM}⏱  ${label}: ${elapsed}s${RESET}"
}

total_timer_end() {
  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - DEPLOY_START_TIME))
  local mins=$((elapsed / 60))
  local secs=$((elapsed % 60))
  if [ "$mins" -gt 0 ]; then
    echo -e "  ${DIM}⏱  Total time: ${mins}m ${secs}s${RESET}"
  else
    echo -e "  ${DIM}⏱  Total time: ${secs}s${RESET}"
  fi
}

# ── Pre-deploy checks ─────────────────────────────────────────────────────────

# Check required secret/env var is set (non-empty)
check_env() {
  local var="$1"
  local label="${2:-$1}"
  if [ -z "${!var}" ]; then
    log_error "Required secret not set: ${label}"
    return 1
  fi
  log_ok "${label} — set"
  return 0
}

# Run all pre-deploy checks. Returns 1 if any fail.
run_preflight_checks() {
  local mode="${1:-full}"   # full | api | web | migrate
  local failed=0

  log_step "Pre-deploy checks"

  # FLY_API_TOKEN — needed for api/web/full deploys
  if [[ "$mode" != "migrate" ]]; then
    check_env "FLY_API_TOKEN" "FLY_API_TOKEN" || failed=1
  fi

  # DB URL — needed for migrate/full deploys
  if [[ "$mode" == "migrate" || "$mode" == "full" ]]; then
    # Prefer NEON_DATABASE_URL for production migrations; fall back to DATABASE_URL
    if [ -n "$NEON_DATABASE_URL" ]; then
      log_ok "NEON_DATABASE_URL — set (production Neon DB)"
      export DATABASE_URL="$NEON_DATABASE_URL"
    elif [ -n "$DATABASE_URL" ]; then
      log_ok "DATABASE_URL — set"
    else
      log_error "Neither NEON_DATABASE_URL nor DATABASE_URL is set — cannot run migrations"
      failed=1
    fi
  fi

  # OpenAI (warn only, non-blocking)
  if [ -z "$OPENAI_API_KEY" ]; then
    log_warn "OPENAI_API_KEY not set — chat LLM will be disabled after deploy"
  fi

  # flyctl binary check
  if [[ "$mode" != "migrate" ]]; then
    if ! command -v flyctl &>/dev/null; then
      log_error "flyctl not found in PATH — cannot deploy to Fly.io"
      failed=1
    else
      log_ok "flyctl $(flyctl version 2>/dev/null | head -1 || echo '?') — available"
    fi
  fi

  # DB connectivity check
  if [[ "$mode" == "migrate" || "$mode" == "full" ]]; then
    log_info "Checking DB connectivity..."
    if PGCONNECT_TIMEOUT=8 psql "$DATABASE_URL" -c "SELECT 1" -q --no-psqlrc 2>/dev/null | grep -q "1 row"; then
      log_ok "Database — reachable"
    else
      log_error "Database not reachable — check NEON_DATABASE_URL / DATABASE_URL"
      failed=1
    fi
  fi

  if [ "$failed" -ne 0 ]; then
    log_fatal "Pre-deploy checks FAILED — fix the issues above before deploying."
    return 1
  fi

  log_ok "All pre-deploy checks passed"
  return 0
}

# ── Fly.io health checks ──────────────────────────────────────────────────────

check_api_health() {
  local url="https://api.qorixmarkets.com/api/healthz"
  log_info "Checking API health: ${url}"
  local max_attempts=10
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
    if [ "$status" == "200" ]; then
      log_ok "API health check passed (HTTP 200)"
      return 0
    fi
    log_info "Attempt ${attempt}/${max_attempts} — HTTP ${status}, retrying in 10s..."
    sleep 10
  done
  log_error "API health check FAILED after ${max_attempts} attempts"
  return 1
}

check_web_health() {
  local url="https://qorixmarkets.com/healthz"
  log_info "Checking Web health: ${url}"
  local max_attempts=8
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
    if [ "$status" == "200" ]; then
      log_ok "Web health check passed (HTTP 200)"
      return 0
    fi
    log_info "Attempt ${attempt}/${max_attempts} — HTTP ${status}, retrying in 10s..."
    sleep 10
  done
  log_error "Web health check FAILED after ${max_attempts} attempts"
  return 1
}

# ── Summary printer ───────────────────────────────────────────────────────────
print_summary() {
  local status="$1"   # "success" | "failed"
  shift
  local steps=("$@")  # array of "STEP_NAME:pass|fail|skip"

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  DEPLOY SUMMARY${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

  for step in "${steps[@]}"; do
    local name="${step%%:*}"
    local result="${step##*:}"
    case "$result" in
      pass) echo -e "  ${GREEN}✅  ${name}${RESET}" ;;
      fail) echo -e "  ${RED}❌  ${name}${RESET}" ;;
      skip) echo -e "  ${DIM}⏭   ${name} (skipped)${RESET}" ;;
    esac
  done

  echo ""
  if [ "$status" == "success" ]; then
    echo -e "  ${GREEN}${BOLD}🚀 DEPLOYMENT SUCCESSFUL${RESET}"
    echo -e "  ${DIM}API:  https://api.qorixmarkets.com${RESET}"
    echo -e "  ${DIM}Web:  https://qorixmarkets.com${RESET}"
  else
    echo -e "  ${RED}${BOLD}💥 DEPLOYMENT FAILED — see errors above${RESET}"
  fi
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}
