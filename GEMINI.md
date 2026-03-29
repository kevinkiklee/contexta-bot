# Gemini CLI — Contexta Bot Guidelines

This document outlines the architectural standards, development workflows, and specific configurations for the Contexta Bot monorepo.

## Project Architecture

- **Monorepo Structure:** Managed via `pnpm` workspaces.
  - `@contexta/bot` (`apps/bot`): Discord bot core. ESM-based (`"type": "module"`). **Imports must use `.js` extensions.**
  - `@contexta/backend` (`apps/backend`): Hono-based API server for LLM processing and data.
  - `@contexta/dashboard` (`apps/dashboard`): Next.js 15 (App Router) management dashboard with NextAuth (Discord).
  - `@contexta/website` (`apps/website`): Next.js 15 marketing site.
  - `@contexta/db` (`packages/db`): Shared Drizzle ORM schema and PostgreSQL client (with `pgvector` support).
  - `@contexta/shared` (`packages/shared`): Cross-app types, constants, and Zod validation.
  - `@contexta/ui` (`packages/ui`): Shared React components.

### Core Systems (Bot)
- **Tiered Memory:** Redis (rolling window of 50 messages/channel) → PostgreSQL + pgvector (768-dim semantic vectors).
- **LLM Strategy:** Multi-provider interface (`IAIProvider`) supporting Gemini, OpenAI, and Anthropic.

## Infrastructure & Ports

To avoid `EADDRINUSE` conflicts during local development, the following port assignments are standard:

| Service | Port | Command |
| :--- | :--- | :--- |
| **Dashboard** | 5000 | `pnpm dev:dashboard` |
| **Website** | 5001 | `pnpm dev:website` |
| **Backend** | 5010 | `pnpm dev:backend` |
| **Bot Health** | 5011 | `pnpm dev:bot` |

### Port Conflict Resilience
The Bot's health server (`apps/bot/src/utils/httpServer.ts`) includes an `EADDRINUSE` error handler. It will log a warning and allow the bot to continue operating even if the health port is blocked, ensuring high availability of the primary Discord functionality.

## Development Workflows

- **User Preference:** **No manual setup steps.** If a task requires setup (migrations, env config), provide a runnable bash script.
- **Environment Variables:** All apps read from the root `.env` via `dotenv`. Copy `.env.example` to `.env` to start.
- **Database:**
  - `pnpm db:generate` — Generate Drizzle migrations.
  - `pnpm db:migrate` — Apply migrations.
  - Schema changes must be in `packages/db/src/schema.ts`.

## Testing

- **Bot:** `apps/bot/src/tests/` (Unit, Component, Integration).
  - `pnpm test:bot` (Unit/Component)
  - `pnpm --filter @contexta/bot test:integration` (Requires `TEST_DATABASE_URL`)
- **Dashboard:** `apps/dashboard/src/tests/`.
  - `pnpm test:dashboard`
- **Global:** `pnpm test` runs all package tests.

## Deployment

- **Bot + Backend:** Railway (PaaS).
- **Dashboard + Website:** Vercel.
- **Infrastructure:** Managed PostgreSQL and Redis on Railway.

## Coding Standards

- **Type Safety:** Strict TypeScript usage is mandatory.
- **ESM Imports:** In `apps/bot`, always append `.js` to relative imports.
- **Error Handling:** Use centralized middleware in the backend and graceful degradation in the bot.
- **Security:** Never hardcode secrets. Internal Bot-to-Backend calls must use `BOT_API_KEY`.
