# Testing Suite Design — Contexta

**Date:** 2026-03-23
**Approach:** Bottom-Up Unit-First (full coverage pyramid)

## Goals

- Full test pyramid: unit → component → integration
- Extract business logic from Discord-coupled handlers into testable functions
- Refactor the background worker into independently testable pipeline stages
- Real PostgreSQL integration tests gated behind an env var for CI
- Shared test helpers to keep individual test files focused on behavior

## Test Infrastructure & Conventions

### File Organization

```
src/tests/
├── unit/
│   ├── rateLimiter.test.ts           (migrated from existing)
│   ├── messageGuard.test.ts          (migrated from existing)
│   ├── dbConfig.test.ts              (new)
│   ├── searchSimilarMemory.test.ts   (new)
│   └── workerPipeline.test.ts        (new)
├── component/
│   ├── messageCreate.test.ts         (new)
│   ├── recall.test.ts                (new)
│   ├── ask.test.ts                   (new)
│   ├── summarize.test.ts             (new)
│   ├── interactionCreate.test.ts     (new)
│   └── backgroundWorker.test.ts      (new)
├── integration/
│   └── db.integration.test.ts        (new)
└── helpers/
    ├── mockAIProvider.ts
    ├── mockDiscord.ts
    ├── mockRedis.ts
    └── mockDb.ts
```

### Conventions

- Existing tests move from `src/tests/` into `src/tests/unit/`.
- Integration tests use `.integration.test.ts` suffix for Vitest filtering.
- `helpers/` contains shared factories only, no test suites.
- All imports use `.js` extensions per the project's ESM convention.

### Vitest Config Changes

- Default `vitest run` excludes `*.integration.test.ts`.
- A separate Vitest project (or workspace entry) includes integration tests and requires `TEST_DATABASE_URL`.
- Add a `test:integration` npm script for running the integration suite.

## Refactoring — Extracting Testable Seams

### 2a. DB Config Parsing → Pure Function

Extract the URL/SSL logic from `src/db/index.ts` into a pure, exported function:

```typescript
export function parseDbConfig(rawUrl: string, disableSslEnv?: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: true };
}
```

Takes a raw URL and the `DISABLE_DB_SSL` env value. Returns the connection string (query params stripped) and the SSL config. The `pool` creation remains in `src/db/index.ts` and calls this function.

**Enables:** unit tests for every SSL/URL parsing edge case with zero mocking.

### 2b. Background Worker → Pipeline Stages

Decompose `runSemanticEmbeddingWorker()` into four functions, each receiving dependencies as arguments:

```typescript
// Stage 1: fetch all channels with ≥10 messages and a valid server mapping
export async function fetchEligibleChannels(
  redis: RedisClientType
): Promise<{ channelId: string; serverId: string; messages: string[] }[]>

// Stage 2: summarize a batch of messages via the AI provider
export async function summarizeBatch(
  ai: IAIProvider, messages: string[]
): Promise<string>

// Stage 3: generate an embedding from summary text
export async function embedSummary(
  ai: IAIProvider, summary: string
): Promise<number[]>

// Stage 4: store the vector in PostgreSQL
export async function storeMemoryVector(
  db: { query: (text: string, params?: any[]) => Promise<any> },
  serverId: string, channelId: string, summary: string, embedding: number[]
): Promise<void>

// Orchestrator: thin glue calling the four stages
export async function runSemanticEmbeddingWorker(
  redis: RedisClientType, ai: IAIProvider, db: typeof pool
): Promise<void>
```

### 2c. Command Handlers → Dependency Injection

Command `execute` functions accept an optional `deps` parameter that defaults to real implementations. Tests pass fakes.

**Rate limiter strategy:** `isRateLimited` is a pure, stateful function with no external dependencies — it is already unit-tested via `rateLimiter.test.ts`. In component tests for handlers that use it, we use `vi.mock('../utils/rateLimiter.js')` to control its return value. This is the one module-level mock we allow; it is justified because `isRateLimited` is a cross-cutting concern (used identically in every handler) and injecting it via `deps` in every handler would add boilerplate with no design benefit. All other dependencies (AI, Redis, DB) are injected via `deps`.

```typescript
// Example: src/commands/recall.ts
interface RecallDeps {
  ai: IAIProvider;
  searchMemory: typeof searchSimilarMemory;
}

const defaultDeps: RecallDeps = {
  ai: new GeminiProvider(),
  searchMemory: searchSimilarMemory,
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: RecallDeps = defaultDeps
) { ... }
```

Same pattern for `messageCreate.ts`:

```typescript
// src/events/messageCreate.ts
interface MessageCreateDeps {
  ai: IAIProvider;
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
  };
}

const defaultDeps: MessageCreateDeps = {
  ai: new GeminiProvider(),
  redis: redisClient,
};

export async function execute(
  message: Message,
  deps: MessageCreateDeps = defaultDeps
) { ... }
```

The `execute` function uses `deps.redis` instead of importing `redisClient` directly, and `deps.ai` instead of a module-scoped `new GeminiProvider()`. Tests pass fakes via the `deps` parameter; production callers pass nothing (defaults kick in).

Stub commands (`ask`, `summarize`, `lore`, `settings`, `profile`) don't need this yet — the pattern is applied when their implementations are filled in.

The `interactionCreate.ts` dispatcher already calls `command.execute(interaction)` — it does not need to know about the extra parameter.

## Test Helpers

### `mockAIProvider.ts`

```typescript
import type { IAIProvider } from '../../llm/IAIProvider.js';

export function createMockAIProvider(overrides?: Partial<IAIProvider>): IAIProvider {
  return {
    generateChatResponse: vi.fn().mockResolvedValue('Mock AI response'),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    summarizeText: vi.fn().mockResolvedValue('Mock summary'),
    createServerContextCache: vi.fn().mockResolvedValue('mock-cache-id'),
    ...overrides,
  };
}
```

### `mockDiscord.ts`

Factory functions returning partial Discord.js objects typed via `as unknown as T` casts. Each factory accepts an `overrides` record so individual tests customize only what they assert on.

- `createMockInteraction(overrides?)` — returns a `ChatInputCommandInteraction` shape with `vi.fn()` stubs for `reply`, `deferReply`, `editReply`, `followUp`, `options.getString`, etc.
- `createMockMessage(overrides?)` — returns a `Message` shape with `author`, `member`, `guildId`, `channelId`, `content`, `mentions.has`, `channel.sendTyping`, `reply`, `react`.

### `mockRedis.ts`

```typescript
export function createMockRedis() {
  return {
    keys: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    rPush: vi.fn().mockResolvedValue(1),
    lTrim: vi.fn().mockResolvedValue('OK'),
    lRange: vi.fn().mockResolvedValue([]),
  };
}
```

### `mockDb.ts`

```typescript
export function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}
```

## Test Cases

### Layer 1 — Unit Tests

**`unit/rateLimiter.test.ts`** (existing, migrated)
- First request allowed
- Third request in window blocked
- Per-user isolation
- Window expiry via fake timers

**`unit/messageGuard.test.ts`** (existing, migrated)
- Bracket stripping in display names
- Prefix injection redaction
- Normal content passthrough
- `formatUserMessage` combined output

**`unit/dbConfig.test.ts`** (new)
- Production URL (no sslmode) → SSL enabled, query string stripped
- `?sslmode=disable` → SSL disabled
- `?sslmode=require` → SSL enabled, query string stripped
- `localhost` URL → SSL disabled regardless of sslmode
- `127.0.0.1` URL → SSL disabled
- `DISABLE_DB_SSL=true` → SSL disabled regardless of URL
- Multiple query params → base URL intact
- Empty URL → graceful handling

**`unit/searchSimilarMemory.test.ts`** (new, `pool.query` mocked)
- Missing `serverId` → throws
- Missing `channelId` → throws
- Empty string `serverId` → throws
- Valid call → correct SQL params (serverId, channelId, formatted vector, limit)
- Default limit is 5 when omitted

**`unit/workerPipeline.test.ts`** (new)
- `fetchEligibleChannels`: skips channels with <10 messages; skips channels without server mapping; returns correct shape
- `summarizeBatch`: passes joined messages to `ai.summarizeText`, returns result
- `embedSummary`: passes summary to `ai.generateEmbedding`, returns vector
- `storeMemoryVector`: calls `db.query` with correct INSERT SQL, formats embedding correctly

### Layer 2 — Component Tests

**`component/messageCreate.test.ts`**
- Bot messages → ignored
- DM messages (no `guildId`) → ignored
- Normal message → Redis push + trim + server mapping; no AI call
- Mention → typing, `generateChatResponse` with system prompt + history, reply, bot response stored
- Mention + rate limited → hourglass react, no AI call
- Mention + AI error → error reply, no Redis store
- History role mapping: `[System/Contexta]` → `model`, else → `user`

**`component/recall.test.ts`**
- No `guildId` → ephemeral rejection
- Rate limited → ephemeral rejection
- No results → "couldn't find" message
- Results found → reports count
- `generateEmbedding` error → error reply
- `searchSimilarMemory` error → error reply

**`component/ask.test.ts`**
- Rate limited → ephemeral rejection, no defer
- Normal flow → defers with correct ephemeral flag, replies
- `private: true` → `deferReply({ ephemeral: true })`

**`component/summarize.test.ts`**
- No `guildId` → ephemeral rejection
- Rate limited → ephemeral rejection
- Normal flow → defers, replies with hours and channel

**`component/interactionCreate.test.ts`**
- Non-command interaction → ignored
- Unknown command → logs error, no crash
- Successful command → calls `execute`
- Command throws before reply → replies with error
- Command throws after defer → `followUp` with error

**`component/backgroundWorker.test.ts`**
- Empty channel list → no AI or DB calls
- Single eligible channel → stages called in order
- Multiple channels → processed sequentially
- Stage error in one channel → logs, continues to next

### Layer 3 — Integration Tests

**`integration/db.integration.test.ts`** (requires `TEST_DATABASE_URL`)

Setup: a `globalSetup` file validates `TEST_DATABASE_URL` is set (fails fast with a clear message if not). A `beforeAll` in the test file connects to the test database and applies `src/db/schema.sql` via `pool.query()` (idempotent — uses `CREATE TABLE IF NOT EXISTS` and `CREATE EXTENSION IF NOT EXISTS`). The test database is assumed to be an empty, pre-provisioned Postgres instance with superuser or `CREATE EXTENSION` privileges (pgvector must be installable). Tests do NOT create or drop the database itself.

- Insert test vector, query via `searchSimilarMemory`, verify cosine similarity ordering
- Server isolation: vector from server A not returned for server B
- Channel isolation: vector from channel X not returned for channel Y
- `afterEach`: delete test rows by a known test prefix in `server_id` (e.g., `test-server-*`)
- `afterAll`: leave tables in place — `IF NOT EXISTS` makes re-runs idempotent, avoiding permission issues with `DROP`

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**', '**/*.integration.test.ts'],
  },
});
```

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/integration/**/*.integration.test.ts'],
    globalSetup: ['src/tests/integration/globalSetup.ts'],
  },
});
```

The `globalSetup.ts` file validates `TEST_DATABASE_URL` at suite start and fails fast with a clear message if it is missing or unreachable:

```typescript
// src/tests/integration/globalSetup.ts
export async function setup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is required for integration tests. ' +
      'Provide a PostgreSQL connection string with pgvector enabled.'
    );
  }
}
```

**npm scripts:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

## CLAUDE.md Update

Replace the "There are no tests configured" line with:

```
## Testing

- `npm test` — runs unit + component tests (Vitest)
- `npm run test:watch` — watch mode
- `npm run test:integration` — integration tests (requires `TEST_DATABASE_URL` with pgvector)
- Test files live in `src/tests/{unit,component,integration}/`
- Shared helpers in `src/tests/helpers/`
```
