# Contexta Bot

AI-powered Discord bot with long-term memory, multi-provider LLM support, and a web dashboard.

## Architecture

pnpm workspace monorepo with 4 apps and 3 packages:

| Package | Purpose | Deploy |
|---------|---------|--------|
| `applications/bot` | Discord bot (discord.js) | Railway |
| `applications/backend` | API server (Hono) | Railway |
| `applications/dashboard` | Admin dashboard (Next.js 15) | Vercel |
| `applications/website` | Marketing site (Next.js 15) | Vercel |
| `packages/db` | Drizzle ORM schema + DB client | Library |
| `packages/shared` | Types, constants, validation | Library |
| `packages/ui` | Theme utilities | Library |

## Features

- **Multi-provider LLM**: Gemini, OpenAI, and Anthropic via pluggable provider registry
- **Tiered memory**: Redis (50-message rolling window) + PostgreSQL/pgvector (768-dim semantic vectors)
- **Context caching**: Server lore cached via Gemini Context Caching API
- **User profiles**: Per-server user context and preferences (JSONB)
- **Multi-bot dashboard**: Switch between dev/prod bot instances from the same UI
- **Slash commands**: /ask, /summarize, /recall, /settings, /lore, /profile

## Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL with pgvector extension
- Redis

## Setup

```bash
git clone <repo-url> && cd contexta-bot
pnpm install
cp .env.example .env   # Fill in values — see .env.example for docs
```

## Development

```bash
pnpm dev:bot           # Bot with hot-reload
pnpm dev:backend       # Backend API server
pnpm dev:dashboard     # Dashboard on localhost:3000
pnpm dev:website       # Website on localhost:5001
```

## Testing

```bash
pnpm test              # All tests
pnpm test:bot          # Bot tests (67 tests)
pnpm test:dashboard    # Dashboard tests (24 tests)
```

## Database Migrations

```bash
pnpm db:generate                    # Generate Drizzle migration from schema changes
source .env && psql "$DATABASE_URL" -f packages/db/src/migrations/<file>.sql  # Run manually
```

## Deployment

- **Bot + Backend**: Railway (single service). Push to `main` triggers deploy.
- **Dashboard + Website**: Vercel. Push to `main` triggers deploy.
- **PostgreSQL + Redis**: Railway internal services.

## Environment Variables

See `.env.example` for the full list with documentation. Key variables:

- `DISCORD_TOKEN` / `BOT_CLIENT_ID` — Bot credentials (per instance)
- `DATABASE_URL` / `REDIS_URL` — Infrastructure
- `BOTS` — Multi-bot dashboard config: `Dev:CLIENT_ID_1,Prod:CLIENT_ID_2`

## Tech Stack

- [discord.js](https://discord.js.org/) — Discord API
- [Hono](https://hono.dev/) — Backend API framework
- [Next.js 15](https://nextjs.org/) — Dashboard and website
- [Drizzle ORM](https://orm.drizzle.team/) — Database schema and queries
- [pgvector](https://github.com/pgvector/pgvector) — Semantic vector search
- [Redis](https://redis.io/) — Short-term cache
- [Vitest](https://vitest.dev/) — Testing

## License

MIT
