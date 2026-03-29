import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCachesCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ name: 'cachedContents/test-123' }));
const mockModelsGenerateContent = vi.hoisted(() => vi.fn().mockResolvedValue({ text: 'cached response' }));
const mockModelsEmbedContent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    embeddings: [{ values: new Array(768).fill(0.1) }],
  })
);

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    caches = { create: mockCachesCreate };
    models = {
      generateContent: mockModelsGenerateContent,
      embedContent: mockModelsEmbedContent,
    };
  },
}));

import { GeminiProvider } from '../../llm/GeminiProvider.js';

describe('GeminiProvider context caching', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider('gemini-2.5-flash');
  });

  it('creates a real cache via ai.caches.create', async () => {
    const cacheId = await provider.createServerContextCache('Server lore text', 30);
    expect(mockCachesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        config: expect.objectContaining({
          ttl: '1800s',
        }),
      })
    );
    expect(cacheId).toBe('cachedContents/test-123');
  });

  it('uses cachedContent instead of systemInstruction when cacheId provided', async () => {
    await provider.generateChatResponse(
      'system prompt',
      [{ role: 'user', parts: [{ text: 'hello' }] }],
      { cacheId: 'cachedContents/test-123' }
    );
    const callArgs = mockModelsGenerateContent.mock.calls[0][0];
    expect(callArgs.config.cachedContent).toBe('cachedContents/test-123');
    expect(callArgs.config.systemInstruction).toBeUndefined();
  });

  it('uses systemInstruction when no cacheId provided', async () => {
    await provider.generateChatResponse(
      'system prompt',
      [{ role: 'user', parts: [{ text: 'hello' }] }]
    );
    const callArgs = mockModelsGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toBe('system prompt');
    expect(callArgs.config.cachedContent).toBeUndefined();
  });
});
