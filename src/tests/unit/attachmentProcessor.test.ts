import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import {
  describeAttachment,
  processAttachments,
  resolveEffectiveMimeType,
  isSupportedMimeType,
  normalizeMimeType,
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
