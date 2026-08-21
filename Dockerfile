FROM oven/bun:1.3.14 AS production-deps

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/email-composer/package.json ./packages/email-composer/package.json
COPY packages/fetch-refs/package.json ./packages/fetch-refs/package.json
COPY packages/images/package.json ./packages/images/package.json
COPY packages/message-channels/package.json ./packages/message-channels/package.json
COPY packages/solid-motion/package.json ./packages/solid-motion/package.json
COPY tools/codegen/package.json ./tools/codegen/package.json

RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1.3.14 AS build

WORKDIR /app

# Native tools such as Sentry CLI need the system CA bundle.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile
RUN bun run generate:templates

# Required during the web build.
ARG VITE_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN bun run --cwd apps/web build:container

FROM oven/bun:1.3.14 AS runtime

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
