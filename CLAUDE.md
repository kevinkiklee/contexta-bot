# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## User Preferences

- **No manual setup steps.** If a task requires manual setup (database migrations, env configuration, service installation, etc.), provide a runnable bash script instead of prose instructions. The user will execute it via `! <script>` in the terminal.

## Monorepo Structure

This is a pnpm workspace monorepo with 4 apps and 3 packages:

| Package | Path | Purpose | Deploy |
|---------|------|---------|--------|
| @contexta/bot | applications/bot/ | Discord bot | Railway |
| @contexta/backend | applications/backend/ | API server (Hono) | Railway |
| @contexta/dashboard | applications/dashboard/ | Admin UI (Next.js) | Vercel |
| @contexta/website | applications/website/ | Marketing site (Next.js) | Vercel |
| @contexta/db | packages/db/ | Drizzle schema + DB client | Library |
| @contexta/shared | packages/shared/ | Types, constants, validation | Library |
| @contexta/ui | packages/ui/ | Shared React components | Library |

## Commands

```bash
# Development (run from repo root)
pnpm dev:bot           # Bot with hot-reload
pnpm dev:backend       # Backend API server
pnpm dev:dashboard     # Dashboard on localhost:3000
pnpm dev:website       # Website on localhost:3001

# Build all
pnpm build

# Test all
pnpm test

# Test specific app
pnpm test:bot
pnpm test:dashboard

# Database
pnpm db:generate       # Generate Drizzle migrations
pnpm db:migrate        # Run migrations

# Run in specific package
pnpm --filter @contexta/bot <command>
pnpm --filter @contexta/backend <command>
```

## Testing

- `pnpm test:bot` — bot unit + component tests (Vitest)
- `pnpm test:dashboard` — dashboard tests (Vitest)
- `pnpm --filter @contexta/bot test:integration` — integration tests (requires `TEST_DATABASE_URL`)
- Bot tests: `applications/bot/src/tests/{unit,component,integration}/`
- Dashboard tests: `applications/dashboard/src/tests/`
- Shared helpers in `applications/bot/src/tests/helpers/`

## Environment Variables

Copy `.env.example` to `.env` at the repo root and fill in values. Each app reads from the root `.env` via dotenv.

Key variables:
- `DISCORD_TOKEN` — Discord bot token
- `GEMINI_API_KEY` — Google Gemini API key
- `DATABASE_URL` — PostgreSQL connection string (pgvector must be enabled)
- `REDIS_URL` — Redis connection string

## Architecture

### Bot (applications/bot/)

ES module TypeScript project (`"type": "module"`, `module: Node16`). Imports must use `.js` extensions.

Entry point `src/index.ts` initializes Redis, loads events/commands via auto-discovery, starts an HTTP health server.

Tiered memory: Redis (rolling window of 50 messages/channel) → PostgreSQL + pgvector (768-dim semantic vectors).

LLM providers: `src/llm/` with IAIProvider interface, GeminiProvider, OpenAIProvider, AnthropicProvider, and providerRegistry.

Slash commands in `src/commands/`: ask, summarize, recall, settings, lore, profile.

### Backend (applications/backend/)

Minimal Hono scaffold with `/health` endpoint. Will be built out in Sub-spec 2 with API routes, LLM service migration, and auth middleware.

### Dashboard (applications/dashboard/)

Next.js 15 App Router with NextAuth (Discord OAuth). Pages: server list, server overview, settings, lore, channel history.

### Website (applications/website/)

Next.js 15 marketing site scaffold. Placeholder content — will be built out in Sub-spec 3.

### Database (packages/db/)

Drizzle ORM schema matching the PostgreSQL tables. Custom pgvector column type for `vector(768)`. Exports typed Drizzle client and raw query helper.

### Shared (packages/shared/)

Cross-app types, constants (model names, limits), and Zod validation schemas.

## Deployment

- **Bot + Backend** → Railway (PaaS). Main branch triggers automated builds.
- **Dashboard + Website** → Vercel.
- PostgreSQL and Redis run as Railway internal services.
