import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { summarizeChannelsRoutes } from '../../../routes/cron/summarizeChannels.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 3: Channel Summarizer', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', summarizeChannelsRoutes);
  });

  it('summarizes channels with enough messages', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ server_id: 's1', channel_id: 'c1', msg_count: 25, earliest: '2026-03-28T00:00:00Z', latest: '2026-03-29T00:00:00Z' }],
      rowCount: 1,
    });

    mockRawQuery.mockResolvedValueOnce({
      rows: Array.from({ length: 25 }, (_, i) => ({
        display_name: i % 2 === 0 ? 'Alice' : 'Bob',
        content: `Message ${i} about Docker and Kubernetes`,
        created_at: new Date(2026, 2, 28, i).toISOString(),
      })),
      rowCount: 25,
    });

    const mockProvider = mockGetProvider('gemini-2.5-pro');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      summary: 'Alice and Bob discussed Docker and Kubernetes deployment strategies.',
      topics: ['docker', 'kubernetes'],
      decisions: ['Use Kubernetes for orchestration'],
      openQuestions: [],
      actionItems: ['Alice to set up K8s cluster'],
    }));

    mockRawQuery.mockResolvedValueOnce({ rows: [{ id: 'cs-1' }], rowCount: 1 });

    const res = await app.request('/api/cron/summarize-channels', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summarized).toBe(1);
  });

  it('skips channels with fewer than 10 messages', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ server_id: 's1', channel_id: 'c1', msg_count: 5, earliest: '2026-03-28T00:00:00Z', latest: '2026-03-29T00:00:00Z' }],
      rowCount: 1,
    });

    const res = await app.request('/api/cron/summarize-channels', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summarized).toBe(0);
  });
});
