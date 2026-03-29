# Backend API Server — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Build the Hono API server in `apps/backend/`, migrate LLM providers and business logic from the bot, create API routes for bot and dashboard consumption, and rewire bot commands to call the backend over HTTP.

---

## Overview

The backend API server (`@contexta/backend`) becomes the single source of truth for all business logic — AI chat, summarization, embeddings, server settings, lore management, and profile queries. The bot becomes a thin Discord client that forwards requests to the backend via HTTP. The dashboard will also call the backend instead of querying the DB directly (dashboard rewiring is deferred to the dashboard's own spec).

## Architecture

```
Discord ←→ Bot (apps/bot)
              │ HTTP (BOT_API_KEY)
              ▼
         Backend (apps/backend)
              │
              ├── LLM Providers (Gemini, OpenAI, Anthropic)
              ├── Redis (channel history for worker)
              └── PostgreSQL via @contexta/db
              │
Dashboard ──→ Backend (session tokens, future spec)
```

---

## 1. Backend Route Structure

All routes under `/api/`. Two auth schemes: bot API key (for bot-to-backend calls) and session tokens (for dashboard, future spec).

### Bot-facing routes (auth: `BOT_API_KEY`)

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| POST | `/api/chat` | Generate AI chat response | `{ serverId, systemPrompt, chatHistory }` | `{ response: string }` |
| POST | `/api/summarize` | Summarize text | `{ serverId, text }` | `{ summary: string }` |
| POST | `/api/embeddings/generate` | Generate embedding vector | `{ text }` | `{ embedding: number[] }` |
| POST | `/api/embeddings/search` | Search similar memories | `{ serverId, channelId, embedding, limit? }` | `{ results: MemoryResult[] }` |
| POST | `/api/attachments/describe` | Describe an attachment | `{ mimeType, base64Data, fileName, serverId }` | `{ description: string }` |
| GET | `/api/servers/:id/settings` | Get server settings | — | `{ settings: ServerSettings }` |
| PUT | `/api/servers/:id/settings/model` | Switch active model | `{ model }` | `{ success: true }` |
| GET | `/api/servers/:id/lore` | Get server lore | — | `{ lore: string \| null }` |
| PUT | `/api/servers/:id/lore` | Update lore | `{ text }` | `{ success: true }` |
| GET | `/api/servers/:id/profile/:userId` | Get user profile | — | `{ profile: ServerMember }` |
| POST | `/api/cache/refresh` | Refresh context cache | `{ serverId }` | `{ cacheId: string }` |
| DELETE | `/api/cache/:serverId` | Clear context cache | — | `{ success: true }` |

### Infrastructure routes (no auth or cron auth)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/health` | Health check | None |
| POST | `/api/cron/embeddings` | Trigger embedding worker | `CRON_SECRET` |

---

## 2. Backend File Structure

```
apps/backend/src/
├── index.ts                    ← Hono app + server startup
├── routes/
│   ├── chat.ts                 ← POST /api/chat, POST /api/summarize
│   ├── embeddings.ts           ← POST /api/embeddings/generate, /search, POST /api/cron/embeddings
│   ├── attachments.ts          ← POST /api/attachments/describe
│   ├── servers.ts              ← GET/PUT /api/servers/:id/settings, lore, profile
│   └── cache.ts                ← POST /api/cache/refresh, DELETE /api/cache/:serverId
├── services/
│   ├── llm/
│   │   ├── IAIProvider.ts      ← Interface (copied from bot)
│   │   ├── GeminiProvider.ts   ← Gemini implementation (copied from bot)
│   │   ├── OpenAIProvider.ts   ← OpenAI implementation (copied from bot)
│   │   ├── AnthropicProvider.ts← Anthropic implementation (copied from bot)
│   │   └── providerRegistry.ts ← Model → provider routing (copied from bot)
│   ├── attachmentProcessor.ts  ← Attachment handling (copied from bot)
│   └── embeddingWorker.ts      ← Background embedding pipeline (adapted from bot)
├── middleware/
│   ├── auth.ts                 ← BOT_API_KEY validation
│   └── errors.ts               ← Error handling middleware
└── lib/
    └── redis.ts                ← Redis client for embedding worker
```

---

## 3. Service Migration

### What moves from bot to backend (copy, not delete yet)

| Bot file | Backend destination | Changes |
|----------|-------------------|---------|
| `src/llm/IAIProvider.ts` | `services/llm/IAIProvider.ts` | None |
| `src/llm/GeminiProvider.ts` | `services/llm/GeminiProvider.ts` | None |
| `src/llm/OpenAIProvider.ts` | `services/llm/OpenAIProvider.ts` | None |
| `src/llm/AnthropicProvider.ts` | `services/llm/AnthropicProvider.ts` | None |
| `src/llm/providerRegistry.ts` | `services/llm/providerRegistry.ts` | None |
| `src/services/attachmentProcessor.ts` | `services/attachmentProcessor.ts` | None |
| `src/utils/backgroundWorker.ts` | `services/embeddingWorker.ts` | Use `@contexta/db` instead of local db |

### What stays in bot

- `commands/` — rewired to call backend HTTP API
- `events/` — `messageCreate.ts` rewired to call backend for AI
- `utils/messageGuard.ts` — bot-specific message formatting
- `utils/rateLimiter.ts` — bot-specific rate limiting
- `utils/redis.ts` — bot's Redis connection for message history
- `utils/httpServer.ts` — simplified to health-only (cron moves to backend)
- `db/index.ts` — kept temporarily for `searchSimilarMemory` used in tests; will be removed when bot fully decoupled

### What gets deleted from bot after rewiring

- `src/llm/` — entire directory (providers now live in backend)
- `src/services/attachmentProcessor.ts` — now in backend
- `src/utils/backgroundWorker.ts` — now in backend
- AI SDK dependencies from `apps/bot/package.json`: `@google/genai`, `openai`, `@anthropic-ai/sdk`

---

## 4. Bot Command Rewiring

Each command/handler that currently calls AI directly gets a `backendClient` helper.

### Backend client utility (`apps/bot/src/lib/backendClient.ts`)

```typescript
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BOT_API_KEY = process.env.BOT_API_KEY || '';

export async function backendPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Backend ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function backendGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${BOT_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Backend ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

### Command changes

| Command | Current behavior | New behavior |
|---------|-----------------|-------------|
| `/ask` | Calls `getProvider(model).generateChatResponse()` | Calls `backendPost('/api/chat', { serverId, systemPrompt, chatHistory })` |
| `/summarize` | Calls `getProvider(model).summarizeText()` | Calls `backendPost('/api/summarize', { serverId, text })` |
| `/recall` | Calls `ai.generateEmbedding()` + `searchSimilarMemory()` | Calls `backendPost('/api/embeddings/generate')` + `backendPost('/api/embeddings/search')` |
| `/settings model` | Calls `getProvider()` to validate, then writes DB | Calls `backendPut('/api/servers/:id/settings/model')` |
| `/settings cache` | Calls `getProvider().createServerContextCache()` | Calls `backendPost('/api/cache/refresh')` or `backendDelete()` |
| `/lore` | Queries/writes DB directly | Calls `backendGet/Put('/api/servers/:id/lore')` |
| `/profile` | Queries DB directly | Calls `backendGet('/api/servers/:id/profile/:userId')` |
| `messageCreate` (mention) | Calls `getProvider().generateChatResponse()` | Calls `backendPost('/api/chat')` |

### httpServer.ts simplification

The bot's HTTP server keeps only `GET /health`. The `POST /cron/embeddings` endpoint moves to the backend.

---

## 5. Auth Middleware

### Bot API key auth (`middleware/auth.ts`)

Simple bearer token check for bot-to-backend calls:

```typescript
// Validates: Authorization: Bearer <BOT_API_KEY>
```

The `BOT_API_KEY` is a shared secret between bot and backend, set in both `.env` files. This is sufficient for service-to-service auth within Railway's private network.

### Cron auth

The `POST /api/cron/embeddings` endpoint checks `Authorization: Bearer <CRON_SECRET>` — same pattern as the current bot's cron endpoint.

### Dashboard auth (deferred)

Session token validation for dashboard routes is deferred to the dashboard rewiring spec. For now, the `GET /api/servers/:id/*` routes use the same `BOT_API_KEY` auth so the bot can call them.

---

## 6. Error Handling

### Error middleware (`middleware/errors.ts`)

Catches all errors and returns consistent JSON:

```json
{ "success": false, "error": "Human-readable message" }
```

Status codes:
- 400 — validation errors (Zod parse failures)
- 401 — missing or invalid auth
- 404 — resource not found
- 500 — internal server error

### Validation

All POST request bodies validated with Zod schemas from `@contexta/shared`. Invalid requests return 400 with the Zod error message.

---

## 7. Backend Dependencies

### New dependencies for `apps/backend/package.json`

```
dependencies:
  hono, @hono/node-server          ← already installed
  dotenv                           ← already installed
  @google/genai                    ← from bot
  openai                           ← from bot
  @anthropic-ai/sdk                ← from bot
  pg                               ← for raw queries
  redis                            ← for embedding worker
  @contexta/db                     ← workspace package
  @contexta/shared                 ← workspace package
```

### Removed from `apps/bot/package.json`

```
- @google/genai
- openai
- @anthropic-ai/sdk
- pg (kept if searchSimilarMemory still used locally, removed if fully proxied)
```

---

## 8. Testing Strategy

### Backend tests

| File | Type | What to test |
|------|------|-------------|
| `routes/chat.test.ts` | Component | Chat endpoint with mocked provider |
| `routes/embeddings.test.ts` | Component | Embedding generation and search |
| `routes/servers.test.ts` | Component | Settings, lore, profile CRUD |
| `routes/cache.test.ts` | Component | Cache refresh and clear |
| `middleware/auth.test.ts` | Unit | API key validation, 401 on missing/wrong |
| `services/llm/providerRegistry.test.ts` | Unit | Migrated from bot (same tests) |

### Bot test updates

Existing bot command tests need updating — instead of mocking AI providers, they mock the `backendClient` functions. The test structure stays the same, just the mock target changes.

---

## 9. Files Created / Modified / Deleted

### New files (backend)
- `apps/backend/src/routes/chat.ts`
- `apps/backend/src/routes/embeddings.ts`
- `apps/backend/src/routes/attachments.ts`
- `apps/backend/src/routes/servers.ts`
- `apps/backend/src/routes/cache.ts`
- `apps/backend/src/services/llm/IAIProvider.ts`
- `apps/backend/src/services/llm/GeminiProvider.ts`
- `apps/backend/src/services/llm/OpenAIProvider.ts`
- `apps/backend/src/services/llm/AnthropicProvider.ts`
- `apps/backend/src/services/llm/providerRegistry.ts`
- `apps/backend/src/services/attachmentProcessor.ts`
- `apps/backend/src/services/embeddingWorker.ts`
- `apps/backend/src/middleware/auth.ts`
- `apps/backend/src/middleware/errors.ts`
- `apps/backend/src/lib/redis.ts`

### New files (bot)
- `apps/bot/src/lib/backendClient.ts`

### Modified files (bot)
- `apps/bot/src/commands/ask.ts` — use backendClient
- `apps/bot/src/commands/summarize.ts` — use backendClient
- `apps/bot/src/commands/recall.ts` — use backendClient
- `apps/bot/src/commands/settings.ts` — use backendClient
- `apps/bot/src/commands/lore.ts` — use backendClient
- `apps/bot/src/commands/profile.ts` — use backendClient
- `apps/bot/src/events/messageCreate.ts` — use backendClient for AI calls
- `apps/bot/src/utils/httpServer.ts` — remove cron endpoint, health only
- `apps/bot/package.json` — remove AI SDK dependencies
- Bot test files — update mocks to target backendClient instead of AI providers

### Deleted files (bot)
- `apps/bot/src/llm/` — entire directory
- `apps/bot/src/services/attachmentProcessor.ts`
- `apps/bot/src/utils/backgroundWorker.ts`
