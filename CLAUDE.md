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
| @contexta/ui | packages/ui/ | Theme script utility | Library |

## Commands

```bash
# Development (run from repo root)
pnpm dev:bot           # Bot with hot-reload
pnpm dev:backend       # Backend API server
pnpm dev:dashboard     # Dashboard on localhost:3000
pnpm dev:website       # Website on localhost:5001

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
# Manual migration: source .env && psql "$DATABASE_URL" -f packages/db/src/migrations/<file>.sql

# Run in specific package
pnpm --filter @contexta/bot <command>
pnpm --filter @contexta/backend <command>
```

## Testing

- `pnpm test:bot` — bot unit + component tests (Vitest, 67 tests)
- `pnpm test:dashboard` — dashboard tests (Vitest, 24 tests)
- `pnpm --filter @contexta/bot test:integration` — integration tests (requires `TEST_DATABASE_URL`)
- Bot tests: `applications/bot/src/tests/{unit,component,integration}/`
- Dashboard tests: `applications/dashboard/src/tests/unit/`
- Shared helpers in `applications/bot/src/tests/helpers/`

## Environment Variables

Copy `.env.example` to `.env` at the repo root and fill in values. Each app reads from the root `.env` via dotenv.

Key variables:
- `DISCORD_TOKEN` — Discord bot token
- `BOT_CLIENT_ID` — Discord Application ID (per bot instance, from Developer Portal)
- `GEMINI_API_KEY` — Google Gemini API key
- `DATABASE_URL` — PostgreSQL connection string (pgvector must be enabled)
- `REDIS_URL` — Redis connection string
- `DISABLE_DB_SSL` — Set `true` for Railway internal Postgres
- `BOT_API_KEY` — Shared secret between bot and backend
- `BACKEND_URL` — Backend URL the bot calls (e.g. `http://localhost:8080` on Railway)
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — OAuth app for dashboard login
- `AUTH_SECRET` — NextAuth session encryption secret
- `BOTS` — Multi-bot dashboard config: `"Dev:CLIENT_ID_1,Prod:CLIENT_ID_2"`

## Architecture

### Bot (applications/bot/)

ES module TypeScript project (`"type": "module"`, `module: Node16`). Imports must use `.js` extensions.

Entry point `src/index.ts` initializes Redis, loads events/commands via auto-discovery, syncs guild membership to `server_settings` (per `BOT_CLIENT_ID`), and starts an HTTP health server on `BOT_HEALTH_PORT` (default 5011).

Events: `messageCreate` (chat + Redis history), `interactionCreate` (slash commands), `guildCreate`/`guildDelete` (server_settings sync).

Tiered memory: Redis (rolling window of 50 messages/channel) → PostgreSQL + pgvector (768-dim semantic vectors).

Slash commands in `src/commands/`: ask, summarize, recall, settings, lore, profile.

Bot sends `X-Bot-Id` header on all backend API calls via `src/lib/backendClient.ts`.

### Backend (applications/backend/)

Hono API server. Routes: `/api/chat`, `/api/summarize`, `/api/servers/:id/*`, `/api/cache/*`, `/api/attachments/*`, `/api/embeddings/*`. All `server_settings` queries are scoped by `bot_id` from the `X-Bot-Id` header.

LLM providers in `src/services/llm/`: GeminiProvider, OpenAIProvider, AnthropicProvider with providerRegistry.

Auth: `BOT_API_KEY` bearer token via middleware.

Cron endpoints (under `/api/cron`): `/cron/embeddings` (channel memory), `/cron/message-embeddings` (message-level embeddings for semantic search).

### Dashboard (applications/dashboard/)

Next.js 15 App Router with NextAuth v5 (Discord OAuth). Tailwind CSS v4 with CSS-based theme config (no `tailwind.config.ts` — all theming via `@theme` in `globals.css`).

Multi-bot support: `BOTS` env var parsed by `lib/bots.ts`, selected via `bot_id` cookie managed by `lib/bot-cookie.ts`. Bot selector dropdown hidden when only one bot configured.

Pages: server list, server overview, settings (model selection), lore editor, message log (search, filter, cursor pagination).

Message log: unified view with text search (Postgres `tsvector`), user/channel/bot-only filters, and cursor-based pagination. Semantic search via pgvector available when embeddings are backfilled.

Lib layer: `auth.ts` / `auth.config.ts` (NextAuth with Discord), `auth-helpers.ts` (permission checks + guild sync), `queries.ts` (DB/Redis queries — all scoped by `botId`), `db.ts` (pg Pool), `redis.ts` (ioredis), `bots.ts` + `bot-cookie.ts` (bot config).

API routes: `/api/channels/[serverId]` (channel list for sidebar).

### Website (applications/website/)

Next.js 15 marketing site scaffold. Placeholder content.

### Database (packages/db/)

Drizzle ORM schema matching the PostgreSQL tables. Key tables:
- `server_settings` — composite PK `(server_id, bot_id)`, tracks per-bot guild membership via `is_active`
- `user_servers` — user's Discord guild memberships with `server_name` and `is_admin`
- `messages` — durable message store with `search_vec` (tsvector) and `embedding` (pgvector). Written by bot on every message.
- `channel_memory_vectors` — pgvector embeddings for channel-level semantic search
- `server_members` / `global_users` — user profiles and preferences

Custom pgvector column type for `vector(768)`. Exports typed Drizzle client and raw query helper.

Migrations in `src/migrations/` — run manually via psql.

### Shared (packages/shared/)

Cross-app types, constants (model names, limits), and Zod validation schemas.

### UI (packages/ui/)

Exports `themeScript` — inline JS for dark mode flash prevention. Layouts inline this directly rather than importing at build time.

## Deployment

- **Bot + Backend** → Railway (single service, both run concurrently). Main branch triggers automated builds.
  - Backend listens on `PORT` (8080), bot health server on `BOT_HEALTH_PORT` (5011).
  - Set `DISABLE_DB_SSL=true` for Railway internal Postgres.
- **Dashboard + Website** → Vercel.
- PostgreSQL and Redis run as Railway internal services.
