# Text Attachment Raw Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Text-based file attachments store raw content instead of lossy LLM summaries, preserving all details for follow-up questions.

**Architecture:** In `describeAttachment`, branch after fetch: `text/*` types decode buffer as UTF-8 and return raw content (truncated at 4000 chars); `image/*` and `application/pdf` continue through the existing Gemini description path.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-text-attachment-raw-content-design.md`

---

### Task 1: Add `isTextMimeType` helper and `MAX_TEXT_LENGTH` constant with tests (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write failing tests for `isTextMimeType`**

Update the import in `src/tests/unit/attachmentProcessor.test.ts` to include `isTextMimeType` and `MAX_TEXT_LENGTH`:

```typescript
import {
  describeAttachment,
  processAttachments,
  resolveEffectiveMimeType,
  isSupportedMimeType,
  normalizeMimeType,
  isTextMimeType,
  MAX_FILE_SIZE,
  MAX_TEXT_LENGTH,
} from '../../services/attachmentProcessor.js';
```

Add a new describe block after the `isSupportedMimeType` block:

```typescript
describe('isTextMimeType', () => {
  it('returns true for text/plain', () => {
    expect(isTextMimeType('text/plain')).toBe(true);
  });

  it('returns true for text/csv', () => {
    expect(isTextMimeType('text/csv')).toBe(true);
  });

  it('returns true for text/markdown', () => {
    expect(isTextMimeType('text/markdown')).toBe(true);
  });

  it('returns false for image/png', () => {
    expect(isTextMimeType('image/png')).toBe(false);
  });

  it('returns false for application/pdf', () => {
    expect(isTextMimeType('application/pdf')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — `isTextMimeType` is not exported

- [ ] **Step 3: Implement `isTextMimeType` and `MAX_TEXT_LENGTH`**

In `src/services/attachmentProcessor.ts`, add after `MAX_FILE_SIZE`:

```typescript
export const MAX_TEXT_LENGTH = 4000;
```

Add `isTextMimeType` after `normalizeMimeType`:

```typescript
export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "feat: add isTextMimeType helper and MAX_TEXT_LENGTH constant"
```

---

### Task 2: Implement raw text path in `describeAttachment` with tests (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Add a text-content mock helper to the test file**

Add after the existing `mockFetchFail` helper (around line 31):

```typescript
function mockFetchText(content: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from(content, 'utf-8')),
  });
}
```

- [ ] **Step 2: Write failing tests for the raw text path**

Add these tests inside the existing `describe('describeAttachment', ...)` block:

```typescript
  it('returns raw text content for text/plain files without calling AI', async () => {
    const textContent = 'Hello from the text file';
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'text/plain', name: 'notes.txt', size: 100 }),
      mockFetchText(textContent)
    );
    expect(result).toBe('[Attachment: notes.txt — Hello from the text file]');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('returns raw text content for text/csv files without calling AI', async () => {
    const csvContent = 'name,age\nAlice,30\nBob,25';
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'text/csv', name: 'data.csv', size: 100 }),
      mockFetchText(csvContent)
    );
    expect(result).toBe('[Attachment: data.csv — name,age\nAlice,30\nBob,25]');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('truncates text content exceeding MAX_TEXT_LENGTH', async () => {
    const longContent = 'x'.repeat(5000);
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'text/plain', name: 'big.txt', size: 5000 }),
      mockFetchText(longContent)
    );
    expect(result).toContain('[Attachment: big.txt — ');
    expect(result).toContain('[truncated]');
    expect(result).toContain(']');
    const inner = result.slice('[Attachment: big.txt — '.length, result.lastIndexOf(']'));
    expect(inner.replace(' [truncated]', '').length).toBe(MAX_TEXT_LENGTH);
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('does not truncate text content at exactly MAX_TEXT_LENGTH', async () => {
    const exactContent = 'y'.repeat(MAX_TEXT_LENGTH);
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'text/plain', name: 'exact.txt', size: MAX_TEXT_LENGTH }),
      mockFetchText(exactContent)
    );
    expect(result).not.toContain('[truncated]');
    expect(result).toBe(`[Attachment: exact.txt — ${exactContent}]`);
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });

  it('still sends image files to AI for description', async () => {
    const result = await describeAttachment(ai, makeAttachment(), mockFetchOk());
    expect(result).toBe('[Attachment: photo.png — A test image showing a blue square on a white background]');
    expect(ai.describeAttachment).toHaveBeenCalledWith('image/png', expect.any(String), 'photo.png');
  });

  it('still sends PDF files to AI for description', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'application/pdf', name: 'doc.pdf' }),
      mockFetchOk()
    );
    expect(result).toContain('[Attachment: doc.pdf —');
    expect(ai.describeAttachment).toHaveBeenCalledWith('application/pdf', expect.any(String), 'doc.pdf');
  });
```

- [ ] **Step 3: Run tests to verify the new text-path tests fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — the raw text tests fail because `describeAttachment` still sends text files to Gemini. The image/PDF regression tests should pass.

- [ ] **Step 4: Implement the raw text branch in `describeAttachment`**

In `src/services/attachmentProcessor.ts`, replace the section of `describeAttachment` from the buffer fetch through the AI call. After the fetch try/catch block that produces `buffer` (currently producing `base64Data`), replace:

```typescript
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
```

With:

```typescript
  let buffer: Buffer;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetchFn(attachment.url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to fetch ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }

  if (isTextMimeType(effectiveMime)) {
    let text = buffer.toString('utf-8');
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + ' [truncated]';
    }
    return `[Attachment: ${name} — ${text}]`;
  }

  try {
    const base64Data = buffer.toString('base64');
    const description = await ai.describeAttachment(effectiveMime, base64Data, name);
    return `[Attachment: ${name} — ${description}]`;
  } catch (err) {
    console.error(`[attachmentProcessor] Failed to describe ${name}:`, err);
    return `[Attachment: ${name} — description unavailable]`;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: The new tests pass. Some existing tests may fail — see Task 3.

- [ ] **Step 6: Commit (if all tests pass; if some existing tests need updating, do that first in Task 3)**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "feat: use raw text content for text-based attachments"
```

---

### Task 3: Update existing tests affected by the text path change

**Files:**
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

Two existing tests assert `ai.describeAttachment` is called for text files. After the raw text path, these need updating:

- [ ] **Step 1: Update the code-file-via-extension test (line ~209)**

The test `'resolves code files with generic MIME via extension'` sends `index.ts` with `application/octet-stream`. The effective MIME resolves to `text/plain`, which now takes the raw text path. Update:

Find:
```typescript
  it('resolves code files with generic MIME via extension', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'application/octet-stream', name: 'index.ts' }),
      mockFetchOk()
    );
    expect(result).toContain('[Attachment: index.ts —');
    expect(ai.describeAttachment).toHaveBeenCalledWith('text/plain', expect.any(String), 'index.ts');
  });
```

Replace with:
```typescript
  it('resolves code files with generic MIME via extension using raw text', async () => {
    const codeContent = 'const x = 42;';
    const result = await describeAttachment(
      ai,
      makeAttachment({ contentType: 'application/octet-stream', name: 'index.ts' }),
      mockFetchText(codeContent)
    );
    expect(result).toBe('[Attachment: index.ts — const x = 42;]');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Update the parameterized MIME bug test (line ~219)**

The test `'describes .txt file with parameterized MIME type (original bug)'` asserts `ai.describeAttachment` is called. Update:

Find:
```typescript
  it('describes .txt file with parameterized MIME type (original bug)', async () => {
    const result = await describeAttachment(
      ai,
      makeAttachment({
        contentType: 'text/plain; charset=utf-8',
        name: 'message.txt',
        size: 512,
      }),
      mockFetchOk()
    );
    expect(result).toContain('[Attachment: message.txt —');
    expect(result).not.toContain('unsupported');
    expect(ai.describeAttachment).toHaveBeenCalledWith('text/plain', expect.any(String), 'message.txt');
  });
```

Replace with:
```typescript
  it('returns raw content for .txt file with parameterized MIME type (original bug)', async () => {
    const textContent = 'Hello from the message file';
    const result = await describeAttachment(
      ai,
      makeAttachment({
        contentType: 'text/plain; charset=utf-8',
        name: 'message.txt',
        size: 512,
      }),
      mockFetchText(textContent)
    );
    expect(result).toBe('[Attachment: message.txt — Hello from the message file]');
    expect(result).not.toContain('unsupported');
    expect(ai.describeAttachment).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run all tests to verify everything passes**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All unit and component tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tests/unit/attachmentProcessor.test.ts
git commit -m "test: update existing tests for raw text path behavior"
```
