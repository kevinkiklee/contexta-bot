import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { tagMessagesRoutes } from '../../../routes/cron/tagMessages.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 1: Message Tagger', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', tagMessagesRoutes);
  });

  it('tags untagged messages in batch', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', content: 'We should use Redis for caching', display_name: 'Alice' },
        { id: 'msg-2', content: 'lol nice', display_name: 'Bob' },
      ],
      rowCount: 2,
    } as any);

    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify([
      { index: 0, topics: ['redis', 'caching'], isDecision: false, isActionItem: false, isReference: false, confidence: 0.8 },
      { index: 1, topics: [], isDecision: false, isActionItem: false, isReference: false, confidence: 0.1 },
    ]));

    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(2);

    expect(mockRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('tags IS NULL'),
      expect.any(Array)
    );
  });

  it('handles empty batch gracefully', async () => {
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(0);
  });

  it('continues on individual message errors', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'msg-1', content: 'test', display_name: 'Alice' }],
      rowCount: 1,
    } as any);

    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockRejectedValueOnce(new Error('LLM failed'));

    const res = await app.request('/api/cron/tag-messages', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.errors).toHaveLength(1);
  });
});
