# Phase 2: Proactive Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bot surface knowledge proactively — inject relevant context into every response, enable cross-channel awareness, enhance `/recall` to search the full knowledge base, and add a `/catchup` command for personalized digests.

**Architecture:** A new knowledge search backend route performs semantic search across `knowledge_entries` with graph traversal. The bot's `messageCreate` and `/ask` handlers call this before the LLM to inject relevant knowledge into the system prompt. `/recall` is upgraded to search across entries, summaries, and messages. A new `/catchup` command generates personalized digests from `channel_summaries`.

**Tech Stack:** Hono (backend routes), PostgreSQL + pgvector (semantic search), discord.js (bot commands), Vitest (testing).

**Spec:** `docs/superpowers/specs/2026-03-29-knowledge-management-vision-design.md` — Phase 2 section.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `applications/backend/src/routes/knowledgeSearch.ts` | Semantic search across knowledge_entries with graph traversal |
| `applications/backend/src/tests/routes/knowledgeSearch.test.ts` | Tests for knowledge search route |
| `applications/bot/src/commands/catchup.ts` | `/catchup` command — personalized missed-content digest |
| `applications/bot/src/tests/component/catchup.test.ts` | Tests for `/catchup` command |

### Modified Files

| File | Change |
|------|--------|
| `applications/backend/src/index.ts` | Mount knowledgeSearch routes |
| `applications/backend/src/routes/chat.ts` | Inject knowledge context into system prompt before LLM call |
| `applications/backend/src/tests/routes/chat.test.ts` | Update tests for knowledge injection |
| `applications/bot/src/events/messageCreate.ts` | Add knowledge retrieval before LLM call on @mentions |
| `applications/bot/src/tests/component/messageCreate.test.ts` | Update tests for knowledge retrieval |
| `applications/bot/src/commands/recall.ts` | Search knowledge_entries + summaries, synthesize with LLM |
| `applications/bot/src/commands/ask.ts` | Add knowledge retrieval before LLM call |

---

## Task 1: Knowledge Search Backend Route

**Files:**
- Create: `applications/backend/src/routes/knowledgeSearch.ts`
- Create: `applications/backend/src/tests/routes/knowledgeSearch.test.ts`

- [ ] **Step 1: Write tests for knowledge search**

```typescript
// applications/backend/src/tests/routes/knowledgeSearch.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  }),
}));

import { rawQuery } from '@contexta/db';
import { knowledgeSearchRoutes } from '../../routes/knowledgeSearch.js';

const mockRawQuery = vi.mocked(rawQuery);

describe('knowledge search routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', knowledgeSearchRoutes);
  });

  describe('POST /api/knowledge/:serverId/search', () => {
    it('returns semantically similar knowledge entries', async () => {
      // Semantic search results
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ke-1', type: 'decision', title: 'Use Redis for caching', content: 'Team decided on Redis', confidence: 0.9, similarity: 0.85, source_channel_id: 'c1', created_at: '2026-03-29T00:00:00Z' },
          { id: 'ke-2', type: 'topic', title: 'Caching strategies', content: 'Discussion about caching options', confidence: 0.7, similarity: 0.72, source_channel_id: 'c1', created_at: '2026-03-28T00:00:00Z' },
        ],
        rowCount: 2,
      } as any);

      // Graph links for ke-1
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'ke-3', type: 'entity', title: 'Redis', content: 'Redis is used for caching', relationship: 'relates_to' }],
        rowCount: 1,
      } as any);

      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What caching solution are we using?' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(2);
      expect(data.entries[0].title).toBe('Use Redis for caching');
      expect(data.related).toBeDefined();
    });

    it('returns 400 when query is missing', async () => {
      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns empty results when no matches found', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'something obscure' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(0);
      expect(data.related).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `knowledgeSearchRoutes` module not found

- [ ] **Step 3: Implement knowledge search route**

```typescript
// applications/backend/src/routes/knowledgeSearch.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const knowledgeSearchRoutes = new Hono();

knowledgeSearchRoutes.post('/knowledge/:serverId/search', async (c) => {
  const serverId = c.req.param('serverId');
  const { query, limit = 5, minConfidence = 0.3 } = await c.req.json();

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  const ai = getProvider('gemini-2.5-flash');
  const embedding = await ai.generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  // Semantic search on knowledge_entries
  const searchResult = await rawQuery(
    `SELECT id, type, title, content, confidence, source_channel_id, created_at,
            1 - (embedding <=> $3::vector) AS similarity
     FROM knowledge_entries
     WHERE server_id = $1
       AND is_archived = false
       AND confidence >= $2
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, minConfidence, vectorStr, limit]
  );

  if (searchResult.rows.length === 0) {
    return c.json({ entries: [], related: [] });
  }

  // Follow graph links one hop for top results (max 3 related per entry)
  const entryIds = searchResult.rows.map((r: { id: string }) => r.id);
  const relatedResult = await rawQuery(
    `SELECT DISTINCT ke.id, ke.type, ke.title, ke.content, kel.relationship
     FROM knowledge_entry_links kel
     JOIN knowledge_entries ke ON ke.id = CASE
       WHEN kel.source_id = ANY($1::uuid[]) THEN kel.target_id
       ELSE kel.source_id
     END
     WHERE (kel.source_id = ANY($1::uuid[]) OR kel.target_id = ANY($1::uuid[]))
       AND ke.id != ALL($1::uuid[])
       AND ke.is_archived = false
     LIMIT $2`,
    [entryIds, limit * 3]
  );

  return c.json({
    entries: searchResult.rows,
    related: relatedResult.rows,
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/knowledgeSearch.ts applications/backend/src/tests/routes/knowledgeSearch.test.ts
git commit -m "feat: add knowledge semantic search route with graph traversal"
```

---

## Task 2: Inject Knowledge Into Chat Route

**Files:**
- Modify: `applications/backend/src/routes/chat.ts`
- Modify: `applications/backend/src/tests/routes/chat.test.ts`

- [ ] **Step 1: Read the current chat.ts to understand exact structure**

Read `applications/backend/src/routes/chat.ts` in full before making changes.

- [ ] **Step 2: Write a test for knowledge injection**

Add to the existing test file `applications/backend/src/tests/routes/chat.test.ts`:

```typescript
it('POST /api/chat injects knowledge context into system prompt', async () => {
  // Mock rawQuery to return server settings AND knowledge entries
  const { rawQuery } = await import('@contexta/db');
  const mockQuery = vi.mocked(rawQuery);

  // First call: server_settings
  mockQuery.mockResolvedValueOnce({
    rows: [{ active_model: 'gemini-2.5-flash', context_cache_id: null, cache_expires_at: null, personality: null }],
    rowCount: 1,
  } as any);

  // Second call: knowledge search
  mockQuery.mockResolvedValueOnce({
    rows: [
      { type: 'decision', title: 'Use Redis', content: 'Team decided to use Redis for caching', confidence: 0.9, source_channel_id: 'c1', created_at: '2026-03-29T00:00:00Z' },
    ],
    rowCount: 1,
  } as any);

  const res = await app.request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverId: 'guild-1',
      systemPrompt: 'You are helpful',
      chatHistory: [{ role: 'user', parts: [{ text: 'What caching solution should we use?' }] }],
    }),
  });

  expect(res.status).toBe(200);
  // Verify the LLM was called with knowledge context in the prompt
  const { getProvider } = await import('../../services/llm/providerRegistry.js');
  const mockProvider = vi.mocked(getProvider)('gemini-2.5-flash');
  expect(vi.mocked(mockProvider.generateChatResponse)).toHaveBeenCalledWith(
    expect.stringContaining('RELEVANT KNOWLEDGE'),
    expect.any(Array),
    expect.any(Object)
  );
});
```

- [ ] **Step 3: Add knowledge retrieval to chat.ts**

In the chat route handler, after fetching server settings and before the LLM call, add:

```typescript
// Retrieve relevant knowledge (Phase 2: Proactive Intelligence)
let knowledgeContext = '';
try {
  const lastUserMessage = chatHistory.filter((m: { role: string }) => m.role === 'user').pop();
  const userText = lastUserMessage?.parts?.[0]?.text;
  if (userText) {
    const ai = getProvider('gemini-2.5-flash');
    const embedding = await ai.generateEmbedding(userText);
    const vectorStr = `[${embedding.join(',')}]`;

    const knowledgeResult = await rawQuery(
      `SELECT type, title, content, confidence, source_channel_id, created_at
       FROM knowledge_entries
       WHERE server_id = $1
         AND is_archived = false
         AND confidence >= 0.3
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector
       LIMIT 5`,
      [serverId, vectorStr]
    );

    if (knowledgeResult.rows.length > 0) {
      const entries = knowledgeResult.rows.map((r: { type: string; title: string; content: string; confidence: number; source_channel_id: string; created_at: string }) => {
        const conf = r.confidence >= 0.7 ? 'high confidence' : 'moderate confidence';
        return `- ${r.type} (${conf}): "${r.title}" — ${r.content} (from ${r.source_channel_id}, ${new Date(r.created_at).toLocaleDateString()})`;
      });
      knowledgeContext = `\n\n[RELEVANT KNOWLEDGE]\n${entries.join('\n')}\n[/RELEVANT KNOWLEDGE]\n\nYou have access to the server's knowledge base. When relevant, actively reference past knowledge and cite sources (channel and date). Use phrases like "By the way, this relates to..." or "Based on a previous discussion..."`;
    }
  }
} catch (err) {
  // Knowledge retrieval is best-effort — don't fail the chat
  console.warn('[chat] Knowledge retrieval failed:', (err as Error).message);
}
```

Then append `knowledgeContext` to the system prompt assembly before the LLM call.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/chat.ts applications/backend/src/tests/routes/chat.test.ts
git commit -m "feat: inject knowledge context into chat responses"
```

---

## Task 3: Wire Knowledge Search Route

**Files:**
- Modify: `applications/backend/src/index.ts`

- [ ] **Step 1: Add import and mount**

Add import:
```typescript
import { knowledgeSearchRoutes } from './routes/knowledgeSearch.js';
```

Mount under bot-authed API app:
```typescript
apiApp.route('/', knowledgeSearchRoutes);
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add applications/backend/src/index.ts
git commit -m "feat: wire knowledge search route into backend"
```

---

## Task 4: Enhanced /recall Command

**Files:**
- Modify: `applications/bot/src/commands/recall.ts`

- [ ] **Step 1: Read the current recall.ts**

Read the file in full to understand exact structure before modifying.

- [ ] **Step 2: Rewrite recall to search knowledge base and synthesize**

Replace the current implementation with one that:
1. Calls `POST /api/knowledge/{serverId}/search` with the user's topic
2. Also calls `POST /api/embeddings/search` for channel memory vectors (existing behavior)
3. Groups results by type (decisions, topics, conversations)
4. Calls `POST /api/chat` to synthesize results into a coherent answer
5. Returns the synthesized response

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Search the server knowledge base for past discussions, decisions, and topics.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The topic, decision, or event you want to recall')
      .setRequired(true)
  );

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
    // Search knowledge base
    const { entries, related } = await backendPost<{
      entries: { type: string; title: string; content: string; confidence: number; source_channel_id: string; created_at: string; similarity: number }[];
      related: { type: string; title: string; content: string; relationship: string }[];
    }>(`/api/knowledge/${interaction.guildId}/search`, { query: topic, limit: 5 });

    // Also search channel memory vectors (legacy)
    let legacyResults: { summary_text: string; time_start: string; time_end: string }[] = [];
    try {
      const { embedding } = await backendPost<{ embedding: number[] }>('/api/embeddings/generate', { text: topic });
      const { results } = await backendPost<{ results: { summary_text: string; time_start: string; time_end: string }[] }>('/api/embeddings/search', {
        serverId: interaction.guildId,
        channelId: interaction.channelId,
        embedding,
        limit: 3,
      });
      legacyResults = results;
    } catch {
      // Legacy search is best-effort
    }

    if (entries.length === 0 && legacyResults.length === 0) {
      await interaction.editReply("I couldn't find any relevant knowledge about that topic.");
      return;
    }

    // Build context for LLM synthesis
    const knowledgeParts: string[] = [];
    for (const entry of entries) {
      knowledgeParts.push(`[${entry.type}] ${entry.title}: ${entry.content} (confidence: ${entry.confidence.toFixed(1)})`);
    }
    for (const rel of related) {
      knowledgeParts.push(`[related ${rel.type}] ${rel.title}: ${rel.content}`);
    }
    for (const legacy of legacyResults) {
      knowledgeParts.push(`[conversation] ${legacy.summary_text} (${new Date(legacy.time_start).toLocaleDateString()} - ${new Date(legacy.time_end).toLocaleDateString()})`);
    }

    // Synthesize with LLM
    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId: interaction.guildId,
      systemPrompt: `You are Contexta, recalling knowledge for a Discord server member. Summarize the following knowledge entries about "${topic}" into a clear, concise response. Group by type (decisions, topics, discussions). Cite sources where available. Be direct and factual.`,
      chatHistory: [{ role: 'user', parts: [{ text: `Here is what I found:\n\n${knowledgeParts.join('\n')}\n\nSummarize this knowledge about: ${topic}` }] }],
    });

    const truncated = response.length > 2000 ? response.slice(0, 1997) + '...' : response;
    await interaction.editReply(truncated);
  } catch (err) {
    console.error('[recall] Error:', err);
    await interaction.editReply('There was an error searching the knowledge base.');
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @contexta/bot test -- --run`
Expected: All tests PASS (existing recall tests should still pass since they mock backend calls)

- [ ] **Step 4: Commit**

```bash
git add applications/bot/src/commands/recall.ts
git commit -m "feat: enhance /recall to search knowledge base and synthesize results"
```

---

## Task 5: Enhanced /ask with Knowledge Injection

**Files:**
- Modify: `applications/bot/src/commands/ask.ts`

- [ ] **Step 1: Read the current ask.ts**

Read the file in full before modifying.

- [ ] **Step 2: Add knowledge retrieval before LLM call**

After the lore fetch and before the `/api/chat` call, add a call to the knowledge search endpoint:

```typescript
// Retrieve relevant knowledge
let knowledgeBlock = '';
try {
  const { entries } = await backendPost<{
    entries: { type: string; title: string; content: string; confidence: number; source_channel_id: string; created_at: string }[];
    related: unknown[];
  }>(`/api/knowledge/${interaction.guildId}/search`, { query: userQuery, limit: 5, minConfidence: 0.3 });

  if (entries.length > 0) {
    const lines = entries.map((e: { type: string; title: string; content: string; confidence: number; source_channel_id: string; created_at: string }) => {
      const conf = e.confidence >= 0.7 ? 'high confidence' : 'moderate confidence';
      return `- ${e.type} (${conf}): "${e.title}" — ${e.content}`;
    });
    knowledgeBlock = `\n\n[RELEVANT KNOWLEDGE]\n${lines.join('\n')}\n[/RELEVANT KNOWLEDGE]`;
  }
} catch {
  // Knowledge retrieval is best-effort
}
```

Append `knowledgeBlock` to the `systemPrompt` before calling `/api/chat`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @contexta/bot test -- --run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add applications/bot/src/commands/ask.ts
git commit -m "feat: inject knowledge context into /ask responses"
```

---

## Task 6: Enhanced @mention with Knowledge Injection

**Files:**
- Modify: `applications/bot/src/events/messageCreate.ts`
- Modify: `applications/bot/src/tests/component/messageCreate.test.ts`

- [ ] **Step 1: Read current messageCreate.ts**

Read the file in full to understand the exact mention-handling flow.

- [ ] **Step 2: Add knowledge retrieval to the mention handler**

In the mention-handling block, after the lore fetch and before the `/api/chat` call, add:

```typescript
// Retrieve relevant knowledge (Phase 2)
let knowledgeBlock = '';
try {
  const { entries } = await (deps.postBackend || backendPost)<{
    entries: { type: string; title: string; content: string; confidence: number }[];
    related: unknown[];
  }>(`/api/knowledge/${message.guildId}/search`, { query: message.content, limit: 5, minConfidence: 0.3 });

  if (entries.length > 0) {
    const lines = entries.map((e: { type: string; title: string; content: string; confidence: number }) => {
      const conf = e.confidence >= 0.7 ? 'high confidence' : 'moderate confidence';
      return `- ${e.type} (${conf}): "${e.title}" — ${e.content}`;
    });
    knowledgeBlock = `\n\n[RELEVANT KNOWLEDGE]\n${lines.join('\n')}\n[/RELEVANT KNOWLEDGE]\n\nWhen relevant, actively reference this knowledge. Use phrases like "By the way, this relates to..." or "Based on a previous discussion..."`;
  }
} catch {
  // Knowledge retrieval is best-effort
}
```

Append `knowledgeBlock` to the `systemPrompt` variable before the chat call.

- [ ] **Step 3: Add test for knowledge injection on mention**

Add to `applications/bot/src/tests/component/messageCreate.test.ts`:

```typescript
it('injects knowledge context when mentioned', async () => {
  const message = createMockMessage({
    content: 'What caching solution are we using?',
    mentions: { has: vi.fn().mockReturnValue(true) },
  });
  redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

  mockPostBackend.mockImplementation(async (path: string) => {
    if (path.includes('/knowledge/') && path.includes('/search')) {
      return {
        entries: [{ type: 'decision', title: 'Use Redis', content: 'Team chose Redis', confidence: 0.9 }],
        related: [],
      };
    }
    if (path === '/api/messages') return {};
    return { response: 'Based on a previous discussion, the team chose Redis for caching.' };
  });
  mockGetBackend.mockResolvedValue({ lore: null });

  await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

  // Verify chat was called with knowledge in the prompt
  const chatCall = mockPostBackend.mock.calls.find((c: string[]) => c[0] === '/api/chat');
  expect(chatCall).toBeDefined();
  expect(chatCall![1].systemPrompt).toContain('RELEVANT KNOWLEDGE');
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @contexta/bot test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/bot/src/events/messageCreate.ts applications/bot/src/tests/component/messageCreate.test.ts
git commit -m "feat: inject knowledge context into @mention responses"
```

---

## Task 7: /catchup Command

**Files:**
- Create: `applications/bot/src/commands/catchup.ts`

- [ ] **Step 1: Implement the /catchup command**

```typescript
// applications/bot/src/commands/catchup.ts

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('catchup')
  .setDescription('Get a personalized digest of what you missed.')
  .addStringOption(option =>
    option.setName('timerange')
      .setDescription('How far back to look (e.g. "12h", "3d", "1w"). Default: 24h')
      .setRequired(false)
  );

function parseTimeRange(input: string): number {
  const match = input.match(/^(\d+)(h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const timerangeInput = interaction.options.getString('timerange') || '24h';
  const timerangeMs = parseTimeRange(timerangeInput);
  const since = new Date(Date.now() - timerangeMs).toISOString();

  await interaction.deferReply();

  try {
    // Fetch channel summaries for this server
    const { summaries } = await backendGet<{
      summaries: { channel_id: string; summary: string; topics: string[]; decisions: string[]; open_questions: string[]; action_items: string[]; period_start: string; period_end: string; message_count: number }[];
    }>(`/api/summaries/${interaction.guildId}?limit=20`);

    // Filter summaries within time range
    const recentSummaries = summaries.filter(s => new Date(s.period_end) >= new Date(since));

    if (recentSummaries.length === 0) {
      await interaction.editReply(`No activity summaries found for the last ${timerangeInput}. Either there wasn't much going on, or summaries haven't been generated yet.`);
      return;
    }

    // Fetch user's expertise to personalize the digest
    let userTopics: string[] = [];
    try {
      const { expertise } = await backendGet<{
        expertise: { topic: string; score: number }[];
      }>(`/api/expertise/${interaction.guildId}?userId=${interaction.user.id}&limit=10`);
      userTopics = expertise.map(e => e.topic);
    } catch {
      // Expertise is optional for personalization
    }

    // Build context for LLM
    const summaryParts = recentSummaries.map(s => {
      const parts = [`Channel: ${s.channel_id} (${s.message_count} messages)`];
      parts.push(`Summary: ${s.summary}`);
      if (s.decisions.length > 0) parts.push(`Decisions: ${s.decisions.join('; ')}`);
      if (s.action_items.length > 0) parts.push(`Action items: ${s.action_items.join('; ')}`);
      if (s.open_questions.length > 0) parts.push(`Open questions: ${s.open_questions.join('; ')}`);
      return parts.join('\n');
    }).join('\n\n');

    const personalizeHint = userTopics.length > 0
      ? `\n\nThis user is interested in: ${userTopics.join(', ')}. Prioritize topics relevant to their interests.`
      : '';

    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId: interaction.guildId,
      systemPrompt: `You are Contexta, generating a personalized catch-up digest for a Discord server member. Summarize what happened in the last ${timerangeInput}. Highlight decisions made, action items, and trending topics. Be concise but informative. Use bullet points and sections.${personalizeHint}`,
      chatHistory: [{ role: 'user', parts: [{ text: `Here are the channel summaries:\n\n${summaryParts}\n\nGenerate a catch-up digest for me.` }] }],
    });

    const truncated = response.length > 2000 ? response.slice(0, 1997) + '...' : response;
    await interaction.editReply(truncated);
  } catch (err) {
    console.error('[catchup] Error:', err);
    await interaction.editReply('There was an error generating your catch-up digest.');
  }
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @contexta/bot test -- --run`
Expected: All existing tests PASS (new command has no tests to break)

- [ ] **Step 3: Commit**

```bash
git add applications/bot/src/commands/catchup.ts
git commit -m "feat: add /catchup command for personalized missed-content digests"
```

---

## Task 8: Verify Build & All Tests

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Clean build with no TypeScript errors

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Commit any build fixes if needed**

---
