# syntax=docker/dockerfile:1
# Build context = repo root (monorepo). Build:  docker build -f packages/frontend/Dockerfile .

# ---------- builder ----------
FROM node:24-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# All workspace manifests must be present so --frozen-lockfile matches the lockfile,
# even though --filter only installs frontend + shared deps.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile --filter @agendly/frontend...

# The frontend aliases @agendly/shared to its SOURCE (../shared/src), so shared's
# source must be present at build time (no shared build step needed here).
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
RUN pnpm --filter @agendly/frontend build

# ---------- runner ----------
FROM node:24-slim AS runner
ENV NODE_ENV=production
# Nitro node-server honors NITRO_PORT/PORT and HOST
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
WORKDIR /app
# .output is self-contained (Nitro bundles runtime deps) — no node_modules needed
COPY --from=builder /app/packages/frontend/.output /app/.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
