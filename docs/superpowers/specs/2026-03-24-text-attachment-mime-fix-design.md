# Text Attachment MIME Type Fix Design

**Date:** 2026-03-24
**Scope:** Bug fix + hardening of text-based file type resolution in attachment processor

## Problem

When a user sends a `.txt` file (or other common text file) in Discord, the bot responds with an "unsupported file type" placeholder. The LLM then interprets that placeholder and tells the user it cannot read attached files.

### Root Cause

Discord sends MIME types with parameters, e.g., `text/plain; charset=utf-8`. The `resolveEffectiveMimeType` function in `src/services/attachmentProcessor.ts` performs an exact `Set.has()` check against bare types like `text/plain`, which fails on parameterized strings. Since the contentType is neither null nor `application/octet-stream`, the function skips the extension-based fallback and returns `null` (unsupported).

### Secondary Gap

Common text file extensions (`.txt`, `.md`, `.csv`, `.log`) are absent from `CODE_EXTENSIONS`. Even if the extension fallback path ran, these files would still be rejected.

## Design

### 1. MIME Normalization

Extract a shared helper function `normalizeMimeType(raw: string): string` that:

1. Splits on `;` and takes the first segment
2. Trims whitespace
3. Lowercases the result (RFC 2045 — type/subtype is case-insensitive)

This converts `text/plain; charset=utf-8` → `text/plain`, `Image/PNG` → `image/png`, etc.

Apply this normalization in both `resolveEffectiveMimeType` and `isSupportedMimeType` so the exported API is consistent — callers can pass raw Discord contentType strings to either function without pre-processing.

**Important:** The normalized base type (not the original parameterized string) must be returned from `resolveEffectiveMimeType` and passed downstream to `GeminiProvider.describeAttachment`, since Gemini expects clean MIME types in `inlineData.mimeType`.

### 2. Extension Allowlist Expansion

Rename `CODE_EXTENSIONS` to `TEXT_LIKE_EXTENSIONS` to better reflect its purpose. Add missing text file extensions:

| Category | Extensions added |
|---|---|
| Text documents | `.txt`, `.md`, `.csv`, `.log` |
| Config / dotfiles | `.env`, `.conf`, `.properties`, `.editorconfig`, `.gitignore`, `.dockerignore` |

Extensions already present and retained: `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.rb`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.h`, `.cs`, `.swift`, `.kt`, `.sh`, `.bash`, `.json`, `.yaml`, `.yml`, `.xml`, `.html`, `.css`, `.scss`, `.sql`, `.graphql`, `.proto`, `.toml`, `.ini`, `.cfg`.

The extension fallback continues to return `text/plain` for any match when the MIME type is null or `application/octet-stream`.

### 3. What Doesn't Change

| Component | Status |
|---|---|
| `SUPPORTED_IMAGE_TYPES` set | Unchanged |
| `SUPPORTED_DOCUMENT_TYPES` set | Unchanged |
| `describeAttachment` flow (fetch → base64 → Gemini) | Unchanged |
| `processAttachments` function | Unchanged |
| `messageCreate.ts` integration | Unchanged |
| `GeminiProvider.describeAttachment` | Unchanged |
| `IAIProvider` interface | Unchanged |
| Redis storage format | Unchanged |
| Background worker / vector pipeline | Unchanged |

## Testing

### New Unit Tests

- MIME normalization: `text/plain; charset=utf-8` resolves to `text/plain`
- MIME normalization: `image/jpeg; name=photo.jpg` resolves to `image/jpeg`
- MIME normalization edge case: contentType with `;` but no params (e.g., `text/plain;`) resolves to `text/plain`
- MIME normalization edge case: contentType with multiple `;` segments strips all of them
- MIME case folding: `Text/Plain` resolves to `text/plain`
- `isSupportedMimeType` accepts parameterized and mixed-case input (e.g., `text/plain; charset=utf-8` → `true`)
- Expanded extensions: `.txt` file with null contentType resolves to `text/plain`
- Expanded extensions: `.md`, `.log`, `.env`, `.gitignore` all resolve to `text/plain`
- End-to-end: `.txt` file with `text/plain; charset=utf-8` contentType produces a description (not "unsupported")

### Existing Tests

All existing unit and component tests must continue to pass. The changes are purely additive — no behavior changes for previously supported types.

## Change Summary

| File | Change |
|---|---|
| `src/services/attachmentProcessor.ts` | Add `normalizeMimeType` helper; apply in `resolveEffectiveMimeType` and `isSupportedMimeType`; rename `CODE_EXTENSIONS` → `TEXT_LIKE_EXTENSIONS`; add missing text extensions |
| `src/tests/unit/attachmentProcessor.test.ts` | New test cases for MIME stripping and expanded extensions |
