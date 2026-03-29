# Monorepo Restructure — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Restructure the Contexta Bot repository into a pnpm monorepo with 4 apps and 3 shared packages. Migrate existing code, add Drizzle ORM, scaffold the backend API and marketing website.

---

## Overview

The Contexta Bot codebase is currently a single-package TypeScript project with a separate Next.js dashboard. This spec restructures it into a production-grade pnpm monorepo with clear separation: deployable apps in `apps/`, shared libraries in `packages/`. This enables a backend API server, a marketing website, Stripe billing scaffolding, and shared types/schema via Drizzle.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo tooling | pnpm workspaces | Strict dependency isolation, fast installs |
| Folder convention | `apps/` + `packages/` | Industry standard, best tooling support |
| Backend framework | Hono | Lightweight, TypeScript-native, fast |
| ORM | Drizzle | SQL-like, good pgvector support, type generation |
| Marketing site | Next.js (SSG) | Same framework as dashboard, share UI components |
| Payments | Stripe | Standard SaaS billing (scaffolded, not fully implemented) |
| Deploy: bot + backend | Railway | Long-running processes |
| Deploy: dashboard + website | Vercel | Optimized for Next.js |

---

## 1. Target Structure

```
contexta/
├── pnpm-workspace.yaml
├── package.json                    ← Root: pnpm scripts, shared devDeps
├── tsconfig.base.json              ← Shared TS config (all packages extend)
├── .env.example                    ← Documents ALL env vars across all apps
├── .gitignore
├── apps/
│   ├── bot/                        ← Discord bot → Railway
│   │   ├── package.json            ← @contexta/bot
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── commands/           ← Slash commands (thin — call backend)
│   │       ├── events/             ← Discord event handlers
│   │       └── utils/              ← messageGuard, rateLimiter, redis
│   │
│   ├── backend/                    ← API server → Railway
│   │   ├── package.json            ← @contexta/backend
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            ← Hono server entry
│   │       ├── routes/             ← API route modules
│   │       ├── services/           ← LLM providers, embeddings, billing
│   │       └── middleware/         ← Auth, rate limiting, errors
│   │
│   ├── dashboard/                  ← Admin UI → Vercel
│   │   ├── package.json            ← @contexta/dashboard
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/                ← Next.js App Router
│   │       └── lib/                ← Dashboard helpers, API client
│   │
│   └── website/                    ← Marketing site → Vercel
│       ├── package.json            ← @contexta/website
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── app/                ← Marketing pages (SSG)
│           └── lib/
│
├── packages/
│   ├── db/                         ← Drizzle schema + migrations
│   │   ├── package.json            ← @contexta/db
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── schema.ts           ← Drizzle table definitions
│   │       ├── client.ts           ← Connection pool + typed client
│   │       ├── index.ts            ← Re-exports
│   │       └── migrations/         ← Versioned SQL migrations
│   │
│   ├── shared/                     ← Types, constants, validation
│   │   ├── package.json            ← @contexta/shared
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts            ← Shared interfaces
│   │       ├── constants.ts        ← Model names, limits, defaults
│   │       ├── validation.ts       ← Zod schemas for API payloads
│   │       └── index.ts            ← Re-exports
│   │
│   └── ui/                         ← Shared React components
│       ├── package.json            ← @contexta/ui
│       ├── tsconfig.json
│       └── src/
│           ├── components/         ← Buttons, cards, layout primitives
│           ├── styles/             ← Shared Tailwind theme/tokens
│           └── index.ts            ← Re-exports
```

---

## 2. Package Details

### `packages/db` — @contexta/db

**Purpose:** Single source of truth for database schema, types, and access.

**Schema conversion:** Convert existing `src/db/schema.sql` into Drizzle table definitions:
- `serverSettings` — server_id PK, active_model, server_lore, context_cache_id, cache_expires_at, is_active
- `globalUsers` — user_id PK, global_name, created_at, last_interaction
- `serverMembers` — composite PK (server_id, user_id), inferred_context, preferences (jsonb), interaction_count
- `channelMemoryVectors` — UUID PK, server_id, channel_id, summary_text, embedding (custom pgvector type), time_start, time_end
- `users` — id PK, username, avatar_url, created_at, updated_at
- `userServers` — composite PK (user_id, server_id), is_admin

**pgvector support:** Define a custom Drizzle column type for `vector(768)` using `customType`. The HNSW index is created in the initial migration SQL.

**Client:** Exports a configured Drizzle client wrapping `pg.Pool` with the SSL detection logic from the current `parseDbConfig()`. Consumers import `import { db } from '@contexta/db'`.

**Migrations:**
- Initial migration: generated from the Drizzle schema to match current production DB
- Future migrations: `pnpm --filter @contexta/db migrate` runs `drizzle-kit migrate`
- `drizzle.config.ts` reads `DATABASE_URL` from environment

**Exports:** `db` (Drizzle client), all table schemas, inferred types (`ServerSettings`, `User`, etc.), `searchSimilarMemory()` helper.

### `packages/shared` — @contexta/shared

**Purpose:** Cross-app types, constants, and validation schemas.

**Contents:**
- `types.ts`: `WorkerStats`, `AIProviderConfig`, `ApiResponse<T>`, API route types
- `constants.ts`: `SUPPORTED_MODELS` (the 6 model strings), `EMBEDDING_DIMS` (768), `MAX_DISCORD_MESSAGE_LENGTH` (2000), `RATE_LIMIT_WINDOW_MS`, Discord permission bit constants
- `validation.ts`: Zod schemas for API payloads — `UpdateLoreSchema`, `SwitchModelSchema`, `AskQuerySchema`, etc. Used by both backend (validation) and dashboard (form validation)

### `packages/ui` — @contexta/ui

**Purpose:** Shared React component library for dashboard and website.

**Initial contents:**
- Tailwind CSS preset with shared theme tokens (colors, fonts, spacing, border radii)
- Base layout components: `Container`, `Card`, `Button`, `Badge`
- Typography components: `Heading`, `Text`, `Code`
- Starts minimal — grows as patterns emerge between dashboard and website

**Build:** Uses `tsup` for building, exports ESM. Both Next.js apps import directly.

---

## 3. App Details

### `apps/bot` — @contexta/bot

**What stays:** `commands/`, `events/`, `utils/` (messageGuard, rateLimiter, redis), `index.ts`, `tests/`

**What moves out:**
- `src/llm/` → `apps/backend/src/services/llm/`
- `src/services/attachmentProcessor.ts` → `apps/backend/src/services/`
- `src/db/` → `packages/db/`
- `src/utils/backgroundWorker.ts` → `apps/backend/src/services/`
- `src/utils/httpServer.ts` → `apps/backend/` (the cron endpoint moves to backend)

**How commands change:** Commands that need AI (`/ask`, `/summarize`, `/recall`) make HTTP calls to the backend API instead of instantiating providers directly. Example:

```typescript
// apps/bot/src/commands/ask.ts — calls backend instead of provider directly
const response = await fetch(`${BACKEND_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${BOT_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ serverId, query: userQuery }),
});
```

**What stays local:** Redis (short-term message storage), message formatting, rate limiting, Discord event handling. These are tightly coupled to the Discord client and don't belong in the backend.

**HTTP server:** The bot keeps a minimal health endpoint (`GET /health`) for Railway. The cron embedding endpoint moves to the backend.

**Dependencies:** `discord.js`, `redis`, `@contexta/shared`, `@contexta/db` (read-only, for startup validation)

### `apps/backend` — @contexta/backend

**Purpose:** Central API server housing all business logic. Single point of enforcement for auth, billing, and rate limiting.

**Framework:** Hono — lightweight, TypeScript-native, middleware-based. Similar API to Express but built for modern runtimes.

**Routes:**

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/chat` | Generate AI response | Bot API key |
| POST | `/api/summarize` | Summarize messages | Bot API key |
| POST | `/api/embeddings/generate` | Generate embedding | Bot API key |
| POST | `/api/embeddings/run` | Trigger embedding worker | Cron secret |
| GET | `/api/servers/:id/settings` | Get server settings | Session token |
| PUT | `/api/servers/:id/settings` | Update settings (model switch) | Session token + admin |
| GET | `/api/servers/:id/lore` | Get server lore | Session token |
| PUT | `/api/servers/:id/lore` | Update lore | Session token + admin |
| GET | `/api/servers/:id/channels` | List channels with history | Session token |
| GET | `/api/servers/:id/channels/:channelId/history` | Get channel history | Session token |
| GET | `/api/users/:id/profile` | Get user profile | Session token |
| POST | `/api/billing/webhook` | Stripe webhook | Stripe signature |
| GET | `/api/billing/status` | Subscription status | Session token |
| GET | `/health` | Health check | None |

**Services (migrated from bot):**
- `services/llm/` — IAIProvider, GeminiProvider, OpenAIProvider, AnthropicProvider, providerRegistry
- `services/attachmentProcessor.ts` — attachment processing
- `services/embeddingWorker.ts` — background semantic embedding (reads Redis, writes to DB)
- `services/billing.ts` — Stripe integration (scaffolded)

**Middleware:**
- `authMiddleware` — validates bot API keys and session tokens
- `rateLimitMiddleware` — per-endpoint rate limiting
- `errorMiddleware` — consistent error responses

**Redis access:** Backend connects to the same Redis for the embedding worker (needs to read channel history). Uses the `redis` npm package (same as bot).

**Dependencies:** `hono`, `@node-rs/argon2` (password hashing if needed), `stripe`, `redis`, `@contexta/db`, `@contexta/shared`, `@google/genai`, `openai`, `@anthropic-ai/sdk`

### `apps/dashboard` — @contexta/dashboard

**What stays:** Next.js App Router pages, NextAuth with Discord, Tailwind

**What changes:**
- `src/lib/db.ts` → removed (no direct DB access)
- `src/lib/redis.ts` → removed (no direct Redis access)
- `src/lib/queries.ts` → replaced with `src/lib/api-client.ts` that calls backend
- Pages rewritten to fetch from backend API instead of querying DB directly

**API client pattern:**
```typescript
// apps/dashboard/src/lib/api-client.ts
export async function getServerSettings(serverId: string, sessionToken: string) {
  const res = await fetch(`${BACKEND_URL}/api/servers/${serverId}/settings`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return res.json();
}
```

**Dependencies:** `next`, `react`, `next-auth`, `@contexta/ui`, `@contexta/shared`

### `apps/website` — @contexta/website

**Purpose:** Marketing and documentation site. Statically generated.

**Pages (scaffolded, content deferred):**
- `/` — Landing page (hero, features, social proof)
- `/pricing` — Pricing tiers
- `/features` — Feature breakdown
- `/docs` — Documentation (MDX or similar)
- `/blog` — Blog (MDX)

**Initial implementation:** Scaffold with placeholder content. The actual marketing copy, design, and blog content are a separate spec.

**Dependencies:** `next`, `react`, `@contexta/ui`, `@contexta/shared`

---

## 4. Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json

```json
{
  "name": "contexta",
  "private": true,
  "scripts": {
    "dev:bot": "pnpm --filter @contexta/bot dev",
    "dev:backend": "pnpm --filter @contexta/backend dev",
    "dev:dashboard": "pnpm --filter @contexta/dashboard dev",
    "dev:website": "pnpm --filter @contexta/website dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "db:generate": "pnpm --filter @contexta/db generate",
    "db:migrate": "pnpm --filter @contexta/db migrate"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.1.1"
  }
}
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Each package/app has its own `tsconfig.json` that extends this and adds its own `paths`, `include`, etc.

---

## 5. Environment Variables

All apps read from their own `.env` files. Shared infrastructure vars:

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | db, backend | PostgreSQL connection |
| `REDIS_URL` | bot, backend | Redis connection |
| `DISCORD_TOKEN` | bot | Discord bot token |
| `DEV_GUILD_ID` | bot | Dev guild for instant command registration |
| `GEMINI_API_KEY` | backend | Gemini API |
| `OPENAI_API_KEY` | backend | OpenAI API |
| `ANTHROPIC_API_KEY` | backend | Anthropic API |
| `BOT_API_KEY` | bot, backend | Bot ↔ backend authentication |
| `BACKEND_URL` | bot, dashboard | Backend API URL |
| `CRON_SECRET` | backend | Cron endpoint auth |
| `NEXTAUTH_URL` | dashboard | NextAuth callback URL |
| `NEXTAUTH_SECRET` | dashboard | NextAuth session secret |
| `DISCORD_CLIENT_ID` | dashboard | Discord OAuth |
| `DISCORD_CLIENT_SECRET` | dashboard | Discord OAuth |
| `STRIPE_SECRET_KEY` | backend | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | backend | Stripe webhook verification |
| `PORT` | bot, backend | HTTP server port |

---

## 6. Testing Strategy

Each package and app has its own test suite, all using Vitest:

| Package/App | Test Types | What to Test |
|-------------|-----------|-------------|
| `packages/db` | Unit | Schema definitions, query helpers, pgvector custom type |
| `packages/shared` | Unit | Zod schemas, constants, type guards |
| `packages/ui` | Component | React component rendering (vitest + @testing-library/react) |
| `apps/bot` | Unit + Component | Commands, events, utils (existing tests migrated) |
| `apps/backend` | Unit + Component | Routes, services, middleware |
| `apps/dashboard` | Component | Pages, API client |
| `apps/website` | Component | Page rendering |

Existing bot tests migrate to `apps/bot/src/tests/`. Tests that cover moved code (LLM providers, etc.) migrate to `apps/backend/src/tests/`.

---

## 7. Decomposition Into Sub-Specs

This restructure is too large for a single implementation plan. It decomposes into these sub-specs, each with its own plan → implementation cycle:

### Sub-spec 1: Monorepo Scaffolding (this spec's implementation)
- Initialize pnpm workspace
- Create `packages/db` with Drizzle schema (convert from SQL)
- Create `packages/shared` with types and constants
- Create `packages/ui` with minimal components
- Move bot code to `apps/bot/` (preserve functionality, just relocate)
- Move dashboard to `apps/dashboard/` (preserve functionality, just relocate)
- Scaffold empty `apps/backend/` and `apps/website/`
- All existing tests pass in new locations
- Root scripts work (`pnpm build`, `pnpm test`)

### Sub-spec 2: Backend API Server (separate spec)
- Build out `apps/backend/` with Hono routes and services
- Migrate LLM providers and business logic from bot
- Implement auth middleware (bot API key + session tokens)
- Wire bot commands to call backend instead of local providers
- Wire dashboard to call backend instead of direct DB

### Sub-spec 3: Marketing Website (separate spec)
- Design and build `apps/website/` pages
- Landing, pricing, features, docs scaffolding
- Shared UI components between dashboard and website

### Sub-spec 4: Stripe Billing Integration (separate spec)
- Billing routes in backend
- Subscription management
- Usage tracking
- Pricing page integration

**This spec covers Sub-spec 1 only.** The implementation plan will focus on the scaffolding and code relocation — getting the monorepo working with all existing functionality preserved.

---

## 8. Files Created / Modified Summary

### New files
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `packages/db/` — package.json, drizzle.config.ts, tsconfig.json, src/schema.ts, src/client.ts, src/index.ts
- `packages/shared/` — package.json, tsconfig.json, src/types.ts, src/constants.ts, src/validation.ts, src/index.ts
- `packages/ui/` — package.json, tsconfig.json, src/components/, src/styles/, src/index.ts
- `apps/backend/` — package.json, tsconfig.json, src/index.ts (minimal scaffold)
- `apps/website/` — package.json, next.config.ts, tsconfig.json, src/app/ (minimal scaffold)

### Moved files
- `src/` → `apps/bot/src/`
- `dashboard/` → `apps/dashboard/`
- `src/db/schema.sql` → converted to `packages/db/src/schema.ts`
- `src/db/index.ts` → split into `packages/db/src/client.ts` (connection) and kept in bot for `searchSimilarMemory` until backend migration

### Modified files
- Root `package.json` — becomes workspace root
- `.gitignore` — add pnpm patterns
- `CLAUDE.md` — update paths and commands

### Deleted after migration
- `dashboard/src/lib/db.ts` — replaced by `@contexta/db` (in sub-spec 2)
- `dashboard/src/lib/redis.ts` — replaced by backend API (in sub-spec 2)
