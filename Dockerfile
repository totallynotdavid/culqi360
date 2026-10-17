# The bun version comes from mise.toml, so the image and the checks run the same
# release. The mise binary is static, so the stage copies it from the mise image.
FROM debian:trixie-slim AS bun-binary

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/jdx/mise:2026.10.12 /usr/local/bin/mise /usr/local/bin/mise

WORKDIR /pins
COPY mise.toml ./
RUN mise trust \
    && mise install bun \
    && cp "$(mise which bun)" /usr/local/bin/bun

FROM debian:trixie-slim AS base

# Native tools such as Sentry CLI need the system CA bundle.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1000 bun \
    && useradd --system --uid 1000 --gid bun --create-home bun

COPY --from=bun-binary /usr/local/bin/bun /usr/local/bin/bun

ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

FROM base AS production-deps

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/email-composer/package.json ./packages/email-composer/package.json
COPY packages/fetch-refs/package.json ./packages/fetch-refs/package.json
COPY packages/images/package.json ./packages/images/package.json
COPY packages/message-channels/package.json ./packages/message-channels/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY tools/codegen/package.json ./tools/codegen/package.json

RUN bun install --frozen-lockfile --production --ignore-scripts

FROM base AS build

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --cwd packages/email-composer build:emails

# Source-map upload only. The Sentry DSN is read at runtime, not baked in.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

ENV SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN bun run --cwd apps/web build:container

FROM base AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=production-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=production-deps --chown=bun:bun /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=bun:bun /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=bun:bun /app/apps/web/server.ts ./apps/web/server.ts
COPY --from=build --chown=bun:bun /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=bun:bun /app/apps/web/src ./apps/web/src
COPY --from=build --chown=bun:bun /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=build --chown=bun:bun /app/packages ./packages

WORKDIR /app/apps/web

USER bun

EXPOSE 3000

CMD ["bun", "run", "start"]
