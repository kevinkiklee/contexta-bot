# Backend API Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Hono API server, migrate LLM providers and business logic from the bot, and rewire all bot commands to call the backend over HTTP.

**Architecture:** The backend (`apps/backend/`) becomes the central business logic layer. LLM providers, attachment processing, and embedding worker move from the bot. The bot becomes a thin Discord client that calls the backend via HTTP with a shared `BOT_API_KEY`. All existing bot functionality is preserved — only the execution location changes.

**Tech Stack:** Hono, TypeScript (ES modules), @google/genai, openai, @anthropic-ai/sdk, pg, redis, @contexta/db, @contexta/shared, Vitest

**Important:** This plan must be executed on the `main` branch (not the monorepo-scaffolding worktree) because main has the complete bot features (OpenAI/Anthropic providers, providerRegistry, all implemented commands). The worktree was created before those features were merged.

---

## File Structure

### New files (backend)

| File | Responsibility |
|------|---------------|
| `apps/backend/src/middleware/auth.ts` | BOT_API_KEY and CRON_SECRET validation |
| `apps/backend/src/middleware/errors.ts` | Consistent JSON error responses |
| `apps/backend/src/routes/chat.ts` | POST /api/chat, POST /api/summarize |
| `apps/backend/src/routes/embeddings.ts` | POST /api/embeddings/generate, /search, /api/cron/embeddings |
| `apps/backend/src/routes/attachments.ts` | POST /api/attachments/describe |
| `apps/backend/src/routes/servers.ts` | Server settings, lore, profile routes |
| `apps/backend/src/routes/cache.ts` | POST /api/cache/refresh, DELETE /api/cache/:serverId |
| `apps/backend/src/services/llm/IAIProvider.ts` | Interface (copied from bot) |
| `apps/backend/src/services/llm/GeminiProvider.ts` | Gemini (copied from bot) |
| `apps/backend/src/services/llm/OpenAIProvider.ts` | OpenAI (copied from bot) |
| `apps/backend/src/services/llm/AnthropicProvider.ts` | Anthropic (copied from bot) |
| `apps/backend/src/services/llm/providerRegistry.ts` | Registry (copied from bot) |
| `apps/backend/src/services/attachmentProcessor.ts` | Copied from bot |
| `apps/backend/src/services/embeddingWorker.ts` | Adapted from bot backgroundWorker |
| `apps/backend/src/lib/redis.ts` | Redis client for worker |
| `apps/backend/vitest.config.ts` | Backend test config |

### New files (bot)

| File | Responsibility |
|------|---------------|
| `apps/bot/src/lib/backendClient.ts` | HTTP client for bot→backend calls |

### Modified files

| File | Changes |
|------|---------|
| `apps/backend/package.json` | Add AI SDK deps, pg, redis, workspace deps |
| `apps/backend/src/index.ts` | Mount all routes and middleware |
| `apps/bot/src/commands/ask.ts` | Use backendClient instead of direct AI |
| `apps/bot/src/commands/summarize.ts` | Use backendClient |
| `apps/bot/src/commands/recall.ts` | Use backendClient |
| `apps/bot/src/commands/settings.ts` | Use backendClient |
| `apps/bot/src/commands/lore.ts` | Use backendClient |
| `apps/bot/src/commands/profile.ts` | Use backendClient |
| `apps/bot/src/events/messageCreate.ts` | Use backendClient for AI |
| `apps/bot/src/utils/httpServer.ts` | Remove cron endpoint |
| `apps/bot/src/index.ts` | Remove cron wiring |
| `apps/bot/package.json` | Remove AI SDK deps |
| Bot test files | Update mocks |

### Deleted files (bot)

| File | Reason |
|------|--------|
| `apps/bot/src/llm/*` | Moved to backend |
| `apps/bot/src/services/attachmentProcessor.ts` | Moved to backend |
| `apps/bot/src/utils/backgroundWorker.ts` | Moved to backend |

---

### Task 1: Backend Dependencies and Config

**Files:**
- Modify: `apps/backend/package.json`
- Create: `apps/backend/vitest.config.ts`

- [ ] **Step 1: Update apps/backend/package.json**

Add the AI SDK dependencies, database, redis, and workspace packages:

```json
{
  "name": "@contexta/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.14.0",
    "dotenv": "^16.4.5",
    "@google/genai": "latest",
    "openai": "^6.33.0",
    "@anthropic-ai/sdk": "^0.80.0",
    "pg": "^8.11.3",
    "redis": "^4.6.13",
    "@contexta/db": "workspace:*",
    "@contexta/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/pg": "^8.20.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.1"
  }
}
```

- [ ] **Step 2: Create apps/backend/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**'],
  },
});
```

- [ ] **Step 3: Install dependencies**

```bash
cd apps/backend && pnpm install
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json apps/backend/vitest.config.ts pnpm-lock.yaml
git commit -m "chore: add backend dependencies for AI, DB, Redis, and workspace packages"
```

---

### Task 2: Copy LLM Providers to Backend

**Files:**
- Create: `apps/backend/src/services/llm/IAIProvider.ts`
- Create: `apps/backend/src/services/llm/GeminiProvider.ts`
- Create: `apps/backend/src/services/llm/OpenAIProvider.ts`
- Create: `apps/backend/src/services/llm/AnthropicProvider.ts`
- Create: `apps/backend/src/services/llm/providerRegistry.ts`

- [ ] **Step 1: Copy all LLM files from bot to backend**

```bash
mkdir -p apps/backend/src/services/llm
cp apps/bot/src/llm/IAIProvider.ts apps/backend/src/services/llm/
cp apps/bot/src/llm/GeminiProvider.ts apps/backend/src/services/llm/
cp apps/bot/src/llm/OpenAIProvider.ts apps/backend/src/services/llm/
cp apps/bot/src/llm/AnthropicProvider.ts apps/backend/src/services/llm/
cp apps/bot/src/llm/providerRegistry.ts apps/backend/src/services/llm/
```

The files use relative `.js` imports between themselves (e.g., `import { IAIProvider } from './IAIProvider.js'`), so they work unchanged in the new location.

- [ ] **Step 2: Verify build**

```bash
cd apps/backend && pnpm build
```

Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/services/llm/
git commit -m "feat(backend): copy LLM providers from bot"
```

---

### Task 3: Copy Attachment Processor and Embedding Worker

**Files:**
- Create: `apps/backend/src/services/attachmentProcessor.ts`
- Create: `apps/backend/src/services/embeddingWorker.ts`
- Create: `apps/backend/src/lib/redis.ts`

- [ ] **Step 1: Copy attachment processor**

```bash
cp apps/bot/src/services/attachmentProcessor.ts apps/backend/src/services/
```

Update the import in `apps/backend/src/services/attachmentProcessor.ts`:
Change `import type { IAIProvider } from '../llm/IAIProvider.js';` to `import type { IAIProvider } from './llm/IAIProvider.js';`

- [ ] **Step 2: Create backend Redis client**

Create `apps/backend/src/lib/redis.ts`:

```typescript
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err: any) => console.error('[Redis] Client Error', err));
redisClient.on('connect', () => console.log('[Redis] Connected to Redis'));

export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
```

- [ ] **Step 3: Create embedding worker adapted from bot**

Create `apps/backend/src/services/embeddingWorker.ts`:

```typescript
import { redisClient } from '../lib/redis.js';
import { rawQuery } from '@contexta/db';
import { GeminiProvider } from './llm/GeminiProvider.js';
import type { IAIProvider } from './llm/IAIProvider.js';

export async function fetchEligibleChannels(
  redis: Pick<typeof redisClient, 'sMembers' | 'get' | 'lRange'>
): Promise<{ channelId: string; serverId: string; messages: string[] }[]> {
  const channelIds = await redis.sMembers('active_channels');
  const eligible: { channelId: string; serverId: string; messages: string[] }[] = [];

  for (const channelId of channelIds) {
    const key = `channel:${channelId}:history`;
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

export interface WorkerStats {
  status: string;
  reason?: string;
  channelsProcessed: number;
  embeddingsCreated: number;
  errors: string[];
}

export async function runSemanticEmbeddingWorker(
  redis: Pick<typeof redisClient, 'sMembers' | 'get' | 'lRange' | 'setEx' | 'del'> = redisClient,
  ai: IAIProvider = new GeminiProvider(),
  db: { query: (text: string, params?: any[]) => Promise<any> } = { query: (text, params) => rawQuery(text, params) }
): Promise<WorkerStats> {
  const LOCK_KEY = 'worker:embedding:running';
  const LOCK_TTL = 300;

  const isRunning = await redis.get(LOCK_KEY);
  if (isRunning) {
    console.log('[Worker] Skipping — another run is already in progress.');
    return { status: 'skipped', reason: 'already_running', channelsProcessed: 0, embeddingsCreated: 0, errors: [] };
  }

  await redis.setEx(LOCK_KEY, LOCK_TTL, '1');
  console.log('[Worker] Starting background semantic embedding sweep...');

  const stats: WorkerStats = { status: 'completed', channelsProcessed: 0, embeddingsCreated: 0, errors: [] };

  try {
    const channels = await fetchEligibleChannels(redis);

    for (const { channelId, serverId, messages } of channels) {
      try {
        const summary = await summarizeBatch(ai, messages);
        const embedding = await embedSummary(ai, summary);
        await storeMemoryVector(db, serverId, channelId, summary, embedding);
        console.log(`[Worker] Processed channel ${channelId} (server ${serverId})`);
        stats.channelsProcessed++;
        stats.embeddingsCreated++;
      } catch (err) {
        console.error(`[Worker] Error processing channel ${channelId}:`, err);
        stats.errors.push(`channel ${channelId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error:', err);
    stats.status = 'error';
    stats.errors.push(`fatal: ${(err as Error).message}`);
  } finally {
    await redis.del(LOCK_KEY);
  }

  return stats;
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/backend && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/attachmentProcessor.ts apps/backend/src/services/embeddingWorker.ts apps/backend/src/lib/redis.ts
git commit -m "feat(backend): add attachment processor, embedding worker, and Redis client"
```

---

### Task 4: Auth and Error Middleware

**Files:**
- Create: `apps/backend/src/middleware/auth.ts`
- Create: `apps/backend/src/middleware/errors.ts`
- Test: `apps/backend/src/tests/middleware/auth.test.ts`

- [ ] **Step 1: Write auth middleware tests**

Create `apps/backend/src/tests/middleware/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { botAuth, cronAuth } from '../../middleware/auth.js';

describe('botAuth middleware', () => {
  const originalEnv = process.env;
  let app: Hono;

  beforeEach(() => {
    process.env = { ...originalEnv, BOT_API_KEY: 'test-bot-key' };
    app = new Hono();
    app.use('/api/*', botAuth());
    app.post('/api/test', (c) => c.json({ ok: true }));
  });

  afterEach(() => { process.env = originalEnv; });

  it('returns 401 when no Authorization header', async () => {
    const res = await app.request('/api/test', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong key', async () => {
    const res = await app.request('/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
  });

  it('passes with correct key', async () => {
    const res = await app.request('/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-bot-key' },
    });
    expect(res.status).toBe(200);
  });
});

describe('cronAuth middleware', () => {
  const originalEnv = process.env;
  let app: Hono;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
    app = new Hono();
    app.use('/api/cron/*', cronAuth());
    app.post('/api/cron/test', (c) => c.json({ ok: true }));
  });

  afterEach(() => { process.env = originalEnv; });

  it('returns 401 without correct secret', async () => {
    const res = await app.request('/api/cron/test', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('passes with correct secret', async () => {
    const res = await app.request('/api/cron/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && pnpm test
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement auth middleware**

Create `apps/backend/src/middleware/auth.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

export function botAuth() {
  return createMiddleware(async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const expectedKey = process.env.BOT_API_KEY;

    if (!authHeader || !expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    await next();
  });
}

export function cronAuth() {
  return createMiddleware(async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    await next();
  });
}
```

- [ ] **Step 4: Implement error middleware**

Create `apps/backend/src/middleware/errors.ts`:

```typescript
import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error('[Backend] Unhandled error:', err);
  return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/backend && pnpm test
```
Expected: All auth tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/middleware/ apps/backend/src/tests/
git commit -m "feat(backend): add auth and error middleware with tests"
```

---

### Task 5: Chat and Summarize Routes

**Files:**
- Create: `apps/backend/src/routes/chat.ts`
- Test: `apps/backend/src/tests/routes/chat.test.ts`

- [ ] **Step 1: Write route tests**

Create `apps/backend/src/tests/routes/chat.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

// Mock the provider registry
vi.mock('../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn().mockResolvedValue('AI response'),
    summarizeText: vi.fn().mockResolvedValue('Summary text'),
  }),
}));

// Mock DB
vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn().mockResolvedValue({
    rows: [{ active_model: 'gemini-2.5-flash', server_lore: null, context_cache_id: null, cache_expires_at: null }],
    rowCount: 1,
  }),
}));

import { chatRoutes } from '../../routes/chat.js';

describe('chat routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', chatRoutes);
  });

  it('POST /api/chat returns AI response', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: 'guild-1',
        systemPrompt: 'You are helpful',
        chatHistory: [{ role: 'user', parts: [{ text: 'hello' }] }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe('AI response');
  });

  it('POST /api/summarize returns summary', async () => {
    const res = await app.request('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: 'guild-1', text: 'some conversation' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBe('Summary text');
  });

  it('POST /api/chat returns 400 on missing body', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement chat routes**

Create `apps/backend/src/routes/chat.ts`:

```typescript
import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';

export const chatRoutes = new Hono();

chatRoutes.post('/chat', async (c) => {
  const body = await c.req.json();
  const { serverId, systemPrompt, chatHistory } = body;

  if (!serverId || !chatHistory) {
    return c.json({ success: false, error: 'serverId and chatHistory are required' }, 400);
  }

  // Get server's active model
  let activeModel = 'gemini-2.5-flash';
  let cacheId: string | null = null;

  try {
    const result = await rawQuery(
      'SELECT active_model, context_cache_id, cache_expires_at FROM server_settings WHERE server_id = $1',
      [serverId]
    );
    if (result.rows.length > 0) {
      activeModel = result.rows[0].active_model || activeModel;
      if (result.rows[0].context_cache_id && result.rows[0].cache_expires_at) {
        const expiresAt = new Date(result.rows[0].cache_expires_at);
        if (expiresAt > new Date()) {
          cacheId = result.rows[0].context_cache_id;
        }
      }
    }
  } catch (err) {
    console.warn('[chat] Failed to fetch server settings:', err);
  }

  const ai = getProvider(activeModel);
  const prompt = systemPrompt || 'You are Contexta, an intelligent AI co-host for this Discord server.';
  const response = await ai.generateChatResponse(prompt, chatHistory, {
    cacheId: cacheId || undefined,
    ttlMinutes: 60,
  });

  return c.json({ response });
});

chatRoutes.post('/summarize', async (c) => {
  const body = await c.req.json();
  const { serverId, text } = body;

  if (!serverId || !text) {
    return c.json({ success: false, error: 'serverId and text are required' }, 400);
  }

  let activeModel = 'gemini-2.5-flash';
  try {
    const result = await rawQuery(
      'SELECT active_model FROM server_settings WHERE server_id = $1',
      [serverId]
    );
    if (result.rows.length > 0) {
      activeModel = result.rows[0].active_model || activeModel;
    }
  } catch { /* use default */ }

  const ai = getProvider(activeModel);
  const summary = await ai.summarizeText(text);
  return c.json({ summary });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/backend && pnpm test
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/routes/chat.ts apps/backend/src/tests/routes/
git commit -m "feat(backend): add chat and summarize API routes"
```

---

### Task 6: Embedding Routes

**Files:**
- Create: `apps/backend/src/routes/embeddings.ts`

- [ ] **Step 1: Create embeddings route**

Create `apps/backend/src/routes/embeddings.ts`:

```typescript
import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';
import { runSemanticEmbeddingWorker } from '../services/embeddingWorker.js';

export const embeddingRoutes = new Hono();

embeddingRoutes.post('/embeddings/generate', async (c) => {
  const { text } = await c.req.json();
  if (!text) return c.json({ success: false, error: 'text is required' }, 400);

  // Always use Gemini for embeddings (768-dim consistency)
  const ai = getProvider('gemini-2.5-flash');
  const embedding = await ai.generateEmbedding(text);
  return c.json({ embedding });
});

embeddingRoutes.post('/embeddings/search', async (c) => {
  const { serverId, channelId, embedding, limit = 5 } = await c.req.json();
  if (!serverId || !channelId || !embedding) {
    return c.json({ success: false, error: 'serverId, channelId, and embedding are required' }, 400);
  }

  const result = await rawQuery(
    `SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
     FROM channel_memory_vectors
     WHERE server_id = $1 AND channel_id = $2
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, channelId, `[${embedding.join(',')}]`, limit]
  );

  return c.json({ results: result.rows });
});

embeddingRoutes.post('/cron/embeddings', async (c) => {
  const stats = await runSemanticEmbeddingWorker();
  return c.json(stats);
});
```

- [ ] **Step 2: Verify build**

```bash
cd apps/backend && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/embeddings.ts
git commit -m "feat(backend): add embedding generation, search, and cron routes"
```

---

### Task 7: Server Settings, Lore, Profile, Attachment, and Cache Routes

**Files:**
- Create: `apps/backend/src/routes/servers.ts`
- Create: `apps/backend/src/routes/attachments.ts`
- Create: `apps/backend/src/routes/cache.ts`

- [ ] **Step 1: Create servers routes**

Create `apps/backend/src/routes/servers.ts`:

```typescript
import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const serverRoutes = new Hono();

serverRoutes.get('/servers/:id/settings', async (c) => {
  const serverId = c.req.param('id');
  const result = await rawQuery(
    'SELECT server_id, active_model, server_lore, context_cache_id, cache_expires_at, is_active FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  if (result.rows.length === 0) {
    return c.json({ settings: null });
  }
  return c.json({ settings: result.rows[0] });
});

serverRoutes.put('/servers/:id/settings/model', async (c) => {
  const serverId = c.req.param('id');
  const { model } = await c.req.json();
  if (!model) return c.json({ success: false, error: 'model is required' }, 400);

  // Validate provider can be instantiated
  try {
    getProvider(model);
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 400);
  }

  await rawQuery(
    `INSERT INTO server_settings (server_id, active_model)
     VALUES ($1, $2)
     ON CONFLICT (server_id)
     DO UPDATE SET active_model = $2`,
    [serverId, model]
  );

  return c.json({ success: true });
});

serverRoutes.get('/servers/:id/lore', async (c) => {
  const serverId = c.req.param('id');
  const result = await rawQuery(
    'SELECT server_lore FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  const lore = result.rows[0]?.server_lore || null;
  return c.json({ lore });
});

serverRoutes.put('/servers/:id/lore', async (c) => {
  const serverId = c.req.param('id');
  const { text } = await c.req.json();
  if (!text) return c.json({ success: false, error: 'text is required' }, 400);

  await rawQuery(
    `INSERT INTO server_settings (server_id, server_lore, context_cache_id, cache_expires_at)
     VALUES ($1, $2, NULL, NULL)
     ON CONFLICT (server_id)
     DO UPDATE SET server_lore = $2, context_cache_id = NULL, cache_expires_at = NULL`,
    [serverId, text]
  );

  return c.json({ success: true });
});

serverRoutes.get('/servers/:id/profile/:userId', async (c) => {
  const serverId = c.req.param('id');
  const userId = c.req.param('userId');

  const result = await rawQuery(
    `SELECT gu.global_name, sm.inferred_context, sm.preferences, sm.interaction_count, gu.last_interaction
     FROM server_members sm
     JOIN global_users gu ON gu.user_id = sm.user_id
     WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, userId]
  );

  if (result.rows.length === 0) {
    return c.json({ profile: null });
  }
  return c.json({ profile: result.rows[0] });
});
```

- [ ] **Step 2: Create attachments route**

Create `apps/backend/src/routes/attachments.ts`:

```typescript
import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';

export const attachmentRoutes = new Hono();

attachmentRoutes.post('/attachments/describe', async (c) => {
  const { mimeType, base64Data, fileName, serverId } = await c.req.json();
  if (!mimeType || !base64Data || !fileName) {
    return c.json({ success: false, error: 'mimeType, base64Data, and fileName are required' }, 400);
  }

  let activeModel = 'gemini-2.5-flash';
  if (serverId) {
    try {
      const result = await rawQuery(
        'SELECT active_model FROM server_settings WHERE server_id = $1',
        [serverId]
      );
      if (result.rows.length > 0) activeModel = result.rows[0].active_model || activeModel;
    } catch { /* use default */ }
  }

  const ai = getProvider(activeModel);
  const description = await ai.describeAttachment(mimeType, base64Data, fileName);
  return c.json({ description });
});
```

- [ ] **Step 3: Create cache routes**

Create `apps/backend/src/routes/cache.ts`:

```typescript
import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const cacheRoutes = new Hono();

cacheRoutes.post('/cache/refresh', async (c) => {
  const { serverId } = await c.req.json();
  if (!serverId) return c.json({ success: false, error: 'serverId is required' }, 400);

  const result = await rawQuery(
    'SELECT server_lore, active_model FROM server_settings WHERE server_id = $1',
    [serverId]
  );

  if (result.rows.length === 0 || !result.rows[0].server_lore) {
    return c.json({ success: false, error: 'No server lore to cache' }, 400);
  }

  const { server_lore, active_model } = result.rows[0];

  if (!active_model.startsWith('gemini-')) {
    return c.json({ success: false, error: 'Context caching is only available with Gemini models' }, 400);
  }

  const ai = getProvider(active_model);
  const cacheId = await ai.createServerContextCache(server_lore, 60);

  await rawQuery(
    `UPDATE server_settings SET context_cache_id = $1, cache_expires_at = NOW() + INTERVAL '60 minutes' WHERE server_id = $2`,
    [cacheId, serverId]
  );

  return c.json({ cacheId });
});

cacheRoutes.delete('/cache/:serverId', async (c) => {
  const serverId = c.req.param('serverId');

  await rawQuery(
    'UPDATE server_settings SET context_cache_id = NULL, cache_expires_at = NULL WHERE server_id = $1',
    [serverId]
  );

  return c.json({ success: true });
});
```

- [ ] **Step 4: Verify build**

```bash
cd apps/backend && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/
git commit -m "feat(backend): add server, attachment, and cache API routes"
```

---

### Task 8: Wire Routes Into Hono App

**Files:**
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Update the Hono app to mount all routes with middleware**

Replace `apps/backend/src/index.ts`:

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { botAuth, cronAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { chatRoutes } from './routes/chat.js';
import { embeddingRoutes } from './routes/embeddings.js';
import { serverRoutes } from './routes/servers.js';
import { attachmentRoutes } from './routes/attachments.js';
import { cacheRoutes } from './routes/cache.js';
import { initRedis } from './lib/redis.js';

dotenv.config();

const app = new Hono();

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Cron routes (cron secret auth)
app.use('/api/cron/*', cronAuth());
app.route('/api', embeddingRoutes); // /api/cron/embeddings is in embeddingRoutes

// Bot-facing API routes (bot API key auth)
app.use('/api/*', botAuth());
app.route('/api', chatRoutes);
app.route('/api', serverRoutes);
app.route('/api', attachmentRoutes);
app.route('/api', cacheRoutes);

// Error handler
app.onError(errorHandler);

const port = parseInt(process.env.PORT || '4000', 10);

async function start() {
  await initRedis();

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[Backend] Server listening on port ${port}`);
  });
}

start();
```

Note: The cron middleware is applied before the general bot auth middleware. Hono's middleware matching is path-specific, so `/api/cron/*` gets `cronAuth` and all other `/api/*` routes get `botAuth`.

- [ ] **Step 2: Verify build**

```bash
cd apps/backend && pnpm build
```

- [ ] **Step 3: Run backend tests**

```bash
cd apps/backend && pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/index.ts
git commit -m "feat(backend): wire all routes and middleware into Hono app"
```

---

### Task 9: Create Bot Backend Client

**Files:**
- Create: `apps/bot/src/lib/backendClient.ts`

- [ ] **Step 1: Create the backend client**

Create `apps/bot/src/lib/backendClient.ts`:

```typescript
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BOT_API_KEY = process.env.BOT_API_KEY || '';

export async function backendPost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${BOT_API_KEY}` },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendPut<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${BOT_API_KEY}` },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/bot && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/bot/src/lib/backendClient.ts
git commit -m "feat(bot): add backend HTTP client"
```

---

### Task 10: Rewire Bot Commands to Use Backend

**Files:**
- Modify: `apps/bot/src/commands/ask.ts`
- Modify: `apps/bot/src/commands/summarize.ts`
- Modify: `apps/bot/src/commands/recall.ts`
- Modify: `apps/bot/src/commands/settings.ts`
- Modify: `apps/bot/src/commands/lore.ts`
- Modify: `apps/bot/src/commands/profile.ts`

This is the most critical task. Each command is rewritten to use backendClient instead of direct AI/DB calls. The command definitions (SlashCommandBuilder) stay the same — only the execute functions change.

- [ ] **Step 1: Rewrite ask.ts**

Replace `apps/bot/src/commands/ask.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask Contexta a direct question.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Your core question')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('private')
      .setDescription('Whether the response should be hidden from others (ephemeral)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const userQuery = interaction.options.getString('query', true);
  const isPrivate = interaction.options.getBoolean('private') || false;

  await interaction.deferReply({ ephemeral: isPrivate });

  try {
    const serverId = interaction.guildId || '';

    // Get server lore for system prompt
    const { lore } = await backendGet<{ lore: string | null }>(`/api/servers/${serverId}/lore`);

    let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses.';
    if (lore) {
      systemPrompt += `\n\nServer context and lore:\n${lore}`;
    }

    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId,
      systemPrompt,
      chatHistory: [{ role: 'user', parts: [{ text: userQuery }] }],
    });

    if (response.length > 2000) {
      await interaction.editReply(response.substring(0, 2000));
    } else {
      await interaction.editReply(response);
    }
  } catch (err) {
    console.error('[ask] Error:', err);
    await interaction.editReply('I ran into an issue attempting to process that request.');
  }
}
```

- [ ] **Step 2: Rewrite summarize.ts**

Replace `apps/bot/src/commands/summarize.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, SnowflakeUtil, TextChannel } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('summarize')
  .setDescription('Catch up on a fast-moving channel.')
  .addIntegerOption(option =>
    option.setName('hours')
      .setDescription('Hours of history to catch up on (max 168 = 1 week)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(168))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to summarize (defaults to current)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const hours = interaction.options.getInteger('hours', true);
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  await interaction.deferReply();

  try {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const afterSnowflake = SnowflakeUtil.generate({ timestamp: cutoffTime });

    const channel = targetChannel as TextChannel;
    const fetched = await channel.messages.fetch({ after: afterSnowflake.toString(), limit: 100 });

    if (fetched.size === 0) {
      await interaction.editReply('No messages found in that time range.');
      return;
    }

    const formatted = [...fetched.values()]
      .filter(msg => !msg.author.bot)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(msg => `[${msg.author.username}]: ${msg.content}`)
      .join('\n');

    if (!formatted) {
      await interaction.editReply('No user messages found in that time range.');
      return;
    }

    const { summary } = await backendPost<{ summary: string }>('/api/summarize', {
      serverId: interaction.guildId,
      text: formatted,
    });

    if (summary.length > 2000) {
      await interaction.editReply(summary.substring(0, 2000));
    } else {
      await interaction.editReply(summary);
    }
  } catch (err) {
    console.error('[summarize] Error:', err);
    await interaction.editReply('There was an error generating the summary.');
  }
}
```

- [ ] **Step 3: Rewrite recall.ts**

Replace `apps/bot/src/commands/recall.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Triggers a semantic search of the pgvector database.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The past event or topic you want to remember')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
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
    const { embedding } = await backendPost<{ embedding: number[] }>('/api/embeddings/generate', { text: topic });
    const { results } = await backendPost<{ results: any[] }>('/api/embeddings/search', {
      serverId: interaction.guildId,
      channelId: interaction.channelId,
      embedding,
      limit: 3,
    });

    if (results.length === 0) {
      await interaction.editReply("I couldn't find any relevant memories regarding that topic.");
      return;
    }

    await interaction.editReply(`I found ${results.length} related memory chunks. Contexta is analyzing them...`);
  } catch (err) {
    console.error('[recall] Error:', err);
    await interaction.editReply('There was an error querying my semantic memory.');
  }
}
```

- [ ] **Step 4: Rewrite settings.ts**

Replace `apps/bot/src/commands/settings.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendPut, backendPost, backendDelete } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Admin commands to configure the bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('cache')
      .setDescription('Manage the context cache for server lore')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'refresh', value: 'refresh' },
            { name: 'clear', value: 'clear' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('model')
      .setDescription('Dynamically swap the active LLM interface')
      .addStringOption(option =>
        option.setName('provider')
          .setDescription('The AI model to use')
          .setRequired(true)
          .addChoices(
            { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
            { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            { name: 'GPT-4o', value: 'gpt-4o' },
            { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            { name: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
            { name: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
          )));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const serverId = interaction.guildId!;

  if (subcommand === 'model') {
    const modelName = interaction.options.getString('provider', true);

    try {
      await backendPut(`/api/servers/${serverId}/settings/model`, { model: modelName });
      await interaction.reply({ content: `Active model switched to **${modelName}**.`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `Cannot switch to ${modelName} — ${(err as Error).message}`, ephemeral: true });
    }
    return;
  }

  if (subcommand === 'cache') {
    const action = interaction.options.getString('action', true);

    if (action === 'clear') {
      await backendDelete(`/api/cache/${serverId}`);
      await interaction.reply({ content: 'Context cache cleared.', ephemeral: true });
      return;
    }

    if (action === 'refresh') {
      try {
        await backendPost('/api/cache/refresh', { serverId });
        await interaction.reply({ content: 'Context cache refreshed (expires in 60 minutes).', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: (err as Error).message, ephemeral: true });
      }
    }
  }
}
```

- [ ] **Step 5: Rewrite lore.ts**

Replace `apps/bot/src/commands/lore.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendGet, backendPut } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('lore')
  .setDescription('Update the overarching rules and community themes.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Action to perform on server lore')
      .setRequired(true)
      .addChoices(
        { name: 'view', value: 'view' },
        { name: 'update', value: 'update' }
      ))
  .addStringOption(option =>
    option.setName('text')
      .setDescription('The lore text (if updating)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const action = interaction.options.getString('action', true);
  const serverId = interaction.guildId!;

  if (action === 'view') {
    const { lore } = await backendGet<{ lore: string | null }>(`/api/servers/${serverId}/lore`);
    if (!lore) {
      await interaction.reply({ content: 'No lore configured for this server.', ephemeral: true });
    } else {
      await interaction.reply({ content: lore, ephemeral: true });
    }
    return;
  }

  if (action === 'update') {
    const text = interaction.options.getString('text');
    if (!text) {
      await interaction.reply({ content: 'Please provide the lore text using the `text` option.', ephemeral: true });
      return;
    }

    await backendPut(`/api/servers/${serverId}/lore`, { text });
    await interaction.reply({ content: 'Server lore updated successfully.', ephemeral: true });
  }
}
```

- [ ] **Step 6: Rewrite profile.ts**

Replace `apps/bot/src/commands/profile.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View the inferred JSONB context built for a specific user.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to view')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const serverId = interaction.guildId!;

  const { profile } = await backendGet<{ profile: any }>(`/api/servers/${serverId}/profile/${user.id}`);

  if (!profile) {
    await interaction.reply({
      content: `No profile data for ${user.username} yet. Contexta builds profiles as users interact in the server.`,
      ephemeral: true,
    });
    return;
  }

  const prefs = typeof profile.preferences === 'string'
    ? profile.preferences
    : JSON.stringify(profile.preferences, null, 2);

  const lines = [
    `**Profile: ${profile.global_name || user.username}**`,
    '',
    `**Context:** ${profile.inferred_context || 'None yet'}`,
    `**Preferences:** \`\`\`json\n${prefs}\n\`\`\``,
    `**Interactions:** ${profile.interaction_count}`,
    `**Last active:** ${profile.last_interaction ? new Date(profile.last_interaction).toUTCString() : 'Unknown'}`,
  ];

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
```

- [ ] **Step 7: Verify build**

```bash
cd apps/bot && pnpm build
```

Note: This will have errors because `messageCreate.ts` still imports from `llm/` and `db/`. That's fixed in the next task.

- [ ] **Step 8: Commit**

```bash
git add apps/bot/src/commands/
git commit -m "refactor(bot): rewire all commands to use backend API"
```

---

### Task 11: Rewire messageCreate and Simplify Bot HTTP Server

**Files:**
- Modify: `apps/bot/src/events/messageCreate.ts`
- Modify: `apps/bot/src/utils/httpServer.ts`
- Modify: `apps/bot/src/index.ts`

- [ ] **Step 1: Rewrite messageCreate.ts**

The mention handler calls the backend for AI responses instead of using local providers. Attachment processing also goes through the backend. Redis storage stays local.

Replace `apps/bot/src/events/messageCreate.ts`:

```typescript
import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { BOT_SENTINEL, sanitizeMessageContent, formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export interface MessageCreateDeps {
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
    sAdd: (key: string, member: string) => Promise<number>;
  };
  postBackend?: typeof backendPost;
  getBackend?: typeof backendGet;
}

const defaultDeps: MessageCreateDeps = {
  redis: redisClient as unknown as MessageCreateDeps['redis'],
  postBackend: backendPost,
  getBackend: backendGet,
};

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message, deps: MessageCreateDeps = defaultDeps) {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;

  if (!serverId) return;

  if (isRateLimited(message.author.id)) {
    if (message.mentions.has(message.client.user.id)) {
      await message.react('⏳').catch(() => {});
    }
    return;
  }

  const displayName = message.member?.displayName || message.author.username;
  let formattedMessage = formatUserMessage(displayName, message.content);

  // Attachment descriptions stay simple — no AI processing in the bot
  // (attachment AI processing happens when the backend handles chat)

  const redisKey = `channel:${channelId}:history`;
  await deps.redis.rPush(redisKey, formattedMessage);
  await deps.redis.sAdd('active_channels', channelId);
  await deps.redis.lTrim(redisKey, -50, -1);
  await deps.redis.set(`channel:${channelId}:server`, serverId);

  if (message.mentions.has(message.client.user.id)) {
    const history = await deps.redis.lRange(redisKey, 0, -1);

    const chatHistory = history.map(msg => ({
      role: msg.startsWith(BOT_SENTINEL) ? 'model' as const : 'user' as const,
      parts: [{ text: msg }],
    }));

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const post = deps.postBackend || backendPost;
      const get = deps.getBackend || backendGet;

      // Get server lore for system prompt
      let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.';

      try {
        const { lore } = await get<{ lore: string | null }>(`/api/servers/${serverId}/lore`);
        if (lore) {
          systemPrompt += `\n\nServer context and lore:\n${lore}`;
        }
      } catch { /* use default prompt */ }

      const { response } = await post<{ response: string }>('/api/chat', {
        serverId,
        systemPrompt,
        chatHistory,
      });

      await message.reply(response);

      const botFormattedMsg = `${BOT_SENTINEL}[System/Contexta]: ${response}`;
      await deps.redis.rPush(redisKey, botFormattedMsg);
      await deps.redis.lTrim(redisKey, -50, -1);
    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
```

- [ ] **Step 2: Simplify httpServer.ts**

Replace `apps/bot/src/utils/httpServer.ts` — health only, no cron:

```typescript
import http from 'http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function startHealthServer(): http.Server {
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`[Bot HTTP] Health server on port ${port}`);
  });

  return server;
}
```

- [ ] **Step 3: Update index.ts**

Update `apps/bot/src/index.ts` to use the simplified health server. Remove the cron wiring and `runSemanticEmbeddingWorker` import. Replace the HTTP server section with:

```typescript
import { startHealthServer } from './utils/httpServer.js';
```

And in `start()`, after `client.login(token)`:

```typescript
  startHealthServer();
```

Remove any imports of `runSemanticEmbeddingWorker`, `HttpServerDeps`, or the `CRON_SECRET` gating logic.

- [ ] **Step 4: Commit**

```bash
git add apps/bot/src/events/messageCreate.ts apps/bot/src/utils/httpServer.ts apps/bot/src/index.ts
git commit -m "refactor(bot): rewire messageCreate to backend, simplify HTTP server"
```

---

### Task 12: Remove Bot AI Code and Clean Up

**Files:**
- Delete: `apps/bot/src/llm/` (entire directory)
- Delete: `apps/bot/src/services/attachmentProcessor.ts`
- Delete: `apps/bot/src/utils/backgroundWorker.ts`
- Modify: `apps/bot/package.json` (remove AI SDK deps)
- Delete or update tests that reference removed code

- [ ] **Step 1: Delete moved code from bot**

```bash
rm -rf apps/bot/src/llm/
rm apps/bot/src/services/attachmentProcessor.ts
rm apps/bot/src/utils/backgroundWorker.ts
```

- [ ] **Step 2: Remove AI SDK deps from bot package.json**

In `apps/bot/package.json`, remove these from `dependencies`:
- `"@anthropic-ai/sdk"`
- `"@google/genai"`
- `"openai"`

Also remove `"pg"` since the bot no longer queries the DB directly (all goes through backend). Remove `"@types/pg"` from devDependencies.

- [ ] **Step 3: Remove bot db/index.ts**

The bot no longer needs direct DB access:

```bash
rm -rf apps/bot/src/db/
```

- [ ] **Step 4: Delete tests for removed code**

```bash
rm apps/bot/src/tests/unit/providerRegistry.test.ts
rm apps/bot/src/tests/unit/geminiCaching.test.ts
rm apps/bot/src/tests/unit/httpServer.test.ts
rm apps/bot/src/tests/unit/workerPipeline.test.ts
rm apps/bot/src/tests/unit/attachmentProcessor.test.ts
rm apps/bot/src/tests/unit/dbConfig.test.ts
rm apps/bot/src/tests/unit/searchSimilarMemory.test.ts
rm apps/bot/src/tests/component/backgroundWorker.test.ts
```

- [ ] **Step 5: Update remaining bot tests**

The command and messageCreate tests need updating — they should mock `backendClient` functions instead of AI providers and DB queries. Each test file needs its `vi.mock()` calls updated to mock `../../lib/backendClient.js` instead of `../../llm/providerRegistry.js` and `../../db/index.js`.

For each remaining test file (`ask.test.ts`, `summarize.test.ts`, `recall.test.ts`, `settings.test.ts`, `lore.test.ts`, `profile.test.ts`, `messageCreate.test.ts`):

- Replace mocks of `../../db/index.js` and `../../llm/providerRegistry.js` with mock of `../../lib/backendClient.js`
- Mock `backendPost`, `backendGet`, `backendPut`, `backendDelete` to return appropriate responses
- Update assertions to check backendClient calls instead of AI/DB calls

This is detailed per-file work. The engineer should update each test to mock the backend client and verify the command calls the right endpoint with the right payload.

- [ ] **Step 6: Reinstall and verify**

```bash
cd apps/bot && pnpm install
pnpm build
pnpm test
```

Expected: Bot builds and tests pass with the new backend-calling architecture.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(bot): remove AI providers and DB code, update tests for backend client"
```

---

### Task 13: Final Integration Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Verify backend builds and tests**

```bash
cd apps/backend && pnpm build && pnpm test
```

Expected: All backend tests pass.

- [ ] **Step 2: Verify bot builds and tests**

```bash
cd apps/bot && pnpm build && pnpm test
```

Expected: All bot tests pass.

- [ ] **Step 3: Verify full workspace**

```bash
pnpm build
pnpm test
```

Expected: All packages build, all tests pass across the workspace.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final integration verification — all tests passing"
```
