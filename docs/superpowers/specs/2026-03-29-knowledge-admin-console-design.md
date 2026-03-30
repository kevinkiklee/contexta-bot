# Knowledge Admin Console

**Date:** 2026-03-29
**Scope:** Admin knowledge management — approval system, citation footers, Discord commands, dashboard UI
**Apps affected:** bot, backend, dashboard, packages/db, packages/shared

## Overview

Add admin control over the bot's autonomous knowledge pipeline. Four components:

1. **Configurable approval system** — per-server thresholds for auto-publish vs review queue
2. **Citation footers** — bot responses show which knowledge entries were used, making entries discoverable at point of use
3. **Discord commands** — quick reactive corrections (`/knowledge delete`, `/knowledge correct`, `/knowledge search`)
4. **Dashboard knowledge management** — browse, search, filter, edit, approve/reject, pin, archive

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approval model | Configurable per server (auto-publish threshold + optional full review mode) | Hands-off servers stay hands-off; strict servers get full review |
| Discord admin surface | Reactive commands only (correct/delete/search) | Quick fixes in context; heavy management goes to dashboard |
| Entry discoverability | Citation footers on bot responses with short IDs | Admins naturally encounter problems at point of use |
| Citation ID format | `KE-<first 4 hex of UUID>` | Short enough for Discord, unique enough within a server |
| Dashboard pattern | Follow existing: server components + client form components + server actions | Matches lore/personality/settings page patterns |

---

## Schema Changes

### `knowledge_entries` — Add `status` column

```sql
ALTER TABLE knowledge_entries
  ADD COLUMN status varchar(20) NOT NULL DEFAULT 'published';

CREATE INDEX idx_ke_status ON knowledge_entries (server_id, status);

-- Backfill: all existing entries are published
UPDATE knowledge_entries SET status = 'published' WHERE status = 'published';
```

Valid statuses: `published`, `pending_review`, `rejected`

### `server_settings.knowledge_config` — Extend JSONB

Add to the existing `knowledge_config` JSONB:

```typescript
interface KnowledgeConfig {
  // existing fields
  extractionEnabled: boolean;
  summaryInterval: 'daily' | 'weekly';
  crossChannelEnabled: boolean;
  injectionAggressiveness: 'conservative' | 'moderate' | 'assertive';
  // new fields
  autoPublishThreshold: number;  // 0.0–1.0, default 0.7
  reviewRequired: boolean;       // if true, ALL entries go to review regardless of confidence
}
```

Default: `autoPublishThreshold: 0.7`, `reviewRequired: false` — existing behavior preserved.

### Shared Types (packages/shared)

```typescript
type KnowledgeEntryStatus = 'published' | 'pending_review' | 'rejected';

// Add to existing KnowledgeEntry interface
interface KnowledgeEntry {
  // ... existing fields
  status: KnowledgeEntryStatus;
}

// New type for citation references
interface KnowledgeCitation {
  shortId: string;      // KE-xxxx
  entryId: string;      // full UUID
  type: string;         // entry type
  confidence: number;
  title: string;
}
```

---

## Component 1: Approval System

### Pipeline Integration

In the knowledge extraction pipeline (`/api/cron/extract-knowledge`), after creating each entry:

```
if (serverConfig.reviewRequired) {
  status = 'pending_review'
} else if (entry.confidence >= serverConfig.autoPublishThreshold) {
  status = 'published'
} else {
  status = 'pending_review'
}
```

### Search Filtering

All knowledge search queries (the `POST /api/knowledge/:serverId/search` route and any direct queries) filter to `status = 'published'` only. This ensures pending/rejected entries never appear in bot responses.

### Review Actions (Backend)

New routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `PUT /api/knowledge/:serverId/:id/approve` | PUT | Set status to `published` |
| `PUT /api/knowledge/:serverId/:id/reject` | PUT | Set status to `rejected` |

Both require bot auth. The dashboard calls these via its own API proxy.

---

## Component 2: Citation Footers

### Format

When the bot uses knowledge entries in a response, append after the LLM output:

```
[Bot's response here...]

───
📚 Sources: `KE-3f8a` (decision, ●●●) · `KE-1c2d` (topic, ●●○)
```

Confidence dots: `●●●` = high (≥0.7), `●●○` = moderate (0.4–0.69), `●○○` = low (<0.4).

### Implementation

In the bot's response formatting (after LLM call returns), if knowledge entries were injected:

1. Collect the list of `KnowledgeCitation` objects from the search results that were injected
2. Generate short IDs: `KE-` + first 4 hex characters of the UUID
3. Format the footer string
4. Append to the response (respecting Discord's 2000 char limit — truncate response text if needed to fit footer)

The footer is appended **after** the LLM response, not included in the LLM prompt. The LLM doesn't see or generate citations.

### Short ID Resolution

When an admin uses a short ID in a command:
1. Query `WHERE id::text LIKE '<short_id_hex>%' AND server_id = <server_id>`
2. If exactly 1 match → use it
3. If multiple matches → tell the admin "Multiple entries match `KE-3f8a`. Please use more characters or the full ID from the dashboard."
4. If 0 matches → "No entry found matching `KE-3f8a`."

---

## Component 3: Discord Admin Commands

### `/knowledge` Command Group

Add a new slash command `/knowledge` with subcommands:

#### `/knowledge search <query>`

- Available to all users
- Searches `knowledge_entries` via the existing search endpoint (published entries only)
- Returns top 3 results formatted as:
  ```
  🔍 Knowledge Search: "redis caching"

  1. `KE-3f8a` — **Redis Session Caching Decision** (decision, ●●●)
     Team chose Redis for session caching over Memcached...

  2. `KE-7b1e` — **Caching Strategy** (topic, ●●○)
     Discussion about caching layers and invalidation...

  📊 3 results found · View all in dashboard: <link>
  ```
- Links to dashboard knowledge page for full results

#### `/knowledge delete <id>`

- Admin only (check `is_admin` from `user_servers`)
- Resolves short ID (`KE-xxxx`) or accepts full UUID
- Archives the entry (sets `is_archived = true`, not hard delete)
- Confirms: "Archived `KE-3f8a` — **Redis Session Caching Decision**. Restore from dashboard if needed."
- Ephemeral response (only visible to the admin)

#### `/knowledge correct <id> <new_content>`

- Admin only
- Resolves short ID
- Updates the entry's `content` field with the new text
- Sets `updated_at` to now
- Optionally re-generates the embedding (async, via backend call)
- Confirms: "Updated `KE-3f8a` — **Redis Session Caching Decision**. New content saved."
- Ephemeral response

### Command Registration

Add to `src/commands/knowledge.ts` following the existing command pattern (SlashCommandBuilder with subcommands). Register in the command loader auto-discovery.

---

## Component 4: Dashboard Knowledge Management

### New Page: Knowledge Browser

**Route:** `/dashboard/[serverId]/knowledge`

**Layout:** Server component that fetches knowledge stats + entry list. Sidebar nav gets a new "Knowledge" item.

#### Stats Header

Row of metric cards at the top:
- Total entries (published / pending / rejected)
- Entries this week
- Average confidence
- Pending review count (highlighted if > 0)

#### Entry List

Below the stats, a filterable/sortable table:

**Filters (client component):**
- Status: published / pending_review / rejected / all (default: published)
- Type: topic / decision / entity / action_item / reference / all
- Confidence range: slider or presets (high/medium/low/all)
- Search: text input (searches title + content)
- Pinned only toggle
- Channel filter dropdown

**Table columns:**
- Short ID (`KE-xxxx`)
- Title (truncated, clickable to expand)
- Type (badge)
- Status (badge: green/yellow/red)
- Confidence (dot indicator)
- Source channel
- Created date
- Actions (approve/reject/pin/archive buttons)

**Pagination:** Cursor-based, matching the existing message log pattern.

**Bulk actions:** Select multiple → approve all / archive all.

#### Entry Detail (Expandable or Side Panel)

When clicking an entry title:
- Full content
- Metadata JSON
- Source message IDs (linked to message log if possible)
- Related entries (from `knowledge_entry_links`) with relationship labels
- Edit form: title, content, type dropdown, confidence slider
- Action buttons: approve, reject, pin/unpin, archive/unarchive, delete permanently (with confirmation)

### New Page: Review Queue

**Route:** `/dashboard/[serverId]/knowledge/review`

Filtered view of the knowledge browser showing only `pending_review` entries. Same table but:
- Default sorted by created date (newest first)
- Prominent approve/reject buttons per row
- Bulk approve/reject
- Link from the stats header "N entries pending review" card

### Settings Integration

On the existing `/dashboard/[serverId]/settings` page, add a "Knowledge" section:

- **Auto-publish threshold** — slider (0.0–1.0) with labels: "Review all (0.0)" / "Balanced (0.5)" / "Auto-publish most (0.7)" / "Auto-publish all (1.0)"
- **Require review for all** — toggle (overrides threshold)
- Saved to `server_settings.knowledge_config`

### Sidebar Navigation

Add to the existing sidebar nav items:
```
📚 Knowledge        → /dashboard/[serverId]/knowledge
```

If there are pending review entries, show a badge count on the nav item.

---

## Backend API Changes

### New Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `GET /api/knowledge/:serverId/stats` | GET | Counts by status, type, avg confidence | botAuth |
| `PUT /api/knowledge/:serverId/:id` | PUT | Update entry fields (title, content, type, confidence) | botAuth |
| `PUT /api/knowledge/:serverId/:id/approve` | PUT | Set status = published | botAuth |
| `PUT /api/knowledge/:serverId/:id/reject` | PUT | Set status = rejected | botAuth |
| `PUT /api/knowledge/:serverId/:id/pin` | PUT | Toggle is_pinned | botAuth |
| `PUT /api/knowledge/:serverId/:id/archive` | PUT | Toggle is_archived | botAuth |
| `POST /api/knowledge/:serverId/merge` | POST | Merge two entries into one (future, not in initial build) | botAuth |

### Modified Routes

| Route | Change |
|-------|--------|
| `POST /api/knowledge/:serverId/search` | Add `WHERE status = 'published'` filter |
| `GET /api/knowledge/:serverId` | Add `status` filter parameter, return status field |
| `POST /api/cron/extract-knowledge` | Apply approval threshold logic when setting status |

### Dashboard API Proxy

The dashboard calls backend routes via its own API route (or directly via server components using the backend URL + bot auth). Follow the existing pattern in `lib/queries.ts` — add new query functions:

- `getKnowledgeEntries(serverId, filters)` — paginated, filtered list
- `getKnowledgeStats(serverId)` — aggregate counts
- `updateKnowledgeEntry(serverId, entryId, data)` — edit
- `approveKnowledgeEntry(serverId, entryId)` — approve
- `rejectKnowledgeEntry(serverId, entryId)` — reject
- `toggleKnowledgePin(serverId, entryId)` — pin/unpin
- `toggleKnowledgeArchive(serverId, entryId)` — archive/unarchive
- `updateKnowledgeConfig(serverId, config)` — save approval settings

---

## Migration

Single SQL migration file: `0006_add_knowledge_status.sql`

```sql
-- Add status column to knowledge_entries
ALTER TABLE knowledge_entries
  ADD COLUMN status varchar(20) NOT NULL DEFAULT 'published';

CREATE INDEX idx_ke_status ON knowledge_entries (server_id, status);

-- Update existing knowledge_config defaults (no-op if already set)
UPDATE server_settings
SET knowledge_config = knowledge_config || '{"autoPublishThreshold": 0.7, "reviewRequired": false}'::jsonb
WHERE knowledge_config IS NOT NULL
  AND NOT (knowledge_config ? 'autoPublishThreshold');
```

---

## Testing

### Bot Tests
- `/knowledge search` returns results formatted with short IDs
- `/knowledge delete` archives entry, confirms to admin
- `/knowledge correct` updates content, confirms to admin
- Admin permission checks on delete/correct
- Short ID resolution: unique match, ambiguous match, no match
- Citation footer formatting with varying entry counts and confidence levels
- Footer respects 2000 char limit (truncates response, not footer)

### Backend Tests
- Approval threshold logic: reviewRequired=true → pending, high confidence → published, low → pending
- Status filter on search (only published entries returned)
- CRUD operations on knowledge entries
- Stats endpoint returns correct counts

### Dashboard Tests
- Knowledge browser renders with entries
- Filter controls update query params
- Approve/reject actions update status
- Settings save knowledge_config correctly
- Review queue shows only pending entries

---

## Out of Scope

- Notification to admin channel when new entries are extracted (user chose reactive-only Discord)
- Knowledge merge UI (deferred — add to topic explorer later)
- Export/download functionality
- Analytics/charts page (separate future work from Phase 4 vision)
- Report generation (separate future work)
