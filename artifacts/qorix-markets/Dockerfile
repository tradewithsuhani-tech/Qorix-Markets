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

ARG NODE_VERSION=24-alpine
# Pin the pnpm major to match artifacts/api-server/Dockerfile and avoid
# `pnpm@latest` silently jumping to a future major that changes install or
# build behavior. Bump deliberately when the api-server Dockerfile bumps.
ARG PNPM_VERSION=10

# ─── Build stage: install + vite build ─────────────────────────────────────
FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# Build-time configuration baked into the static bundle.
ARG VITE_API_URL=""
ARG BASE_PATH="/"
ENV VITE_API_URL=$VITE_API_URL \
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
FROM nginx:1.27-alpine AS runtime

# Vite outputs to dist/public per artifacts/qorix-markets/vite.config.ts
COPY --from=build /workspace/artifacts/qorix-markets/dist/public /usr/share/nginx/html
COPY artifacts/qorix-markets/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
