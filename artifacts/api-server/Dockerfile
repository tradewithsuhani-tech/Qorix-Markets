# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Qorix Markets API server.
#
# Build context: monorepo root (NOT this directory). The GitHub Action and
# fly.toml both run `flyctl deploy` from the repo root with
# `--dockerfile artifacts/api-server/Dockerfile` so the build context picks up
# pnpm-workspace.yaml, pnpm-lock.yaml, the lib/* packages, and this artifact.

ARG NODE_VERSION=24-alpine
# Pin the pnpm major. `pnpm@latest` would silently jump to v11+ and could
# remove the `--legacy` deploy flag we rely on below, breaking this build
# without a code change. Bump deliberately when we're ready to migrate.
ARG PNPM_VERSION=10

# ─── Base image with pnpm via corepack ─────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
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
#
# `--legacy`: pnpm v10 changed the default to require workspace packages to
# opt into injection (`inject-workspace-packages=true`) before `pnpm deploy`
# will run. Setting that flag at the workspace level changes how every
# artifact (web app, mockup-sandbox, etc.) consumes lib/* — too broad a
# blast radius for this fix. `--legacy` keeps the pre-v10 behavior scoped
# to this one Docker stage. See pnpm docs:
# https://pnpm.io/cli/deploy
FROM build AS deploy
WORKDIR /workspace/artifacts/api-server
RUN pnpm deploy --prod --legacy --filter @workspace/api-server /deploy

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
