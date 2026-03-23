# Testing Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a full test pyramid (unit → component → integration) for the Contexta Discord bot, including production refactoring to extract testable seams.

**Architecture:** Bottom-up approach — extract pure functions and inject dependencies into handlers so each layer can be tested with minimal mocking. Rate limiter uses `vi.mock()` as the single allowed module-level mock. All other service dependencies (AI, Redis, DB) are injected via optional `deps` parameters.

**Tech Stack:** Vitest 4.x, Node 16 ESM (`.js` import extensions), TypeScript strict mode, `vi.fn()` for test doubles.

**Spec:** `docs/superpowers/specs/2026-03-23-testing-suite-design.md`

---

## File Structure

### New files to create

| File | Purpose |
|------|---------|
| `src/tests/helpers/mockAIProvider.ts` | Factory for fake `IAIProvider` |
| `src/tests/helpers/mockDiscord.ts` | Factories for `ChatInputCommandInteraction` and `Message` |
| `src/tests/helpers/mockRedis.ts` | Factory for fake Redis client |
| `src/tests/helpers/mockDb.ts` | Factory for fake DB pool |
| `src/tests/unit/dbConfig.test.ts` | Unit tests for `parseDbConfig` |
| `src/tests/unit/searchSimilarMemory.test.ts` | Unit tests for `searchSimilarMemory` validation |
| `src/tests/unit/workerPipeline.test.ts` | Unit tests for extracted pipeline stages |
| `src/tests/component/messageCreate.test.ts` | Component tests for message handler |
| `src/tests/component/recall.test.ts` | Component tests for /recall command |
| `src/tests/component/ask.test.ts` | Component tests for /ask command |
| `src/tests/component/summarize.test.ts` | Component tests for /summarize command |
| `src/tests/component/interactionCreate.test.ts` | Component tests for interaction dispatcher |
| `src/tests/component/backgroundWorker.test.ts` | Component tests for worker orchestrator |
| `src/tests/integration/globalSetup.ts` | Validates `TEST_DATABASE_URL` env var |
| `src/tests/integration/db.integration.test.ts` | Real DB integration tests |
| `vitest.integration.config.ts` | Vitest config for integration tests |

### Files to modify

| File | Change |
|------|--------|
| `vitest.config.ts` | Add integration test exclusion |
| `package.json` | Add `test:integration` script |
| `src/db/index.ts` | Extract `parseDbConfig` pure function |
| `src/utils/backgroundWorker.ts` | Decompose into pipeline stages with DI |
| `src/commands/recall.ts` | Add `deps` parameter for DI |
| `src/events/messageCreate.ts` | Add `deps` parameter for DI |
| `CLAUDE.md` | Update testing section |

### Files to move

| From | To |
|------|-----|
| `src/tests/rateLimiter.test.ts` | `src/tests/unit/rateLimiter.test.ts` |
| `src/tests/messageGuard.test.ts` | `src/tests/unit/messageGuard.test.ts` |

---

### Task 1: Infrastructure — Directory Structure & Config

**Files:**
- Move: `src/tests/rateLimiter.test.ts` → `src/tests/unit/rateLimiter.test.ts`
- Move: `src/tests/messageGuard.test.ts` → `src/tests/unit/messageGuard.test.ts`
- Modify: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create directory structure and move existing tests**

```bash
mkdir -p src/tests/unit src/tests/component src/tests/integration src/tests/helpers
mv src/tests/rateLimiter.test.ts src/tests/unit/rateLimiter.test.ts
mv src/tests/messageGuard.test.ts src/tests/unit/messageGuard.test.ts
```

- [ ] **Step 2: Update import paths in moved test files**

In `src/tests/unit/rateLimiter.test.ts`, change the import path (one extra `../` since we're now one directory deeper):

```typescript
// Old:
import { isRateLimited, clearRateLimitState } from '../utils/rateLimiter.js';
// New:
import { isRateLimited, clearRateLimitState } from '../../utils/rateLimiter.js';
```

In `src/tests/unit/messageGuard.test.ts`, change the import path:

```typescript
// Old:
import { sanitizeDisplayName, sanitizeMessageContent, formatUserMessage } from '../utils/messageGuard.js';
// New:
import { sanitizeDisplayName, sanitizeMessageContent, formatUserMessage } from '../../utils/messageGuard.js';
```

- [ ] **Step 3: Update `vitest.config.ts` to exclude integration tests**

Replace the full file contents with:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**', '**/*.integration.test.ts'],
  },
});
```

- [ ] **Step 4: Create `vitest.integration.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/integration/**/*.integration.test.ts'],
    globalSetup: ['src/tests/integration/globalSetup.ts'],
  },
});
```

- [ ] **Step 5: Create `src/tests/integration/globalSetup.ts`**

```typescript
export async function setup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is required for integration tests. ' +
      'Provide a PostgreSQL connection string with pgvector enabled.'
    );
  }
}
```

- [ ] **Step 6: Add `test:integration` script to `package.json`**

In `package.json`, add to the `"scripts"` object:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 7: Run existing tests to verify migration**

Run: `npx vitest run`
Expected: 2 test suites pass (rateLimiter, messageGuard), all existing tests green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: restructure tests into unit/component/integration layout"
```

---

### Task 2: Test Helpers

**Files:**
- Create: `src/tests/helpers/mockAIProvider.ts`
- Create: `src/tests/helpers/mockDiscord.ts`
- Create: `src/tests/helpers/mockRedis.ts`
- Create: `src/tests/helpers/mockDb.ts`

- [ ] **Step 1: Create `src/tests/helpers/mockAIProvider.ts`**

```typescript
import { vi } from 'vitest';
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

- [ ] **Step 2: Create `src/tests/helpers/mockDiscord.ts`**

```typescript
import { vi } from 'vitest';
import type { ChatInputCommandInteraction, Message } from 'discord.js';

export function createMockInteraction(overrides?: Record<string, any>): ChatInputCommandInteraction {
  return {
    user: { id: 'user-123' },
    guildId: 'guild-456',
    channelId: 'channel-789',
    options: {
      getString: vi.fn().mockReturnValue('test input'),
      getInteger: vi.fn().mockReturnValue(24),
      getBoolean: vi.fn().mockReturnValue(false),
      getChannel: vi.fn().mockReturnValue(null),
      getUser: vi.fn().mockReturnValue({ username: 'TestUser' }),
      getSubcommand: vi.fn().mockReturnValue('cache'),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
    isChatInputCommand: vi.fn().mockReturnValue(true),
    commandName: 'test',
    client: { commands: new Map() },
    ...overrides,
  } as unknown as ChatInputCommandInteraction;
}

export function createMockMessage(overrides?: Record<string, any>): Message {
  return {
    author: { bot: false, id: 'user-123', username: 'TestUser' },
    member: { displayName: 'TestUser' },
    guildId: 'guild-456',
    channelId: 'channel-789',
    content: 'Hello Contexta',
    mentions: { has: vi.fn().mockReturnValue(false) },
    channel: { sendTyping: vi.fn().mockResolvedValue(undefined) },
    client: { user: { id: 'bot-999' } },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Message;
}
```

- [ ] **Step 3: Create `src/tests/helpers/mockRedis.ts`**

```typescript
import { vi } from 'vitest';

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

- [ ] **Step 4: Create `src/tests/helpers/mockDb.ts`**

```typescript
import { vi } from 'vitest';

export function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}
```

- [ ] **Step 5: Verify tests still pass**

Run: `npx vitest run`
Expected: 2 test suites pass. No regressions. Helpers are not test files — they should not be discovered.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add shared test helper factories (AI, Discord, Redis, DB)"
```

---

### Task 3: Extract & Test `parseDbConfig`

**Files:**
- Modify: `src/db/index.ts`
- Create: `src/tests/unit/dbConfig.test.ts`

- [ ] **Step 1: Write the failing test file `src/tests/unit/dbConfig.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { parseDbConfig } from '../../db/index.js';

describe('parseDbConfig', () => {
  it('enables SSL and strips query string for production URLs', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require');
    expect(result.connectionString).toBe('postgresql://host:5432/db');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('disables SSL when sslmode=disable', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=disable');
    expect(result.ssl).toBe(false);
  });

  it('enables SSL when sslmode=require', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('disables SSL for localhost URLs regardless of sslmode', () => {
    const result = parseDbConfig('postgresql://localhost:5432/db?sslmode=require');
    expect(result.ssl).toBe(false);
  });

  it('disables SSL for 127.0.0.1 URLs', () => {
    const result = parseDbConfig('postgresql://127.0.0.1:5432/db');
    expect(result.ssl).toBe(false);
  });

  it('disables SSL when disableSslEnv is true', () => {
    const result = parseDbConfig('postgresql://prod-host:5432/db', 'true');
    expect(result.ssl).toBe(false);
  });

  it('strips multiple query params, keeping base URL intact', () => {
    const result = parseDbConfig('postgresql://host:5432/db?sslmode=require&timeout=30');
    expect(result.connectionString).toBe('postgresql://host:5432/db');
  });

  it('handles empty URL gracefully', () => {
    const result = parseDbConfig('');
    expect(result.connectionString).toBe('');
    // Empty string doesn't contain localhost/127.0.0.1, so SSL would be enabled.
    // But an empty connection string is a misconfiguration — SSL setting is irrelevant.
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('enables SSL for production URL with no sslmode param', () => {
    const result = parseDbConfig('postgresql://prod-host:5432/db');
    expect(result.ssl).toEqual({ rejectUnauthorized: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/unit/dbConfig.test.ts`
Expected: FAIL — `parseDbConfig` is not exported from `src/db/index.ts`.

- [ ] **Step 3: Extract `parseDbConfig` in `src/db/index.ts`**

Add this function BEFORE the existing `const rawUrl` line, then refactor the module-level code to use it:

```typescript
export function parseDbConfig(rawUrl: string, disableSslEnv?: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: true };
} {
  const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
  const sslmode = sslmodeMatch?.[1];
  const connectionString = rawUrl.split('?')[0];
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const disableSSL =
    isLocal ||
    sslmode === 'disable' ||
    disableSslEnv === 'true';
  return {
    connectionString,
    ssl: disableSSL ? false : { rejectUnauthorized: true },
  };
}
```

Then replace the existing module-level config code. The full `src/db/index.ts` becomes:

```typescript
// src/db/index.ts
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export function parseDbConfig(rawUrl: string, disableSslEnv?: string): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: true };
} {
  const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
  const sslmode = sslmodeMatch?.[1];
  const connectionString = rawUrl.split('?')[0];
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const disableSSL =
    isLocal ||
    sslmode === 'disable' ||
    disableSslEnv === 'true';
  return {
    connectionString,
    ssl: disableSSL ? false : { rejectUnauthorized: true },
  };
}

const config = parseDbConfig(
  process.env.DATABASE_URL || '',
  process.env.DISABLE_DB_SSL
);

export const pool = new Pool({
  connectionString: config.connectionString,
  ssl: config.ssl,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Executed query - Duration: ${duration}ms, Rows: ${res.rowCount}`);
  return res;
}

export async function searchSimilarMemory(
  serverId: string,
  channelId: string,
  embedding: number[],
  limit = 5
) {
  if (!serverId || !channelId) {
    throw new Error('[DB] searchSimilarMemory requires non-empty serverId and channelId');
  }

  const textQuery = `
    SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
    FROM channel_memory_vectors
    WHERE server_id = $1 AND channel_id = $2
    ORDER BY embedding <=> $3::vector
    LIMIT $4;
  `;
  const values = [serverId, channelId, `[${embedding.join(',')}]`, limit];
  const { rows } = await query(textQuery, values);
  return rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tests/unit/dbConfig.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Run full suite to verify no regressions**

Run: `npx vitest run`
Expected: 3 test suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(db): extract parseDbConfig pure function with unit tests"
```

---

### Task 4: Unit Test `searchSimilarMemory`

**Files:**
- Create: `src/tests/unit/searchSimilarMemory.test.ts`

- [ ] **Step 1: Write `src/tests/unit/searchSimilarMemory.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../db/index.js')>();
  return {
    ...original,
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
});

import { searchSimilarMemory, query } from '../../db/index.js';

const mockQuery = vi.mocked(query);

describe('searchSimilarMemory', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockQuery.mockResolvedValue({ rows: [{ id: '1', summary_text: 'test' }], rowCount: 1 } as any);
  });

  it('throws when serverId is missing', async () => {
    await expect(searchSimilarMemory('', 'channel-1', [0.1], 5))
      .rejects.toThrow('requires non-empty serverId and channelId');
  });

  it('throws when channelId is missing', async () => {
    await expect(searchSimilarMemory('server-1', '', [0.1], 5))
      .rejects.toThrow('requires non-empty serverId and channelId');
  });

  it('passes correct params to query', async () => {
    const embedding = [0.1, 0.2, 0.3];
    await searchSimilarMemory('server-1', 'channel-1', embedding, 3);

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('WHERE server_id = $1 AND channel_id = $2');
    expect(params).toEqual(['server-1', 'channel-1', '[0.1,0.2,0.3]', 3]);
  });

  it('defaults limit to 5 when omitted', async () => {
    await searchSimilarMemory('server-1', 'channel-1', [0.1]);

    const [, params] = mockQuery.mock.calls[0];
    expect(params![3]).toBe(5);
  });

  it('returns rows from query result', async () => {
    const rows = [{ id: '1', summary_text: 'hello', similarity: 0.95 }];
    mockQuery.mockResolvedValue({ rows, rowCount: 1 } as any);

    const result = await searchSimilarMemory('server-1', 'channel-1', [0.1]);
    expect(result).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/unit/searchSimilarMemory.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: 4 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(db): add unit tests for searchSimilarMemory validation and params"
```

---

### Task 5: Refactor Background Worker & Unit Test Pipeline Stages

**Files:**
- Modify: `src/utils/backgroundWorker.ts`
- Create: `src/tests/unit/workerPipeline.test.ts`

- [ ] **Step 1: Write `src/tests/unit/workerPipeline.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { createMockDb } from '../helpers/mockDb.js';
import {
  fetchEligibleChannels,
  summarizeBatch,
  embedSummary,
  storeMemoryVector,
} from '../../utils/backgroundWorker.js';

describe('fetchEligibleChannels', () => {
  it('skips channels with fewer than 10 messages', async () => {
    const redis = createMockRedis();
    redis.keys.mockResolvedValue(['channel:c1:history']);
    redis.lRange.mockResolvedValue(['msg1', 'msg2']);
    redis.get.mockResolvedValue('server-1');

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([]);
  });

  it('skips channels without a server mapping', async () => {
    const redis = createMockRedis();
    redis.keys.mockResolvedValue(['channel:c1:history']);
    redis.get.mockResolvedValue(null);
    redis.lRange.mockResolvedValue(new Array(15).fill('msg'));

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([]);
  });

  it('returns eligible channels with correct shape', async () => {
    const redis = createMockRedis();
    const messages = new Array(15).fill('msg');
    redis.keys.mockResolvedValue(['channel:c1:history']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([{ channelId: 'c1', serverId: 'server-1', messages }]);
  });
});

describe('summarizeBatch', () => {
  it('passes joined messages to ai.summarizeText', async () => {
    const ai = createMockAIProvider();
    const messages = ['msg1', 'msg2', 'msg3'];
    const result = await summarizeBatch(ai, messages);

    expect(ai.summarizeText).toHaveBeenCalledWith('msg1\nmsg2\nmsg3');
    expect(result).toBe('Mock summary');
  });
});

describe('embedSummary', () => {
  it('passes summary to ai.generateEmbedding', async () => {
    const ai = createMockAIProvider();
    const result = await embedSummary(ai, 'test summary');

    expect(ai.generateEmbedding).toHaveBeenCalledWith('test summary');
    expect(result).toEqual(new Array(768).fill(0.1));
  });
});

describe('storeMemoryVector', () => {
  it('calls db.query with correct INSERT and formatted embedding', async () => {
    const db = createMockDb();
    const embedding = [0.1, 0.2, 0.3];

    await storeMemoryVector(db, 'server-1', 'channel-1', 'summary text', embedding);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO channel_memory_vectors');
    expect(params).toEqual(['server-1', 'channel-1', 'summary text', '[0.1,0.2,0.3]']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/unit/workerPipeline.test.ts`
Expected: FAIL — `fetchEligibleChannels`, `summarizeBatch`, `embedSummary`, `storeMemoryVector` are not exported.

- [ ] **Step 3: Refactor `src/utils/backgroundWorker.ts` into pipeline stages**

Replace the entire file with:

```typescript
import { redisClient } from './redis.js';
import { pool } from '../db/index.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export async function fetchEligibleChannels(
  redis: Pick<typeof redisClient, 'keys' | 'get' | 'lRange'>
): Promise<{ channelId: string; serverId: string; messages: string[] }[]> {
  const keys = await redis.keys('channel:*:history');
  const eligible: { channelId: string; serverId: string; messages: string[] }[] = [];

  for (const key of keys) {
    const channelId = key.split(':')[1];
    const serverId = await redis.get(`channel:${channelId}:server`);
    if (!serverId) {
      console.warn(`[Worker] No serverId mapping found for channel ${channelId}, skipping.`);
      continue;
    }

    const messages = await redis.lRange(key, 0, -1);
    if (messages.length < 10) continue;

    eligible.push({ channelId, serverId, messages });
  }

  return eligible;
}

export async function summarizeBatch(ai: IAIProvider, messages: string[]): Promise<string> {
  return ai.summarizeText(messages.join('\n'));
}

export async function embedSummary(ai: IAIProvider, summary: string): Promise<number[]> {
  return ai.generateEmbedding(summary);
}

export async function storeMemoryVector(
  db: { query: (text: string, params?: any[]) => Promise<any> },
  serverId: string,
  channelId: string,
  summary: string,
  embedding: number[]
): Promise<void> {
  const insertQuery = `
    INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
    VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())
  `;
  await db.query(insertQuery, [serverId, channelId, summary, `[${embedding.join(',')}]`]);
}

export async function runSemanticEmbeddingWorker(
  redis: Pick<typeof redisClient, 'keys' | 'get' | 'lRange'> = redisClient,
  ai: IAIProvider = new GeminiProvider(),
  db: { query: (text: string, params?: any[]) => Promise<any> } = pool
): Promise<void> {
  console.log('[Worker] Starting background semantic embedding sweep...');

  try {
    const channels = await fetchEligibleChannels(redis);

    for (const { channelId, serverId, messages } of channels) {
      try {
        const summary = await summarizeBatch(ai, messages);
        console.log(`[Worker] Generated summary for channel ${channelId}`);

        const embedding = await embedSummary(ai, summary);
        console.log(`[Worker] Generated embedding [${embedding.length} dims]`);

        await storeMemoryVector(db, serverId, channelId, summary, embedding);
        console.log(`[Worker] Inserted memory chunk for channel ${channelId} (server ${serverId})`);
      } catch (err) {
        console.error(`[Worker] Error processing channel ${channelId}:`, err);
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
  }
}
```

- [ ] **Step 4: Run the pipeline test to verify it passes**

Run: `npx vitest run src/tests/unit/workerPipeline.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: 5 test suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(worker): decompose into pipeline stages with unit tests"
```

---

### Task 6: Refactor `recall.ts` with DI & Component Test

**Files:**
- Modify: `src/commands/recall.ts`
- Create: `src/tests/component/recall.test.ts`

- [ ] **Step 1: Write `src/tests/component/recall.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/recall.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('recall command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it('rejects in DM context (no guildId)', async () => {
    const interaction = createMockInteraction({ guildId: null });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('only be used in a server'), ephemeral: true })
    );
  });

  it('rejects when rate limited', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('reports no results', async () => {
    const ai = createMockAIProvider();
    const searchMemory = vi.fn().mockResolvedValue([]);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining("couldn't find")
    );
  });

  it('reports found results count', async () => {
    const ai = createMockAIProvider();
    const results = [{ id: '1' }, { id: '2' }];
    const searchMemory = vi.fn().mockResolvedValue(results);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('2')
    );
  });

  it('handles embedding generation error', async () => {
    const ai = createMockAIProvider({
      generateEmbedding: vi.fn().mockRejectedValue(new Error('API down')),
    });
    const searchMemory = vi.fn();
    const interaction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test') },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });

  it('handles searchSimilarMemory error', async () => {
    const ai = createMockAIProvider();
    const searchMemory = vi.fn().mockRejectedValue(new Error('DB down'));
    const interaction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test') },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/component/recall.test.ts`
Expected: FAIL — `execute` does not accept a `deps` parameter.

- [ ] **Step 3: Refactor `src/commands/recall.ts` to accept `deps`**

Replace the entire file with:

```typescript
// src/commands/recall.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { searchSimilarMemory } from '../db/index.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export interface RecallDeps {
  ai: IAIProvider;
  searchMemory: typeof searchSimilarMemory;
}

const defaultDeps: RecallDeps = {
  ai: new GeminiProvider(),
  searchMemory: searchSimilarMemory,
};

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Triggers a semantic search of the pgvector database.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The past event or topic you want to remember')
      .setRequired(true));

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: RecallDeps = defaultDeps
) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const topic = interaction.options.getString('topic', true);
  await interaction.deferReply();

  try {
    const embedding = await deps.ai.generateEmbedding(topic);
    const results = await deps.searchMemory(interaction.guildId, interaction.channelId, embedding, 3);

    if (results.length === 0) {
      await interaction.editReply("I couldn't find any relevant memories regarding that topic.");
      return;
    }

    await interaction.editReply(`I found ${results.length} related memory chunks. Contexta is analyzing them...`);
  } catch (err) {
    console.error('[recall] Error querying semantic memory:', err);
    await interaction.editReply('There was an error querying my semantic memory.');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tests/component/recall.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: 6 test suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(recall): add dependency injection with component tests"
```

---

### Task 7: Refactor `messageCreate.ts` with DI & Component Test

**Files:**
- Modify: `src/events/messageCreate.ts`
- Create: `src/tests/component/messageCreate.test.ts`

- [ ] **Step 1: Write `src/tests/component/messageCreate.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMessage } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../events/messageCreate.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('messageCreate handler', () => {
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    ai = createMockAIProvider();
    redis = createMockRedis();
  });

  it('ignores bot messages', async () => {
    const message = createMockMessage({ author: { bot: true, id: 'bot-1', username: 'Bot' } });
    await execute(message, { ai, redis });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('ignores DM messages (no guildId)', async () => {
    const message = createMockMessage({ guildId: null });
    await execute(message, { ai, redis });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('stores message in Redis and sets server mapping', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis });

    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[User: TestUser]')
    );
    expect(redis.lTrim).toHaveBeenCalledWith('channel:channel-789:history', -50, -1);
    expect(redis.set).toHaveBeenCalledWith('channel:channel-789:server', 'guild-456');
  });

  it('does not call AI when not mentioned', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis });
    expect(ai.generateChatResponse).not.toHaveBeenCalled();
  });

  it('calls AI and replies when mentioned', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello', '[System/Contexta]: hi']);

    await execute(message, { ai, redis });

    expect(ai.generateChatResponse).toHaveBeenCalledWith(
      expect.stringContaining('Contexta'),
      expect.arrayContaining([
        expect.objectContaining({ role: 'user' }),
        expect.objectContaining({ role: 'model' }),
      ]),
      expect.objectContaining({ ttlMinutes: 60 })
    );
    expect(message.reply).toHaveBeenCalledWith('Mock AI response');
  });

  it('stores bot response in Redis after AI reply', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { ai, redis });

    const rPushCalls = redis.rPush.mock.calls;
    const botMessageCall = rPushCalls.find(
      ([, val]) => typeof val === 'string' && val.startsWith('[System/Contexta]')
    );
    expect(botMessageCall).toBeDefined();
  });

  it('reacts with hourglass and skips AI when rate limited on mention', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });

    await execute(message, { ai, redis });
    expect(message.react).toHaveBeenCalledWith('⏳');
    expect(ai.generateChatResponse).not.toHaveBeenCalled();
  });

  it('replies with error and does not store on AI failure', async () => {
    const failingAI = createMockAIProvider({
      generateChatResponse: vi.fn().mockRejectedValue(new Error('API error')),
    });
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { ai: failingAI, redis });
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('issue'));
    const botStoreCalls = redis.rPush.mock.calls.filter(
      ([, val]) => typeof val === 'string' && val.startsWith('[System/Contexta]')
    );
    expect(botStoreCalls).toHaveLength(0);
  });

  it('maps [System/Contexta] prefix to model role and others to user', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([
      '[User: Alice]: hello',
      '[System/Contexta]: hi there',
    ]);

    await execute(message, { ai, redis });

    const chatHistory = vi.mocked(ai.generateChatResponse).mock.calls[0][1];
    expect(chatHistory[0].role).toBe('user');
    expect(chatHistory[1].role).toBe('model');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: FAIL — `execute` does not accept a `deps` parameter.

- [ ] **Step 3: Refactor `src/events/messageCreate.ts` to accept `deps`**

Replace the entire file with:

```typescript
// src/events/messageCreate.ts
import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export interface MessageCreateDeps {
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
  redis: redisClient as unknown as MessageCreateDeps['redis'],
};

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message, deps: MessageCreateDeps = defaultDeps) {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;

  if (!serverId) return;

  const displayName = message.member?.displayName || message.author.username;
  const formattedMessage = formatUserMessage(displayName, message.content);

  const redisKey = `channel:${channelId}:history`;
  await deps.redis.rPush(redisKey, formattedMessage);
  await deps.redis.lTrim(redisKey, -50, -1);
  await deps.redis.set(`channel:${channelId}:server`, serverId);

  if (message.mentions.has(message.client.user.id)) {
    if (isRateLimited(message.author.id)) {
      await message.react('⏳').catch(() => {});
      return;
    }

    const history = await deps.redis.lRange(redisKey, 0, -1);

    const chatHistory = history.map(msg => ({
      role: msg.startsWith('[System/Contexta]') ? 'model' as const : 'user' as const,
      parts: [{ text: msg }]
    }));

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const systemPrompt = `You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.`;

      const response = await deps.ai.generateChatResponse(
        systemPrompt,
        chatHistory,
        { ttlMinutes: 60 }
      );

      await message.reply(response);

      const botFormattedMsg = `[System/Contexta]: ${response}`;
      await deps.redis.rPush(redisKey, botFormattedMsg);
      await deps.redis.lTrim(redisKey, -50, -1);

    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: 7 test suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(messageCreate): add dependency injection with component tests"
```

---

### Task 8: Component Test `/ask` Command

**Files:**
- Create: `src/tests/component/ask.test.ts`

- [ ] **Step 1: Write `src/tests/component/ask.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/ask.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('ask command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it('rejects when rate limited without deferring', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('defers and replies in normal flow', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('What is TypeScript?'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('What is TypeScript?')
    );
  });

  it('defers with ephemeral true when private option is set', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('secret question'),
        getBoolean: vi.fn().mockReturnValue(true),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/component/ask.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: 8 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(ask): add component tests for /ask command"
```

---

### Task 9: Component Test `/summarize` Command

**Files:**
- Create: `src/tests/component/summarize.test.ts`

- [ ] **Step 1: Write `src/tests/component/summarize.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/summarize.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('summarize command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it('rejects in DM context (no guildId)', async () => {
    const interaction = createMockInteraction({ guildId: null });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('only be used in a server'), ephemeral: true })
    );
  });

  it('rejects when rate limited', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('defers and replies with hours and channel in normal flow', async () => {
    const mockChannel = { id: 'channel-789', toString: () => '<#channel-789>' };
    const interaction = createMockInteraction({
      options: {
        getInteger: vi.fn().mockReturnValue(48),
        getChannel: vi.fn().mockReturnValue(mockChannel),
      },
      channel: mockChannel,
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('48')
    );
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/component/summarize.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: 9 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(summarize): add component tests for /summarize command"
```

---

### Task 10: Component Test `interactionCreate`

**Files:**
- Create: `src/tests/component/interactionCreate.test.ts`

- [ ] **Step 1: Write `src/tests/component/interactionCreate.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../../events/interactionCreate.js';

describe('interactionCreate handler', () => {
  function createBaseInteraction(overrides?: Record<string, any>) {
    return {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      commandName: 'recall',
      client: {
        commands: new Map(),
      },
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
      ...overrides,
    } as any;
  }

  it('ignores non-command interactions', async () => {
    const interaction = createBaseInteraction({
      isChatInputCommand: vi.fn().mockReturnValue(false),
    });
    await execute(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('logs error for unknown command and does not crash', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const interaction = createBaseInteraction();
    await execute(interaction);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No command matching'));
    consoleSpy.mockRestore();
  });

  it('calls execute on a registered command', async () => {
    const mockExecute = vi.fn();
    const commands = new Map([['recall', { execute: mockExecute }]]);
    const interaction = createBaseInteraction({
      client: { commands },
    });

    await execute(interaction);
    expect(mockExecute).toHaveBeenCalledWith(interaction);
  });

  it('replies with error when command throws before reply', async () => {
    const commands = new Map([['recall', {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    }]]);
    const interaction = createBaseInteraction({
      client: { commands },
      replied: false,
      deferred: false,
    });

    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('exception'), ephemeral: true })
    );
  });

  it('follows up with error when command throws after defer', async () => {
    const commands = new Map([['recall', {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    }]]);
    const interaction = createBaseInteraction({
      client: { commands },
      replied: false,
      deferred: true,
    });

    await execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('exception'), ephemeral: true })
    );
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/component/interactionCreate.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: 10 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(interactionCreate): add component tests for command dispatcher"
```

---

### Task 11: Component Test Background Worker Orchestrator

**Files:**
- Create: `src/tests/component/backgroundWorker.test.ts`

- [ ] **Step 1: Write `src/tests/component/backgroundWorker.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { createMockDb } from '../helpers/mockDb.js';
import { runSemanticEmbeddingWorker } from '../../utils/backgroundWorker.js';

describe('runSemanticEmbeddingWorker orchestrator', () => {
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    ai = createMockAIProvider();
    redis = createMockRedis();
    db = createMockDb();
  });

  it('makes no AI or DB calls when no channels are eligible', async () => {
    redis.keys.mockResolvedValue([]);
    await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(ai.summarizeText).not.toHaveBeenCalled();
    expect(ai.generateEmbedding).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('processes a single eligible channel through all stages', async () => {
    const messages = new Array(15).fill('test message');
    redis.keys.mockResolvedValue(['channel:c1:history']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    await runSemanticEmbeddingWorker(redis as any, ai, db);

    expect(ai.summarizeText).toHaveBeenCalledOnce();
    expect(ai.generateEmbedding).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO channel_memory_vectors'),
      expect.arrayContaining(['server-1', 'c1'])
    );
  });

  it('processes multiple channels sequentially', async () => {
    const messages = new Array(15).fill('msg');
    redis.keys.mockResolvedValue(['channel:c1:history', 'channel:c2:history']);
    redis.get.mockImplementation(async (key: string) => {
      if (key.includes('c1')) return 'server-1';
      if (key.includes('c2')) return 'server-2';
      return null;
    });
    redis.lRange.mockResolvedValue(messages);

    await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(ai.summarizeText).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('continues processing after error in one channel', async () => {
    const messages = new Array(15).fill('msg');
    redis.keys.mockResolvedValue(['channel:c1:history', 'channel:c2:history']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    ai.summarizeText = vi.fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce('Summary for c2');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runSemanticEmbeddingWorker(redis as any, ai, db);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error processing channel'),
      expect.any(Error)
    );
    expect(db.query).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/tests/component/backgroundWorker.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: 11 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(worker): add component tests for background worker orchestrator"
```

---

### Task 12: Integration Test Infrastructure & DB Tests

**Files:**
- Create: `src/tests/integration/db.integration.test.ts`

Note: this test requires a real PostgreSQL database with pgvector. It is excluded from `npx vitest run` and only runs via `npm run test:integration` with `TEST_DATABASE_URL` set.

- [ ] **Step 1: Write `src/tests/integration/db.integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

let pool: InstanceType<typeof Pool>;

const TEST_PREFIX = 'test-server';

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

  const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
});

afterEach(async () => {
  await pool.query(`DELETE FROM channel_memory_vectors WHERE server_id LIKE $1`, [`${TEST_PREFIX}%`]);
});

afterAll(async () => {
  await pool.end();
});

async function insertTestVector(
  serverId: string,
  channelId: string,
  summary: string,
  embedding: number[]
) {
  await pool.query(
    `INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
     VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())`,
    [serverId, channelId, summary, `[${embedding.join(',')}]`]
  );
}

function makeEmbedding(seed: number): number[] {
  const emb = new Array(768).fill(0);
  emb[0] = seed;
  return emb;
}

// Thin wrapper that mirrors the real searchSimilarMemory using the test pool
async function searchSimilarMemory(
  serverId: string,
  channelId: string,
  embedding: number[],
  limit = 5
) {
  if (!serverId || !channelId) {
    throw new Error('searchSimilarMemory requires non-empty serverId and channelId');
  }
  const { rows } = await pool.query(
    `SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
     FROM channel_memory_vectors
     WHERE server_id = $1 AND channel_id = $2
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, channelId, `[${embedding.join(',')}]`, limit]
  );
  return rows;
}

describe('database integration', () => {
  it('inserts and queries vectors via searchSimilarMemory with cosine similarity ordering', async () => {
    const serverId = `${TEST_PREFIX}-ordering`;
    const channelId = 'channel-1';

    await insertTestVector(serverId, channelId, 'close match', makeEmbedding(0.9));
    await insertTestVector(serverId, channelId, 'far match', makeEmbedding(0.1));

    const rows = await searchSimilarMemory(serverId, channelId, makeEmbedding(0.9), 5);

    expect(rows.length).toBe(2);
    expect(rows[0].summary_text).toBe('close match');
  });

  it('enforces server isolation via searchSimilarMemory', async () => {
    const channelId = 'channel-shared';
    await insertTestVector(`${TEST_PREFIX}-A`, channelId, 'server A data', makeEmbedding(0.5));
    await insertTestVector(`${TEST_PREFIX}-B`, channelId, 'server B data', makeEmbedding(0.5));

    const rows = await searchSimilarMemory(`${TEST_PREFIX}-A`, channelId, makeEmbedding(0.5), 10);

    expect(rows).toHaveLength(1);
    expect(rows[0].summary_text).toBe('server A data');
  });

  it('enforces channel isolation via searchSimilarMemory', async () => {
    const serverId = `${TEST_PREFIX}-chaniso`;
    await insertTestVector(serverId, 'channel-X', 'channel X data', makeEmbedding(0.5));
    await insertTestVector(serverId, 'channel-Y', 'channel Y data', makeEmbedding(0.5));

    const rows = await searchSimilarMemory(serverId, 'channel-X', makeEmbedding(0.5), 10);

    expect(rows).toHaveLength(1);
    expect(rows[0].summary_text).toBe('channel X data');
  });
});
```

- [ ] **Step 2: Verify the integration test is excluded from default run**

Run: `npx vitest run`
Expected: 11 test suites pass. The integration test is NOT discovered.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(db): add integration tests for pgvector queries and data isolation"
```

---

### Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the stale testing line in `CLAUDE.md`**

Find the line:
```
There are no tests configured in this project.
```

Replace with:
```
## Testing

- `npm test` — runs unit + component tests (Vitest)
- `npm run test:watch` — watch mode
- `npm run test:integration` — integration tests (requires `TEST_DATABASE_URL` with pgvector)
- Test files live in `src/tests/{unit,component,integration}/`
- Shared helpers in `src/tests/helpers/`
```

- [ ] **Step 2: Run full suite one final time**

Run: `npx vitest run`
Expected: 11 test suites pass, all tests green.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md with testing commands and structure"
```
