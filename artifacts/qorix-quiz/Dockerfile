# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Qorix Play web app (React + Vite PWA).
#
# Build context: monorepo root. flyctl deploy is invoked from the repo root
# with `--dockerfile artifacts/qorix-quiz/Dockerfile` so pnpm workspace
# files and lib/* packages are part of the context.
#
# VITE_API_URL is baked in at build time — the prod URL of the api server
# (e.g. https://api.qorixmarkets.com). Currently the landing page makes no
# API calls, so an empty default works; we keep the arg plumbed end-to-end
# so the SSO + quiz-play screens (B36+) can call qorix-api without a
# Dockerfile change.

# Build stage uses glibc (bookworm-slim) instead of alpine/musl. pnpm v10 +
# alpine has trouble pulling the platform-specific optional rollup native
# binary (@rollup/rollup-linux-x64-musl), causing vite build to fail. Runtime
# stage stays on nginx:alpine — only the static html output ships. Mirrors
# artifacts/qorix-markets/Dockerfile so cache layers + pnpm version + node
# version stay in lock-step across the two SPAs.
ARG NODE_VERSION=24-bookworm-slim
ARG PNPM_VERSION=10

# ─── Build stage: install + vite build ─────────────────────────────────────
FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# Build-time configuration baked into the static bundle.
#
# BASE_PATH = "/" for prod (qorixplay.com is the apex root). In Replit dev
# the workflow passes BASE_PATH=/qorix-quiz/ so the multi-artifact preview
# proxy can route to it without colliding with qorix-markets at /.
#
# VITE_API_URL is plumbed but unused by the landing page. SSO + quiz-play
# screens land in B36+ and will read it via getApiUrl().
ARG VITE_API_URL=""
ARG BASE_PATH="/"
ENV VITE_API_URL=$VITE_API_URL \
    BASE_PATH=$BASE_PATH \
    PORT=8080 \
    NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY artifacts/qorix-quiz ./artifacts/qorix-quiz

RUN pnpm install --frozen-lockfile --filter "@workspace/qorix-quiz..."
RUN pnpm --filter @workspace/qorix-quiz run build

# ─── Runtime stage: nginx serving the static bundle ────────────────────────
FROM nginx:1.27-alpine AS runtime

# Vite outputs to dist/public per artifacts/qorix-quiz/vite.config.ts
COPY --from=build /workspace/artifacts/qorix-quiz/dist/public /usr/share/nginx/html
COPY artifacts/qorix-quiz/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
