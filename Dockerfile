# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.12.0
ARG NEXT_PUBLIC_API_URL=http://api:3001

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS build

ARG NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV CI=true

COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN --mount=type=cache,target=/pnpm/store \
    pnpm --filter @procurement/web exec next build --webpack

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ARG NEXT_PUBLIC_API_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN apk add --no-cache libc6-compat

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
