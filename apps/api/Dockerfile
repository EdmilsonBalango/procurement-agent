# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.12.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS build

ENV CI=true

COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @procurement/api build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache libc6-compat
RUN mkdir -p /app/apps/api/uploads
RUN mkdir -p /app/apps/api/uploads/quotes
RUN mkdir -p /app/apps/api/uploads/invoices

COPY --from=build /app /app

USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]
