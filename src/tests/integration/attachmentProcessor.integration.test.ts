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
