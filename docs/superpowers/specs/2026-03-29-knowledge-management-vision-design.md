# Knowledge Management Vision

**Date:** 2026-03-29
**Scope:** Full roadmap — four phases shipping independently
**Apps affected:** bot, backend, dashboard, packages/db, packages/shared

## Overview

Transform Contexta from a conversational Discord bot with basic recall into an autonomous knowledge management platform. The bot learns from every conversation, builds a structured knowledge base, surfaces relevant context proactively, understands its users, and gives admins a full console to see and shape what the bot knows.

Four phases, each shipping independent value but compounding on prior phases:

1. **Autonomous Learning** — Background pipelines extract topics, decisions, summaries, and user profiles
2. **Proactive Intelligence** — Bot surfaces knowledge at the right time, cross-channel awareness, personalized catch-up
3. **User Intelligence** — Auto-populated expertise profiles, `/who` command, personalized response adaptation
4. **Admin Knowledge Console** — Health dashboard, topic explorer, analytics, curation tools, reports

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Topic extraction granularity | Hybrid (message-level tags + conversation-level deep extraction) | Breadth from cheap per-message tagging, depth from conversation chunk analysis |
| Knowledge confidence & corrections | Confidence scoring + community corrections (❌ reactions) | Self-correcting without admin overhead. No review queue. |
| Knowledge relationships | Lightweight graph (join table with relationship types) | Flexible enough for organic Discord conversations without a graph DB. Simple JOINs. |
| User profile visibility | Expertise public, details private | `/who` returns names + topic matches. Detailed profiles (style, hours, preferences) visible only to self + admins. |
| Contextual injection style | Assertive | Bot actively references past knowledge: "By the way, this relates to..." Users see the value of the knowledge engine. |
| LLM cost strategy | Invest in intelligence | Background processing with smart batching. Cheaper models (Gemini Flash) for tagging, capable models (Gemini Pro/Claude) for extraction. Optimize later if needed. |

---

## Phase 1: Autonomous Learning

### New Tables

#### `knowledge_entries`

The core unit of extracted knowledge.

```sql
CREATE TABLE knowledge_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  type            varchar(50) NOT NULL, -- topic | decision | entity | action_item | reference
  title           varchar(500) NOT NULL,
  content         text NOT NULL,
  confidence      real NOT NULL DEFAULT 0.5, -- 0.0–1.0
  source_channel_id varchar(255),
  source_message_ids text[], -- array of message UUIDs for traceability
  embedding       vector(768),
  metadata        jsonb DEFAULT '{}', -- flexible per-type fields
  is_archived     boolean NOT NULL DEFAULT false,
  is_pinned       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ke_server_type ON knowledge_entries (server_id, type);
CREATE INDEX idx_ke_confidence ON knowledge_entries (server_id, confidence DESC);
CREATE INDEX idx_ke_embedding ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_ke_created ON knowledge_entries (server_id, created_at DESC);
```

#### `knowledge_entry_links`

Lightweight graph edges between knowledge entries.

```sql
CREATE TABLE knowledge_entry_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  target_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  relationship    varchar(50) NOT NULL, -- relates_to | supersedes | part_of | led_to
  created_by      varchar(50) NOT NULL DEFAULT 'pipeline', -- pipeline | admin | correction
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, relationship)
);

CREATE INDEX idx_kel_source ON knowledge_entry_links (source_id);
CREATE INDEX idx_kel_target ON knowledge_entry_links (target_id);
```

#### `channel_summaries`

Structured rolling summaries replacing `channel_memory_vectors`.

```sql
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
```

#### `user_expertise`

Per-user topic expertise scores, incrementally updated.

```sql
CREATE TABLE user_expertise (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar(255) NOT NULL,
  server_id       varchar(255) NOT NULL,
  topic           varchar(255) NOT NULL,
  score           real NOT NULL DEFAULT 0.0, -- 0.0–1.0
  message_count   integer NOT NULL DEFAULT 0,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, server_id, topic)
);

CREATE INDEX idx_ue_server_topic ON user_expertise (server_id, topic, score DESC);
CREATE INDEX idx_ue_user ON user_expertise (user_id, server_id);
```

#### `reports`

Generated report storage for history and scheduled delivery.

```sql
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  template        varchar(50) NOT NULL, -- knowledge_summary | weekly_digest | onboarding | expertise_directory | decision_log
  title           varchar(500) NOT NULL,
  content         text NOT NULL, -- markdown
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_server ON reports (server_id, generated_at DESC);
```

### Modified Tables

#### `messages`

Add column for message-level tags:

```sql
ALTER TABLE messages ADD COLUMN tags jsonb DEFAULT NULL;
-- tags shape: { topics: string[], is_decision: bool, is_action_item: bool, is_reference: bool, confidence: number }
```

#### `server_members`

Populate existing empty fields (no schema change needed):
- `inferred_context` — LLM-generated natural language profile summary
- `preferences` JSONB — `{ communication_style, verbosity, technical_level, active_hours, emoji_usage }`

#### `server_settings`

Add knowledge configuration:

```sql
ALTER TABLE server_settings ADD COLUMN knowledge_config jsonb DEFAULT '{"extraction_enabled": true, "summary_interval": "daily", "cross_channel_enabled": true, "injection_aggressiveness": "assertive"}';
```

### Shared Types

```typescript
// Knowledge entry types
type KnowledgeEntryType = 'topic' | 'decision' | 'entity' | 'action_item' | 'reference';
type RelationshipType = 'relates_to' | 'supersedes' | 'part_of' | 'led_to';
type LinkCreator = 'pipeline' | 'admin' | 'correction';

interface KnowledgeEntry {
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

interface KnowledgeEntryLink {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: RelationshipType;
  createdBy: LinkCreator;
}

interface ChannelSummary {
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
}

interface UserExpertise {
  userId: string;
  serverId: string;
  topic: string;
  score: number;
  messageCount: number;
  lastSeenAt: Date;
}

interface MessageTags {
  topics: string[];
  isDecision: boolean;
  isActionItem: boolean;
  isReference: boolean;
  confidence: number;
}

interface KnowledgeConfig {
  extractionEnabled: boolean;
  summaryInterval: 'daily' | 'weekly';
  crossChannelEnabled: boolean;
  injectionAggressiveness: 'conservative' | 'moderate' | 'assertive';
}
```

### Extraction Pipelines

#### Pipeline 1: Message Tagger

- **Schedule:** Every 5 minutes
- **Route:** `POST /api/cron/tag-messages`
- **Model:** Gemini Flash (cheap, fast)
- **Batch size:** 100 untagged messages
- **Process:**
  1. Query `messages WHERE tags IS NULL ORDER BY created_at LIMIT 100`
  2. Send batch to LLM with prompt: classify each message for topics (0-3), decision flag, action item flag, reference flag, confidence
  3. Update `messages.tags` JSONB for each message
- **Output:** Tagged messages ready for deeper extraction

#### Pipeline 2: Knowledge Extractor

- **Schedule:** Every 15 minutes
- **Route:** `POST /api/cron/extract-knowledge`
- **Model:** Gemini Pro or Claude Sonnet (capable, for quality extraction)
- **Process:**
  1. Group recently tagged messages into conversation chunks: same channel, messages within 30-min gaps of each other
  2. For each chunk with tagged signals (decisions, action items, or 3+ topic tags):
     - LLM extracts structured `knowledge_entries` (title, content, type, confidence)
     - LLM identifies links to existing entries (pass top-10 recent entries as context)
     - Generate embeddings for each new entry
  3. Write entries to `knowledge_entries` and links to `knowledge_entry_links`
- **Output:** Structured knowledge with graph relationships

#### Pipeline 3: Channel Summarizer

- **Schedule:** Daily (configurable via `knowledge_config.summary_interval`)
- **Route:** `POST /api/cron/summarize-channels`
- **Model:** Gemini Pro
- **Process:**
  1. For each active channel with ≥10 messages since last summary:
     - Fetch all messages in the period
     - LLM generates structured summary: narrative summary, topics[], decisions[], open_questions[], action_items[]
     - Generate embedding for the summary
  2. Write to `channel_summaries`
- **Output:** Structured daily/weekly channel digests

#### Pipeline 4: Profile Inferencer

- **Schedule:** Daily, per active user (users with messages in the last 7 days)
- **Route:** `POST /api/cron/infer-profiles`
- **Model:** Gemini Flash
- **Process:**
  1. For each active user in each server:
     - Aggregate their recent messages + message tags
     - LLM infers: expertise topics with scores, communication style, technical level, verbosity preference
  2. Upsert `user_expertise` entries (merge scores incrementally: new_score = 0.7 * old + 0.3 * inferred)
  3. Update `server_members.inferred_context` (natural language summary)
  4. Update `server_members.preferences` JSONB
- **Output:** Populated user profiles and expertise rankings

### Correction Feedback Loop

- Bot tracks which `knowledge_entry` IDs it surfaced in each response (stored in message metadata)
- On ❌ reaction to a bot message: reduce confidence of all referenced entries by 0.2 (floor 0.0)
- On explicit correction detected ("that's not right", "actually...", "no, we decided..."): same confidence reduction
- Entries below 0.3 confidence stop being surfaced in retrieval
- Three corrections effectively bury an entry (0.5 → 0.3 → 0.1 → 0.0)
- Admins can restore via dashboard (set confidence manually or pin)

---

## Phase 2: Proactive Intelligence

### Enhanced `/ask` and `@mention` Retrieval

Current flow: Redis history + lore → LLM

New flow:
1. Generate embedding from user's message
2. Query `knowledge_entries` for top-5 relevant entries (cosine similarity, confidence > 0.3)
3. For each result, follow graph links one hop to pull related entries (max 3 additional)
4. Inject into system prompt as structured context block:
   ```
   [RELEVANT KNOWLEDGE]
   - Decision (high confidence): "Team chose Redis for session caching" (from #backend, March 12)
   - Topic: "API rate limiting discussed" — relates to "Redis caching decision"
   [/RELEVANT KNOWLEDGE]
   ```
5. LLM system prompt instructs assertive surfacing: actively reference relevant knowledge, cite sources
6. Store surfaced `knowledge_entry` IDs on the bot's response message (for correction tracking)

### Enhanced `/recall`

Currently searches `channel_memory_vectors` only.

New behavior:
- Searches across `knowledge_entries` + `channel_summaries` + `messages`
- Results grouped by type: Decisions, Topics, Conversations, Summaries
- Each result shows: title/snippet, confidence, source channel, date
- Top 5 results per type, sorted by relevance

### New Command: `/catchup [timerange]`

- Default: last 24 hours. Accepts: "3d", "1w", "12h"
- Pulls `channel_summaries` for channels the user has been active in (based on message history)
- Filters/prioritizes by user's expertise topics from `user_expertise`
- LLM generates personalized digest:
  - Key decisions made
  - Action items that may affect the user
  - Trending topics in their channels
  - Notable discussions they missed
- Response format: structured embed with sections, not a wall of text

### Cross-Channel Surfacing

Passive behavior during conversation (not a command):
- When the knowledge extractor (Pipeline 2) creates an entry, check if the same topic has high-confidence entries from other channels
- On the bot's next response in that channel, include a subtle reference: "By the way, this was also discussed in #backend last week — they decided to go with connection pooling."
- Gated by `knowledge_config.cross_channel_enabled` per server
- Rate limit: max 1 cross-channel reference per channel per hour
- Only surfaces entries with confidence > 0.6

### Threaded Knowledge

When the bot surfaces a knowledge entry in a response:
- Include source reference: "Based on a conversation in #general on March 15"
- If user reacts with 🔍 or replies asking for more context:
  - Bot follows graph links from that entry
  - Pulls the full neighborhood of related entries
  - Presents a threaded view: the entry, its related entries, and source message excerpts

---

## Phase 3: User Intelligence

### Auto-Populated Expertise Profiles

Built by Pipeline 4 (Profile Inferencer). Produces:
- `user_expertise` entries: topic + score + message count per user per server
- Scores updated incrementally: `new_score = 0.7 * old_score + 0.3 * inferred_score`
- Expertise decays naturally — if a user stops contributing on a topic, new inferences will pull the score down over time

### New Command: `/who <topic>`

- Searches `user_expertise` for the given topic (fuzzy match + embedding similarity)
- Returns top 5 users ranked by expertise score
- Display format:
  ```
  Who knows about Docker?
  1. @alice — Expert (score: 0.92, 142 messages) — last active 2 days ago
  2. @bob — Frequent contributor (score: 0.71, 89 messages) — last active today
  3. @carol — Occasional (score: 0.45, 23 messages) — last active 1 week ago
  ```
- Labels: Expert (>0.8), Frequent (>0.5), Occasional (>0.2)

### Enhanced `/profile me`

Shows the requesting user their own inferred profile:
- Top 5 expertise areas with scores and labels
- Communication style summary (from `inferred_context`)
- Active channels and typical hours
- Only shows your own profile — others can't view your details
- Admins retain existing `/profile @user` for viewing anyone

### Personalized Response Adaptation

When responding to a user, the bot reads their `server_members.preferences`:
- `technical_level: high` → more detailed, precise, includes code/references
- `technical_level: low` → simpler explanations, analogies, less jargon
- `verbosity: concise` → shorter responses
- `verbosity: detailed` → longer, more thorough responses
- `communication_style: casual` → friendlier tone, more informal
- `communication_style: formal` → professional tone

Layered on server-wide personality settings: personality is the base, user adaptation is a modifier. User adaptation never contradicts server personality, just adjusts within its range.

### Relationship Mapping

Stored as lightweight data derived from message co-occurrence:
- Track which users interact in the same conversation chunks (from Pipeline 2)
- Powers: "Who else was involved in this discussion?" queries
- Enriches `/who` results: not just who talks about X, but who collaborates on X
- No separate table needed — computed from `knowledge_entries.source_message_ids` + `messages.user_id` at query time

---

## Phase 4: Admin Knowledge Console

### 4A: Knowledge Health Dashboard

**Page:** `/dashboard/[serverId]/knowledge`

Cards and metrics:
- **Pipeline status** — for each of the 4 pipelines: last run time, entries processed, errors, next scheduled run
- **Knowledge totals** — count by type (topics, decisions, entities, action items, references), total active vs archived
- **Confidence distribution** — histogram showing how many entries at each confidence level
- **Embedding coverage** — % of messages with tags, % with embeddings, backfill progress bar
- **This week vs last** — entries created, corrections received, summaries generated
- **Top 10 topics** — most referenced knowledge entries this period

### 4B: Topic Explorer

**Page:** `/dashboard/[serverId]/topics`

List view:
- Searchable, paginated list of all `knowledge_entries`
- Filters: type (multi-select), confidence range (slider), channel, time range, archived/active, pinned
- Sort: by confidence, by date, by relevance to search query
- Bulk actions: archive selected, change type, export

Detail view (click into an entry):
- Full content, metadata, confidence score
- Source messages — linked to the message log (clickable)
- Graph neighborhood — related entries with relationship type labels (relates_to, supersedes, etc.)
- Correction history — timestamps and confidence changes
- Admin actions: edit content, change type, adjust confidence, pin/unpin, archive, merge with another entry

### 4C: Activity & Trends

**Page:** `/dashboard/[serverId]/analytics`

Charts and visualizations:
- **Message volume** — time-series line chart, daily or weekly granularity, filterable by channel
- **Trending topics** — bar chart of topics with the most new knowledge entries this period
- **Top contributors** — leaderboard by message count and by knowledge contribution (how many entries cite their messages)
- **Activity heatmap** — messages by hour-of-day × day-of-week grid
- **Knowledge growth** — cumulative entries over time, broken down by type
- All charts filterable by time range (7d, 30d, 90d, custom)

### 4D: Knowledge Curation

Integrated into the Topic Explorer (4B), not a separate page:

- **Pin** — marks entry as authoritative. Pinned entries always surface regardless of confidence. Badge in UI.
- **Archive** — soft-delete. Entry stops appearing in searches and surfacing. Recoverable.
- **Edit** — modify title, content, type, confidence. Preserves edit history.
- **Merge** — select two entries → combine into one. Preserves source message links from both. Creates "supersedes" link from merged entry to the new one.
- **Mark as official** — for decision-type entries. Pins + adds "Official Decision" badge. These entries are prioritized in `/recall` and report generation.

### 4E: Reports & Export

**Page:** `/dashboard/[serverId]/reports`

Report templates:
- **Server Knowledge Summary** — all active topics, decisions, key entities. Generated from `knowledge_entries`.
- **Weekly Digest** — this week's `channel_summaries`, new decisions, trending topics, top contributors.
- **Onboarding Guide** — auto-generated from: pinned entries + server lore + top topics + official decisions. Designed for new members.
- **Expertise Directory** — who knows what. Generated from `user_expertise`. Lists all users with their top topics and scores.
- **Decision Log** — chronological list of all decision-type entries (filtered to confidence > 0.5 or pinned). Shows: date, decision, source channel, current status.

Features:
- Generate on-demand (button click)
- Schedule recurring generation (weekly digest every Monday)
- Export formats: markdown (clipboard-friendly), downloadable PDF
- Reports stored in a `reports` table for history

---

## Backend Route Summary

### New Cron Routes (Phase 1)

| Route | Pipeline | Schedule |
|-------|----------|----------|
| `POST /api/cron/tag-messages` | Message Tagger | Every 5 min |
| `POST /api/cron/extract-knowledge` | Knowledge Extractor | Every 15 min |
| `POST /api/cron/summarize-channels` | Channel Summarizer | Daily |
| `POST /api/cron/infer-profiles` | Profile Inferencer | Daily |

All secured with `CRON_SECRET` header.

### New API Routes

| Route | Purpose | Phase |
|-------|---------|-------|
| `GET /api/knowledge/:serverId` | List knowledge entries (paginated, filtered) | 1 |
| `GET /api/knowledge/:serverId/:id` | Get single entry with graph neighborhood | 1 |
| `PUT /api/knowledge/:serverId/:id` | Update entry (admin curation) | 4 |
| `POST /api/knowledge/:serverId/merge` | Merge two entries | 4 |
| `GET /api/knowledge/:serverId/search` | Semantic + text search across entries | 2 |
| `GET /api/summaries/:serverId` | List channel summaries | 1 |
| `GET /api/expertise/:serverId` | List user expertise (for `/who`) | 3 |
| `GET /api/expertise/:serverId/:userId` | Get user expertise profile | 3 |
| `GET /api/analytics/:serverId` | Activity metrics and trends | 4 |
| `POST /api/reports/:serverId/generate` | Generate a report | 4 |
| `GET /api/reports/:serverId` | List generated reports | 4 |

### Modified Routes

| Route | Change | Phase |
|-------|--------|-------|
| `POST /api/chat` | Add knowledge retrieval step before LLM call | 2 |
| `GET /api/embeddings/search` | Search across knowledge_entries + channel_summaries | 2 |

### New Bot Commands

| Command | Purpose | Phase |
|---------|---------|-------|
| `/catchup [timerange]` | Personalized missed-content digest | 2 |
| `/who <topic>` | Find experts on a topic | 3 |

### Modified Bot Commands

| Command | Change | Phase |
|---------|--------|-------|
| `/ask` | Knowledge retrieval injected into context | 2 |
| `/recall` | Searches knowledge_entries + summaries + messages | 2 |
| `/profile me` | Shows inferred expertise, style, active channels | 3 |
| `@mention` | Knowledge retrieval injected into context | 2 |

### New Dashboard Pages

| Page | Purpose | Phase |
|------|---------|-------|
| `/dashboard/[serverId]/knowledge` | Knowledge health metrics | 4 |
| `/dashboard/[serverId]/topics` | Topic explorer + curation | 4 |
| `/dashboard/[serverId]/analytics` | Activity trends and charts | 4 |
| `/dashboard/[serverId]/reports` | Report generation and export | 4 |
