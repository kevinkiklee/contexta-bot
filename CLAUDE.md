# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot-reload via tsx)
npm run dev

# Build TypeScript to dist/
npm run build

# Run compiled bot
npm start
```

There are no tests configured in this project.

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DISCORD_TOKEN` — Discord bot token
- `GEMINI_API_KEY` — Google Gemini API key
- `DATABASE_URL` — PostgreSQL connection string (pgvector must be enabled)
- `REDIS_URL` — Redis connection string

SSL handling: `src/db/index.ts` strips `sslmode` from `DATABASE_URL` and auto-detects local connections to disable SSL. Set `DISABLE_DB_SSL=true` to force-disable it.

## Architecture

The bot is an ES module TypeScript project (`"type": "module"`, `module: Node16`). Imports must use `.js` extensions even for `.ts` source files.

### Entry Point & Bootstrapping (`src/index.ts`)

Initializes Redis, then dynamically loads event handlers from `src/events/` by scanning the directory. Commands in `src/commands/` are NOT auto-loaded — they must be registered in a `loadCommands()` function and added to `(client as any).commands` Collection (this is incomplete in the current codebase).

### Tiered Memory Architecture

| Layer | Tech | Purpose |
|---|---|---|
| Short-term | Redis | Rolling window of last 50 messages per channel, keyed `channel:{channelId}:history` |
| Long-term | PostgreSQL + pgvector | Summarized conversation chunks stored as 768-dim vectors (cosine similarity via HNSW index) |
| Server context | Gemini Context Caching API | Server lore/rules cached with TTL to reduce token costs |

### Model Abstraction Layer (`src/llm/`)

`IAIProvider` interface defines `generateChatResponse`, `generateEmbedding`, `summarizeText`, and `createServerContextCache`. `GeminiProvider` implements this using `gemini-2.5-flash` for generation and `text-embedding-004` for embeddings. New LLM providers must implement `IAIProvider`. The active model per server is stored in the `server_settings.active_model` DB column.

### Message Flow (`src/events/messageCreate.ts`)

Every message is appended to Redis with format `[User: DisplayName]: content`. The bot only calls the LLM and replies when directly mentioned. Bot responses are stored back as `[System/Contexta]: content`.

### Background Worker (`src/utils/backgroundWorker.ts`)

`runSemanticEmbeddingWorker()` scans all Redis channel history keys, summarizes batches of 10+ messages via Gemini, generates embeddings, and inserts them into `channel_memory_vectors`. The `setInterval` call in `src/index.ts` is currently commented out.

### Database (`src/db/`)

- `src/db/schema.sql` — apply manually to initialize the database (includes pgvector extension, all tables, and indexes)
- `src/db/index.ts` — exports `pool`, `query()`, and `searchSimilarMemory(serverId, channelId, embedding, limit)`

**Critical:** All pgvector queries must filter by `server_id` to enforce strict data isolation between Discord servers.

### Slash Commands (`src/commands/`)

Files: `ask.ts`, `summarize.ts`, `recall.ts`, `settings.ts`, `lore.ts`, `profile.ts`. Dispatched via `src/events/interactionCreate.ts` which reads from `client.commands` Collection.

## Deployment

Targets Railway (PaaS). The main branch triggers automated builds. PostgreSQL and Redis run as Railway internal services on the same private network as the Node process.
