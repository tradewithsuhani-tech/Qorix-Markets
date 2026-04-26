# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Qorix Markets API server.
#
# Build context: monorepo root (NOT this directory). The GitHub Action and
# fly.toml both run `flyctl deploy` from the repo root with
# `--dockerfile artifacts/api-server/Dockerfile` so the build context picks up
# pnpm-workspace.yaml, pnpm-lock.yaml, the lib/* packages, and this artifact.

ARG NODE_VERSION=24-alpine

# ─── Base image with pnpm via corepack ─────────────────────────────────────
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

# ─── Install workspace deps (filtered to api-server) ───────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server
RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..."

# ─── Build the api-server bundle (esbuild → dist/index.mjs) ────────────────
FROM deps AS build
RUN pnpm --filter @workspace/api-server run build

# ─── Produce a flat, production-only deploy directory via `pnpm deploy` ────
# `pnpm deploy` copies the api-server package, inlines workspace deps
# (@workspace/db, @workspace/api-zod) into node_modules, and prunes devDeps.
FROM build AS deploy
WORKDIR /workspace/artifacts/api-server
RUN pnpm deploy --prod --filter @workspace/api-server /deploy

# ─── Lean runtime image ────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    RUN_BACKGROUND_JOBS=true

# Copy the deploy bundle (package.json + node_modules + freshly-built dist/)
COPY --from=deploy /deploy ./

EXPOSE 8080

# Healthcheck mirrors the Fly healthcheck on /api/healthz.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
