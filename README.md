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
| `SESSION_TTL_HOURS` | Session expiration in hours (default 168). |
| `MFA_TTL_MINUTES` | MFA code expiration in minutes (default 10). |
| `NEXT_PUBLIC_API_URL` | Optional API base URL for the dashboard. |

## MFA Behavior
- Login uses email + password.
- MFA is required if the user has not completed MFA in the last **3 days**.
- MFA codes are logged to the console in development and stored in `OutboundEmailLog` with type `MFA_CODE`.
- The `/mfa` UI shows a **dev-only** "View Code" section when `NODE_ENV=development`.

## Scripts
- `pnpm dev`: run web + API in parallel
- `pnpm db:setup`: migrate + seed database
- `pnpm build`: build all packages
- `pnpm lint`: lint all packages

## OpenAPI Docs
- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/docs/json`
