# Complete Bot Features — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Finish all incomplete subsystems — command registration, background worker, stub commands, multi-provider LLM support, and Gemini context caching.

---

## Overview

The Contexta bot has a solid foundation but several subsystems are incomplete: 4 of 6 slash commands are stubs, command auto-discovery is missing, the background embedding worker is disabled, and context caching is mocked. This spec completes all of them in sequential dependency order, and adds OpenAI + Anthropic as additional LLM providers.

## Sequential Execution Order

1. Command auto-discovery and registration
2. HTTP server for cron endpoint
3. Background worker activation via cron trigger
4. Multi-provider architecture (OpenAI, Anthropic, provider registry)
5. Implement stub commands (`/ask`, `/summarize`, `/lore`, `/settings`, `/profile`) — includes model switching across all 3 providers
6. Gemini context caching (real File API implementation)
7. Wire providers and caching into `messageCreate.ts`

---

## 1. Command Auto-Discovery

### What changes

New `loadCommands()` function in `src/index.ts`, mirroring the existing `loadEvents()` pattern.

### Behavior

- Scans `src/commands/` for `.js`/`.ts` files at startup
- Each command file exports `data` (SlashCommandBuilder) and `execute` — the loader dynamically imports both
- Stores commands in `client.commands` Collection keyed by `data.name`
- After loading, registers all commands with Discord's API via `client.application.commands.set()`
- **Guild-scoped vs global:** If `DEV_GUILD_ID` env var is set, registers commands to that guild (instant updates for development). Otherwise, registers globally (up to 1 hour propagation).
- Registration happens in the `client.once('ready')` callback, since `client.application` is only available after login

### Files touched

- `src/index.ts` — add `loadCommands()`, call it in `start()`, add `ready` event for registration

### No changes needed

- `src/events/interactionCreate.ts` — already reads from `client.commands` Collection

---

## 2. HTTP Server for Cron Endpoint

### What changes

Add a lightweight HTTP server to the bot process for Railway cron to trigger.

### Behavior

- Uses Node's built-in `http.createServer` — no new dependencies
- Listens on `PORT` env var (Railway sets this automatically) or `3000` as default
- Single route: `POST /cron/embeddings`
- Protected by `CRON_SECRET` env var — request must include `Authorization: Bearer <CRON_SECRET>` header. Returns `401 Unauthorized` otherwise.
- Returns JSON response with worker stats on success, or error details on failure
- Health check: `GET /health` returns `200 OK` (useful for Railway health checks)
- All other routes return `404`

### Files touched

- `src/index.ts` — add `startHttpServer()` called from `start()`, after `client.login()`

### New environment variables

- `CRON_SECRET` — shared secret for authenticating cron requests
- `PORT` — server port (Railway auto-sets this)

---

## 3. Background Worker Activation

### What changes

Re-enable the semantic embedding pipeline via the cron endpoint instead of `setInterval`.

### Behavior

- Remove the commented-out `setInterval(runSemanticEmbeddingWorker, ...)` from `src/index.ts`
- The `POST /cron/embeddings` handler calls `runSemanticEmbeddingWorker()` directly
- **Idempotency guard:** At the start of each run, set a Redis key `worker:embedding:running` with a 5-minute TTL. If the key already exists, skip the run and return `{ status: 'skipped', reason: 'already_running' }`.
- Clear the Redis key on completion (or let it expire on crash)
- The HTTP response includes: `{ status: 'completed', channelsProcessed: N, embeddingsCreated: N, errors: [...] }`

### Files touched

- `src/utils/backgroundWorker.ts` — add idempotency guard and return stats object
- `src/index.ts` — remove commented-out `setInterval`, wire cron handler to worker

---

## 4. Multi-Provider Architecture

### New provider implementations

#### `src/llm/OpenAIProvider.ts`

Implements `IAIProvider` using the `openai` npm package.

| Method | Model | Notes |
|--------|-------|-------|
| `generateChatResponse` | Configurable (default `gpt-4o`) | Maps `{role, parts}` → OpenAI `{role, content}` format. `model` role maps to `assistant`. |
| `generateEmbedding` | N/A | **Delegates to GeminiProvider** (see embedding decision below) |
| `summarizeText` | `gpt-4o-mini` | Cheaper model for background summarization |
| `describeAttachment` | Same as chat model | Vision-capable, base64 image input |
| `createServerContextCache` | N/A | Returns no-op string — OpenAI has no equivalent |

#### `src/llm/AnthropicProvider.ts`

Implements `IAIProvider` using the `@anthropic-ai/sdk` npm package.

| Method | Model | Notes |
|--------|-------|-------|
| `generateChatResponse` | Configurable (default `claude-sonnet-4-20250514`) | Maps `{role, parts}` → Anthropic `{role, content}` format. System prompt passed via `system` parameter. |
| `generateEmbedding` | N/A | **Delegates to GeminiProvider** (Anthropic has no embedding API) |
| `summarizeText` | `claude-haiku-4-5-20251001` | Fast and cheap for summarization |
| `describeAttachment` | Same as chat model | Vision-capable, base64 image input |
| `createServerContextCache` | N/A | Returns no-op string — Anthropic has no equivalent |

### Embedding decision: Always use Gemini

All embeddings go through `GeminiProvider.generateEmbedding()` (`text-embedding-004`, 768 dims) regardless of the server's active chat model. Rationale:

- The database has `VECTOR(768)` columns with an HNSW index tuned for cosine similarity
- OpenAI embeddings are 1536-dim — mixing dimensions in the same table is not possible
- Embedding and chat are independent concerns — semantic search quality doesn't depend on which model handles conversation
- Avoids re-embedding the entire vector store when a server switches chat models

Both `OpenAIProvider` and `AnthropicProvider` accept a `GeminiProvider` instance in their constructor for embedding delegation.

### Provider registry: `src/llm/providerRegistry.ts`

```typescript
getProvider(modelName: string): IAIProvider
```

- Maps model string prefixes to provider classes: `gemini-*` → GeminiProvider, `gpt-*` → OpenAIProvider, `claude-*` → AnthropicProvider
- `GeminiProvider` and `OpenAIProvider` accept `modelName` as a constructor parameter to support different model variants within the same provider
- Caches provider instances per model string (avoids re-creating SDK clients)
- Validates that the required API key env var is present before instantiation. Throws a descriptive error if missing (e.g., "OPENAI_API_KEY is required to use gpt-4o").

### New dependencies

- `openai` — OpenAI Node.js SDK
- `@anthropic-ai/sdk` — Anthropic Node.js SDK

### New environment variables

- `OPENAI_API_KEY` — required only if a server selects an OpenAI model
- `ANTHROPIC_API_KEY` — required only if a server selects an Anthropic model

---

## 5. Implement Stub Commands

### `/ask` — Direct question to the bot

- Fetch server's active model from `server_settings` (query by `interaction.guildId`)
- Build a single-turn conversation: system prompt (including server lore if available) + user query
- Call `getProvider(activeModel).generateChatResponse()`
- Reply with the response, respecting the `private` (ephemeral) option
- Truncate response to 2000 chars (Discord limit) or split into multiple messages

### `/summarize` — Channel catch-up

- **Data source:** Use Discord's API (`channel.messages.fetch()`) with a `after` snowflake computed from the `hours` parameter. Redis only holds 50 messages and a 168-hour window will exceed that.
- Fetch up to 500 messages from the target channel within the time window (paginate with `before`/`after` if needed)
- Format messages as `[Username]: content` and pass to `getProvider(activeModel).summarizeText()`
- Reply with the summary. If it exceeds 2000 chars, split across multiple messages.
- Handle edge case: if no messages found in the time range, reply "No messages found in that time range."

### `/lore` — Server lore management

- **view:** Query `server_settings.server_lore WHERE server_id = guildId`. Reply with the lore text or "No lore configured for this server."
- **update:** Upsert `server_settings` row — `INSERT INTO server_settings (server_id, server_lore) VALUES ($1, $2) ON CONFLICT (server_id) DO UPDATE SET server_lore = $2`. Also clear `context_cache_id` and `cache_expires_at` (invalidate stale cache). Reply with confirmation.
- Both actions reply ephemerally.

### `/settings` — Bot configuration

#### `/settings model`

- Expand the choices list to include all supported models:
  - `gemini-2.5-flash`, `gemini-2.5-pro` (Gemini)
  - `gpt-4o`, `gpt-4o-mini` (OpenAI)
  - `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001` (Anthropic)
- Before applying: validate that the required API key is present via the provider registry. If missing, reply with an error: "Cannot switch to {model} — the required API key is not configured."
- Update `server_settings.active_model` for the guild
- Reply with confirmation including the new model name

#### `/settings cache refresh`

- Fetch current `server_lore` from `server_settings`
- If no lore exists, reply "No server lore to cache. Use /lore update first."
- Call `getProvider(activeModel).createServerContextCache(lore, 60)`
- Store returned cache ID and expiry (`NOW() + 60 minutes`) in `server_settings.context_cache_id` and `cache_expires_at`
- If the active model doesn't support caching (OpenAI/Anthropic), reply "Context caching is only available with Gemini models."

#### `/settings cache clear`

- Set `context_cache_id = NULL` and `cache_expires_at = NULL` in `server_settings`
- Reply with confirmation

### `/profile` — User profile viewer

- Query `server_members` joined with `global_users` for the target user in the current guild
- Format reply with: display name, `inferred_context`, `preferences` (pretty-printed JSON), `interaction_count`, `last_interaction` timestamp
- If no record exists: "No profile data for this user yet. Contexta builds profiles as users interact in the server."
- Reply ephemerally (admin-only data)

---

## 6. Gemini Context Caching (Real Implementation)

### What changes

Replace the mock in `GeminiProvider.createServerContextCache()` with a real Gemini Caching API call.

### Behavior

- Use `ai.caches.create()` from the `@google/genai` SDK
- Pass server lore as content with the target model (`gemini-2.5-flash`)
- Set TTL via `ttlSeconds` (convert from the `ttlMinutes` parameter)
- Return the cache `name` (e.g., `cachedContents/abc123`)

### Using the cache in `generateChatResponse`

- When `cacheOptions.cacheId` is provided and non-empty, pass it as `cachedContent` in the API request config
- When using a cached context, do NOT also send `systemInstruction` (the cache already contains it)
- If the cache has expired (API returns an error), fall back to `systemInstruction` and log a warning

---

## 7. Wiring Into messageCreate.ts

### Changes to message handling

- Replace hardcoded `new GeminiProvider()` in `defaultDeps` with a dynamic lookup:
  - Fetch `server_settings` for the current guild (active model, lore, cache ID, cache expiry)
  - Use `getProvider(activeModel)` from the registry
- Include `server_lore` in the system prompt (appended after the base Contexta personality prompt)
- If `context_cache_id` exists and `cache_expires_at > NOW()`, pass it via `cacheOptions.cacheId` to `generateChatResponse`
- The `MessageCreateDeps` interface gets an optional `getProvider` function for testability

### Changes to backgroundWorker.ts

- Always use `GeminiProvider` for both summarization and embeddings (background job, provider-independent)
- No changes to the worker pipeline logic itself

### Schema migration

Add a migration file `src/db/migrations/001-expand-model-choices.sql`:

```sql
-- No structural changes needed. The active_model column is VARCHAR(50) with no CHECK constraint.
-- This migration documents the expanded set of valid model values:
--   gemini-2.5-flash, gemini-2.5-pro (Gemini)
--   gpt-4o, gpt-4o-mini (OpenAI)
--   claude-sonnet-4-20250514, claude-haiku-4-5-20251001 (Anthropic)
-- The default remains 'gemini-2.5-flash'.
```

Since `active_model` is a plain `VARCHAR(50)` with no CHECK constraint, no actual DDL change is needed — validation happens in the provider registry at runtime.

---

## Testing Strategy

Each section gets tests following the existing patterns:

| Section | Test Type | What to Test |
|---------|-----------|-------------|
| Command auto-discovery | Unit | `loadCommands()` finds and loads all command files |
| HTTP server | Component | Auth enforcement, route handling, 404s |
| Background worker | Component | Idempotency guard, stats reporting |
| OpenAIProvider | Unit | Message format mapping, API call structure |
| AnthropicProvider | Unit | Message format mapping, system prompt handling |
| Provider registry | Unit | Prefix routing, caching, missing key errors |
| `/ask` | Component | AI call, ephemeral option, truncation |
| `/summarize` | Component | Discord API fetch, time filtering, empty results |
| `/lore` | Component | View/update, upsert, cache invalidation |
| `/settings` | Component | Model switch validation, cache refresh/clear |
| `/profile` | Component | Data formatting, missing user handling |
| Context caching | Unit | Cache creation, cache usage in chat, expiry fallback |

All new providers use the existing mock patterns (`mockAIProvider.ts` extended, new mocks for OpenAI/Anthropic SDKs).

---

## New Environment Variables Summary

| Variable | Required | Purpose |
|----------|----------|---------|
| `DEV_GUILD_ID` | No | Guild ID for instant command registration during development |
| `CRON_SECRET` | Yes (prod) | Authenticates Railway cron requests to the HTTP endpoint |
| `PORT` | No | HTTP server port (Railway auto-sets, defaults to 3000) |
| `OPENAI_API_KEY` | No | Required only if a server selects an OpenAI model |
| `ANTHROPIC_API_KEY` | No | Required only if a server selects an Anthropic model |

---

## Files Created / Modified Summary

### New files

- `src/llm/OpenAIProvider.ts`
- `src/llm/AnthropicProvider.ts`
- `src/llm/providerRegistry.ts`
- `src/db/migrations/001-expand-model-choices.sql`

### Modified files

- `src/index.ts` — `loadCommands()`, `startHttpServer()`, remove `setInterval`
- `src/utils/backgroundWorker.ts` — idempotency guard, stats return
- `src/commands/ask.ts` — full implementation
- `src/commands/summarize.ts` — full implementation
- `src/commands/lore.ts` — full implementation
- `src/commands/settings.ts` — expanded model choices, full implementation
- `src/commands/profile.ts` — full implementation
- `src/llm/GeminiProvider.ts` — real context caching, `modelName` constructor param
- `src/events/messageCreate.ts` — dynamic provider lookup, lore in system prompt, cache usage
- `package.json` — add `openai` and `@anthropic-ai/sdk` dependencies
- `.env.example` — document new env vars

### No structural database changes

The existing schema supports everything. The `active_model` column is unconstrained VARCHAR.
