# syntax=docker/dockerfile:1
# Build context = repo root (monorepo). Build:  docker build -f packages/backend/Dockerfile .

# ---------- builder ----------
FROM node:24-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Build toolchain for native deps (bcrypt) + openssl for Prisma engines
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Install deps with a warm cache using only manifests first
# All workspace manifests must be present so --frozen-lockfile matches the lockfile,
# even though --filter only installs backend + shared deps.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile --filter @agendly/backend...

# Build shared (tsc) BEFORE backend (backend consumes shared/dist).
# `prisma generate` must run here: the client under src/generated/ is gitignored,
# so a clean clone has no client to compile until it is generated.
COPY packages/shared packages/shared
COPY packages/backend packages/backend
RUN pnpm --filter @agendly/shared build \
  && pnpm --filter @agendly/backend exec prisma generate \
  && pnpm --filter @agendly/backend build

# Produce a self-contained prod bundle (real node_modules, shared injected,
# native modules copied from the store — no recompile in the runner).
# The `files` fields in the package.json's ensure dist/ and prisma/ are included
# despite being gitignored.
RUN pnpm --filter @agendly/backend deploy --prod --legacy /prod

# ---------- runner ----------
FROM node:24-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /prod /app
COPY packages/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
