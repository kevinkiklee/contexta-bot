# Text Attachment MIME Type Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix text file attachments being rejected as "unsupported file type" by stripping MIME parameters before lookup and expanding the text extension allowlist.

**Architecture:** Single-module fix in `src/services/attachmentProcessor.ts`. A new `normalizeMimeType` helper strips parameters and lowercases MIME strings. Applied in `resolveEffectiveMimeType` and `isSupportedMimeType`. The `CODE_EXTENSIONS` set is renamed to `TEXT_LIKE_EXTENSIONS` with additional text file extensions added.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-text-attachment-mime-fix-design.md`

---

### Task 1: Add `normalizeMimeType` helper with tests (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeMimeType`**

Import `normalizeMimeType` from the attachment processor (it won't exist yet), then add a new describe block before the existing `resolveEffectiveMimeType` block.

Update the import at line 4 to include `normalizeMimeType`:

```typescript
import {
  describeAttachment,
  processAttachments,
  resolveEffectiveMimeType,
  isSupportedMimeType,
  normalizeMimeType,
  MAX_FILE_SIZE,
} from '../../services/attachmentProcessor.js';
```

Then add a new describe block before the existing `resolveEffectiveMimeType` block:

```typescript
describe('normalizeMimeType', () => {
  it('strips parameters after semicolon', () => {
    expect(normalizeMimeType('text/plain; charset=utf-8')).toBe('text/plain');
  });

  it('strips parameters from image types', () => {
    expect(normalizeMimeType('image/jpeg; name=photo.jpg')).toBe('image/jpeg');
  });

  it('handles trailing semicolon with no params', () => {
    expect(normalizeMimeType('text/plain;')).toBe('text/plain');
  });

  it('handles multiple semicolon-separated segments', () => {
    expect(normalizeMimeType('text/html; charset=utf-8; boundary=something')).toBe('text/html');
  });

  it('lowercases the MIME type', () => {
    expect(normalizeMimeType('Text/Plain')).toBe('text/plain');
  });

  it('lowercases and strips params combined', () => {
    expect(normalizeMimeType('Image/PNG; Name=foo')).toBe('image/png');
  });

  it('returns already-clean types unchanged', () => {
    expect(normalizeMimeType('application/pdf')).toBe('application/pdf');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — `normalizeMimeType` is not exported from `attachmentProcessor.ts`

- [ ] **Step 3: Implement `normalizeMimeType`**

In `src/services/attachmentProcessor.ts`, add the exported function after the `formatFileSize` helper (before `describeAttachment`):

```typescript
export function normalizeMimeType(raw: string): string {
  const base = raw.split(';')[0].trim();
  return base.toLowerCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All `normalizeMimeType` tests PASS. All pre-existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "feat: add normalizeMimeType helper with tests"
```

---

### Task 2: Apply normalization in `resolveEffectiveMimeType` (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write failing tests for parameterized MIME resolution**

Add these tests inside the existing `describe('resolveEffectiveMimeType', ...)` block:

```typescript
  it('strips MIME parameters before matching', () => {
    expect(resolveEffectiveMimeType('text/plain; charset=utf-8', 'notes.txt')).toBe('text/plain');
  });

  it('strips MIME parameters from image types', () => {
    expect(resolveEffectiveMimeType('image/png; name=photo.png', 'photo.png')).toBe('image/png');
  });

  it('handles mixed-case MIME types', () => {
    expect(resolveEffectiveMimeType('Text/Plain', 'notes.txt')).toBe('text/plain');
  });

  it('returns null for unsupported type even after normalization', () => {
    expect(resolveEffectiveMimeType('video/mp4; codec=h264', 'clip.mp4')).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — the `text/plain; charset=utf-8` test returns `null` instead of `text/plain`

- [ ] **Step 3: Apply normalization in `resolveEffectiveMimeType`**

In `src/services/attachmentProcessor.ts`, replace the body of `resolveEffectiveMimeType`:

```typescript
export function resolveEffectiveMimeType(contentType: string | null, fileName: string): string | null {
  if (contentType && contentType !== 'application/octet-stream') {
    const normalized = normalizeMimeType(contentType);
    if (normalized === 'application/octet-stream') {
      // fall through to extension check below
    } else if (SUPPORTED_IMAGE_TYPES.has(normalized) || SUPPORTED_DOCUMENT_TYPES.has(normalized)) {
      return normalized;
    } else {
      return null;
    }
  }

  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  if (CODE_EXTENSIONS.has(ext)) {
    return 'text/plain';
  }
  return null;
}
```

Note: The `normalized === 'application/octet-stream'` check handles an edge case where a parameterized `application/octet-stream; charset=binary` input would otherwise be treated as unsupported instead of falling through to extension lookup. `CODE_EXTENSIONS` will be renamed in Task 4.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS, including the new parameterized MIME tests and all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "fix: strip MIME parameters in resolveEffectiveMimeType"
```

---

### Task 3: Apply normalization in `isSupportedMimeType` (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write failing tests for parameterized `isSupportedMimeType`**

Add these tests inside the existing `describe('isSupportedMimeType', ...)` block:

```typescript
  it('returns true for parameterized text/plain', () => {
    expect(isSupportedMimeType('text/plain; charset=utf-8')).toBe(true);
  });

  it('returns true for mixed-case image type', () => {
    expect(isSupportedMimeType('Image/PNG')).toBe(true);
  });

  it('returns false for unsupported type even with params', () => {
    expect(isSupportedMimeType('video/mp4; codec=h264')).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — `isSupportedMimeType('text/plain; charset=utf-8')` returns `false`

- [ ] **Step 3: Apply normalization in `isSupportedMimeType`**

In `src/services/attachmentProcessor.ts`, update `isSupportedMimeType`:

```typescript
export function isSupportedMimeType(mimeType: string): boolean {
  const normalized = normalizeMimeType(mimeType);
  return SUPPORTED_IMAGE_TYPES.has(normalized) || SUPPORTED_DOCUMENT_TYPES.has(normalized);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "fix: normalize MIME type in isSupportedMimeType"
```

---

### Task 4: Expand extension allowlist (TDD)

**Files:**
- Modify: `src/services/attachmentProcessor.ts`
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write failing tests for new extensions**

Add these tests inside the existing `describe('resolveEffectiveMimeType', ...)` block:

```typescript
  it('resolves .txt files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, 'message.txt')).toBe('text/plain');
  });

  it('resolves .md files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, 'README.md')).toBe('text/plain');
  });

  it('resolves .csv files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, 'data.csv')).toBe('text/plain');
  });

  it('resolves .log files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, 'app.log')).toBe('text/plain');
  });

  it('resolves .env files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, '.env')).toBe('text/plain');
  });

  it('resolves .gitignore files with null contentType via extension', () => {
    expect(resolveEffectiveMimeType(null, '.gitignore')).toBe('text/plain');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: FAIL — `.txt`, `.md`, `.csv`, `.log`, `.env`, `.gitignore` all return `null`

- [ ] **Step 3: Rename `CODE_EXTENSIONS` → `TEXT_LIKE_EXTENSIONS` and add missing entries**

In `src/services/attachmentProcessor.ts`, replace the `CODE_EXTENSIONS` constant:

```typescript
const TEXT_LIKE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.sh', '.bash',
  '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
  '.sql', '.graphql', '.proto', '.toml', '.ini', '.cfg',
  '.txt', '.md', '.csv', '.log',
  '.env', '.conf', '.properties', '.editorconfig', '.gitignore', '.dockerignore',
]);
```

Update the reference in `resolveEffectiveMimeType` from `CODE_EXTENSIONS.has(ext)` to `TEXT_LIKE_EXTENSIONS.has(ext)`.

**Note on `.env` and dotfiles:** The extension extraction logic uses `fileName.split('.').pop()`. For a file named `.env`, this produces `env`, so the set entry must be `.env`. Let's verify: `'.env'.split('.').pop()` → `'env'`, then `'.' + 'env'` → `'.env'`. Correct — it works.

For `.gitignore`: `'.gitignore'.split('.').pop()` → `'gitignore'`, then `'.' + 'gitignore'` → `'.gitignore'`. Correct.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS, including the new extension tests and all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentProcessor.ts src/tests/unit/attachmentProcessor.test.ts
git commit -m "feat: expand text extension allowlist and rename CODE_EXTENSIONS"
```

---

### Task 5: End-to-end integration test for the original bug scenario

**Files:**
- Modify: `src/tests/unit/attachmentProcessor.test.ts`

- [ ] **Step 1: Write the end-to-end test**

Add a new test inside `describe('describeAttachment', ...)`:

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

- [ ] **Step 2: Run tests to verify the new test passes**

Run: `npx vitest run src/tests/unit/attachmentProcessor.test.ts`
Expected: All tests PASS. This is a green-on-green confirmation that the bug is fixed end-to-end.

- [ ] **Step 3: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: All unit and component tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tests/unit/attachmentProcessor.test.ts
git commit -m "test: add end-to-end test for parameterized MIME type bug fix"
```
