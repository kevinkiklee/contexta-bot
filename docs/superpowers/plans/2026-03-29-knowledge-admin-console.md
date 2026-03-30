# Knowledge Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin control over the bot's knowledge pipeline — configurable approval, citation footers, Discord commands, and a dashboard knowledge browser.

**Architecture:** Four components built bottom-up: schema + shared types → backend API routes → bot commands + citation footers → dashboard UI. Each task produces a working, testable increment.

**Tech Stack:** PostgreSQL (raw SQL via `rawQuery`), Hono (backend routes), Discord.js (bot commands), Next.js 15 App Router (dashboard), Tailwind CSS v4, Vitest (tests).

**Spec:** `docs/superpowers/specs/2026-03-29-knowledge-admin-console-design.md`

---

### Task 1: Schema Migration + Shared Types

**Files:**
- Create: `packages/db/src/migrations/0006_add_knowledge_status.sql`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Create SQL migration**

Create `packages/db/src/migrations/0006_add_knowledge_status.sql`:

```sql
-- Add status column to knowledge_entries
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'published';

CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries (server_id, status);

-- Backfill approval config into existing knowledge_config
UPDATE server_settings
SET knowledge_config = knowledge_config || '{"autoPublishThreshold": 0.7, "reviewRequired": false}'::jsonb
WHERE knowledge_config IS NOT NULL
  AND NOT (knowledge_config ? 'autoPublishThreshold');
```

- [ ] **Step 2: Add status to Drizzle schema**

In `packages/db/src/schema.ts`, add `status` to the `knowledgeEntries` table definition, after the `isPinned` field:

```typescript
status: varchar('status', { length: 20 }).notNull().default('published'),
```

And add the index to the table's index array:

```typescript
index('idx_ke_status').on(table.serverId, table.status),
```

- [ ] **Step 3: Update shared types**

In `packages/shared/src/types.ts`:

Add the new status type:

```typescript
export type KnowledgeEntryStatus = 'published' | 'pending_review' | 'rejected';
```

Add `status` to the `KnowledgeEntry` interface:

```typescript
export interface KnowledgeEntry {
  // ... existing fields ...
  status: KnowledgeEntryStatus;
}
```

Add approval fields to `KnowledgeConfig` and its default:

```typescript
export interface KnowledgeConfig {
  extractionEnabled: boolean;
  summaryInterval: 'daily' | 'weekly';
  crossChannelEnabled: boolean;
  injectionAggressiveness: 'conservative' | 'moderate' | 'assertive';
  autoPublishThreshold: number;
  reviewRequired: boolean;
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  extractionEnabled: true,
  summaryInterval: 'daily',
  crossChannelEnabled: true,
  injectionAggressiveness: 'assertive',
  autoPublishThreshold: 0.7,
  reviewRequired: false,
};
```

Add the citation type:

```typescript
export interface KnowledgeCitation {
  shortId: string;
  entryId: string;
  type: string;
  confidence: number;
  title: string;
}
```

- [ ] **Step 4: Run migration**

```bash
source .env && psql "$DATABASE_URL" -f packages/db/src/migrations/0006_add_knowledge_status.sql
```

Expected: `ALTER TABLE`, `CREATE INDEX`, `UPDATE N` (N = number of servers with knowledge_config).

- [ ] **Step 5: Build to verify types compile**

```bash
pnpm --filter @contexta/shared build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/migrations/0006_add_knowledge_status.sql packages/db/src/schema.ts packages/shared/src/types.ts
git commit -m "feat: add knowledge entry status column and approval config types"
```

---

### Task 2: Backend — Knowledge Entry CRUD + Stats Routes

**Files:**
- Create: `applications/backend/src/routes/knowledgeCrud.ts`
- Modify: `applications/backend/src/index.ts` (register routes)

- [ ] **Step 1: Write the knowledge CRUD route file**

Create `applications/backend/src/routes/knowledgeCrud.ts`:

```typescript
import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';

export const knowledgeCrudRoutes = new Hono();

// GET /knowledge/:serverId/stats
knowledgeCrudRoutes.get('/knowledge/:serverId/stats', async (c) => {
  const serverId = c.req.param('serverId');

  const result = await rawQuery(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'published' AND NOT is_archived) AS published,
       COUNT(*) FILTER (WHERE status = 'pending_review' AND NOT is_archived) AS pending_review,
       COUNT(*) FILTER (WHERE status = 'rejected' AND NOT is_archived) AS rejected,
       COUNT(*) FILTER (WHERE is_archived) AS archived,
       ROUND(AVG(confidence)::numeric, 2) AS avg_confidence,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND NOT is_archived) AS created_this_week
     FROM knowledge_entries
     WHERE server_id = $1`,
    [serverId]
  );

  return c.json(result.rows[0] ?? { published: 0, pending_review: 0, rejected: 0, archived: 0, avg_confidence: 0, created_this_week: 0 });
});

// PUT /knowledge/:serverId/:id — update entry fields
knowledgeCrudRoutes.put('/knowledge/:serverId/:id', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const { title, content, type, confidence } = body;

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [serverId, id];
  let idx = 3;

  if (title !== undefined) { sets.push(`title = $${idx++}`); params.push(title); }
  if (content !== undefined) { sets.push(`content = $${idx++}`); params.push(content); }
  if (type !== undefined) { sets.push(`type = $${idx++}`); params.push(type); }
  if (confidence !== undefined) { sets.push(`confidence = $${idx++}`); params.push(confidence); }

  if (sets.length === 1) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  const result = await rawQuery(
    `UPDATE knowledge_entries SET ${sets.join(', ')} WHERE server_id = $1 AND id = $2 RETURNING id`,
    params
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ updated: true });
});

// PUT /knowledge/:serverId/:id/approve
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/approve', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries SET status = 'published', updated_at = now() WHERE server_id = $1 AND id = $2 RETURNING id`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ approved: true });
});

// PUT /knowledge/:serverId/:id/reject
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/reject', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries SET status = 'rejected', updated_at = now() WHERE server_id = $1 AND id = $2 RETURNING id`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ rejected: true });
});

// PUT /knowledge/:serverId/:id/pin
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/pin', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries SET is_pinned = NOT is_pinned, updated_at = now() WHERE server_id = $1 AND id = $2 RETURNING id, is_pinned`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ pinned: result.rows[0].is_pinned });
});

// PUT /knowledge/:serverId/:id/archive
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/archive', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries SET is_archived = NOT is_archived, updated_at = now() WHERE server_id = $1 AND id = $2 RETURNING id, is_archived`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ archived: result.rows[0].is_archived });
});
```

- [ ] **Step 2: Register routes in backend index**

In `applications/backend/src/index.ts`, import and register under the `apiApp` sub-app (alongside existing knowledge routes):

```typescript
import { knowledgeCrudRoutes } from './routes/knowledgeCrud.js';
```

Add within the `apiApp` setup block:

```typescript
apiApp.route('/', knowledgeCrudRoutes);
```

- [ ] **Step 3: Build to verify compilation**

```bash
pnpm --filter @contexta/backend build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/backend/src/routes/knowledgeCrud.ts applications/backend/src/index.ts
git commit -m "feat: add knowledge CRUD and stats backend routes"
```

---

### Task 3: Backend — Add Status Filter to Knowledge Search

**Files:**
- Modify: `applications/backend/src/routes/knowledgeSearch.ts`

- [ ] **Step 1: Add status filter to search query**

In `applications/backend/src/routes/knowledgeSearch.ts`, in the search route's SQL query, add `AND status = 'published'` to the WHERE clause:

Change the existing query from:

```sql
WHERE server_id = $1
  AND is_archived = false
  AND confidence >= $2
  AND embedding IS NOT NULL
```

To:

```sql
WHERE server_id = $1
  AND is_archived = false
  AND status = 'published'
  AND confidence >= $2
  AND embedding IS NOT NULL
```

- [ ] **Step 2: Add status filter to the GET list route**

In `applications/backend/src/routes/knowledge.ts`, in the GET `/knowledge/:serverId` route, add an optional `status` query parameter:

After the existing `type` filter block, add:

```typescript
const status = c.req.query('status');
if (status) {
  conditions.push(`status = $${paramIdx}`);
  params.push(status);
  paramIdx++;
}
```

Also add `status` to the SELECT column list if not already present.

- [ ] **Step 3: Build to verify**

```bash
pnpm --filter @contexta/backend build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/backend/src/routes/knowledgeSearch.ts applications/backend/src/routes/knowledge.ts
git commit -m "feat: filter knowledge search to published entries only"
```

---

### Task 4: Backend — Approval Threshold in Extraction Pipeline

**Files:**
- Modify: `applications/backend/src/routes/cron/extractKnowledge.ts`

- [ ] **Step 1: Fetch server knowledge config before extraction**

At the start of the route handler, after fetching tagged messages and before the chunk loop, fetch the knowledge config for each server. Add after the `groupIntoChunks` call:

```typescript
// Cache knowledge configs per server
const configCache = new Map<string, { autoPublishThreshold: number; reviewRequired: boolean }>();

async function getServerConfig(serverId: string) {
  if (configCache.has(serverId)) return configCache.get(serverId)!;
  const result = await rawQuery(
    `SELECT knowledge_config FROM server_settings WHERE server_id = $1 LIMIT 1`,
    [serverId]
  );
  const config = result.rows[0]?.knowledge_config as Record<string, unknown> | null;
  const parsed = {
    autoPublishThreshold: (config?.autoPublishThreshold as number) ?? 0.7,
    reviewRequired: (config?.reviewRequired as boolean) ?? false,
  };
  configCache.set(serverId, parsed);
  return parsed;
}
```

- [ ] **Step 2: Determine status on entry insert**

In the loop where entries are inserted, after the embedding is generated, compute the status and add it to the INSERT:

Replace the existing INSERT query:

```typescript
const insertResult = await rawQuery(
  `INSERT INTO knowledge_entries (server_id, type, title, content, confidence, source_channel_id, source_message_ids, embedding)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
   RETURNING id`,
  [serverId, entry.type, entry.title, entry.content, entry.confidence, channelId, messageIds, `[${embedding.join(',')}]`]
);
```

With:

```typescript
const serverConfig = await getServerConfig(serverId);
const entryStatus = serverConfig.reviewRequired
  ? 'pending_review'
  : entry.confidence >= serverConfig.autoPublishThreshold
    ? 'published'
    : 'pending_review';

const insertResult = await rawQuery(
  `INSERT INTO knowledge_entries (server_id, type, title, content, confidence, source_channel_id, source_message_ids, embedding, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
   RETURNING id`,
  [serverId, entry.type, entry.title, entry.content, entry.confidence, channelId, messageIds, `[${embedding.join(',')}]`, entryStatus]
);
```

- [ ] **Step 3: Build to verify**

```bash
pnpm --filter @contexta/backend build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/backend/src/routes/cron/extractKnowledge.ts
git commit -m "feat: apply approval threshold when extracting knowledge entries"
```

---

### Task 5: Bot — Citation Footer Utility

**Files:**
- Create: `applications/bot/src/lib/citations.ts`
- Create: `applications/bot/src/tests/unit/citations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `applications/bot/src/tests/unit/citations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatCitationFooter, resolveShortId, confidenceDots } from '../../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';

describe('confidenceDots', () => {
  it('returns ●●● for high confidence (>= 0.7)', () => {
    expect(confidenceDots(0.7)).toBe('●●●');
    expect(confidenceDots(0.95)).toBe('●●●');
  });

  it('returns ●●○ for moderate confidence (0.4-0.69)', () => {
    expect(confidenceDots(0.4)).toBe('●●○');
    expect(confidenceDots(0.65)).toBe('●●○');
  });

  it('returns ●○○ for low confidence (< 0.4)', () => {
    expect(confidenceDots(0.1)).toBe('●○○');
    expect(confidenceDots(0.39)).toBe('●○○');
  });
});

describe('formatCitationFooter', () => {
  const citations: KnowledgeCitation[] = [
    { shortId: 'KE-3f8a', entryId: '3f8a1234-0000-0000-0000-000000000000', type: 'decision', confidence: 0.85, title: 'Redis Decision' },
    { shortId: 'KE-1c2d', entryId: '1c2d5678-0000-0000-0000-000000000000', type: 'topic', confidence: 0.52, title: 'Caching Strategy' },
  ];

  it('formats citations with separator and confidence dots', () => {
    const footer = formatCitationFooter(citations);
    expect(footer).toContain('───');
    expect(footer).toContain('📚');
    expect(footer).toContain('`KE-3f8a`');
    expect(footer).toContain('`KE-1c2d`');
    expect(footer).toContain('decision');
    expect(footer).toContain('●●●');
    expect(footer).toContain('●●○');
  });

  it('returns empty string for empty citations', () => {
    expect(formatCitationFooter([])).toBe('');
  });
});

describe('resolveShortId', () => {
  it('extracts hex part from KE-xxxx format', () => {
    expect(resolveShortId('KE-3f8a')).toBe('3f8a');
  });

  it('extracts hex part from ke-xxxx (case insensitive)', () => {
    expect(resolveShortId('ke-3F8A')).toBe('3f8a');
  });

  it('treats raw hex as-is', () => {
    expect(resolveShortId('3f8a')).toBe('3f8a');
  });

  it('treats full UUID as full id', () => {
    const uuid = '3f8a1234-0000-0000-0000-000000000000';
    expect(resolveShortId(uuid)).toBe(uuid);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @contexta/bot test -- src/tests/unit/citations.test.ts
```

Expected: FAIL — module `../../lib/citations.js` not found.

- [ ] **Step 3: Implement the citations utility**

Create `applications/bot/src/lib/citations.ts`:

```typescript
import type { KnowledgeCitation } from '@contexta/shared';

export function confidenceDots(confidence: number): string {
  if (confidence >= 0.7) return '●●●';
  if (confidence >= 0.4) return '●●○';
  return '●○○';
}

export function makeCitation(entry: { id: string; type: string; confidence: number; title: string }): KnowledgeCitation {
  return {
    shortId: `KE-${entry.id.slice(0, 4)}`,
    entryId: entry.id,
    type: entry.type,
    confidence: entry.confidence,
    title: entry.title,
  };
}

export function formatCitationFooter(citations: KnowledgeCitation[]): string {
  if (citations.length === 0) return '';

  const parts = citations.map(
    (c) => `\`${c.shortId}\` (${c.type}, ${confidenceDots(c.confidence)})`
  );

  return `\n───\n📚 Sources: ${parts.join(' · ')}`;
}

export function appendCitationFooter(response: string, citations: KnowledgeCitation[]): string {
  const footer = formatCitationFooter(citations);
  if (!footer) return response;

  const maxResponseLen = 2000 - footer.length;
  const truncated = response.length > maxResponseLen
    ? response.slice(0, maxResponseLen - 3) + '...'
    : response;

  return truncated + footer;
}

export function resolveShortId(input: string): string {
  // Full UUID — return as-is
  if (input.includes('-') && input.length > 8) return input.toLowerCase();
  // KE-xxxx format — extract hex
  const match = input.match(/^ke-(.+)$/i);
  return match ? match[1].toLowerCase() : input.toLowerCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @contexta/bot test -- src/tests/unit/citations.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add applications/bot/src/lib/citations.ts applications/bot/src/tests/unit/citations.test.ts
git commit -m "feat: add citation footer utility for knowledge entries"
```

---

### Task 6: Bot — Add Citations to @mention and /ask Responses

**Files:**
- Modify: `applications/bot/src/events/messageCreate.ts`
- Modify: `applications/bot/src/commands/ask.ts`

- [ ] **Step 1: Add citation imports to messageCreate.ts**

At the top of `applications/bot/src/events/messageCreate.ts`, add:

```typescript
import { makeCitation, appendCitationFooter } from '../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';
```

- [ ] **Step 2: Collect citations during knowledge injection in messageCreate**

In the @mention handler section where knowledge entries are fetched and formatted, collect citations alongside the knowledge block. After the `entries` are fetched from `/api/knowledge/${serverId}/search`, add a `citations` array:

```typescript
let citations: KnowledgeCitation[] = [];
```

Inside the `if (entries.length > 0)` block, after building the lines, add:

```typescript
citations = entries.map((e: { id: string; type: string; confidence: number; title: string }) => makeCitation(e));
```

- [ ] **Step 3: Append citation footer to the @mention reply**

Where the bot reply is sent (e.g., `await message.reply(response)`), replace with:

```typescript
const replyText = appendCitationFooter(response, citations);
await message.reply(replyText);
```

Make sure the `response` variable here is the raw LLM response, before any existing truncation.

- [ ] **Step 4: Add the same pattern to /ask command**

In `applications/bot/src/commands/ask.ts`:

Add the same imports:

```typescript
import { makeCitation, appendCitationFooter } from '../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';
```

Declare `let citations: KnowledgeCitation[] = [];` before the knowledge injection try block.

Inside the `if (entries.length > 0)` block, add:

```typescript
citations = entries.map((e: { id: string; type: string; confidence: number; title: string }) => makeCitation(e));
```

Replace the existing truncation + editReply with:

```typescript
const replyText = appendCitationFooter(response, citations);
await interaction.editReply(replyText);
```

- [ ] **Step 5: Build to verify**

```bash
pnpm --filter @contexta/bot build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add applications/bot/src/events/messageCreate.ts applications/bot/src/commands/ask.ts
git commit -m "feat: append knowledge citation footers to bot responses"
```

---

### Task 7: Bot — /knowledge Discord Command

**Files:**
- Create: `applications/bot/src/commands/knowledge.ts`
- Create: `applications/bot/src/tests/unit/knowledge-command.test.ts`

- [ ] **Step 1: Write the failing test**

Create `applications/bot/src/tests/unit/knowledge-command.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { data } from '../../commands/knowledge.js';

describe('/knowledge command registration', () => {
  it('has the correct name', () => {
    const json = data.toJSON();
    expect(json.name).toBe('knowledge');
  });

  it('has search, delete, and correct subcommands', () => {
    const json = data.toJSON();
    const subcommands = json.options?.map((o: any) => o.name) ?? [];
    expect(subcommands).toContain('search');
    expect(subcommands).toContain('delete');
    expect(subcommands).toContain('correct');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @contexta/bot test -- src/tests/unit/knowledge-command.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the /knowledge command**

Create `applications/bot/src/commands/knowledge.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendPost, backendPut, backendGet } from '../lib/backendClient.js';
import { resolveShortId, confidenceDots } from '../lib/citations.js';

export const data = new SlashCommandBuilder()
  .setName('knowledge')
  .setDescription('Manage the knowledge base')
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Search the knowledge base')
      .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Archive a knowledge entry (admin only)')
      .addStringOption((opt) => opt.setName('id').setDescription('Entry ID (e.g. KE-3f8a)').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('correct')
      .setDescription('Correct a knowledge entry (admin only)')
      .addStringOption((opt) => opt.setName('id').setDescription('Entry ID (e.g. KE-3f8a)').setRequired(true))
      .addStringOption((opt) => opt.setName('content').setDescription('New content for the entry').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId;
  if (!serverId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'search') {
    await handleSearch(interaction, serverId);
  } else if (subcommand === 'delete') {
    await handleDelete(interaction, serverId);
  } else if (subcommand === 'correct') {
    await handleCorrect(interaction, serverId);
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction, serverId: string) {
  const query = interaction.options.getString('query', true);
  await interaction.deferReply();

  try {
    const { entries } = await backendPost<{
      entries: { id: string; type: string; title: string; content: string; confidence: number }[];
    }>(`/api/knowledge/${serverId}/search`, { query, limit: 3, minConfidence: 0.3 });

    if (entries.length === 0) {
      await interaction.editReply(`🔍 No knowledge entries found for "${query}".`);
      return;
    }

    const lines = entries.map((e, i) => {
      const shortId = `KE-${e.id.slice(0, 4)}`;
      const snippet = e.content.length > 120 ? e.content.slice(0, 117) + '...' : e.content;
      return `${i + 1}. \`${shortId}\` — **${e.title}** (${e.type}, ${confidenceDots(e.confidence)})\n   ${snippet}`;
    });

    const reply = `🔍 Knowledge Search: "${query}"\n\n${lines.join('\n\n')}\n\n📊 ${entries.length} result${entries.length === 1 ? '' : 's'} found`;
    const truncated = reply.length > 2000 ? reply.slice(0, 1997) + '...' : reply;
    await interaction.editReply(truncated);
  } catch (err) {
    console.error('[knowledge search] Error:', err);
    await interaction.editReply('Failed to search the knowledge base. Please try again.');
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction, serverId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the **Manage Server** permission to delete knowledge entries.', ephemeral: true });
    return;
  }

  const rawId = interaction.options.getString('id', true);
  const shortHex = resolveShortId(rawId);

  await interaction.deferReply({ ephemeral: true });

  try {
    const { entries } = await backendGet<{
      entries: { id: string; title: string }[];
    }>(`/api/knowledge/${serverId}?limit=100`);

    const matches = entries.filter((e) => e.id.toLowerCase().startsWith(shortHex));

    if (matches.length === 0) {
      await interaction.editReply(`No entry found matching \`KE-${shortHex}\`.`);
      return;
    }

    if (matches.length > 1) {
      await interaction.editReply(`Multiple entries match \`KE-${shortHex}\`. Please use more characters or the full ID from the dashboard.`);
      return;
    }

    const entry = matches[0];
    await backendPut(`/api/knowledge/${serverId}/${entry.id}/archive`, {});

    await interaction.editReply(`Archived \`KE-${shortHex}\` — **${entry.title}**. Restore from dashboard if needed.`);
  } catch (err) {
    console.error('[knowledge delete] Error:', err);
    await interaction.editReply('Failed to archive the entry. Please try again.');
  }
}

async function handleCorrect(interaction: ChatInputCommandInteraction, serverId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the **Manage Server** permission to correct knowledge entries.', ephemeral: true });
    return;
  }

  const rawId = interaction.options.getString('id', true);
  const newContent = interaction.options.getString('content', true);
  const shortHex = resolveShortId(rawId);

  await interaction.deferReply({ ephemeral: true });

  try {
    const { entries } = await backendGet<{
      entries: { id: string; title: string }[];
    }>(`/api/knowledge/${serverId}?limit=100`);

    const matches = entries.filter((e) => e.id.toLowerCase().startsWith(shortHex));

    if (matches.length === 0) {
      await interaction.editReply(`No entry found matching \`KE-${shortHex}\`.`);
      return;
    }

    if (matches.length > 1) {
      await interaction.editReply(`Multiple entries match \`KE-${shortHex}\`. Please use more characters or the full ID from the dashboard.`);
      return;
    }

    const entry = matches[0];
    await backendPut(`/api/knowledge/${serverId}/${entry.id}`, { content: newContent });

    await interaction.editReply(`Updated \`KE-${shortHex}\` — **${entry.title}**. New content saved.`);
  } catch (err) {
    console.error('[knowledge correct] Error:', err);
    await interaction.editReply('Failed to update the entry. Please try again.');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @contexta/bot test -- src/tests/unit/knowledge-command.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Build to verify**

```bash
pnpm --filter @contexta/bot build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add applications/bot/src/commands/knowledge.ts applications/bot/src/tests/unit/knowledge-command.test.ts
git commit -m "feat: add /knowledge search, delete, correct Discord commands"
```

---

### Task 8: Dashboard — Knowledge Query Functions

**Files:**
- Modify: `applications/dashboard/src/lib/queries.ts`

- [ ] **Step 1: Add knowledge query interfaces and functions**

Add to the bottom of `applications/dashboard/src/lib/queries.ts`:

```typescript
// --- Knowledge queries ---

export interface KnowledgeEntryRow {
  id: string;
  server_id: string;
  type: string;
  title: string;
  content: string;
  confidence: number;
  status: string;
  source_channel_id: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  published: number;
  pending_review: number;
  rejected: number;
  archived: number;
  avg_confidence: number;
  created_this_week: number;
}

export interface KnowledgeFilters {
  serverId: string;
  status?: string;
  type?: string;
  search?: string;
  pinnedOnly?: boolean;
  before?: string;
  limit?: number;
}

export async function getKnowledgeEntries(
  db: DbClient,
  filters: KnowledgeFilters
): Promise<{ entries: KnowledgeEntryRow[]; nextCursor: string | null }> {
  const { serverId, status, type, search, pinnedOnly, before, limit = 20 } = filters;

  const conditions: string[] = ['server_id = $1', 'is_archived = false'];
  const params: unknown[] = [serverId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (type) {
    conditions.push(`type = $${idx++}`);
    params.push(type);
  }
  if (pinnedOnly) {
    conditions.push('is_pinned = true');
  }
  if (before) {
    conditions.push(`created_at < $${idx++}`);
    params.push(before);
  }

  if (search) {
    conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  params.push(limit + 1);

  const result = await db.query(
    `SELECT id, server_id, type, title, content, confidence, status, source_channel_id, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    params
  );

  const rows = result.rows as unknown as KnowledgeEntryRow[];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return {
    entries: rows,
    nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].created_at : null,
  };
}

export async function getKnowledgeStats(db: DbClient, serverId: string): Promise<KnowledgeStats> {
  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'published' AND NOT is_archived)::int AS published,
       COUNT(*) FILTER (WHERE status = 'pending_review' AND NOT is_archived)::int AS pending_review,
       COUNT(*) FILTER (WHERE status = 'rejected' AND NOT is_archived)::int AS rejected,
       COUNT(*) FILTER (WHERE is_archived)::int AS archived,
       COALESCE(ROUND(AVG(confidence)::numeric, 2), 0)::float AS avg_confidence,
       COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND NOT is_archived)::int AS created_this_week
     FROM knowledge_entries
     WHERE server_id = $1`,
    [serverId]
  );

  return (result.rows[0] as unknown as KnowledgeStats) ?? {
    published: 0, pending_review: 0, rejected: 0, archived: 0, avg_confidence: 0, created_this_week: 0,
  };
}

export async function approveKnowledgeEntry(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET status = 'published', updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function rejectKnowledgeEntry(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET status = 'rejected', updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function toggleKnowledgePin(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET is_pinned = NOT is_pinned, updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function toggleKnowledgeArchive(db: DbClient, serverId: string, entryId: string): Promise<void> {
  await db.query(
    `UPDATE knowledge_entries SET is_archived = NOT is_archived, updated_at = now() WHERE server_id = $1 AND id = $2`,
    [serverId, entryId]
  );
}

export async function updateKnowledgeEntry(
  db: DbClient,
  serverId: string,
  entryId: string,
  data: { title?: string; content?: string; type?: string; confidence?: number }
): Promise<void> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [serverId, entryId];
  let idx = 3;

  if (data.title !== undefined) { sets.push(`title = $${idx++}`); params.push(data.title); }
  if (data.content !== undefined) { sets.push(`content = $${idx++}`); params.push(data.content); }
  if (data.type !== undefined) { sets.push(`type = $${idx++}`); params.push(data.type); }
  if (data.confidence !== undefined) { sets.push(`confidence = $${idx++}`); params.push(data.confidence); }

  await db.query(
    `UPDATE knowledge_entries SET ${sets.join(', ')} WHERE server_id = $1 AND id = $2`,
    params
  );
}

export async function getKnowledgeConfig(db: DbClient, serverId: string, botId: string) {
  const result = await db.query(
    `SELECT knowledge_config FROM server_settings WHERE server_id = $1 AND bot_id = $2`,
    [serverId, botId]
  );
  return (result.rows[0] as { knowledge_config: Record<string, unknown> } | undefined)?.knowledge_config ?? null;
}

export async function updateKnowledgeConfig(
  db: DbClient,
  serverId: string,
  botId: string,
  config: { autoPublishThreshold: number; reviewRequired: boolean }
): Promise<void> {
  await db.query(
    `UPDATE server_settings
     SET knowledge_config = COALESCE(knowledge_config, '{}'::jsonb) || $3::jsonb
     WHERE server_id = $1 AND bot_id = $2`,
    [serverId, botId, JSON.stringify(config)]
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @contexta/dashboard build
```

Expected: Build succeeds (or at least `tsc --noEmit` passes).

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/lib/queries.ts
git commit -m "feat: add knowledge management query functions for dashboard"
```

---

### Task 9: Dashboard — Knowledge Browser Page (Server Component + Stats)

**Files:**
- Create: `applications/dashboard/src/app/dashboard/[serverId]/knowledge/page.tsx`
- Create: `applications/dashboard/src/app/dashboard/[serverId]/knowledge/knowledge-list.tsx`

- [ ] **Step 1: Create the knowledge page server component**

Create `applications/dashboard/src/app/dashboard/[serverId]/knowledge/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { checkServerMembership } from '@/lib/auth-helpers';
import { getKnowledgeStats, getKnowledgeEntries } from '@/lib/queries';
import { getSelectedBotId } from '@/lib/bot-cookie';
import { KnowledgeList } from './knowledge-list';

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ status?: string; type?: string; q?: string; pinned?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const { serverId } = await params;
  const search = await searchParams;

  const membership = await checkServerMembership(pool, session.user.id, serverId);
  if (!membership) redirect('/dashboard');

  const botId = await getSelectedBotId();
  const stats = await getKnowledgeStats(pool, serverId);
  const { entries, nextCursor } = await getKnowledgeEntries(pool, {
    serverId,
    status: search.status || undefined,
    type: search.type || undefined,
    search: search.q || undefined,
    pinnedOnly: search.pinned === 'true',
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Knowledge Base</h1>
        <p className="text-sm text-text-muted mt-1">Browse and manage extracted knowledge entries</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Published" value={stats.published} />
        <StatCard
          label="Pending Review"
          value={stats.pending_review}
          highlight={stats.pending_review > 0}
          href={`/dashboard/${serverId}/knowledge?status=pending_review`}
        />
        <StatCard label="This Week" value={stats.created_this_week} />
        <StatCard label="Avg Confidence" value={`${(stats.avg_confidence * 100).toFixed(0)}%`} />
      </div>

      {/* Entry List */}
      <KnowledgeList
        serverId={serverId}
        entries={entries}
        nextCursor={nextCursor}
        isAdmin={membership.is_admin}
        currentFilters={{
          status: search.status || '',
          type: search.type || '',
          q: search.q || '',
          pinned: search.pinned || '',
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  href,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-bg-raised'
      }`}
    >
      <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${highlight ? 'text-amber-400' : 'text-text'}`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
```

- [ ] **Step 2: Create the knowledge list client component**

Create `applications/dashboard/src/app/dashboard/[serverId]/knowledge/knowledge-list.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { KnowledgeEntryRow } from '@/lib/queries';

interface KnowledgeListProps {
  serverId: string;
  entries: KnowledgeEntryRow[];
  nextCursor: string | null;
  isAdmin: boolean;
  currentFilters: { status: string; type: string; q: string; pinned: string };
}

const TYPE_BADGES: Record<string, string> = {
  topic: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  decision: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  entity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  action_item: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  reference: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STATUS_BADGES: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function confidenceDots(c: number) {
  if (c >= 0.7) return '●●●';
  if (c >= 0.4) return '●●○';
  return '●○○';
}

export function KnowledgeList({ serverId, entries, nextCursor, isAdmin, currentFilters }: KnowledgeListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentFilters.q);
  const [acting, setActing] = useState<string | null>(null);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/${serverId}/knowledge?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilter('q', search);
  }

  async function handleAction(entryId: string, action: 'approve' | 'reject' | 'pin' | 'archive') {
    setActing(entryId);
    try {
      const res = await fetch(`/api/knowledge/${serverId}/${entryId}/${action}`, { method: 'PUT' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={currentFilters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="bg-bg-raised border border-border rounded-md px-2.5 py-1.5 text-sm text-text"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="pending_review">Pending Review</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={currentFilters.type}
          onChange={(e) => updateFilter('type', e.target.value)}
          className="bg-bg-raised border border-border rounded-md px-2.5 py-1.5 text-sm text-text"
        >
          <option value="">All Types</option>
          <option value="topic">Topic</option>
          <option value="decision">Decision</option>
          <option value="entity">Entity</option>
          <option value="action_item">Action Item</option>
          <option value="reference">Reference</option>
        </select>

        <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
          <input
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-bg-raised border border-border rounded-md px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted w-48"
          />
          <button
            type="submit"
            className="bg-primary text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Entry Table */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">No knowledge entries found.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-raised border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left font-medium">ID</th>
                <th className="px-3 py-2.5 text-left font-medium">Title</th>
                <th className="px-3 py-2.5 text-left font-medium">Type</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-left font-medium">Conf.</th>
                <th className="px-3 py-2.5 text-left font-medium">Date</th>
                {isAdmin && <th className="px-3 py-2.5 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-bg-overlay transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
                    KE-{entry.id.slice(0, 4)}
                  </td>
                  <td className="px-3 py-2.5 text-text max-w-xs truncate" title={entry.title}>
                    {entry.is_pinned && <span className="mr-1">📌</span>}
                    {entry.title}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 text-xs rounded border ${TYPE_BADGES[entry.type] || ''}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 text-xs rounded border ${STATUS_BADGES[entry.status] || ''}`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{confidenceDots(entry.confidence)}</td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        {entry.status === 'pending_review' && (
                          <>
                            <ActionBtn
                              label="✓"
                              title="Approve"
                              onClick={() => handleAction(entry.id, 'approve')}
                              disabled={acting === entry.id}
                              className="text-emerald-400 hover:bg-emerald-500/10"
                            />
                            <ActionBtn
                              label="✗"
                              title="Reject"
                              onClick={() => handleAction(entry.id, 'reject')}
                              disabled={acting === entry.id}
                              className="text-red-400 hover:bg-red-500/10"
                            />
                          </>
                        )}
                        <ActionBtn
                          label={entry.is_pinned ? '📌' : '📍'}
                          title={entry.is_pinned ? 'Unpin' : 'Pin'}
                          onClick={() => handleAction(entry.id, 'pin')}
                          disabled={acting === entry.id}
                        />
                        <ActionBtn
                          label="🗑"
                          title="Archive"
                          onClick={() => handleAction(entry.id, 'archive')}
                          disabled={acting === entry.id}
                          className="text-red-400 hover:bg-red-500/10"
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={() => updateFilter('before', nextCursor)}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Load more →
          </button>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  title,
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-colors disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
pnpm --filter @contexta/dashboard build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add applications/dashboard/src/app/dashboard/\[serverId\]/knowledge/
git commit -m "feat: add knowledge browser page to dashboard"
```

---

### Task 10: Dashboard — Knowledge Action API Routes

**Files:**
- Create: `applications/dashboard/src/app/api/knowledge/[serverId]/[entryId]/[action]/route.ts`

- [ ] **Step 1: Create the action API route**

Create `applications/dashboard/src/app/api/knowledge/[serverId]/[entryId]/[action]/route.ts`:

```typescript
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { checkServerAdmin } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import {
  approveKnowledgeEntry,
  rejectKnowledgeEntry,
  toggleKnowledgePin,
  toggleKnowledgeArchive,
} from '@/lib/queries';

const ACTIONS: Record<string, (db: typeof pool, serverId: string, entryId: string) => Promise<void>> = {
  approve: approveKnowledgeEntry,
  reject: rejectKnowledgeEntry,
  pin: toggleKnowledgePin,
  archive: toggleKnowledgeArchive,
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ serverId: string; entryId: string; action: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { serverId, entryId, action } = await params;

  const isAdmin = await checkServerAdmin(pool, session.user.id, serverId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const handler = ACTIONS[action];
  if (!handler) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  await handler(pool, serverId, entryId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @contexta/dashboard build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/api/knowledge/
git commit -m "feat: add knowledge action API routes for dashboard"
```

---

### Task 11: Dashboard — Add Knowledge to Sidebar Navigation

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/sidebar.tsx`

- [ ] **Step 1: Add Knowledge nav item**

In `applications/dashboard/src/app/dashboard/sidebar.tsx`, in the nav section where other items are listed (Overview, Settings, Lore, Personality, History), add a Knowledge nav item. Place it after History (or after Overview if you want it prominent):

```typescript
<NavItem
  href={`/dashboard/${activeServerId}/knowledge`}
  label="Knowledge"
  icon={<span>📚</span>}
  active={pathname === `/dashboard/${activeServerId}/knowledge` || pathname.startsWith(`/dashboard/${activeServerId}/knowledge/`)}
/>
```

This should be visible to all users (not just admins), since `/knowledge search` is available to everyone. The page itself handles admin-only actions.

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @contexta/dashboard build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/dashboard/sidebar.tsx
git commit -m "feat: add Knowledge nav item to dashboard sidebar"
```

---

### Task 12: Dashboard — Knowledge Settings Section

**Files:**
- Modify: `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx`

- [ ] **Step 1: Add knowledge config form to settings page**

In `applications/dashboard/src/app/dashboard/[serverId]/settings/page.tsx`:

Import the new query functions at the top:

```typescript
import { getKnowledgeConfig, updateKnowledgeConfig } from '@/lib/queries';
```

After the existing server settings fetch, add:

```typescript
const knowledgeConfig = await getKnowledgeConfig(pool, serverId, botId);
const autoPublishThreshold = (knowledgeConfig?.autoPublishThreshold as number) ?? 0.7;
const reviewRequired = (knowledgeConfig?.reviewRequired as boolean) ?? false;
```

Add a server action for the knowledge config:

```typescript
async function handleUpdateKnowledgeConfig(formData: FormData) {
  'use server';
  const threshold = parseFloat(formData.get('autoPublishThreshold') as string) || 0.7;
  const review = formData.get('reviewRequired') === 'on';
  await updateKnowledgeConfig(pool, serverId, botId, {
    autoPublishThreshold: Math.min(1, Math.max(0, threshold)),
    reviewRequired: review,
  });
  revalidatePath(`/dashboard/${serverId}/settings`);
  redirect(`/dashboard/${serverId}/settings`);
}
```

Add the knowledge settings section in the JSX, below the existing model selection form:

```tsx
{/* Knowledge Approval Settings */}
<form action={handleUpdateKnowledgeConfig} className="mt-8 border border-border rounded-lg p-5 bg-bg-raised">
  <h2 className="text-base font-semibold text-text mb-4">Knowledge Approval</h2>
  <p className="text-sm text-text-muted mb-4">
    Control how extracted knowledge entries are published. Entries below the threshold go to a review queue.
  </p>

  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-text mb-1">
        Auto-publish threshold
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          name="autoPublishThreshold"
          min="0"
          max="1"
          step="0.1"
          defaultValue={autoPublishThreshold}
          className="flex-1"
        />
        <span className="text-sm text-text-muted w-8 text-right">{autoPublishThreshold}</span>
      </div>
      <div className="flex justify-between text-xs text-text-muted mt-1">
        <span>Review all</span>
        <span>Auto-publish all</span>
      </div>
    </div>

    <label className="flex items-center gap-2 text-sm text-text">
      <input
        type="checkbox"
        name="reviewRequired"
        defaultChecked={reviewRequired}
        className="rounded border-border"
      />
      Require review for all entries (overrides threshold)
    </label>
  </div>

  <button
    type="submit"
    className="mt-4 bg-primary text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
  >
    Save Knowledge Settings
  </button>
</form>
```

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @contexta/dashboard build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add applications/dashboard/src/app/dashboard/\[serverId\]/settings/page.tsx
git commit -m "feat: add knowledge approval settings to dashboard settings page"
```

---

### Task 13: Run All Tests

**Files:** None (verification only)

- [ ] **Step 1: Run bot tests**

```bash
pnpm test:bot
```

Expected: All tests pass (existing 68 + new citation tests).

- [ ] **Step 2: Run dashboard tests**

```bash
pnpm test:dashboard
```

Expected: All 24 tests pass.

- [ ] **Step 3: Build all packages**

```bash
pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test failures from knowledge admin console implementation"
```

Only commit this if there were fixes needed. If everything passed, skip.
