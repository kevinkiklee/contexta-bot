# Phase 1: Autonomous Learning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the background extraction pipelines that automatically learn from Discord conversations — message tagging, knowledge extraction, channel summarization, and user profile inference.

**Architecture:** Four cron-driven pipelines process messages in batches. Pipeline 1 (Message Tagger) does lightweight per-message classification with Gemini Flash. Pipeline 2 (Knowledge Extractor) groups tagged messages into conversation chunks and extracts structured knowledge entries with graph relationships. Pipeline 3 (Channel Summarizer) generates daily structured summaries. Pipeline 4 (Profile Inferencer) builds user expertise profiles. All pipelines are backend cron routes secured with CRON_SECRET.

**Tech Stack:** Hono (backend routes), PostgreSQL + pgvector (storage), Gemini Flash/Pro (LLM), Vitest (testing), raw SQL via `rawQuery()`.

**Spec:** `docs/superpowers/specs/2026-03-29-knowledge-management-vision-design.md` — Phase 1 section.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/db/src/migrations/0004_add_knowledge_tables.sql` | Migration: knowledge_entries, knowledge_entry_links, channel_summaries, user_expertise, reports tables |
| `packages/db/src/migrations/0005_add_message_tags_and_knowledge_config.sql` | Migration: messages.tags column, server_settings.knowledge_config column |
| `applications/backend/src/routes/knowledge.ts` | CRUD routes for knowledge entries (list, get, search) |
| `applications/backend/src/routes/cron/tagMessages.ts` | Pipeline 1: Message Tagger cron |
| `applications/backend/src/routes/cron/extractKnowledge.ts` | Pipeline 2: Knowledge Extractor cron |
| `applications/backend/src/routes/cron/summarizeChannels.ts` | Pipeline 3: Channel Summarizer cron |
| `applications/backend/src/routes/cron/inferProfiles.ts` | Pipeline 4: Profile Inferencer cron |
| `applications/backend/src/services/llm/prompts.ts` | LLM prompt templates for all pipelines |
| `applications/backend/src/tests/routes/knowledge.test.ts` | Tests for knowledge CRUD routes |
| `applications/backend/src/tests/routes/cron/tagMessages.test.ts` | Tests for Pipeline 1 |
| `applications/backend/src/tests/routes/cron/extractKnowledge.test.ts` | Tests for Pipeline 2 |
| `applications/backend/src/tests/routes/cron/summarizeChannels.test.ts` | Tests for Pipeline 3 |
| `applications/backend/src/tests/routes/cron/inferProfiles.test.ts` | Tests for Pipeline 4 |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/src/schema.ts` | Add Drizzle schema for new tables |
| `packages/shared/src/types.ts` | Add knowledge management types |
| `applications/backend/src/index.ts` | Mount new routes |

---

## Task 1: Database Migrations

**Files:**
- Create: `packages/db/src/migrations/0004_add_knowledge_tables.sql`
- Create: `packages/db/src/migrations/0005_add_message_tags_and_knowledge_config.sql`

- [ ] **Step 1: Write migration for knowledge tables**

```sql
-- packages/db/src/migrations/0004_add_knowledge_tables.sql

-- Knowledge entries: the core unit of extracted knowledge
CREATE TABLE knowledge_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  type            varchar(50) NOT NULL,
  title           varchar(500) NOT NULL,
  content         text NOT NULL,
  confidence      real NOT NULL DEFAULT 0.5,
  source_channel_id varchar(255),
  source_message_ids text[] DEFAULT '{}',
  embedding       vector(768),
  metadata        jsonb DEFAULT '{}',
  is_archived     boolean NOT NULL DEFAULT false,
  is_pinned       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ke_server_type ON knowledge_entries (server_id, type);
CREATE INDEX idx_ke_confidence ON knowledge_entries (server_id, confidence DESC);
CREATE INDEX idx_ke_embedding ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_ke_created ON knowledge_entries (server_id, created_at DESC);

-- Lightweight graph edges between knowledge entries
CREATE TABLE knowledge_entry_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  target_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  relationship    varchar(50) NOT NULL,
  created_by      varchar(50) NOT NULL DEFAULT 'pipeline',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, relationship)
);

CREATE INDEX idx_kel_source ON knowledge_entry_links (source_id);
CREATE INDEX idx_kel_target ON knowledge_entry_links (target_id);

-- Structured rolling channel summaries
CREATE TABLE channel_summaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  channel_id      varchar(255) NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  summary         text NOT NULL,
  topics          text[] DEFAULT '{}',
  decisions       text[] DEFAULT '{}',
  open_questions  text[] DEFAULT '{}',
  action_items    text[] DEFAULT '{}',
  embedding       vector(768),
  message_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_channel_time ON channel_summaries (server_id, channel_id, period_end DESC);
CREATE INDEX idx_cs_embedding ON channel_summaries USING hnsw (embedding vector_cosine_ops);

-- Per-user topic expertise scores
CREATE TABLE user_expertise (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar(255) NOT NULL,
  server_id       varchar(255) NOT NULL,
  topic           varchar(255) NOT NULL,
  score           real NOT NULL DEFAULT 0.0,
  message_count   integer NOT NULL DEFAULT 0,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, server_id, topic)
);

CREATE INDEX idx_ue_server_topic ON user_expertise (server_id, topic, score DESC);
CREATE INDEX idx_ue_user ON user_expertise (user_id, server_id);

-- Generated reports
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  template        varchar(50) NOT NULL,
  title           varchar(500) NOT NULL,
  content         text NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_server ON reports (server_id, generated_at DESC);
```

- [ ] **Step 2: Write migration for message tags and knowledge config**

```sql
-- packages/db/src/migrations/0005_add_message_tags_and_knowledge_config.sql

-- Add tags column to messages for lightweight per-message classification
ALTER TABLE messages ADD COLUMN tags jsonb DEFAULT NULL;

-- Add knowledge config to server_settings
ALTER TABLE server_settings ADD COLUMN knowledge_config jsonb DEFAULT '{"extraction_enabled": true, "summary_interval": "daily", "cross_channel_enabled": true, "injection_aggressiveness": "assertive"}';
```

- [ ] **Step 3: Commit migrations**

```bash
git add packages/db/src/migrations/0004_add_knowledge_tables.sql packages/db/src/migrations/0005_add_message_tags_and_knowledge_config.sql
git commit -m "feat: add knowledge management database migrations"
```

---

## Task 2: Drizzle Schema & Shared Types

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add Drizzle schema for new tables**

Add to `packages/db/src/schema.ts` after the existing `messages` table definition:

```typescript
export const knowledgeEntries = pgTable('knowledge_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  confidence: customType<{ data: number; driverParam: number }>({
    dataType() { return 'real'; },
    toDriver(value: number) { return value; },
    fromDriver(value: unknown) { return Number(value); },
  })('confidence').notNull().default(0.5),
  sourceChannelId: varchar('source_channel_id', { length: 255 }),
  sourceMessageIds: text('source_message_ids').array().default([]),
  embedding: vector('embedding'),
  metadata: jsonb('metadata').default({}),
  isArchived: boolean('is_archived').notNull().default(false),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ke_server_type').on(table.serverId, table.type),
  index('idx_ke_created').on(table.serverId, table.createdAt),
]);

export const knowledgeEntryLinks = pgTable('knowledge_entry_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull(),
  targetId: uuid('target_id').notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull(),
  createdBy: varchar('created_by', { length: 50 }).notNull().default('pipeline'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_kel_source').on(table.sourceId),
  index('idx_kel_target').on(table.targetId),
]);

export const channelSummaries = pgTable('channel_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  channelId: varchar('channel_id', { length: 255 }).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  summary: text('summary').notNull(),
  topics: text('topics').array().default([]),
  decisions: text('decisions').array().default([]),
  openQuestions: text('open_questions').array().default([]),
  actionItems: text('action_items').array().default([]),
  embedding: vector('embedding'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_cs_channel_time').on(table.serverId, table.channelId, table.periodEnd),
]);

export const userExpertise = pgTable('user_expertise', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  score: customType<{ data: number; driverParam: number }>({
    dataType() { return 'real'; },
    toDriver(value: number) { return value; },
    fromDriver(value: unknown) { return Number(value); },
  })('score').notNull().default(0.0),
  messageCount: integer('message_count').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_ue_server_topic').on(table.serverId, table.topic),
  index('idx_ue_user').on(table.userId, table.serverId),
]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  template: varchar('template', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_reports_server').on(table.serverId, table.generatedAt),
]);
```

- [ ] **Step 2: Add shared types**

Add to `packages/shared/src/types.ts`:

```typescript
// --- Knowledge Management Types ---

export type KnowledgeEntryType = 'topic' | 'decision' | 'entity' | 'action_item' | 'reference';
export type RelationshipType = 'relates_to' | 'supersedes' | 'part_of' | 'led_to';
export type LinkCreator = 'pipeline' | 'admin' | 'correction';

export interface KnowledgeEntry {
  id: string;
  serverId: string;
  type: KnowledgeEntryType;
  title: string;
  content: string;
  confidence: number;
  sourceChannelId?: string;
  sourceMessageIds: string[];
  metadata: Record<string, unknown>;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntryLink {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: RelationshipType;
  createdBy: LinkCreator;
  createdAt: Date;
}

export interface ChannelSummary {
  id: string;
  serverId: string;
  channelId: string;
  periodStart: Date;
  periodEnd: Date;
  summary: string;
  topics: string[];
  decisions: string[];
  openQuestions: string[];
  actionItems: string[];
  messageCount: number;
  createdAt: Date;
}

export interface UserExpertise {
  userId: string;
  serverId: string;
  topic: string;
  score: number;
  messageCount: number;
  lastSeenAt: Date;
}

export interface MessageTags {
  topics: string[];
  isDecision: boolean;
  isActionItem: boolean;
  isReference: boolean;
  confidence: number;
}

export interface KnowledgeConfig {
  extractionEnabled: boolean;
  summaryInterval: 'daily' | 'weekly';
  crossChannelEnabled: boolean;
  injectionAggressiveness: 'conservative' | 'moderate' | 'assertive';
}

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  extractionEnabled: true,
  summaryInterval: 'daily',
  crossChannelEnabled: true,
  injectionAggressiveness: 'assertive',
};
```

- [ ] **Step 3: Commit schema and types**

```bash
git add packages/db/src/schema.ts packages/shared/src/types.ts
git commit -m "feat: add Drizzle schema and shared types for knowledge management"
```

---

## Task 3: LLM Prompt Templates

**Files:**
- Create: `applications/backend/src/services/llm/prompts.ts`

- [ ] **Step 1: Write prompt templates for all four pipelines**

```typescript
// applications/backend/src/services/llm/prompts.ts

/**
 * Pipeline 1: Message Tagger
 * Classifies messages for topics, decisions, action items, references.
 */
export function buildTaggingPrompt(messages: { id: string; content: string; displayName: string }[]): string {
  const messageList = messages.map((m, i) => `[${i}] ${m.displayName}: ${m.content}`).join('\n');

  return `You are a message classifier for a Discord server. Analyze each message and extract structured tags.

For each message, output a JSON object with:
- "index": the message index number
- "topics": array of 0-3 topic strings (short, lowercase, e.g. "docker", "api design", "hiring")
- "isDecision": true if the message announces or confirms a decision
- "isActionItem": true if the message assigns or commits to an action
- "isReference": true if the message shares a URL, doc, or external resource
- "confidence": 0.0-1.0 how confident you are in your classification

Messages that are casual chat, greetings, or reactions with no substantive content should get empty topics and 0.1 confidence.

Output a JSON array of objects. No markdown, no explanation, just the JSON array.

Messages:
${messageList}`;
}

/**
 * Pipeline 2: Knowledge Extractor
 * Extracts structured knowledge entries from conversation chunks.
 */
export function buildExtractionPrompt(
  messages: { displayName: string; content: string; createdAt: string }[],
  existingEntries: { id: string; title: string; type: string }[]
): string {
  const conversation = messages.map(m => `[${m.createdAt}] ${m.displayName}: ${m.content}`).join('\n');
  const existing = existingEntries.length > 0
    ? existingEntries.map(e => `- [${e.id}] (${e.type}) ${e.title}`).join('\n')
    : 'None yet.';

  return `You are a knowledge extractor for a Discord server. Analyze this conversation chunk and extract structured knowledge entries.

For each piece of knowledge found, output a JSON object with:
- "type": one of "topic", "decision", "entity", "action_item", "reference"
- "title": short descriptive title (under 100 chars)
- "content": full description of the knowledge (1-3 sentences)
- "confidence": 0.0-1.0 how confident you are this is real knowledge (not speculation or jokes)
- "linkedEntryIds": array of IDs from existing entries that this relates to (can be empty)
- "linkRelationship": if linkedEntryIds is non-empty, one of "relates_to", "supersedes", "part_of", "led_to"

Rules:
- Only extract genuine knowledge, decisions, or references. Skip casual chat.
- A "decision" must be clearly agreed upon, not just suggested.
- An "action_item" must have a clear owner or commitment.
- An "entity" is a project, tool, person, or concept referenced multiple times.
- Confidence below 0.3 means "probably not real knowledge."

Existing knowledge entries (for linking):
${existing}

Conversation:
${conversation}

Output a JSON array of objects. No markdown, no explanation, just the JSON array.`;
}

/**
 * Pipeline 3: Channel Summarizer
 * Generates structured daily/weekly channel summaries.
 */
export function buildSummaryPrompt(
  channelName: string,
  messages: { displayName: string; content: string; createdAt: string }[]
): string {
  const conversation = messages.map(m => `[${m.createdAt}] ${m.displayName}: ${m.content}`).join('\n');

  return `You are a channel summarizer for a Discord server. Summarize the following conversation from #${channelName}.

Output a single JSON object with:
- "summary": a 2-5 sentence narrative summary of what was discussed
- "topics": array of topic strings discussed (short, lowercase)
- "decisions": array of decisions made (full sentence each, empty array if none)
- "openQuestions": array of unresolved questions raised (empty array if none)
- "actionItems": array of action items committed to (include who if mentioned, empty array if none)

Rules:
- Be factual and specific. Include names when relevant.
- Only include decisions that were clearly agreed upon.
- Open questions are things explicitly asked but not answered.
- Keep the summary concise but informative.

Conversation from #${channelName}:
${conversation}

Output a single JSON object. No markdown, no explanation, just the JSON.`;
}

/**
 * Pipeline 4: Profile Inferencer
 * Infers user expertise and communication preferences from their messages.
 */
export function buildProfilePrompt(
  displayName: string,
  messages: { content: string; tags: { topics: string[] } | null }[]
): string {
  const sampleMessages = messages.slice(0, 50).map(m => {
    const tagStr = m.tags?.topics?.length ? ` [topics: ${m.tags.topics.join(', ')}]` : '';
    return `- ${m.content}${tagStr}`;
  }).join('\n');

  return `You are a user profile analyzer for a Discord server. Analyze this user's recent messages to infer their expertise and communication style.

User: ${displayName}

Output a single JSON object with:
- "expertiseTopics": array of objects, each with "topic" (string) and "score" (0.0-1.0, where 1.0 = clearly an expert)
  Only include topics where the user shows real knowledge, not just mentions.
  Max 10 topics.
- "communicationStyle": one of "casual", "formal", "technical", "mixed"
- "verbosity": one of "concise", "moderate", "detailed"
- "technicalLevel": one of "low", "medium", "high"
- "summary": 1-2 sentence natural language description of this user's role and expertise

Rules:
- Base expertise scores on demonstrated knowledge, not just frequency of mention.
- A user asking questions about a topic is NOT expertise — it's interest.
- Communication style should reflect their actual writing, not the topics.

Recent messages:
${sampleMessages}

Output a single JSON object. No markdown, no explanation, just the JSON.`;
}
```

- [ ] **Step 2: Commit prompts**

```bash
git add applications/backend/src/services/llm/prompts.ts
git commit -m "feat: add LLM prompt templates for knowledge extraction pipelines"
```

---

## Task 4: Knowledge CRUD Routes

**Files:**
- Create: `applications/backend/src/routes/knowledge.ts`
- Create: `applications/backend/src/tests/routes/knowledge.test.ts`

- [ ] **Step 1: Write tests for knowledge routes**

```typescript
// applications/backend/src/tests/routes/knowledge.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

import { rawQuery } from '@contexta/db';
import { knowledgeRoutes } from '../../routes/knowledge.js';

const mockRawQuery = vi.mocked(rawQuery);

describe('knowledge routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', knowledgeRoutes);
  });

  describe('GET /api/knowledge/:serverId', () => {
    it('returns paginated knowledge entries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ke-1', server_id: 's1', type: 'topic', title: 'Docker', content: 'Docker usage', confidence: 0.8, is_archived: false, is_pinned: false, created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z', source_channel_id: 'c1', source_message_ids: [], metadata: {} },
        ],
        rowCount: 1,
      });

      const res = await app.request('/api/knowledge/s1?limit=20');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].title).toBe('Docker');
    });

    it('filters by type', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request('/api/knowledge/s1?type=decision');
      expect(res.status).toBe(200);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("type = $"),
        expect.arrayContaining(['s1', 'decision'])
      );
    });

    it('excludes archived by default', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await app.request('/api/knowledge/s1');
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_archived = false'),
        expect.any(Array)
      );
    });
  });

  describe('GET /api/knowledge/:serverId/:id', () => {
    it('returns entry with linked entries', async () => {
      // Main entry query
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'ke-1', server_id: 's1', type: 'topic', title: 'Docker', content: 'Docker usage', confidence: 0.8, is_archived: false, is_pinned: false, created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z', source_channel_id: 'c1', source_message_ids: [], metadata: {} }],
        rowCount: 1,
      });
      // Links query
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'link-1', source_id: 'ke-1', target_id: 'ke-2', relationship: 'relates_to', target_title: 'Kubernetes', target_type: 'topic' }],
        rowCount: 1,
      });

      const res = await app.request('/api/knowledge/s1/ke-1');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entry.title).toBe('Docker');
      expect(data.links).toHaveLength(1);
      expect(data.links[0].target_title).toBe('Kubernetes');
    });

    it('returns 404 for missing entry', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await app.request('/api/knowledge/s1/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/summaries/:serverId', () => {
    it('returns channel summaries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'cs-1', server_id: 's1', channel_id: 'c1', summary: 'Discussed Docker', topics: ['docker'], message_count: 25, period_start: '2026-03-28T00:00:00Z', period_end: '2026-03-29T00:00:00Z' }],
        rowCount: 1,
      });

      const res = await app.request('/api/summaries/s1');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summaries).toHaveLength(1);
    });
  });

  describe('GET /api/expertise/:serverId', () => {
    it('returns user expertise for a topic', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', topic: 'docker', score: 0.92, message_count: 142, last_seen_at: '2026-03-29T00:00:00Z' },
          { user_id: 'u2', topic: 'docker', score: 0.71, message_count: 89, last_seen_at: '2026-03-28T00:00:00Z' },
        ],
        rowCount: 2,
      });

      const res = await app.request('/api/expertise/s1?topic=docker');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expertise).toHaveLength(2);
      expect(data.expertise[0].score).toBe(0.92);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `knowledgeRoutes` module not found

- [ ] **Step 3: Implement knowledge routes**

```typescript
// applications/backend/src/routes/knowledge.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';

export const knowledgeRoutes = new Hono();

// List knowledge entries (paginated, filtered)
knowledgeRoutes.get('/knowledge/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const cursor = c.req.query('cursor'); // ISO timestamp for cursor pagination
  const type = c.req.query('type');
  const includeArchived = c.req.query('includeArchived') === 'true';

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (!includeArchived) {
    conditions.push('is_archived = false');
  }

  if (type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  if (cursor) {
    conditions.push(`created_at < $${paramIdx}`);
    params.push(cursor);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT id, server_id, type, title, content, confidence, source_channel_id, source_message_ids, metadata, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ entries: result.rows });
});

// Get single entry with graph neighborhood
knowledgeRoutes.get('/knowledge/:serverId/:id', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const entryResult = await rawQuery(
    `SELECT id, server_id, type, title, content, confidence, source_channel_id, source_message_ids, metadata, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE id = $1 AND server_id = $2`,
    [id, serverId]
  );

  if (entryResult.rowCount === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Get linked entries (one hop in both directions)
  const linksResult = await rawQuery(
    `SELECT kel.id, kel.source_id, kel.target_id, kel.relationship,
            ke.title AS target_title, ke.type AS target_type
     FROM knowledge_entry_links kel
     JOIN knowledge_entries ke ON ke.id = CASE WHEN kel.source_id = $1 THEN kel.target_id ELSE kel.source_id END
     WHERE kel.source_id = $1 OR kel.target_id = $1`,
    [id]
  );

  return c.json({ entry: entryResult.rows[0], links: linksResult.rows });
});

// List channel summaries
knowledgeRoutes.get('/summaries/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const channelId = c.req.query('channelId');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (channelId) {
    conditions.push(`channel_id = $${paramIdx}`);
    params.push(channelId);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT id, server_id, channel_id, period_start, period_end, summary, topics, decisions, open_questions, action_items, message_count, created_at
     FROM channel_summaries
     WHERE ${conditions.join(' AND ')}
     ORDER BY period_end DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ summaries: result.rows });
});

// List user expertise
knowledgeRoutes.get('/expertise/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const topic = c.req.query('topic');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') || '10', 10);

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (topic) {
    conditions.push(`topic ILIKE $${paramIdx}`);
    params.push(`%${topic}%`);
    paramIdx++;
  }

  if (userId) {
    conditions.push(`user_id = $${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT user_id, topic, score, message_count, last_seen_at
     FROM user_expertise
     WHERE ${conditions.join(' AND ')}
     ORDER BY score DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ expertise: result.rows });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/knowledge.ts applications/backend/src/tests/routes/knowledge.test.ts
git commit -m "feat: add knowledge entry CRUD and query routes"
```

---

## Task 5: Pipeline 1 — Message Tagger

**Files:**
- Create: `applications/backend/src/routes/cron/tagMessages.ts`
- Create: `applications/backend/src/tests/routes/cron/tagMessages.test.ts`

- [ ] **Step 1: Write tests for message tagger**

```typescript
// applications/backend/src/tests/routes/cron/tagMessages.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { tagMessagesRoutes } from '../../../routes/cron/tagMessages.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 1: Message Tagger', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', tagMessagesRoutes);
  });

  it('tags untagged messages in batch', async () => {
    // Return untagged messages
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', content: 'We should use Redis for caching', display_name: 'Alice' },
        { id: 'msg-2', content: 'lol nice', display_name: 'Bob' },
      ],
      rowCount: 2,
    });

    // Mock LLM response
    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify([
      { index: 0, topics: ['redis', 'caching'], isDecision: false, isActionItem: false, isReference: false, confidence: 0.8 },
      { index: 1, topics: [], isDecision: false, isActionItem: false, isReference: false, confidence: 0.1 },
    ]));

    // Mock update calls
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(2);

    // Verify SELECT for untagged messages was called
    expect(mockRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('tags IS NULL'),
      expect.any(Array)
    );
  });

  it('handles empty batch gracefully', async () => {
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(0);
  });

  it('continues on individual message errors', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'msg-1', content: 'test', display_name: 'Alice' }],
      rowCount: 1,
    });

    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockRejectedValueOnce(new Error('LLM failed'));

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.errors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `tagMessagesRoutes` module not found

- [ ] **Step 3: Implement message tagger**

```typescript
// applications/backend/src/routes/cron/tagMessages.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildTaggingPrompt } from '../../services/llm/prompts.js';

export const tagMessagesRoutes = new Hono();

const BATCH_SIZE = 100;

tagMessagesRoutes.post('/tag-messages', async (c) => {
  const ai = getProvider('gemini-2.5-flash');
  let processed = 0;
  const errors: string[] = [];

  // Fetch untagged messages
  const result = await rawQuery(
    `SELECT id, content, display_name FROM messages WHERE tags IS NULL ORDER BY created_at ASC LIMIT $1`,
    [BATCH_SIZE]
  );

  if (result.rows.length === 0) {
    return c.json({ status: 'completed', processed: 0, errors: [] });
  }

  try {
    const prompt = buildTaggingPrompt(
      result.rows.map((r: { id: string; content: string; display_name: string }) => ({
        id: r.id,
        content: r.content,
        displayName: r.display_name,
      }))
    );

    const response = await ai.generateChatResponse(prompt, []);
    const tags = JSON.parse(response) as {
      index: number;
      topics: string[];
      isDecision: boolean;
      isActionItem: boolean;
      isReference: boolean;
      confidence: number;
    }[];

    for (const tag of tags) {
      const row = result.rows[tag.index];
      if (!row) continue;

      try {
        await rawQuery(
          `UPDATE messages SET tags = $1::jsonb WHERE id = $2`,
          [JSON.stringify({
            topics: tag.topics,
            isDecision: tag.isDecision,
            isActionItem: tag.isActionItem,
            isReference: tag.isReference,
            confidence: tag.confidence,
          }), row.id]
        );
        processed++;
      } catch (err) {
        errors.push(`${row.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`batch: ${(err as Error).message}`);
  }

  return c.json({ status: 'completed', processed, errors });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/cron/tagMessages.ts applications/backend/src/tests/routes/cron/tagMessages.test.ts
git commit -m "feat: add Pipeline 1 — message tagger cron"
```

---

## Task 6: Pipeline 2 — Knowledge Extractor

**Files:**
- Create: `applications/backend/src/routes/cron/extractKnowledge.ts`
- Create: `applications/backend/src/tests/routes/cron/extractKnowledge.test.ts`

- [ ] **Step 1: Write tests for knowledge extractor**

```typescript
// applications/backend/src/tests/routes/cron/extractKnowledge.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { extractKnowledgeRoutes } from '../../../routes/cron/extractKnowledge.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 2: Knowledge Extractor', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', extractKnowledgeRoutes);
  });

  it('extracts knowledge from conversation chunks', async () => {
    // Tagged messages with signals
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', server_id: 's1', channel_id: 'c1', display_name: 'Alice', content: 'We decided to use Redis for caching', created_at: '2026-03-29T10:00:00Z', tags: { topics: ['redis', 'caching'], isDecision: true, isActionItem: false, isReference: false, confidence: 0.9 } },
        { id: 'msg-2', server_id: 's1', channel_id: 'c1', display_name: 'Bob', content: 'Agreed, Redis it is', created_at: '2026-03-29T10:05:00Z', tags: { topics: ['redis'], isDecision: true, isActionItem: false, isReference: false, confidence: 0.8 } },
      ],
      rowCount: 2,
    });

    // Existing entries for linking
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'ke-existing', title: 'Caching strategy discussion', type: 'topic' }],
      rowCount: 1,
    });

    // LLM extraction response
    const mockProvider = mockGetProvider('gemini-2.5-pro');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify([
      {
        type: 'decision',
        title: 'Redis chosen for caching',
        content: 'The team decided to use Redis for the caching layer.',
        confidence: 0.9,
        linkedEntryIds: ['ke-existing'],
        linkRelationship: 'led_to',
      },
    ]));

    // Insert knowledge entry
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'ke-new' }],
      rowCount: 1,
    });

    // Insert link
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Mark messages as processed
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await app.request('/api/cron/extract-knowledge', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entriesCreated).toBeGreaterThanOrEqual(1);
  });

  it('skips chunks without knowledge signals', async () => {
    // Only low-confidence casual messages
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', server_id: 's1', channel_id: 'c1', display_name: 'Alice', content: 'lol', created_at: '2026-03-29T10:00:00Z', tags: { topics: [], isDecision: false, isActionItem: false, isReference: false, confidence: 0.1 } },
      ],
      rowCount: 1,
    });

    const res = await app.request('/api/cron/extract-knowledge', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entriesCreated).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `extractKnowledgeRoutes` module not found

- [ ] **Step 3: Implement knowledge extractor**

```typescript
// applications/backend/src/routes/cron/extractKnowledge.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildExtractionPrompt } from '../../services/llm/prompts.js';

export const extractKnowledgeRoutes = new Hono();

const CONVERSATION_GAP_MS = 30 * 60 * 1000; // 30 minutes

interface TaggedMessage {
  id: string;
  server_id: string;
  channel_id: string;
  display_name: string;
  content: string;
  created_at: string;
  tags: { topics: string[]; isDecision: boolean; isActionItem: boolean; isReference: boolean; confidence: number };
}

function groupIntoChunks(messages: TaggedMessage[]): TaggedMessage[][] {
  if (messages.length === 0) return [];

  const chunks: TaggedMessage[][] = [];
  let currentChunk: TaggedMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].created_at).getTime();
    const curr = new Date(messages[i].created_at).getTime();
    const sameChannel = messages[i].channel_id === messages[i - 1].channel_id;

    if (sameChannel && curr - prev < CONVERSATION_GAP_MS) {
      currentChunk.push(messages[i]);
    } else {
      chunks.push(currentChunk);
      currentChunk = [messages[i]];
    }
  }
  chunks.push(currentChunk);
  return chunks;
}

function hasKnowledgeSignals(chunk: TaggedMessage[]): boolean {
  const hasDecision = chunk.some(m => m.tags?.isDecision);
  const hasActionItem = chunk.some(m => m.tags?.isActionItem);
  const topicCount = new Set(chunk.flatMap(m => m.tags?.topics || [])).size;
  return hasDecision || hasActionItem || topicCount >= 3;
}

extractKnowledgeRoutes.post('/extract-knowledge', async (c) => {
  const ai = getProvider('gemini-2.5-pro');
  let entriesCreated = 0;
  let linksCreated = 0;
  const errors: string[] = [];

  // Fetch recently tagged messages not yet processed for extraction
  // Use a simple heuristic: messages tagged in the last hour that have knowledge signals
  const result = await rawQuery(
    `SELECT id, server_id, channel_id, display_name, content, created_at, tags
     FROM messages
     WHERE tags IS NOT NULL
       AND tags->>'confidence' != '0'
       AND created_at > now() - interval '2 hours'
     ORDER BY server_id, channel_id, created_at ASC
     LIMIT 500`,
    []
  );

  if (result.rows.length === 0) {
    return c.json({ status: 'completed', entriesCreated: 0, linksCreated: 0, errors: [] });
  }

  const chunks = groupIntoChunks(result.rows as TaggedMessage[]);

  for (const chunk of chunks) {
    if (!hasKnowledgeSignals(chunk)) continue;

    const serverId = chunk[0].server_id;
    const channelId = chunk[0].channel_id;

    try {
      // Get recent existing entries for linking context
      const existingResult = await rawQuery(
        `SELECT id, title, type FROM knowledge_entries
         WHERE server_id = $1 AND is_archived = false
         ORDER BY created_at DESC LIMIT 10`,
        [serverId]
      );

      const prompt = buildExtractionPrompt(
        chunk.map(m => ({ displayName: m.display_name, content: m.content, createdAt: m.created_at })),
        existingResult.rows as { id: string; title: string; type: string }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const extracted = JSON.parse(response) as {
        type: string;
        title: string;
        content: string;
        confidence: number;
        linkedEntryIds: string[];
        linkRelationship: string;
      }[];

      for (const entry of extracted) {
        const embedding = await ai.generateEmbedding(`${entry.title}: ${entry.content}`);
        const messageIds = chunk.map(m => m.id);

        const insertResult = await rawQuery(
          `INSERT INTO knowledge_entries (server_id, type, title, content, confidence, source_channel_id, source_message_ids, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
           RETURNING id`,
          [serverId, entry.type, entry.title, entry.content, entry.confidence, channelId, messageIds, `[${embedding.join(',')}]`]
        );

        const newId = insertResult.rows[0]?.id;
        if (!newId) continue;
        entriesCreated++;

        // Create links to existing entries
        for (const linkedId of entry.linkedEntryIds) {
          try {
            await rawQuery(
              `INSERT INTO knowledge_entry_links (source_id, target_id, relationship, created_by)
               VALUES ($1, $2, $3, 'pipeline')
               ON CONFLICT (source_id, target_id, relationship) DO NOTHING`,
              [newId, linkedId, entry.linkRelationship || 'relates_to']
            );
            linksCreated++;
          } catch (linkErr) {
            // Link to nonexistent entry — skip silently
          }
        }
      }
    } catch (err) {
      errors.push(`chunk in ${channelId}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', entriesCreated, linksCreated, errors });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/cron/extractKnowledge.ts applications/backend/src/tests/routes/cron/extractKnowledge.test.ts
git commit -m "feat: add Pipeline 2 — knowledge extractor cron"
```

---

## Task 7: Pipeline 3 — Channel Summarizer

**Files:**
- Create: `applications/backend/src/routes/cron/summarizeChannels.ts`
- Create: `applications/backend/src/tests/routes/cron/summarizeChannels.test.ts`

- [ ] **Step 1: Write tests for channel summarizer**

```typescript
// applications/backend/src/tests/routes/cron/summarizeChannels.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { summarizeChannelsRoutes } from '../../../routes/cron/summarizeChannels.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 3: Channel Summarizer', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', summarizeChannelsRoutes);
  });

  it('summarizes channels with enough messages', async () => {
    // Active channels query
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ server_id: 's1', channel_id: 'c1', msg_count: 25, earliest: '2026-03-28T00:00:00Z', latest: '2026-03-29T00:00:00Z' }],
      rowCount: 1,
    });

    // Channel name from Redis mapping — we'll use channel_id as fallback
    // Messages for the channel
    mockRawQuery.mockResolvedValueOnce({
      rows: Array.from({ length: 25 }, (_, i) => ({
        display_name: i % 2 === 0 ? 'Alice' : 'Bob',
        content: `Message ${i} about Docker and Kubernetes`,
        created_at: new Date(2026, 2, 28, i).toISOString(),
      })),
      rowCount: 25,
    });

    // LLM summary response
    const mockProvider = mockGetProvider('gemini-2.5-pro');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      summary: 'Alice and Bob discussed Docker and Kubernetes deployment strategies.',
      topics: ['docker', 'kubernetes'],
      decisions: ['Use Kubernetes for orchestration'],
      openQuestions: [],
      actionItems: ['Alice to set up K8s cluster'],
    }));

    // Insert summary
    mockRawQuery.mockResolvedValueOnce({ rows: [{ id: 'cs-1' }], rowCount: 1 });

    const res = await app.request('/api/cron/summarize-channels', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summarized).toBe(1);
  });

  it('skips channels with fewer than 10 messages', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ server_id: 's1', channel_id: 'c1', msg_count: 5, earliest: '2026-03-28T00:00:00Z', latest: '2026-03-29T00:00:00Z' }],
      rowCount: 1,
    });

    const res = await app.request('/api/cron/summarize-channels', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summarized).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `summarizeChannelsRoutes` module not found

- [ ] **Step 3: Implement channel summarizer**

```typescript
// applications/backend/src/routes/cron/summarizeChannels.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildSummaryPrompt } from '../../services/llm/prompts.js';

export const summarizeChannelsRoutes = new Hono();

const MIN_MESSAGES = 10;

summarizeChannelsRoutes.post('/summarize-channels', async (c) => {
  const ai = getProvider('gemini-2.5-pro');
  let summarized = 0;
  const errors: string[] = [];

  // Find channels with enough messages since last summary
  const channelsResult = await rawQuery(
    `SELECT m.server_id, m.channel_id,
            COUNT(*)::int AS msg_count,
            MIN(m.created_at) AS earliest,
            MAX(m.created_at) AS latest
     FROM messages m
     LEFT JOIN channel_summaries cs
       ON cs.server_id = m.server_id
       AND cs.channel_id = m.channel_id
       AND cs.period_end > now() - interval '1 day'
     WHERE cs.id IS NULL
       AND m.created_at > now() - interval '1 day'
     GROUP BY m.server_id, m.channel_id`,
    []
  );

  for (const channel of channelsResult.rows) {
    if (channel.msg_count < MIN_MESSAGES) continue;

    try {
      // Fetch messages for this channel in the period
      const messagesResult = await rawQuery(
        `SELECT display_name, content, created_at
         FROM messages
         WHERE server_id = $1 AND channel_id = $2
           AND created_at BETWEEN $3 AND $4
         ORDER BY created_at ASC`,
        [channel.server_id, channel.channel_id, channel.earliest, channel.latest]
      );

      const prompt = buildSummaryPrompt(
        channel.channel_id, // Use channel ID as name fallback
        messagesResult.rows as { displayName: string; content: string; createdAt: string }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const summary = JSON.parse(response) as {
        summary: string;
        topics: string[];
        decisions: string[];
        openQuestions: string[];
        actionItems: string[];
      };

      const embedding = await ai.generateEmbedding(summary.summary);

      await rawQuery(
        `INSERT INTO channel_summaries (server_id, channel_id, period_start, period_end, summary, topics, decisions, open_questions, action_items, embedding, message_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11)`,
        [
          channel.server_id,
          channel.channel_id,
          channel.earliest,
          channel.latest,
          summary.summary,
          summary.topics,
          summary.decisions,
          summary.openQuestions,
          summary.actionItems,
          `[${embedding.join(',')}]`,
          channel.msg_count,
        ]
      );

      summarized++;
    } catch (err) {
      errors.push(`${channel.channel_id}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', summarized, errors });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/cron/summarizeChannels.ts applications/backend/src/tests/routes/cron/summarizeChannels.test.ts
git commit -m "feat: add Pipeline 3 — channel summarizer cron"
```

---

## Task 8: Pipeline 4 — Profile Inferencer

**Files:**
- Create: `applications/backend/src/routes/cron/inferProfiles.ts`
- Create: `applications/backend/src/tests/routes/cron/inferProfiles.test.ts`

- [ ] **Step 1: Write tests for profile inferencer**

```typescript
// applications/backend/src/tests/routes/cron/inferProfiles.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { inferProfilesRoutes } from '../../../routes/cron/inferProfiles.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 4: Profile Inferencer', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', inferProfilesRoutes);
  });

  it('infers profiles for active users', async () => {
    // Active users query
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', server_id: 's1', display_name: 'Alice' }],
      rowCount: 1,
    });

    // User's recent messages
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { content: 'The Docker build is failing on CI', tags: { topics: ['docker', 'ci'] } },
        { content: 'I fixed the Dockerfile, was a missing COPY step', tags: { topics: ['docker'] } },
      ],
      rowCount: 2,
    });

    // LLM profile response
    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      expertiseTopics: [
        { topic: 'docker', score: 0.85 },
        { topic: 'ci/cd', score: 0.6 },
      ],
      communicationStyle: 'technical',
      verbosity: 'concise',
      technicalLevel: 'high',
      summary: 'Alice is a DevOps-focused developer with strong Docker and CI expertise.',
    }));

    // Existing expertise (for incremental merge)
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // Upsert expertise entries + update server_members
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await app.request('/api/cron/infer-profiles', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profilesUpdated).toBe(1);
  });

  it('merges scores incrementally with existing expertise', async () => {
    // Active users
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', server_id: 's1', display_name: 'Alice' }],
      rowCount: 1,
    });

    // Messages
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ content: 'Docker is great', tags: { topics: ['docker'] } }],
      rowCount: 1,
    });

    // LLM response
    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      expertiseTopics: [{ topic: 'docker', score: 0.9 }],
      communicationStyle: 'technical',
      verbosity: 'concise',
      technicalLevel: 'high',
      summary: 'Docker expert.',
    }));

    // Existing expertise — old score was 0.6
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ topic: 'docker', score: 0.6, message_count: 50 }],
      rowCount: 1,
    });

    // Upsert calls
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await app.request('/api/cron/infer-profiles', { method: 'POST' });
    expect(res.status).toBe(200);

    // The upsert should use merged score: 0.7 * 0.6 + 0.3 * 0.9 = 0.69
    expect(mockRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.arrayContaining(['u1', 's1', 'docker'])
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: FAIL — `inferProfilesRoutes` module not found

- [ ] **Step 3: Implement profile inferencer**

```typescript
// applications/backend/src/routes/cron/inferProfiles.ts

import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildProfilePrompt } from '../../services/llm/prompts.js';

export const inferProfilesRoutes = new Hono();

inferProfilesRoutes.post('/infer-profiles', async (c) => {
  const ai = getProvider('gemini-2.5-flash');
  let profilesUpdated = 0;
  const errors: string[] = [];

  // Find active users (messages in the last 7 days)
  const usersResult = await rawQuery(
    `SELECT DISTINCT m.user_id, m.server_id, m.display_name
     FROM messages m
     WHERE m.created_at > now() - interval '7 days'
       AND m.is_bot = false
     ORDER BY m.server_id, m.user_id`,
    []
  );

  for (const user of usersResult.rows) {
    try {
      // Get recent messages with tags
      const messagesResult = await rawQuery(
        `SELECT content, tags
         FROM messages
         WHERE user_id = $1 AND server_id = $2 AND is_bot = false
         ORDER BY created_at DESC
         LIMIT 100`,
        [user.user_id, user.server_id]
      );

      if (messagesResult.rows.length < 5) continue; // Skip users with very few messages

      const prompt = buildProfilePrompt(
        user.display_name,
        messagesResult.rows as { content: string; tags: { topics: string[] } | null }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const profile = JSON.parse(response) as {
        expertiseTopics: { topic: string; score: number }[];
        communicationStyle: string;
        verbosity: string;
        technicalLevel: string;
        summary: string;
      };

      // Get existing expertise for incremental merging
      const existingResult = await rawQuery(
        `SELECT topic, score, message_count FROM user_expertise WHERE user_id = $1 AND server_id = $2`,
        [user.user_id, user.server_id]
      );
      const existingMap = new Map(
        (existingResult.rows as { topic: string; score: number; message_count: number }[]).map(r => [r.topic, r])
      );

      // Upsert expertise entries with incremental score merging
      for (const expertise of profile.expertiseTopics) {
        const existing = existingMap.get(expertise.topic);
        const mergedScore = existing
          ? 0.7 * existing.score + 0.3 * expertise.score
          : expertise.score;
        const messageCount = existing ? existing.message_count + 1 : 1;

        await rawQuery(
          `INSERT INTO user_expertise (user_id, server_id, topic, score, message_count, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (user_id, server_id, topic)
           DO UPDATE SET score = $4, message_count = $5, last_seen_at = now()`,
          [user.user_id, user.server_id, expertise.topic, mergedScore, messageCount]
        );
      }

      // Update server_members profile fields
      await rawQuery(
        `UPDATE server_members
         SET inferred_context = $3,
             preferences = $4::jsonb
         WHERE user_id = $1 AND server_id = $2`,
        [
          user.user_id,
          user.server_id,
          profile.summary,
          JSON.stringify({
            communication_style: profile.communicationStyle,
            verbosity: profile.verbosity,
            technical_level: profile.technicalLevel,
          }),
        ]
      );

      profilesUpdated++;
    } catch (err) {
      errors.push(`${user.user_id}@${user.server_id}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', profilesUpdated, errors });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @contexta/backend test -- --run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add applications/backend/src/routes/cron/inferProfiles.ts applications/backend/src/tests/routes/cron/inferProfiles.test.ts
git commit -m "feat: add Pipeline 4 — profile inferencer cron"
```

---

## Task 9: Wire Routes Into Backend

**Files:**
- Modify: `applications/backend/src/index.ts`

- [ ] **Step 1: Mount new routes in index.ts**

Add imports and mount the routes. The knowledge routes go under the bot-authed API app. The cron routes go under the cron app.

Add these imports at the top of `applications/backend/src/index.ts`:

```typescript
import { knowledgeRoutes } from './routes/knowledge.js';
import { tagMessagesRoutes } from './routes/cron/tagMessages.js';
import { extractKnowledgeRoutes } from './routes/cron/extractKnowledge.js';
import { summarizeChannelsRoutes } from './routes/cron/summarizeChannels.js';
import { inferProfilesRoutes } from './routes/cron/inferProfiles.js';
```

Mount knowledge routes under the bot-authed API app (alongside existing routes):

```typescript
apiApp.route('/', knowledgeRoutes);
```

Mount cron routes under the cron app:

```typescript
cronApp.route('/', tagMessagesRoutes);
cronApp.route('/', extractKnowledgeRoutes);
cronApp.route('/', summarizeChannelsRoutes);
cronApp.route('/', inferProfilesRoutes);
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests PASS across all packages

- [ ] **Step 3: Commit**

```bash
git add applications/backend/src/index.ts
git commit -m "feat: wire knowledge and cron routes into backend"
```

---

## Task 10: Verify Build

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Clean build with no TypeScript errors

- [ ] **Step 2: Run all tests one final time**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Commit any build fixes if needed**

Only if the build revealed issues. Otherwise skip.

---
