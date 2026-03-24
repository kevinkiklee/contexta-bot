# Multimodal Attachment Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the bot to process images and documents shared in Discord chat, describe them via Gemini, and store those descriptions in the existing text-based memory pipeline.

**Architecture:** A new `attachmentProcessor` service fetches attachment bytes from Discord CDN, sends them inline (base64) to Gemini for description, and returns formatted text strings. The message handler appends these strings to the user's message before writing to Redis. All downstream systems (conversation LLM, background worker, vector DB) consume the richer text without code changes.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), Vitest 4.x, discord.js v14, `@google/genai` (Gemini), Redis.

---

## File Structure

| File | Responsibility |
|---|---|
| **Create:** `src/services/attachmentProcessor.ts` | MIME validation, CDN fetch, Gemini description, formatting, error handling |
| **Create:** `src/tests/unit/attachmentProcessor.test.ts` | Unit tests for the attachment processor |
| **Create:** `src/tests/helpers/mockAttachmentProcessor.ts` | Mock for component tests |
| **Modify:** `src/llm/IAIProvider.ts` | Add `describeAttachment()` method to the interface |
| **Modify:** `src/llm/GeminiProvider.ts` | Implement `describeAttachment()` using `inlineData` |
| **Modify:** `src/tests/helpers/mockAIProvider.ts` | Add `describeAttachment` stub |
| **Modify:** `src/events/messageCreate.ts` | Call attachment processor, update `MessageCreateDeps` |
| **Modify:** `src/tests/helpers/mockDiscord.ts` | Add `attachments` to `createMockMessage` |
| **Modify:** `src/tests/component/messageCreate.test.ts` | Add attachment-related component tests |

---

## Task 1: Add `describeAttachment` to `IAIProvider` and Mock

**Files:**
- Modify: `src/llm/IAIProvider.ts:5-37`
- Modify: `src/tests/helpers/mockAIProvider.ts:1-12`

- [ ] **Step 1: Add `describeAttachment` to the IAIProvider interface**

In `src/llm/IAIProvider.ts`, add the new method after `createServerContextCache` (before the closing `}`):

```typescript
  /**
   * Describes an image or document attachment for context in conversation.
   * @param mimeType The MIME type of the attachment.
   * @param base64Data The base64-encoded binary data.
   * @param fileName The original filename.
   */
  describeAttachment(
    mimeType: string,
    base64Data: string,
    fileName: string
  ): Promise<string>;
```

- [ ] **Step 2: Add `describeAttachment` to the mock AI provider**

In `src/tests/helpers/mockAIProvider.ts`, add to the returned object (before `...overrides`):

```typescript
    describeAttachment: vi.fn().mockResolvedValue('A test image showing a blue square on a white background'),
```

- [ ] **Step 3: Verify the project compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Compilation error in `GeminiProvider.ts` only — it doesn't implement `describeAttachment` yet. That's expected and will be fixed in Task 2.

- [ ] **Step 4: Run existing tests to confirm nothing else broke**

Run: `npm test`
Expected: All 63 existing tests pass (the mock already satisfies the interface).

- [ ] **Step 5: Commit**

```bash
git add src/llm/IAIProvider.ts src/tests/helpers/mockAIProvider.ts
git commit -m "feat: add describeAttachment to IAIProvider interface and mock"
```

---

## Task 2: Implement `describeAttachment` in GeminiProvider

**Files:**
- Modify: `src/llm/GeminiProvider.ts:55-61`

- [ ] **Step 1: Implement `describeAttachment` in GeminiProvider**

In `src/llm/GeminiProvider.ts`, add after the `createServerContextCache` method (before the closing `}`):

```typescript
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
```

- [ ] **Step 2: Verify the project compiles cleanly**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All 63 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/llm/GeminiProvider.ts
git commit -m "feat: implement describeAttachment in GeminiProvider using inlineData"
```

---

## Task 3: Build the Attachment Processor Service (Tests First)

**Files:**
- Create: `src/services/attachmentProcessor.ts`
- Create: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Create the attachment processor module**

Create `src/services/attachmentProcessor.ts`:

```typescript
import type { IAIProvider } from '../llm/IAIProvider.js';

export interface AttachmentInfo {
  url: string;
  name: string;
  contentType: string | null;
  size: number;
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const SUPPORTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
  '.sql', '.graphql', '.proto', '.toml', '.ini', '.cfg',
]);

export function resolveEffectiveMimeType(contentType: string | null, fileName: string): string | null {
  if (contentType && contentType !== 'application/octet-stream') {
    if (SUPPORTED_IMAGE_TYPES.has(contentType) || SUPPORTED_DOCUMENT_TYPES.has(contentType)) {
      return contentType;
    }
    return null;
  }

  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  if (CODE_EXTENSIONS.has(ext)) {
    return 'text/plain';
  }
  return null;
}

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType) || SUPPORTED_DOCUMENT_TYPES.has(mimeType);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function describeAttachment(
  ai: IAIProvider,
  attachment: AttachmentInfo,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<string> {
  const name = attachment.name || 'unknown';

  if (attachment.size > MAX_FILE_SIZE) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — file too large to process]`;
  }

  const effectiveMime = resolveEffectiveMimeType(attachment.contentType, name);
  if (!effectiveMime) {
    return `[Attachment: ${name} (${formatFileSize(attachment.size)}) — unsupported file type]`;
  }

  let base64Data: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetchFn(attachment.url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    base64Data = buffer.toString('base64');
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to fetch ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }

  try {
    const description = await ai.describeAttachment(effectiveMime, base64Data, name);
    return `[Attachment: ${name} — ${description}]`;
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to describe ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }
}

export async function processAttachments(
  ai: IAIProvider,
  attachments: AttachmentInfo[],
  fetchFn: typeof fetch = globalThis.fetch
): Promise<string> {
  if (attachments.length === 0) return '';

  const results = await Promise.allSettled(
    attachments.map(att => describeAttachment(ai, att, fetchFn))
  );

  return results
    .map(r => r.status === 'fulfilled' ? r.value : `[Attachment: unknown — description unavailable]`)
    .join(' ');
}
```

- [ ] **Step 2: Write the unit tests**

Create `src/tests/unit/attachmentProcessor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import {
  describeAttachment,
  processAttachments,
  resolveEffectiveMimeType,
  isSupportedMimeType,
  MAX_FILE_SIZE,
} from '../../services/attachmentProcessor.js';
import type { AttachmentInfo } from '../../services/attachmentProcessor.js';

function makeAttachment(overrides?: Partial<AttachmentInfo>): AttachmentInfo {
  return {
    url: 'https://cdn.discordapp.com/attachments/123/456/photo.png',
    name: 'photo.png',
    contentType: 'image/png',
    size: 1024,
    ...overrides,
  };
}

function mockFetchOk(base64Content = 'iVBORw0KGgo='): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from(base64Content, 'base64')),
  });
}

function mockFetchFail(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('Network error'));
}

describe('resolveEffectiveMimeType', () => {
  it('returns supported image MIME type as-is', () => {
    expect(resolveEffectiveMimeType('image/png', 'photo.png')).toBe('image/png');
  });

  it('returns supported document MIME type as-is', () => {
    expect(resolveEffectiveMimeType('application/pdf', 'doc.pdf')).toBe('application/pdf');
  });

  it('returns null for unsupported MIME type', () => {
    expect(resolveEffectiveMimeType('video/mp4', 'clip.mp4')).toBeNull();
  });

  it('falls back to extension for application/octet-stream', () => {
    expect(resolveEffectiveMimeType('application/octet-stream', 'main.ts')).toBe('text/plain');
  });

  it('falls back to extension for null contentType', () => {
    expect(resolveEffectiveMimeType(null, 'config.json')).toBe('text/plain');
  });

  it('returns null for unknown extension with generic MIME', () => {
    expect(resolveEffectiveMimeType('application/octet-stream', 'data.bin')).toBeNull();
  });
});

describe('isSupportedMimeType', () => {
  it('returns true for image/png', () => {
    expect(isSupportedMimeType('image/png')).toBe(true);
  });

  it('returns true for application/pdf', () => {
    expect(isSupportedMimeType('application/pdf')).toBe(true);
  });

  it('returns false for video/mp4', () => {
    expect(isSupportedMimeType('video/mp4')).toBe(false);
  });
});

describe('describeAttachment', () => {
  let ai: ReturnType<typeof createMockAIProvider>;

  beforeEach(() => {
    ai = createMockAIProvider();
  });

  it('returns formatted description on success', async () => {
    const result = await describeAttachment(ai, makeAttachment(), mockFetchOk());
    expect(result).toBe('[Attachment: photo.png — A test image showing a blue square on a white background]');
    expect(ai.describeAttachment).toHaveBeenCalledWith('image/png', expect.any(String), 'photo.png');
  });

  it('returns size placeholder for files over the limit', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ size: MAX_FILE_SIZE + 1 }),
      mockFetchOk()
    );
    expect(result).toContain('file too large to process');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('returns unsupported placeholder for unknown MIME types', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'video/mp4', name: 'clip.mp4' }),
      mockFetchOk()
    );
    expect(result).toContain('unsupported file type');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('returns fallback placeholder when CDN fetch fails', async () => {
    const result = await describeAttachment(ai, makeAttachment(), mockFetchFail());
    expect(result).toBe('[Attachment: photo.png — description unavailable]');
  });

  it('returns fallback placeholder when AI description fails', async () => {
    ai.describeAttachment = vi.fn().mockRejectedValue(new Error('API error'));
    const result = await describeAttachment(ai, makeAttachment(), mockFetchOk());
    expect(result).toBe('[Attachment: photo.png — description unavailable]');
  });

  it('handles empty filename gracefully', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ name: '', contentType: 'image/png' }),
      mockFetchOk()
    );
    expect(result).toContain('[Attachment:');
  });

  it('resolves code files with generic MIME via extension', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'application/octet-stream', name: 'index.ts' }),
      mockFetchOk()
    );
    expect(result).toContain('[Attachment: index.ts —');
    expect(ai.describeAttachment).toHaveBeenCalledWith('text/plain', expect.any(String), 'index.ts');
  });
});

describe('processAttachments', () => {
  let ai: ReturnType<typeof createMockAIProvider>;

  beforeEach(() => {
    ai = createMockAIProvider();
  });

  it('returns empty string for no attachments', async () => {
    const result = await processAttachments(ai, []);
    expect(result).toBe('');
  });

  it('returns single description for one attachment', async () => {
    const result = await processAttachments(ai, [makeAttachment()], mockFetchOk());
    expect(result).toContain('[Attachment: photo.png');
  });

  it('returns space-separated descriptions for multiple attachments', async () => {
    const attachments = [
      makeAttachment({ name: 'a.png' }),
      makeAttachment({ name: 'b.png' }),
    ];
    const result = await processAttachments(ai, attachments, mockFetchOk());
    expect(result).toContain('[Attachment: a.png');
    expect(result).toContain('[Attachment: b.png');
  });

  it('includes placeholders for partial failures', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('data')) })
      .mockRejectedValueOnce(new Error('fail'));

    const attachments = [
      makeAttachment({ name: 'good.png' }),
      makeAttachment({ name: 'bad.png' }),
    ];
    const result = await processAttachments(ai, attachments, fetchFn as unknown as typeof fetch);
    expect(result).toContain('[Attachment: good.png');
    expect(result).toContain('description unavailable');
  });
});
```

- [ ] **Step 3: Run the unit tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "feat: add attachment processor service with unit tests"
```

---

## Task 4: Create the Mock Attachment Processor Helper

**Files:**
- Create: `src/tests/helpers/mockAttachmentProcessor.ts`

- [ ] **Step 1: Create the mock attachment processor**

Create `src/tests/helpers/mockAttachmentProcessor.ts`:

```typescript
import { vi } from 'vitest';

export function createMockAttachmentProcessor() {
  return {
    processAttachments: vi.fn().mockResolvedValue(''),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tests/helpers/mockAttachmentProcessor.ts
git commit -m "feat: add mock attachment processor test helper"
```

---

## Task 5: Integrate Attachment Processor into Message Handler

**Files:**
- Modify: `src/events/messageCreate.ts:1-80`
- Modify: `src/tests/helpers/mockDiscord.ts:30-44`

- [ ] **Step 1: Update `MessageCreateDeps` and the handler to process attachments**

In `src/events/messageCreate.ts`, make these changes:

Add the import at the top (after existing imports):

```typescript
import { processAttachments } from '../services/attachmentProcessor.js';
import type { AttachmentInfo } from '../services/attachmentProcessor.js';
```

Update the `MessageCreateDeps` interface to add the attachment processor:

```typescript
export interface MessageCreateDeps {
  ai: IAIProvider;
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
  };
  processAttachments: (ai: IAIProvider, attachments: AttachmentInfo[]) => Promise<string>;
}
```

Update the `defaultDeps` to include the real implementation:

```typescript
const defaultDeps: MessageCreateDeps = {
  ai: new GeminiProvider(),
  redis: redisClient as unknown as MessageCreateDeps['redis'],
  processAttachments,
};
```

In the `execute` function, replace the section between `formatUserMessage` and `rPush` (lines 36-39):

```typescript
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
      formattedMessage += ' ' + descriptions;
    }
  }

  const redisKey = `channel:${channelId}:history`;
```

- [ ] **Step 2: Update `createMockMessage` to include an `attachments` collection**

In `src/tests/helpers/mockDiscord.ts`, add `attachments` to the `createMockMessage` return object (before `...overrides`):

```typescript
    attachments: new Map(),
```

This is a `Map` (matches discord.js `Collection` for `.size` and `.values()`) that defaults to empty. Tests that need attachments pass them via overrides.

- [ ] **Step 3: Run existing tests (runtime only — type errors fixed in Task 6)**

Run: `npm test`
Expected: All existing tests still pass at runtime (Vitest uses esbuild which strips types). The `{ ai, redis }` deps objects in the component tests are missing the new `processAttachments` field, so `npx tsc --noEmit` will report type errors — that is expected and will be fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/events/messageCreate.ts src/tests/helpers/mockDiscord.ts
git commit -m "feat: integrate attachment processor into message handler"
```

---

## Task 6: Update Component Tests for Attachment Support

**Files:**
- Modify: `src/tests/component/messageCreate.test.ts:1-133`

- [ ] **Step 1: Update existing test setup to include `processAttachments` in deps**

In `src/tests/component/messageCreate.test.ts`, add the import at the top:

```typescript
import { createMockAttachmentProcessor } from '../helpers/mockAttachmentProcessor.js';
```

Update the `beforeEach` block to create the mock and add a `processAttachments` variable:

```typescript
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;
  let attachmentProcessor: ReturnType<typeof createMockAttachmentProcessor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    ai = createMockAIProvider();
    redis = createMockRedis();
    attachmentProcessor = createMockAttachmentProcessor();
  });
```

Update **every** `execute(message, { ai, redis })` call in the file to include the mock:

```typescript
execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments })
```

Also update the `failingAI` test to include it:

```typescript
execute(message, { ai: failingAI, redis, processAttachments: attachmentProcessor.processAttachments })
```

- [ ] **Step 2: Run existing tests to confirm regression safety**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: All 8 existing tests pass with the updated deps.

- [ ] **Step 3: Add new component tests for attachment handling**

Append to the `describe('messageCreate handler', ...)` block in `src/tests/component/messageCreate.test.ts`:

```typescript
  it('calls processAttachments and appends result to Redis for message with attachment', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('[Attachment: photo.png — A blue square]');
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/photo.png', name: 'photo.png', contentType: 'image/png', size: 1024 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    expect(attachmentProcessor.processAttachments).toHaveBeenCalledWith(
      ai,
      [expect.objectContaining({ name: 'photo.png', contentType: 'image/png' })]
    );
    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[Attachment: photo.png — A blue square]')
    );
  });

  it('stores message text only when attachment processing returns empty string', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('');
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/bad.zip', name: 'bad.zip', contentType: 'application/zip', size: 500 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const storedMsg = redis.rPush.mock.calls[0][1] as string;
    expect(storedMsg).toContain('[User: TestUser]');
    expect(storedMsg).not.toContain('[Attachment:');
  });

  it('processes multiple attachments and appends all descriptions', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue(
      '[Attachment: a.png — First image] [Attachment: b.pdf — A document]'
    );
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/a.png', name: 'a.png', contentType: 'image/png', size: 1024 }],
        ['att-2', { url: 'https://cdn.example.com/b.pdf', name: 'b.pdf', contentType: 'application/pdf', size: 2048 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const storedMsg = redis.rPush.mock.calls[0][1] as string;
    expect(storedMsg).toContain('[Attachment: a.png');
    expect(storedMsg).toContain('[Attachment: b.pdf');
  });

  it('does not call processAttachments when message has no attachments', async () => {
    const message = createMockMessage();

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    expect(attachmentProcessor.processAttachments).not.toHaveBeenCalled();
  });

  it('includes attachment descriptions in LLM history when mentioned', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('[Attachment: error.png — A stack trace]');
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/error.png', name: 'error.png', contentType: 'image/png', size: 512 }],
      ]),
    });
    redis.lRange.mockResolvedValue([
      '[User: TestUser]: help me [Attachment: error.png — A stack trace]',
    ]);

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const chatHistory = vi.mocked(ai.generateChatResponse).mock.calls[0][1];
    expect(chatHistory[0].parts[0].text).toContain('[Attachment: error.png');
  });
```

- [ ] **Step 4: Run the component tests**

Run: `npx vitest run src/tests/component/messageCreate.test.ts`
Expected: All tests pass (8 existing + 5 new = 13 total).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/tests/component/messageCreate.test.ts
git commit -m "feat: add component tests for attachment processing in message handler"
```

---

## Task 7: Add Integration Test (Skipped in CI)

**Files:**
- Create: `src/tests/integration/attachmentProcessor.integration.test.ts`

- [ ] **Step 1: Create the integration test**

Create `src/tests/integration/attachmentProcessor.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../llm/GeminiProvider.js';
import { describeAttachment } from '../../services/attachmentProcessor.js';

const SKIP = !process.env.GEMINI_API_KEY;

describe.skipIf(SKIP)('attachmentProcessor integration', () => {
  it('describes a small PNG image via real Gemini API', async () => {
    const ai = new GeminiProvider();

    // 1x1 red PNG pixel (base64)
    const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(redPixelBase64, 'base64');

    const attachment = {
      url: `data:image/png;base64,${redPixelBase64}`,
      name: 'red-pixel.png',
      contentType: 'image/png',
      size: pngBuffer.length,
    };

    const mockFetch = async () => ({
      ok: true,
      arrayBuffer: () => Promise.resolve(pngBuffer),
    }) as unknown as Response;

    const result = await describeAttachment(ai, attachment, mockFetch);

    expect(result).toMatch(/^\[Attachment: red-pixel\.png — .+\]$/);
    expect(result).not.toContain('description unavailable');
    expect(result).not.toContain('unsupported');
  }, 30_000);
});
```

- [ ] **Step 2: Run the integration test (requires `GEMINI_API_KEY` in env)**

Run: `npx vitest run src/tests/integration/attachmentProcessor.integration.test.ts`
Expected: If `GEMINI_API_KEY` is set, the test passes. If not, the test is skipped.

- [ ] **Step 3: Commit**

```bash
git add src/tests/integration/attachmentProcessor.integration.test.ts
git commit -m "feat: add integration test for attachment processor with real Gemini API"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify no linter issues in changed files**

Check linter output for the modified/created files.

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: Working tree clean, all changes committed.
