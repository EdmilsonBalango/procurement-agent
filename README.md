# Procurement PR Workflow Monorepo

This monorepo contains a Next.js dashboard and a Fastify API for a procurement PR workflow.

## Architecture
- **apps/web**: Next.js App Router dashboard (Tailwind + Radix UI primitives via `@procurement/ui`).
- **apps/api**: Fastify API with Prisma (SQLite dev default) + OpenAPI docs.
- **packages/shared**: Shared Zod schemas and TypeScript types.
- **packages/ui**: Shared UI components (Radix wrappers).

## Requirements
- Node.js 20+
- pnpm 9+

## Setup
```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:setup
pnpm dev
```

### Environment Variables
| Variable | Description |
| --- | --- |
| `DATABASE_PROVIDER` | Prisma provider (default `sqlite`). For Postgres set `postgresql`. |
| `DATABASE_URL` | Database connection string. |
| `MYSQL_HOST` | MySQL host for the Fastify API. In Docker Compose this defaults to `host.docker.internal`. |
| `MYSQL_PORT` | MySQL port (default `3306`). |
| `MYSQL_USER` | MySQL user (default `root`). |
| `MYSQL_PASSWORD` | MySQL password. |
| `MYSQL_DATABASE` | MySQL database name (default `procuremes-agent-test`). |
| `APP_ORIGIN` | Public app URL, for example `https://procurement.karingani.com`. Used as the default allowed browser origin in production-like deployments. |
| `CORS_ORIGIN` | Optional comma-separated allowed origins for the API. If unset, the API falls back to `APP_ORIGIN` plus local development origins. |
| `SESSION_COOKIE_SECURE` | Set to `true` for HTTPS deployments, `false` for plain HTTP deployments, or leave unset for auto-detection from `X-Forwarded-Proto`. |
| `SESSION_TTL_HOURS` | Session expiration in hours (default 168). |
| `NEXT_PUBLIC_API_URL` | Optional browser API base URL for non-proxied setups. |

## Scripts
- `pnpm dev`: run web + API in parallel
- `pnpm db:setup`: migrate + seed database
- `pnpm build`: build all packages
- `pnpm lint`: lint all packages

## OpenAPI Docs
- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/docs/json`

## DNS / Domain Setup
- Set `APP_ORIGIN` to your public domain, for example `https://procurement.karingani.com`.
- If you terminate TLS at a reverse proxy, make sure it forwards `X-Forwarded-Proto=https` so secure session cookies are enabled automatically.
- If you prefer to force secure cookies regardless of proxy headers, set `SESSION_COOKIE_SECURE=true`.
- If your deployment needs strict origin control, set `CORS_ORIGIN=https://procurement.karingani.com`.
