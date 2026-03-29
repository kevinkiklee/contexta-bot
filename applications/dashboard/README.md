# @contexta/dashboard

Admin dashboard for managing Contexta Discord bot servers. Built with Next.js 15 (App Router), NextAuth v5 (Discord OAuth), and Tailwind CSS v4.

## Setup

Requires a populated `.env` at the repo root (see `.env.example`). Dashboard-specific variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth application client secret |
| `AUTH_SECRET` | Yes | NextAuth session encryption key (`openssl rand -base64 32`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string (defaults to `localhost:6379`) |
| `BOTS` | No | Multi-bot config: `"Dev:123456,Prod:789012"` |

## Development

```bash
pnpm dev:dashboard     # http://localhost:3000
pnpm test:dashboard    # Run tests (24 unit tests)
pnpm --filter @contexta/dashboard build
```

## Architecture

```
src/
├── app/
│   ├── layout.tsx              Root layout (Manrope + JetBrains Mono fonts)
│   ├── page.tsx                Landing page (Discord sign-in)
│   ├── globals.css             Theme tokens (light/dark via CSS variables)
│   ├── animations.css          GPU-composited animations
│   ├── api/auth/[...nextauth]  NextAuth route handler
│   └── dashboard/
│       ├── layout.tsx          Auth guard, sidebar, bot selection
│       ├── page.tsx            Server list
│       ├── sidebar.tsx         Navigation (icon rail + nav panel)
│       ├── bot-selector.tsx    Multi-bot dropdown
│       └── [serverId]/
│           ├── layout.tsx      Server membership check
│           ├── page.tsx        Overview (stats + quick actions)
│           ├── settings/       Model selection (admin)
│           ├── lore/           Lore editor (admin)
│           └── history/        Channel message history
├── lib/
│   ├── auth.ts / auth.config.ts   NextAuth with Discord provider
│   ├── auth-helpers.ts            Permission checks + guild sync
│   ├── queries.ts                 Database + Redis queries
│   ├── db.ts                      PostgreSQL pool
│   ├── redis.ts                   ioredis client
│   ├── bots.ts                    Bot config parser
│   └── bot-cookie.ts              Bot selection cookie
├── middleware.ts                   Route protection
└── tests/
    ├── unit/
    │   ├── auth-helpers.test.ts   Permission + sync tests
    │   └── queries.test.ts        DB/Redis query tests
    └── helpers/mockDb.ts          Test utilities
```

## Key Patterns

- **Server Components by default** — `'use client'` only for sidebar, bot selector, and lore form
- **Server Actions** for mutations (model update, lore save) — no custom API routes
- **Multi-bot support** — `BOTS` env var parsed once, selected via cookie, hidden if only one bot
- **Tailwind CSS v4** — CSS-based config with `@theme` in `globals.css`, no `tailwind.config.ts`
- **Theme** — Light/dark modes via `.dark` class, indigo primary + cyan accent
