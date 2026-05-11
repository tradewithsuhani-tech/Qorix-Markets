# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Qorix Markets web app (React + Vite PWA).
#
# Build context: monorepo root. flyctl deploy is invoked from the repo root
# with `--dockerfile artifacts/qorix-markets/Dockerfile` so pnpm workspace
# files and lib/* packages are part of the context.
#
# VITE_API_URL is baked in at build time — the prod URL of the api server
# (e.g. https://api.qorixmarkets.com). In dev (Replit) this stays unset and
# the Vite proxy handles /api → localhost:8080.

# Build stage uses glibc (bookworm-slim) instead of alpine/musl. pnpm v10 +
# alpine has trouble pulling the platform-specific optional rollup native
# binary (@rollup/rollup-linux-x64-musl), causing vite build to fail. Runtime
# stage stays on nginx:alpine — only the static html output ships.
ARG NODE_VERSION=24-bookworm-slim
# Pin the pnpm major to match artifacts/api-server/Dockerfile and avoid
# `pnpm@latest` silently jumping to a future major that changes install or
# build behavior. Bump deliberately when the api-server Dockerfile bumps.
ARG PNPM_VERSION=10
# PREV_IMAGE: tag of the most-recently-deployed qorix-markets-web image.
# Must be declared at global scope (before all FROM) so it can be used in
# a FROM instruction. Large static assets (banners ~90 MB, promo ~12 MB)
# are excluded from the build context (.dockerignore) to keep uploads fast;
# the runtime stage copies them from this image instead.
# Pass at deploy time:
#   flyctl deploy --build-arg PREV_IMAGE=registry.fly.io/qorix-markets-web:<tag>
# Defaults to the public nginx image (no /banners) so the first-ever deploy
# still works — the COPY is a no-op for missing source paths.
ARG PREV_IMAGE="nginx:1.27-alpine"

# ─── Build stage: install + vite build ─────────────────────────────────────
FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# Build-time configuration baked into the static bundle.
#
# B9.6: VITE_CAPTCHA_PROVIDER picks which captcha widget the bundle ships
# with — "recaptcha" (default, current behavior) or "turnstile" (Cloudflare
# Turnstile, the B9.6 cutover target). Both site keys are accepted as build
# args so a deploy can swap providers by flipping this one ARG without
# changing any other build infra. The unused provider's site key may be
# left empty.
ARG VITE_API_URL=""
ARG VITE_RECAPTCHA_SITE_KEY=""
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_CAPTCHA_PROVIDER="recaptcha"
ARG BASE_PATH="/"
# VITE_GA_MEASUREMENT_ID: Google Analytics 4 Measurement ID (G-XXXXXXXXXX).
# Optional — when empty, src/lib/analytics.ts initAnalytics() becomes a
# no-op so dev / preview deploys do not pollute prod GA traffic.
ARG VITE_GA_MEASUREMENT_ID=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_CAPTCHA_PROVIDER=$VITE_CAPTCHA_PROVIDER \
    VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID \
    BASE_PATH=$BASE_PATH \
    PORT=8080 \
    NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY artifacts/qorix-markets ./artifacts/qorix-markets

RUN pnpm install --frozen-lockfile --filter "@workspace/qorix-markets..."
RUN pnpm --filter @workspace/qorix-markets run build

# ─── Runtime stage: nginx serving the static bundle ────────────────────────
FROM ${PREV_IMAGE} AS prev_static

FROM nginx:1.27-alpine AS runtime

# Vite outputs to dist/public per artifacts/qorix-markets/vite.config.ts
COPY --from=build /workspace/artifacts/qorix-markets/dist/public /usr/share/nginx/html
# Restore large static assets from the previous deployment.
# These files are excluded from the build context to keep uploads fast.
# The --link flag makes this a no-op if the source path doesn't exist in
# prev_static (e.g. on the very first deploy when PREV_IMAGE=nginx:alpine).
COPY --from=prev_static --link /usr/share/nginx/html/banners /usr/share/nginx/html/banners
COPY --from=prev_static --link /usr/share/nginx/html/promo /usr/share/nginx/html/promo
COPY artifacts/qorix-markets/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
# rebuild trigger 2026-05-04T21:33:09Z bake VITE_GA_MEASUREMENT_ID into bundle
