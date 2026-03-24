# Multimodal Attachment Ingestion Design

**Date:** 2026-03-23
**Approach:** Attachment Service Module (text-description-at-ingestion)

## Goals

- Enable the bot to understand images and documents shared in Discord chat
- Persist attachment context in the full memory pipeline (Redis short-term + pgvector long-term)
- Minimize changes to existing code — the attachment processor is a new module, and downstream systems (background worker, vector DB, message guard) remain unchanged

## Scope

**In scope:** Images (`image/png`, `image/jpeg`, `image/gif`, `image/webp`), PDFs (`application/pdf`), plain text files (`text/plain`, `text/csv`, `text/markdown`), and common code file types.

**Out of scope:** Video, audio, and arbitrary binary files. Unsupported types receive a metadata-only placeholder.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Processing trigger | Every message with attachments | Richest history for conversation and background summarization |
| Description timing | At ingestion (before Redis store) | Avoids CDN URL expiry; description is available immediately |
| Data transfer to Gemini | Inline base64 | Discord's 8-25MB limit keeps files within Gemini's inline ceiling; simpler than File API |
| Storage format | Text description appended to message string in Redis | Downstream pipeline (worker, vector DB) works unchanged |
| Large/unsupported files | Graceful fallback to metadata placeholder | Never blocks or crashes the message pipeline |

## Architecture

### 1. Attachment Processor Service

New module: `src/services/attachmentProcessor.ts`

Core function:

```typescript
async function describeAttachment(
  ai: IAIProvider,
  attachment: { url: string; name: string; contentType: string; size: number }
): Promise<string | null>
```

Responsibilities:
1. **Validate** — check MIME type against allowlist and size against limit (~20MB cap)
2. **Fetch** — download binary data from the Discord CDN URL
3. **Describe** — send bytes as base64 to Gemini via `IAIProvider.describeAttachment()` with a focused prompt
4. **Format** — return a bracketed description string: `[Attachment: filename.ext — description text]`
5. **Fail gracefully** — network failures, API errors, and timeouts return a fallback placeholder like `[Attachment: filename.ext — description unavailable]`. Unsupported types return `[Attachment: filename.ext (size) — unsupported file type]`.

A convenience function handles multiple attachments:

```typescript
async function processAttachments(
  ai: IAIProvider,
  attachments: Attachment[]
): Promise<string>
```

Calls `describeAttachment` for each attachment via `Promise.allSettled` (parallel, fault-tolerant), concatenates results with spaces, returns a single string to append to the user's message.

### 2. IAIProvider Interface Change

One new method added to `src/llm/IAIProvider.ts`:

```typescript
describeAttachment(
  mimeType: string,
  base64Data: string,
  fileName: string
): Promise<string>;
```

Keeps multimodal concerns scoped to a single method rather than widening the existing `generateChatResponse` parts type.

### 3. GeminiProvider Implementation

`GeminiProvider.describeAttachment()` calls `generateContent` with:
- A system instruction: "Describe this image/document concisely for context in a Discord conversation."
- Contents with an `inlineData` part: `{ inlineData: { mimeType, data: base64Data } }`

Returns the text response.

### 4. Message Handler Integration

Changes to `src/events/messageCreate.ts`:

```
message arrives
  → format text via messageGuard (unchanged)
  → NEW: if message.attachments.size > 0, call processAttachments()
  → NEW: append attachment descriptions to the formatted message string
  → push to Redis (unchanged)
  → if @mentioned, build chat history and call LLM (unchanged)
```

**Redis format examples:**

No attachment (unchanged):
```
[User: Alice]: check out this error
```

One image:
```
[User: Alice]: check out this error [Attachment: screenshot.png — A VS Code editor showing a red squiggly under a variable named 'count' with the error "Type 'string' is not assignable to type 'number'" on line 42]
```

Multiple attachments:
```
[User: Alice]: here are the receipts [Attachment: receipt1.pdf — A restaurant receipt from Olive Garden dated March 15, total $47.82] [Attachment: receipt2.pdf — A gas station receipt from Shell, $38.50 for 10.2 gallons]
```

Failed description:
```
[User: Alice]: check this [Attachment: data.zip — unsupported file type]
```

**Dependency injection:** `MessageCreateDeps` gains an `attachmentProcessor` field (defaulting to the real implementation) so tests can mock it.

### 5. LLM Conversation Path (when @mentioned)

**Unchanged.** The chat history pulled from Redis already contains attachment descriptions inline as text. The existing text-only `generateChatResponse` has all the context it needs.

If the @mention message itself has attachments, the description calls complete before the conversation call, ensuring the bot's response accounts for the attachment content. This adds 1-2 seconds of latency on mentioned messages with attachments.

### 6. Background Worker & Long-Term Memory

**Unchanged.** The worker already joins message strings and summarizes them. Attachment descriptions are embedded in those strings, so summaries naturally include attachment context. Vector embeddings capture the semantic content, making attachments discoverable via `/recall`.

### 7. Database Schema

**No changes.** `channel_memory_vectors` stores `summary_text` (TEXT) and `embedding` (VECTOR(768)) — both remain text-derived.

### 8. Message Guard

**No changes.** The `[Attachment: ...]` format is not a role prefix (`[System/Contexta]` or `[User: ...]`) so the existing sanitization regex does not match it. No injection vector is introduced.

## Supported MIME Types

| Category | MIME Types |
|---|---|
| Images | `image/png`, `image/jpeg`, `image/gif`, `image/webp` |
| Documents | `application/pdf` |
| Text | `text/plain`, `text/csv`, `text/markdown` |
| Code | Common extensions detected by filename (`.ts`, `.js`, `.py`, `.json`, `.yaml`, `.xml`, `.html`, `.css`, etc.) treated as `text/plain` |

All other types receive a metadata-only placeholder without a Gemini API call.

## Error Handling

| Failure | Behavior |
|---|---|
| CDN fetch fails (network error, timeout) | Fallback placeholder: `[Attachment: name — description unavailable]` |
| Gemini API error | Fallback placeholder: `[Attachment: name — description unavailable]` |
| File too large (>20MB) | Fallback placeholder: `[Attachment: name (size) — file too large to process]` |
| Unsupported MIME type | Metadata placeholder: `[Attachment: name (size) — unsupported file type]` |
| Multiple attachments, partial failure | `Promise.allSettled` — successful descriptions included, failed ones get placeholders |

Errors are logged but never block the message pipeline. The user's text content is always stored regardless of attachment processing outcomes.

## Testing Strategy

### Unit Tests (`src/tests/unit/attachmentProcessor.test.ts`)

- Validates supported MIME types (accepts `image/png`, rejects `video/mp4`)
- Rejects files over the size limit
- Returns formatted description string on success
- Returns metadata-only placeholder on unsupported types
- Returns fallback placeholder when AI description fails
- Returns fallback placeholder when CDN fetch fails
- Handles empty/missing filename gracefully

### Component Tests (updates to `src/tests/component/messageCreate.test.ts`)

- Message with no attachments works as before (regression)
- Message with one image attachment stores text + description in Redis
- Message with multiple attachments processes all and stores all descriptions
- Failed attachment description doesn't prevent message from being stored
- @mentioned message with attachment includes description in history sent to LLM
- Attachment processor dependency is injectable and mockable

### Integration Tests (`src/tests/integration/attachmentProcessor.integration.test.ts`)

- Real Gemini API call with a small test image (guarded by env var, skipped in CI unless configured)

### Test Helpers

- `mockAttachmentProcessor.ts` — returns canned descriptions, tracks calls

## Change Summary

| Layer | Change |
|---|---|
| **New** `src/services/attachmentProcessor.ts` | Core service: fetch, validate, describe, format |
| **New** `IAIProvider.describeAttachment()` | One new method on the interface |
| **Modified** `GeminiProvider.ts` | Implement `describeAttachment` using `inlineData` parts |
| **Modified** `messageCreate.ts` | Call attachment processor before Redis push |
| **Modified** `MessageCreateDeps` | Add injectable `attachmentProcessor` |
| **Unchanged** `backgroundWorker.ts` | Sees richer text, no code changes |
| **Unchanged** `src/db/schema.sql` | No new tables or columns |
| **Unchanged** `messageGuard.ts` | `[Attachment: ...]` is not a role prefix |
| **New** test files + mock | Unit, component, integration coverage |
