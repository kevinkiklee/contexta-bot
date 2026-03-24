# Text Attachment Raw Content Ingestion Design

**Date:** 2026-03-24
**Scope:** Quality improvement — use raw text content instead of LLM summary for text-based file attachments

## Problem

When a text file is attached, the bot sends it to Gemini to "describe" it, producing a lossy summary. Details are dropped — e.g., "Charlie owns the landing page copy" becomes "a new onboarding flow launches April 1st." When users ask follow-up questions about specific details from the file, the bot can't answer because those details aren't in the stored description.

Summarization makes sense for images (pixels can't be stored as text) and PDFs (binary format). For text files, the raw content *is* the best representation — no LLM call needed.

## Design

### Branch on MIME Type in `describeAttachment`

After fetching the file buffer, check if the effective MIME type is text-based (`text/*`). If so, decode the buffer as UTF-8 and return the raw content directly. If not (`image/*`, `application/pdf`), continue with the existing Gemini description path.

Decision logic:

```
effectiveMime starts with "text/" → raw text path
effectiveMime is "application/pdf" → Gemini description path
effectiveMime starts with "image/" → Gemini description path
```

This covers all currently supported types:
- `text/plain`, `text/csv`, `text/markdown` → raw text (also all extension-resolved files, which get `text/plain`)
- `image/png`, `image/jpeg`, `image/gif`, `image/webp` → Gemini
- `application/pdf` → Gemini

### Truncation

Raw text content is capped at 4000 characters. If truncated, a `[truncated]` indicator is appended before the closing bracket.

4000 characters (~1000 tokens) preserves enough detail for most shared files while keeping individual messages reasonable within the 50-message Redis window. Gemini 2.5 Flash's 1M-token context window means even worst-case scenarios (many large text attachments in history) stay well within limits.

### Output Format

**Text file (short, under limit):**
```
[Attachment: notes.txt — Meeting Notes — March 24, 2026\nAttendees: Alice, Bob, Charlie\n1. Charlie owns the landing page copy.]
```

**Text file (truncated):**
```
[Attachment: bigfile.log — Line 1 of the log\nLine 2 of the log\n... [truncated]]
```

**Image (unchanged):**
```
[Attachment: screenshot.png — A VS Code editor showing a red squiggly under a variable]
```

### What Changes

| Component | Change |
|---|---|
| `describeAttachment` in `src/services/attachmentProcessor.ts` | After fetch, branch: text files → decode UTF-8 + truncate; others → base64 + Gemini (existing) |

### What Doesn't Change

| Component | Status |
|---|---|
| `resolveEffectiveMimeType` | Unchanged |
| `isSupportedMimeType` | Unchanged |
| `normalizeMimeType` | Unchanged |
| `processAttachments` | Unchanged |
| `IAIProvider` / `GeminiProvider` | Unchanged |
| `messageCreate.ts` | Unchanged |
| Redis format (bracketed `[Attachment: ...]`) | Unchanged structure |
| Error handling (fetch fail, size limit, unsupported) | Unchanged |

### New Export

A `MAX_TEXT_LENGTH` constant (4000) exported for testability.

A helper `isTextMimeType(mimeType: string): boolean` that returns `true` when the MIME type starts with `text/`. Exported for testability and reuse.

## Testing

### New Unit Tests

- Text file returns raw content (not sent to Gemini)
- Text file content is decoded as UTF-8
- Text file over 4000 chars is truncated with `[truncated]` indicator
- Text file at exactly 4000 chars is not truncated
- `ai.describeAttachment` is NOT called for text files
- Image file still goes through Gemini (regression)
- PDF file still goes through Gemini (regression)
- `isTextMimeType` returns true for `text/plain`, `text/csv`, `text/markdown`
- `isTextMimeType` returns false for `image/png`, `application/pdf`

### Existing Tests

All existing tests must continue to pass. The image and PDF paths are unchanged.
