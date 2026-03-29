# Complete Bot Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish all incomplete bot subsystems — command auto-discovery, cron-triggered background worker, multi-provider LLM support (Gemini + OpenAI + Anthropic), all stub slash commands, and real Gemini context caching.

**Architecture:** Sequential completion in dependency order. Infrastructure first (command loading, HTTP server, provider registry), then feature implementations (commands, caching), then wiring everything into the message handler. Each provider implements `IAIProvider`; all embeddings always go through Gemini regardless of active chat model.

**Tech Stack:** TypeScript (ES modules, `.js` extension imports), Discord.js 14, Node `http`, `@google/genai`, `openai`, `@anthropic-ai/sdk`, PostgreSQL + pgvector, Redis, Vitest

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/llm/OpenAIProvider.ts` | `IAIProvider` implementation using OpenAI SDK |
| `src/llm/AnthropicProvider.ts` | `IAIProvider` implementation using Anthropic SDK |
| `src/llm/providerRegistry.ts` | Maps model strings to provider instances, caches them, validates API keys |
| `src/db/migrations/001-expand-model-choices.sql` | Documents expanded model values (no DDL change) |
| `src/tests/unit/providerRegistry.test.ts` | Tests for provider registry routing, caching, key validation |
| `src/tests/unit/openAIProvider.test.ts` | Tests for OpenAI message format mapping |
| `src/tests/unit/anthropicProvider.test.ts` | Tests for Anthropic message format mapping |
| `src/tests/unit/httpServer.test.ts` | Tests for HTTP server routing and auth |
| `src/tests/component/lore.test.ts` | Tests for `/lore` command |
| `src/tests/component/settings.test.ts` | Tests for `/settings` command |
| `src/tests/component/profile.test.ts` | Tests for `/profile` command |

### Modified files

| File | Changes |
|------|---------|
| `src/index.ts` | Add `loadCommands()`, `startHttpServer()`, remove commented `setInterval`, add `ready` event for command registration |
| `src/llm/GeminiProvider.ts` | Accept `modelName` constructor param, implement real `createServerContextCache()`, use `cachedContent` in `generateChatResponse` |
| `src/utils/backgroundWorker.ts` | Add idempotency guard (Redis lock), return stats object |
| `src/commands/ask.ts` | Full implementation with provider lookup and server lore |
| `src/commands/summarize.ts` | Full implementation fetching Discord messages and summarizing |
| `src/commands/lore.ts` | Full implementation with DB read/write |
| `src/commands/settings.ts` | Full implementation with expanded model list and cache management |
| `src/commands/profile.ts` | Full implementation with DB query |
| `src/events/messageCreate.ts` | Dynamic provider lookup, server lore in system prompt, cache passthrough |
| `src/tests/helpers/mockRedis.ts` | Add `setEx` and `del` methods for idempotency guard tests |
| `src/tests/helpers/mockDb.ts` | No changes needed — already has `query` mock |
| `src/tests/component/ask.test.ts` | Update tests for real AI integration |
| `src/tests/component/summarize.test.ts` | Replace stub tests with real implementation tests |
| `src/tests/component/messageCreate.test.ts` | Add tests for dynamic provider and lore |
| `package.json` | Add `openai` and `@anthropic-ai/sdk` dependencies |
| `.env.example` | Add new env vars |

---

### Task 1: Command Auto-Discovery

**Files:**
- Modify: `src/index.ts:22-65`
- Test: `src/tests/unit/commandLoader.test.ts` (new, but we'll verify via integration in this task)

- [ ] **Step 1: Write the loadCommands function**

Replace the contents of `src/index.ts` with:

```typescript
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './utils/redis.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

(client as any).commands = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const commandFiles = fs.readdirSync(commandsPath).filter(
    file => file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(`file://${filePath}`);

    if (command.data && command.execute) {
      (client as any).commands.set(command.data.name, command);
    } else {
      console.warn(`[Loader] Command file ${file} is missing 'data' or 'execute' export.`);
    }
  }

  console.log(`[Loader] Loaded ${(client as any).commands.size} commands.`);
}

async function registerCommands() {
  const commands = (client as any).commands.map((cmd: any) => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  const devGuildId = process.env.DEV_GUILD_ID;

  if (devGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, devGuildId),
      { body: commands }
    );
    console.log(`[Loader] Registered ${commands.length} commands to dev guild ${devGuildId}.`);
  } else {
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    console.log(`[Loader] Registered ${commands.length} commands globally.`);
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(
    file => file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(`file://${filePath}`);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

async function initServices() {
  await initRedis();
}

async function start() {
  await initServices();
  await loadCommands();
  await loadEvents();

  client.once('ready', async () => {
    try {
      await registerCommands();
    } catch (err) {
      console.error('[Loader] Failed to register commands:', err);
    }
    console.log(`[Contexta Bot] Boot sequence complete. System online.`);
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Contexta Bot] FATAL ERROR: DISCORD_TOKEN is missing. Please set it in your .env file.');
    process.exit(1);
  }

  await client.login(token);
}

start();
```

- [ ] **Step 2: Run the build to verify no compile errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run existing tests to verify nothing is broken**

Run: `npm test`
Expected: All existing tests pass (the loadCommands/registerCommands functions are only called at startup, not in test code)

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add command auto-discovery and Discord API registration"
```

---

### Task 2: HTTP Server for Cron Endpoint

**Files:**
- Modify: `src/index.ts`
- Test: `src/tests/unit/httpServer.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/httpServer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';

// We'll test the route handler logic directly, not the server lifecycle.
// Extract the handler into a testable function.

// The handler will be imported from index.ts — but since index.ts has side effects,
// we'll extract the handler into a separate file for testability.

// For now, test the handler logic we'll build in src/utils/httpServer.ts
import { createRequestHandler } from '../../utils/httpServer.js';

describe('HTTP request handler', () => {
  let handler: ReturnType<typeof createRequestHandler>;
  let mockWorker: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorker = vi.fn().mockResolvedValue({
      status: 'completed',
      channelsProcessed: 2,
      embeddingsCreated: 2,
      errors: [],
    });
    handler = createRequestHandler({ cronSecret: 'test-secret', runWorker: mockWorker });
  });

  function mockReqRes(method: string, url: string, headers: Record<string, string> = {}) {
    const req = { method, url, headers } as http.IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as http.ServerResponse;
    return { req, res };
  }

  it('returns 200 on GET /health', async () => {
    const { req, res } = mockReqRes('GET', '/health');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
  });

  it('returns 404 on unknown routes', async () => {
    const { req, res } = mockReqRes('GET', '/unknown');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('returns 401 when cron secret is missing', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(mockWorker).not.toHaveBeenCalled();
  });

  it('returns 401 when cron secret is wrong', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer wrong-secret',
    });
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(mockWorker).not.toHaveBeenCalled();
  });

  it('calls worker and returns stats on valid cron request', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer test-secret',
    });
    await handler(req, res);
    expect(mockWorker).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = JSON.parse((res.end as any).mock.calls[0][0]);
    expect(body.status).toBe('completed');
    expect(body.channelsProcessed).toBe(2);
  });

  it('returns 500 when worker throws', async () => {
    mockWorker.mockRejectedValue(new Error('Worker crashed'));
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer test-secret',
    });
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });

  it('returns 405 on non-POST to /cron/embeddings', async () => {
    const { req, res } = mockReqRes('GET', '/cron/embeddings');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/httpServer.test.ts`
Expected: FAIL — `../../utils/httpServer.js` does not exist

- [ ] **Step 3: Write the HTTP server module**

Create `src/utils/httpServer.ts`:

```typescript
import http from 'http';

export interface HttpServerDeps {
  cronSecret: string;
  runWorker: () => Promise<{
    status: string;
    channelsProcessed: number;
    embeddingsCreated: number;
    errors: string[];
  }>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function createRequestHandler(deps: HttpServerDeps) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const { method, url, headers } = req;

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url === '/cron/embeddings') {
      if (method !== 'POST') {
        res.writeHead(405, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const authHeader = headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${deps.cronSecret}`) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        const stats = await deps.runWorker();
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify(stats));
      } catch (err) {
        console.error('[HTTP] Worker error:', err);
        res.writeHead(500, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Worker failed', message: (err as Error).message }));
      }
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}

export function startHttpServer(deps: HttpServerDeps): http.Server {
  const handler = createRequestHandler(deps);
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(err => {
      console.error('[HTTP] Unhandled error:', err);
      res.writeHead(500, JSON_HEADERS);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  server.listen(port, () => {
    console.log(`[HTTP] Server listening on port ${port}`);
  });

  return server;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/unit/httpServer.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Wire HTTP server into index.ts**

In `src/index.ts`, add the import at the top:

```typescript
import { startHttpServer } from './utils/httpServer.js';
import { runSemanticEmbeddingWorker } from './utils/backgroundWorker.js';
```

Add after `await client.login(token)` in the `start()` function:

```typescript
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    startHttpServer({ cronSecret, runWorker: runSemanticEmbeddingWorker });
  } else {
    console.warn('[HTTP] CRON_SECRET not set — HTTP server disabled.');
  }
```

Remove the old unused import of `runSemanticEmbeddingWorker` and the commented-out `setInterval` line from `initServices()`.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/utils/httpServer.ts src/tests/unit/httpServer.test.ts src/index.ts
git commit -m "feat: add HTTP server with cron endpoint for background worker"
```

---

### Task 3: Background Worker Idempotency Guard

**Files:**
- Modify: `src/utils/backgroundWorker.ts:51-78`
- Modify: `src/tests/helpers/mockRedis.ts`
- Test: `src/tests/unit/workerPipeline.test.ts` (add new tests)

- [ ] **Step 1: Add setEx and del to mock Redis**

In `src/tests/helpers/mockRedis.ts`, add two methods:

```typescript
    setEx: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
```

Add these after the `sMembers` line inside the return object.

- [ ] **Step 2: Write the failing test for idempotency guard**

Add to `src/tests/unit/workerPipeline.test.ts`:

```typescript
import { runSemanticEmbeddingWorker } from '../../utils/backgroundWorker.js';

describe('runSemanticEmbeddingWorker idempotency', () => {
  it('skips when lock key already exists', async () => {
    const redis = createMockRedis();
    redis.get.mockImplementation(async (key: string) => {
      if (key === 'worker:embedding:running') return '1';
      return null;
    });
    const ai = createMockAIProvider();
    const db = createMockDb();

    const result = await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(result).toEqual({ status: 'skipped', reason: 'already_running', channelsProcessed: 0, embeddingsCreated: 0, errors: [] });
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it('acquires and releases lock on successful run', async () => {
    const redis = createMockRedis();
    redis.get.mockResolvedValue(null);
    redis.sMembers.mockResolvedValue([]);
    const ai = createMockAIProvider();
    const db = createMockDb();

    const result = await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(redis.setEx).toHaveBeenCalledWith('worker:embedding:running', 300, '1');
    expect(redis.del).toHaveBeenCalledWith('worker:embedding:running');
    expect(result.status).toBe('completed');
  });

  it('returns stats with channel and embedding counts', async () => {
    const redis = createMockRedis();
    redis.get.mockImplementation(async (key: string) => {
      if (key === 'worker:embedding:running') return null;
      return 'server-1';
    });
    redis.sMembers.mockResolvedValue(['c1']);
    redis.lRange.mockResolvedValue(new Array(15).fill('msg'));
    const ai = createMockAIProvider();
    const db = createMockDb();

    const result = await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(result.status).toBe('completed');
    expect(result.channelsProcessed).toBe(1);
    expect(result.embeddingsCreated).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/workerPipeline.test.ts`
Expected: FAIL — `runSemanticEmbeddingWorker` doesn't return an object / doesn't check lock

- [ ] **Step 4: Update backgroundWorker.ts with idempotency guard and stats**

Replace the `runSemanticEmbeddingWorker` function in `src/utils/backgroundWorker.ts`:

```typescript
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
  db: { query: (text: string, params?: any[]) => Promise<any> } = pool
): Promise<WorkerStats> {
  const LOCK_KEY = 'worker:embedding:running';
  const LOCK_TTL = 300; // 5 minutes

  // Idempotency guard
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
        console.log(`[Worker] Generated summary for channel ${channelId}`);

        const embedding = await embedSummary(ai, summary);
        console.log(`[Worker] Generated embedding [${embedding.length} dims]`);

        await storeMemoryVector(db, serverId, channelId, summary, embedding);
        console.log(`[Worker] Inserted memory chunk for channel ${channelId} (server ${serverId})`);

        stats.channelsProcessed++;
        stats.embeddingsCreated++;
      } catch (err) {
        console.error(`[Worker] Error processing channel ${channelId}:`, err);
        stats.errors.push(`channel ${channelId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
    stats.status = 'error';
    stats.errors.push(`fatal: ${(err as Error).message}`);
  } finally {
    await redis.del(LOCK_KEY);
  }

  return stats;
}
```

Also update the redis type in `fetchEligibleChannels` to not require the new methods (it stays as-is — only `runSemanticEmbeddingWorker` needs `setEx`/`del`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/workerPipeline.test.ts`
Expected: All tests PASS (old and new)

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/utils/backgroundWorker.ts src/tests/unit/workerPipeline.test.ts src/tests/helpers/mockRedis.ts
git commit -m "feat: add idempotency guard and stats reporting to background worker"
```

---

### Task 4: Provider Registry

**Files:**
- Create: `src/llm/providerRegistry.ts`
- Test: `src/tests/unit/providerRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/unit/providerRegistry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProvider, clearProviderCache } from '../../llm/providerRegistry.js';

describe('providerRegistry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
    clearProviderCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns GeminiProvider for gemini-* models', () => {
    const provider = getProvider('gemini-2.5-flash');
    expect(provider.constructor.name).toBe('GeminiProvider');
  });

  it('returns GeminiProvider for gemini-2.5-pro', () => {
    const provider = getProvider('gemini-2.5-pro');
    expect(provider.constructor.name).toBe('GeminiProvider');
  });

  it('returns OpenAIProvider for gpt-* models', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const provider = getProvider('gpt-4o');
    expect(provider.constructor.name).toBe('OpenAIProvider');
  });

  it('returns AnthropicProvider for claude-* models', () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const provider = getProvider('claude-sonnet-4-20250514');
    expect(provider.constructor.name).toBe('AnthropicProvider');
  });

  it('throws for unknown model prefix', () => {
    expect(() => getProvider('llama-3')).toThrow('Unsupported model');
  });

  it('throws when OPENAI_API_KEY is missing for OpenAI model', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getProvider('gpt-4o')).toThrow('OPENAI_API_KEY');
  });

  it('throws when ANTHROPIC_API_KEY is missing for Anthropic model', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getProvider('claude-sonnet-4-20250514')).toThrow('ANTHROPIC_API_KEY');
  });

  it('caches provider instances per model string', () => {
    const p1 = getProvider('gemini-2.5-flash');
    const p2 = getProvider('gemini-2.5-flash');
    expect(p1).toBe(p2);
  });

  it('returns different instances for different models', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const gemini = getProvider('gemini-2.5-flash');
    const openai = getProvider('gpt-4o');
    expect(gemini).not.toBe(openai);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/providerRegistry.test.ts`
Expected: FAIL — `../../llm/providerRegistry.js` does not exist

- [ ] **Step 3: Write providerRegistry.ts**

Create `src/llm/providerRegistry.ts`:

```typescript
import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

const providerCache = new Map<string, IAIProvider>();

function getProviderPrefix(modelName: string): string {
  if (modelName.startsWith('gemini-')) return 'gemini';
  if (modelName.startsWith('gpt-')) return 'openai';
  if (modelName.startsWith('claude-')) return 'anthropic';
  throw new Error(`Unsupported model: "${modelName}". Expected a model starting with gemini-, gpt-, or claude-.`);
}

export function getProvider(modelName: string): IAIProvider {
  const cached = providerCache.get(modelName);
  if (cached) return cached;

  const prefix = getProviderPrefix(modelName);
  let provider: IAIProvider;

  switch (prefix) {
    case 'gemini':
      provider = new GeminiProvider(modelName);
      break;
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(`OPENAI_API_KEY is required to use ${modelName}. Set it in your environment variables.`);
      }
      provider = new OpenAIProvider(modelName);
      break;
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(`ANTHROPIC_API_KEY is required to use ${modelName}. Set it in your environment variables.`);
      }
      provider = new AnthropicProvider(modelName);
      break;
    default:
      throw new Error(`Unsupported model prefix: ${prefix}`);
  }

  providerCache.set(modelName, provider);
  return provider;
}

export function clearProviderCache(): void {
  providerCache.clear();
}
```

This will fail to compile until OpenAIProvider and AnthropicProvider exist. We'll create stubs next.

- [ ] **Step 4: Create OpenAIProvider stub**

Create `src/llm/OpenAIProvider.ts`:

```typescript
import OpenAI from 'openai';
import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private modelName: string;
  private geminiForEmbeddings: GeminiProvider;

  constructor(modelName = 'gpt-4o') {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.modelName = modelName;
    this.geminiForEmbeddings = new GeminiProvider();
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    _cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.parts.map(p => p.text).join('\n'),
      })),
    ];

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.geminiForEmbeddings.generateEmbedding(text);
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an objective summarization engine. Summarize the following text accurately and concisely.' },
        { role: 'user', content: text },
      ],
    });
    return response.choices[0]?.message?.content || '';
  }

  async createServerContextCache(_lore: string, _ttlMinutes?: number): Promise<string> {
    return 'noop-openai-no-context-cache';
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
            { type: 'text', text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content || 'No description available';
  }
}
```

- [ ] **Step 5: Create AnthropicProvider stub**

Create `src/llm/AnthropicProvider.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { IAIProvider } from './IAIProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private modelName: string;
  private geminiForEmbeddings: GeminiProvider;

  constructor(modelName = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.modelName = modelName;
    this.geminiForEmbeddings = new GeminiProvider();
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    _cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const messages: Anthropic.MessageParam[] = chatHistory.map(msg => ({
      role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.parts.map(p => p.text).join('\n'),
    }));

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.geminiForEmbeddings.generateEmbedding(text);
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are an objective summarization engine. Summarize the following text accurately and concisely.',
      messages: [{ role: 'user', content: text }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async createServerContextCache(_lore: string, _ttlMinutes?: number): Promise<string> {
    return 'noop-anthropic-no-context-cache';
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Data } },
            { type: 'text', text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
          ],
        },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'No description available';
  }
}
```

- [ ] **Step 6: Install new dependencies**

Run: `npm install openai @anthropic-ai/sdk`

- [ ] **Step 7: Update GeminiProvider to accept modelName parameter**

In `src/llm/GeminiProvider.ts`, change the constructor and `modelName` field:

Replace:
```typescript
export class GeminiProvider implements IAIProvider {
  private ai: GoogleGenAI;
  private modelName = 'gemini-2.5-flash';
  private embeddingModel = 'text-embedding-004';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
```

With:
```typescript
export class GeminiProvider implements IAIProvider {
  private ai: GoogleGenAI;
  private modelName: string;
  private embeddingModel = 'text-embedding-004';

  constructor(modelName = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = modelName;
  }
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/tests/unit/providerRegistry.test.ts`
Expected: All 9 tests PASS

Run: `npm test`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/llm/providerRegistry.ts src/llm/OpenAIProvider.ts src/llm/AnthropicProvider.ts src/llm/GeminiProvider.ts src/tests/unit/providerRegistry.test.ts package.json package-lock.json
git commit -m "feat: add OpenAI and Anthropic providers with provider registry"
```

---

### Task 5: Implement `/lore` Command

**Files:**
- Modify: `src/commands/lore.ts`
- Test: `src/tests/component/lore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/component/lore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockDb } from '../helpers/mockDb.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

import { query } from '../../db/index.js';
import { execute } from '../../commands/lore.js';

const mockQuery = vi.mocked(query);

describe('lore command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin users', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(false) },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('permission'), ephemeral: true })
    );
  });

  it('view action returns lore when it exists', async () => {
    mockQuery.mockResolvedValue({ rows: [{ server_lore: 'This is a fantasy server.' }], rowCount: 1 } as any);
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'view';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('fantasy server'), ephemeral: true })
    );
  });

  it('view action reports when no lore is configured', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'view';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No lore configured'), ephemeral: true })
    );
  });

  it('update action upserts lore and clears cache', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'update';
          if (name === 'text') return 'New lore content';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO server_settings'),
      expect.arrayContaining(['guild-456', 'New lore content'])
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('updated'), ephemeral: true })
    );
  });

  it('update action rejects when no text is provided', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'update';
          if (name === 'text') return null;
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('provide the lore text'), ephemeral: true })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/lore.test.ts`
Expected: FAIL — current implementation doesn't query DB

- [ ] **Step 3: Implement lore command**

Replace `src/commands/lore.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';

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
    const result = await query(
      'SELECT server_lore FROM server_settings WHERE server_id = $1',
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].server_lore) {
      await interaction.reply({ content: 'No lore configured for this server.', ephemeral: true });
    } else {
      await interaction.reply({ content: result.rows[0].server_lore, ephemeral: true });
    }
    return;
  }

  if (action === 'update') {
    const text = interaction.options.getString('text');
    if (!text) {
      await interaction.reply({ content: 'Please provide the lore text using the `text` option.', ephemeral: true });
      return;
    }

    await query(
      `INSERT INTO server_settings (server_id, server_lore, context_cache_id, cache_expires_at)
       VALUES ($1, $2, NULL, NULL)
       ON CONFLICT (server_id)
       DO UPDATE SET server_lore = $2, context_cache_id = NULL, cache_expires_at = NULL`,
      [serverId, text]
    );

    await interaction.reply({ content: 'Server lore updated successfully.', ephemeral: true });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/lore.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/lore.ts src/tests/component/lore.test.ts
git commit -m "feat: implement /lore command with DB read/write and cache invalidation"
```

---

### Task 6: Implement `/profile` Command

**Files:**
- Modify: `src/commands/profile.ts`
- Test: `src/tests/component/profile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/component/profile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

import { query } from '../../db/index.js';
import { execute } from '../../commands/profile.js';

const mockQuery = vi.mocked(query);

describe('profile command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows profile data when user exists', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        global_name: 'Alice',
        inferred_context: 'Enjoys coding and gaming',
        preferences: { theme: 'dark' },
        interaction_count: 42,
        last_interaction: '2026-03-15T12:00:00Z',
      }],
      rowCount: 1,
    } as any);

    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-456', username: 'Alice' }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Alice'),
        ephemeral: true,
      })
    );
    const content = (interaction.reply as any).mock.calls[0][0].content;
    expect(content).toContain('42');
    expect(content).toContain('coding');
  });

  it('reports when no profile data exists', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-999', username: 'Nobody' }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No profile data'),
        ephemeral: true,
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/profile.test.ts`
Expected: FAIL — current implementation doesn't query DB

- [ ] **Step 3: Implement profile command**

Replace `src/commands/profile.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';

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

  const result = await query(
    `SELECT gu.global_name, sm.inferred_context, sm.preferences, sm.interaction_count, gu.last_interaction
     FROM server_members sm
     JOIN global_users gu ON gu.user_id = sm.user_id
     WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, user.id]
  );

  if (result.rows.length === 0) {
    await interaction.reply({
      content: `No profile data for ${user.username} yet. Contexta builds profiles as users interact in the server.`,
      ephemeral: true,
    });
    return;
  }

  const row = result.rows[0];
  const prefs = typeof row.preferences === 'string'
    ? row.preferences
    : JSON.stringify(row.preferences, null, 2);

  const lines = [
    `**Profile: ${row.global_name || user.username}**`,
    '',
    `**Context:** ${row.inferred_context || 'None yet'}`,
    `**Preferences:** \`\`\`json\n${prefs}\n\`\`\``,
    `**Interactions:** ${row.interaction_count}`,
    `**Last active:** ${row.last_interaction ? new Date(row.last_interaction).toUTCString() : 'Unknown'}`,
  ];

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/profile.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/profile.ts src/tests/component/profile.test.ts
git commit -m "feat: implement /profile command with DB query"
```

---

### Task 7: Implement `/ask` Command

**Files:**
- Modify: `src/commands/ask.ts`
- Modify: `src/tests/component/ask.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/tests/component/ask.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock('../../llm/providerRegistry.js', () => ({
  getProvider: vi.fn(),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { query } from '../../db/index.js';
import { getProvider } from '../../llm/providerRegistry.js';
import { execute } from '../../commands/ask.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockQuery = vi.mocked(query);
const mockGetProvider = vi.mocked(getProvider);

describe('ask command', () => {
  let mockAI: ReturnType<typeof createMockAIProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockAI = createMockAIProvider();
    mockGetProvider.mockReturnValue(mockAI);
    mockQuery.mockResolvedValue({ rows: [{ active_model: 'gemini-2.5-flash', server_lore: null }], rowCount: 1 } as any);
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

  it('calls AI provider and replies with response', async () => {
    mockAI.generateChatResponse = vi.fn().mockResolvedValue('The answer is 42.');
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('What is the meaning of life?'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    expect(mockAI.generateChatResponse).toHaveBeenCalledWith(
      expect.stringContaining('Contexta'),
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', parts: [{ text: 'What is the meaning of life?' }] }),
      ]),
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith('The answer is 42.');
  });

  it('includes server lore in system prompt when available', async () => {
    mockQuery.mockResolvedValue({ rows: [{ active_model: 'gemini-2.5-flash', server_lore: 'This is a pirate server.' }], rowCount: 1 } as any);
    mockAI.generateChatResponse = vi.fn().mockResolvedValue('Arr!');
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('hello'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    const systemPrompt = vi.mocked(mockAI.generateChatResponse).mock.calls[0][0];
    expect(systemPrompt).toContain('pirate server');
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

  it('handles AI error gracefully', async () => {
    mockAI.generateChatResponse = vi.fn().mockRejectedValue(new Error('API down'));
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('issue')
    );
  });

  it('uses default model when no server settings exist', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(mockGetProvider).toHaveBeenCalledWith('gemini-2.5-flash');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/ask.test.ts`
Expected: FAIL — current implementation doesn't call AI

- [ ] **Step 3: Implement ask command**

Replace `src/commands/ask.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

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
    const serverId = interaction.guildId;
    let activeModel = 'gemini-2.5-flash';
    let serverLore: string | null = null;

    if (serverId) {
      const result = await query(
        'SELECT active_model, server_lore FROM server_settings WHERE server_id = $1',
        [serverId]
      );
      if (result.rows.length > 0) {
        activeModel = result.rows[0].active_model || activeModel;
        serverLore = result.rows[0].server_lore;
      }
    }

    const ai = getProvider(activeModel);

    let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses.';
    if (serverLore) {
      systemPrompt += `\n\nServer context and lore:\n${serverLore}`;
    }

    const chatHistory = [
      { role: 'user' as const, parts: [{ text: userQuery }] },
    ];

    const response = await ai.generateChatResponse(systemPrompt, chatHistory, { ttlMinutes: 60 });

    if (response.length > 2000) {
      await interaction.editReply(response.substring(0, 2000));
    } else {
      await interaction.editReply(response);
    }
  } catch (err) {
    console.error('[ask] Error generating response:', err);
    await interaction.editReply('I ran into an issue attempting to process that request.');
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/ask.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/ask.ts src/tests/component/ask.test.ts
git commit -m "feat: implement /ask command with provider lookup and server lore"
```

---

### Task 8: Implement `/summarize` Command

**Files:**
- Modify: `src/commands/summarize.ts`
- Modify: `src/tests/component/summarize.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace or create `src/tests/component/summarize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { Collection, SnowflakeUtil } from 'discord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ active_model: 'gemini-2.5-flash' }], rowCount: 1 }),
}));

vi.mock('../../llm/providerRegistry.js', () => ({
  getProvider: vi.fn(),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { getProvider } from '../../llm/providerRegistry.js';
import { execute } from '../../commands/summarize.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockGetProvider = vi.mocked(getProvider);

describe('summarize command', () => {
  let mockAI: ReturnType<typeof createMockAIProvider>;
  let mockChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockAI = createMockAIProvider();
    mockAI.summarizeText = vi.fn().mockResolvedValue('Here is the summary of the conversation.');
    mockGetProvider.mockReturnValue(mockAI);

    mockChannel = {
      id: 'channel-789',
      messages: {
        fetch: vi.fn().mockResolvedValue(new Collection([
          ['msg-1', { author: { bot: false, username: 'Alice' }, content: 'Hello everyone', createdTimestamp: Date.now() - 1000 }],
          ['msg-2', { author: { bot: false, username: 'Bob' }, content: 'Hi Alice!', createdTimestamp: Date.now() - 500 }],
        ])),
      },
    };
  });

  it('rejects in DM context', async () => {
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
  });

  it('fetches messages and summarizes via AI', async () => {
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(24),
        getChannel: vi.fn().mockReturnValue(null),
      },
    });
    await execute(interaction);
    expect(mockChannel.messages.fetch).toHaveBeenCalled();
    expect(mockAI.summarizeText).toHaveBeenCalledWith(
      expect.stringContaining('Alice')
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('summary')
    );
  });

  it('reports when no messages found in time range', async () => {
    mockChannel.messages.fetch.mockResolvedValue(new Collection());
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(1),
        getChannel: vi.fn().mockReturnValue(null),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('No messages found')
    );
  });

  it('uses specified channel when provided', async () => {
    const otherChannel = {
      id: 'other-channel',
      messages: {
        fetch: vi.fn().mockResolvedValue(new Collection([
          ['msg-3', { author: { bot: false, username: 'Charlie' }, content: 'Test', createdTimestamp: Date.now() }],
        ])),
      },
    };
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(24),
        getChannel: vi.fn().mockReturnValue(otherChannel),
      },
    });
    await execute(interaction);
    expect(otherChannel.messages.fetch).toHaveBeenCalled();
    expect(mockChannel.messages.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/summarize.test.ts`
Expected: FAIL — current implementation doesn't fetch messages or call AI

- [ ] **Step 3: Implement summarize command**

Replace `src/commands/summarize.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, SnowflakeUtil, TextChannel } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

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
    // Calculate the snowflake for the cutoff time
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const afterSnowflake = SnowflakeUtil.generate({ timestamp: cutoffTime });

    // Fetch messages from Discord API
    const channel = targetChannel as TextChannel;
    const fetched = await channel.messages.fetch({ after: afterSnowflake.toString(), limit: 100 });

    if (fetched.size === 0) {
      await interaction.editReply('No messages found in that time range.');
      return;
    }

    // Format messages chronologically (Collection is newest-first)
    const formatted = [...fetched.values()]
      .filter(msg => !msg.author.bot)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(msg => `[${msg.author.username}]: ${msg.content}`)
      .join('\n');

    if (!formatted) {
      await interaction.editReply('No user messages found in that time range.');
      return;
    }

    // Get server's active model
    const settingsResult = await query(
      'SELECT active_model FROM server_settings WHERE server_id = $1',
      [interaction.guildId]
    );
    const activeModel = settingsResult.rows[0]?.active_model || 'gemini-2.5-flash';
    const ai = getProvider(activeModel);

    const summary = await ai.summarizeText(formatted);

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

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/summarize.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/summarize.ts src/tests/component/summarize.test.ts
git commit -m "feat: implement /summarize command with Discord message fetch and AI summarization"
```

---

### Task 9: Implement `/settings` Command

**Files:**
- Modify: `src/commands/settings.ts`
- Test: `src/tests/component/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/component/settings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock('../../llm/providerRegistry.js', () => ({
  getProvider: vi.fn(),
}));

import { query } from '../../db/index.js';
import { getProvider } from '../../llm/providerRegistry.js';
import { execute } from '../../commands/settings.js';

const mockQuery = vi.mocked(query);
const mockGetProvider = vi.mocked(getProvider);

describe('settings command', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'key', OPENAI_API_KEY: 'key', ANTHROPIC_API_KEY: 'key' };
    mockGetProvider.mockReturnValue(createMockAIProvider());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects non-admin users', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(false) },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('permission'), ephemeral: true })
    );
  });

  describe('model subcommand', () => {
    it('updates active_model in database', async () => {
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('model'),
          getString: vi.fn().mockReturnValue('gpt-4o'),
        },
      });
      await execute(interaction);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO server_settings'),
        expect.arrayContaining(['guild-456', 'gpt-4o'])
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('gpt-4o'), ephemeral: true })
      );
    });

    it('rejects when provider API key is missing', async () => {
      mockGetProvider.mockImplementation(() => { throw new Error('OPENAI_API_KEY is required'); });
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('model'),
          getString: vi.fn().mockReturnValue('gpt-4o'),
        },
      });
      await execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Cannot switch'), ephemeral: true })
      );
    });
  });

  describe('cache subcommand', () => {
    it('refresh creates cache and stores ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ server_lore: 'Test lore', active_model: 'gemini-2.5-flash' }], rowCount: 1,
      } as any);
      const mockAI = createMockAIProvider();
      mockAI.createServerContextCache = vi.fn().mockResolvedValue('cached-123');
      mockGetProvider.mockReturnValue(mockAI);

      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(mockAI.createServerContextCache).toHaveBeenCalledWith('Test lore', 60);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('context_cache_id'),
        expect.arrayContaining(['cached-123'])
      );
    });

    it('refresh rejects when no lore exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('No server lore'), ephemeral: true })
      );
    });

    it('refresh rejects for non-Gemini models', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ server_lore: 'Lore', active_model: 'gpt-4o' }], rowCount: 1,
      } as any);
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('only available with Gemini'), ephemeral: true })
      );
    });

    it('clear nulls cache fields', async () => {
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('clear'),
        },
      });
      await execute(interaction);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('context_cache_id = NULL'),
        expect.arrayContaining(['guild-456'])
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/settings.test.ts`
Expected: FAIL — current implementation is a stub

- [ ] **Step 3: Implement settings command**

Replace `src/commands/settings.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

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

    // Validate the provider can be instantiated (checks API key)
    try {
      getProvider(modelName);
    } catch (err) {
      await interaction.reply({
        content: `Cannot switch to ${modelName} — ${(err as Error).message}`,
        ephemeral: true,
      });
      return;
    }

    await query(
      `INSERT INTO server_settings (server_id, active_model)
       VALUES ($1, $2)
       ON CONFLICT (server_id)
       DO UPDATE SET active_model = $2`,
      [serverId, modelName]
    );

    await interaction.reply({
      content: `Active model switched to **${modelName}**.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'cache') {
    const action = interaction.options.getString('action', true);

    if (action === 'clear') {
      await query(
        'UPDATE server_settings SET context_cache_id = NULL, cache_expires_at = NULL WHERE server_id = $1',
        [serverId]
      );
      await interaction.reply({ content: 'Context cache cleared.', ephemeral: true });
      return;
    }

    if (action === 'refresh') {
      const result = await query(
        'SELECT server_lore, active_model FROM server_settings WHERE server_id = $1',
        [serverId]
      );

      if (result.rows.length === 0 || !result.rows[0].server_lore) {
        await interaction.reply({
          content: 'No server lore to cache. Use `/lore update` first.',
          ephemeral: true,
        });
        return;
      }

      const { server_lore, active_model } = result.rows[0];

      if (!active_model.startsWith('gemini-')) {
        await interaction.reply({
          content: 'Context caching is only available with Gemini models.',
          ephemeral: true,
        });
        return;
      }

      const ai = getProvider(active_model);
      const cacheId = await ai.createServerContextCache(server_lore, 60);

      await query(
        `UPDATE server_settings SET context_cache_id = $1, cache_expires_at = NOW() + INTERVAL '60 minutes' WHERE server_id = $2`,
        [cacheId, serverId]
      );

      await interaction.reply({
        content: `Context cache refreshed (expires in 60 minutes).`,
        ephemeral: true,
      });
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/settings.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/settings.ts src/tests/component/settings.test.ts
git commit -m "feat: implement /settings command with model switching and cache management"
```

---

### Task 10: Gemini Context Caching (Real Implementation)

**Files:**
- Modify: `src/llm/GeminiProvider.ts:55-84`

- [ ] **Step 1: Write the failing test**

Add to a new file `src/tests/unit/geminiCaching.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the @google/genai module
const mockCachesCreate = vi.fn().mockResolvedValue({ name: 'cachedContents/test-123' });
const mockModelsGenerateContent = vi.fn().mockResolvedValue({ text: 'cached response' });
const mockModelsEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [{ values: new Array(768).fill(0.1) }],
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    caches: { create: mockCachesCreate },
    models: {
      generateContent: mockModelsGenerateContent,
      embedContent: mockModelsEmbedContent,
    },
  })),
}));

import { GeminiProvider } from '../../llm/GeminiProvider.js';

describe('GeminiProvider context caching', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider('gemini-2.5-flash');
  });

  it('creates a real cache via ai.caches.create', async () => {
    const cacheId = await provider.createServerContextCache('Server lore text', 30);
    expect(mockCachesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        config: expect.objectContaining({
          ttl: '1800s',
        }),
      })
    );
    expect(cacheId).toBe('cachedContents/test-123');
  });

  it('uses cachedContent instead of systemInstruction when cacheId provided', async () => {
    await provider.generateChatResponse(
      'system prompt',
      [{ role: 'user', parts: [{ text: 'hello' }] }],
      { cacheId: 'cachedContents/test-123' }
    );
    const callArgs = mockModelsGenerateContent.mock.calls[0][0];
    expect(callArgs.config.cachedContent).toBe('cachedContents/test-123');
    expect(callArgs.config.systemInstruction).toBeUndefined();
  });

  it('uses systemInstruction when no cacheId provided', async () => {
    await provider.generateChatResponse(
      'system prompt',
      [{ role: 'user', parts: [{ text: 'hello' }] }]
    );
    const callArgs = mockModelsGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toBe('system prompt');
    expect(callArgs.config.cachedContent).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/geminiCaching.test.ts`
Expected: FAIL — current implementation is mocked and doesn't call `ai.caches.create`

- [ ] **Step 3: Update GeminiProvider with real caching**

Replace the full `src/llm/GeminiProvider.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';
import { IAIProvider } from './IAIProvider.js';

export class GeminiProvider implements IAIProvider {
  private ai: GoogleGenAI;
  private modelName: string;
  private embeddingModel = 'text-embedding-004';

  constructor(modelName = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = modelName;
  }

  async generateChatResponse(
    systemPrompt: string,
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
    cacheOptions?: { cacheId?: string; ttlMinutes?: number }
  ): Promise<string> {
    const config: Record<string, any> = {};

    if (cacheOptions?.cacheId) {
      // Use cached context — do not send systemInstruction alongside it
      config.cachedContent = cacheOptions.cacheId;
    } else {
      config.systemInstruction = systemPrompt;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: chatHistory,
        config,
      });
      return response.text || '';
    } catch (err) {
      // If cache expired or invalid, fall back to systemInstruction
      if (cacheOptions?.cacheId) {
        console.warn('[Gemini] Cache miss or expired, falling back to systemInstruction');
        const fallbackResponse = await this.ai.models.generateContent({
          model: this.modelName,
          contents: chatHistory,
          config: { systemInstruction: systemPrompt },
        });
        return fallbackResponse.text || '';
      }
      throw err;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.embeddingModel,
      contents: text,
    });

    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values || [];
    }
    throw new Error('Failed to generate embeddings via Gemini.');
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: text,
      config: {
        systemInstruction: 'You are an objective summarization engine. Summarize the following text accurately and concisely.',
      },
    });
    return response.text || '';
  }

  async createServerContextCache(lore: string, ttlMinutes = 60): Promise<string> {
    const ttlSeconds = ttlMinutes * 60;

    const cache = await this.ai.caches.create({
      model: this.modelName,
      contents: [
        {
          role: 'user',
          parts: [{ text: lore }],
        },
      ],
      config: {
        ttl: `${ttlSeconds}s`,
      },
    });

    console.log(`[Gemini] Created context cache: ${cache.name} (TTL = ${ttlMinutes} mins)`);
    return cache.name!;
  }

  async describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: `Describe this file (${fileName}) concisely for context in a Discord conversation. Focus on the key content, not formatting details.` },
        ],
      }],
      config: {
        systemInstruction: 'You are a concise file descriptor. Output a single short paragraph describing the content. No preamble.',
      },
    });

    return response.text || 'No description available';
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/unit/geminiCaching.test.ts`
Expected: All 3 tests PASS

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/llm/GeminiProvider.ts src/tests/unit/geminiCaching.test.ts
git commit -m "feat: implement real Gemini context caching with cache fallback"
```

---

### Task 11: Wire Providers and Caching Into messageCreate.ts

**Files:**
- Modify: `src/events/messageCreate.ts`
- Modify: `src/tests/component/messageCreate.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/tests/component/messageCreate.test.ts` at the end of the `describe` block:

```typescript
  it('uses server active model from settings when mentioned', async () => {
    const mockGetProvider = vi.fn().mockReturnValue(ai);
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

    const mockDbQuery = vi.fn().mockResolvedValue({
      rows: [{ active_model: 'gpt-4o', server_lore: null, context_cache_id: null, cache_expires_at: null }],
      rowCount: 1,
    });

    await execute(message, {
      ai,
      redis,
      processAttachments: attachmentProcessor.processAttachments,
      getProvider: mockGetProvider,
      queryDb: mockDbQuery,
    });

    expect(mockGetProvider).toHaveBeenCalledWith('gpt-4o');
  });

  it('includes server lore in system prompt when available', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

    const mockDbQuery = vi.fn().mockResolvedValue({
      rows: [{ active_model: 'gemini-2.5-flash', server_lore: 'Pirates only!', context_cache_id: null, cache_expires_at: null }],
      rowCount: 1,
    });

    await execute(message, {
      ai,
      redis,
      processAttachments: attachmentProcessor.processAttachments,
      queryDb: mockDbQuery,
    });

    const systemPrompt = vi.mocked(ai.generateChatResponse).mock.calls[0][0];
    expect(systemPrompt).toContain('Pirates only!');
  });

  it('passes cache ID when valid cache exists', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const mockDbQuery = vi.fn().mockResolvedValue({
      rows: [{
        active_model: 'gemini-2.5-flash',
        server_lore: 'Lore',
        context_cache_id: 'cachedContents/abc',
        cache_expires_at: futureDate,
      }],
      rowCount: 1,
    });

    await execute(message, {
      ai,
      redis,
      processAttachments: attachmentProcessor.processAttachments,
      queryDb: mockDbQuery,
    });

    const cacheOptions = vi.mocked(ai.generateChatResponse).mock.calls[0][2];
    expect(cacheOptions?.cacheId).toBe('cachedContents/abc');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: FAIL — `execute` doesn't accept `getProvider` or `queryDb` deps yet

- [ ] **Step 3: Update messageCreate.ts with provider and caching support**

Replace `src/events/messageCreate.ts`:

```typescript
import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { BOT_SENTINEL, sanitizeMessageContent, formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';
import { processAttachments } from '../services/attachmentProcessor.js';
import type { AttachmentInfo } from '../services/attachmentProcessor.js';
import { getProvider as registryGetProvider } from '../llm/providerRegistry.js';
import { query as dbQuery } from '../db/index.js';

export interface MessageCreateDeps {
  ai: IAIProvider;
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
    sAdd: (key: string, member: string) => Promise<number>;
  };
  processAttachments: (ai: IAIProvider, attachments: AttachmentInfo[]) => Promise<string>;
  getProvider?: (modelName: string) => IAIProvider;
  queryDb?: (text: string, params?: any[]) => Promise<any>;
}

const defaultDeps: MessageCreateDeps = {
  ai: new GeminiProvider(),
  redis: redisClient as unknown as MessageCreateDeps['redis'],
  processAttachments,
  getProvider: registryGetProvider,
  queryDb: dbQuery,
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

  if (message.attachments.size > 0) {
    const attachmentInfos: AttachmentInfo[] = [...message.attachments.values()].map(att => ({
      url: att.url,
      name: att.name ?? 'unknown',
      contentType: att.contentType,
      size: att.size,
    }));
    const descriptions = await deps.processAttachments(deps.ai, attachmentInfos);
    if (descriptions) {
      formattedMessage += ' ' + sanitizeMessageContent(descriptions);
    }
  }

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

      // Fetch server settings for provider, lore, and cache
      let activeModel = 'gemini-2.5-flash';
      let serverLore: string | null = null;
      let cacheId: string | null = null;
      let cacheExpiresAt: string | null = null;

      const queryFn = deps.queryDb || dbQuery;
      try {
        const settingsResult = await queryFn(
          'SELECT active_model, server_lore, context_cache_id, cache_expires_at FROM server_settings WHERE server_id = $1',
          [serverId]
        );
        if (settingsResult.rows.length > 0) {
          const row = settingsResult.rows[0];
          activeModel = row.active_model || activeModel;
          serverLore = row.server_lore;
          cacheId = row.context_cache_id;
          cacheExpiresAt = row.cache_expires_at;
        }
      } catch (err) {
        console.warn('[messageCreate] Failed to fetch server settings, using defaults:', err);
      }

      // Use provider from registry if available
      const getProviderFn = deps.getProvider || registryGetProvider;
      let ai: IAIProvider;
      try {
        ai = getProviderFn(activeModel);
      } catch {
        ai = deps.ai; // fallback to default
      }

      let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.';
      if (serverLore) {
        systemPrompt += `\n\nServer context and lore:\n${serverLore}`;
      }

      // Determine cache options
      const cacheOptions: { cacheId?: string; ttlMinutes?: number } = { ttlMinutes: 60 };
      if (cacheId && cacheExpiresAt && new Date(cacheExpiresAt) > new Date()) {
        cacheOptions.cacheId = cacheId;
      }

      const response = await ai.generateChatResponse(systemPrompt, chatHistory, cacheOptions);

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

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: All tests PASS (old tests unchanged, new tests pass)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/events/messageCreate.ts src/tests/component/messageCreate.test.ts
git commit -m "feat: wire dynamic provider lookup, server lore, and cache into message handler"
```

---

### Task 12: Update Environment Config and Documentation

**Files:**
- Modify: `.env.example`
- Create: `src/db/migrations/001-expand-model-choices.sql`

- [ ] **Step 1: Update .env.example**

Replace `.env.example`:

```
# Contexta Bot Environment Variables
# Copy this file to `.env` and fill in your actual keys.

# Discord Token
DISCORD_TOKEN=

# Dev guild ID for instant command registration (optional — omit for global registration)
DEV_GUILD_ID=

# Google Gemini API Key (required — also used for embeddings regardless of active model)
GEMINI_API_KEY=

# OpenAI API Key (optional — required only if a server selects a GPT model)
OPENAI_API_KEY=

# Anthropic API Key (optional — required only if a server selects a Claude model)
ANTHROPIC_API_KEY=

# PostgreSQL Database (with pgvector)
DATABASE_URL=postgresql://localhost:5432/contexta_bot

# Redis Cache
REDIS_URL=redis://localhost:6379

# Cron endpoint authentication (required in production for Railway cron)
CRON_SECRET=

# HTTP server port (Railway auto-sets this)
PORT=3000
```

- [ ] **Step 2: Create migration documentation file**

Create `src/db/migrations/001-expand-model-choices.sql`:

```sql
-- Migration 001: Document expanded model choices
-- Date: 2026-03-28
--
-- No structural changes needed. The active_model column is VARCHAR(50)
-- with no CHECK constraint. Validation happens in the provider registry
-- at runtime.
--
-- Valid model values:
--   gemini-2.5-flash (default)
--   gemini-2.5-pro
--   gpt-4o
--   gpt-4o-mini
--   claude-sonnet-4-20250514
--   claude-haiku-4-5-20251001
--
-- The default remains 'gemini-2.5-flash'.
```

- [ ] **Step 3: Run full test suite one final time**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
mkdir -p src/db/migrations
git add .env.example src/db/migrations/001-expand-model-choices.sql
git commit -m "docs: update env config and add migration documentation for expanded model choices"
```
