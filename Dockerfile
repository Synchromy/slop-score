# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/action/package.json apps/action/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/extract/package.json packages/extract/package.json
COPY packages/rules/package.json packages/rules/package.json
COPY services/api/package.json services/api/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm build

FROM node:22-slim AS runtime
WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

RUN mkdir -p /data

ENV HOST=0.0.0.0 \
    PORT=8790 \
    SLOP_SCORE_STATIC_DIR=/app/apps/web/dist \
    SLOP_SCORE_DB_PATH=/data/leads.db

EXPOSE 8790
VOLUME ["/data"]

CMD ["node", "services/api/dist/index.js"]
