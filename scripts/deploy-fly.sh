#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# One-click deploy: pushes both API server and web app to Fly.io.
# Run from the repo root: bash scripts/deploy-fly.sh
#
# Requires FLY_API_TOKEN to be set in Replit Secrets.
# ─────────────────────────────────────────────────────────────────────────────
set -e

if [ -z "$FLY_API_TOKEN" ]; then
  echo "❌ ERROR: FLY_API_TOKEN secret is not set. Add it in Replit Secrets."
  exit 1
fi

export FLY_API_TOKEN="$FLY_API_TOKEN"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Qorix Markets — Fly.io Deploy"
echo "══════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Deploy API server (qorix-api) ───────────────────────────────────
echo "▶ [1/2] Deploying API server (qorix-api)..."
flyctl deploy \
  --config artifacts/api-server/fly.toml \
  --dockerfile artifacts/api-server/Dockerfile \
  --remote-only \
  --strategy rolling \
  --wait-timeout 300

echo "✅ API server deployed successfully."
echo ""

# ─── Step 2: Deploy web app (qorix-markets-web) ──────────────────────────────
echo "▶ [2/2] Deploying web app (qorix-markets-web)..."

# Get the latest deployed image tag to use as PREV_IMAGE (speeds up Docker build
# by reusing the previous layer cache for large static assets).
PREV_IMAGE=$(flyctl image show --app qorix-markets-web --json 2>/dev/null | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); console.log(j.ImageRef||''); } catch { console.log(''); } })" || echo "")

PREV_IMAGE_ARG=""
if [ -n "$PREV_IMAGE" ]; then
  PREV_IMAGE_ARG="--build-arg PREV_IMAGE=$PREV_IMAGE"
  echo "   Using previous image for cache: $PREV_IMAGE"
fi

flyctl deploy \
  --config artifacts/qorix-markets/fly.toml \
  --dockerfile artifacts/qorix-markets/Dockerfile \
  --remote-only \
  --strategy rolling \
  --wait-timeout 300 \
  --build-arg VITE_API_URL="https://api.qorixmarkets.com" \
  --build-arg BASE_PATH="/" \
  --build-arg VITE_CAPTCHA_PROVIDER="turnstile" \
  --build-arg VITE_TURNSTILE_SITE_KEY="0x4AAAAAADF7hL3-sNctEdTJ" \
  $PREV_IMAGE_ARG

echo "✅ Web app deployed successfully."
echo ""
echo "══════════════════════════════════════════════════════"
echo "  🚀 Deploy complete!"
echo "  API:  https://api.qorixmarkets.com"
echo "  Web:  https://qorixmarkets.com"
echo "══════════════════════════════════════════════════════"
