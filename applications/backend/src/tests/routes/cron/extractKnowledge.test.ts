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
import { extractKnowledgeRoutes } from '../../../routes/cron/extractKnowledge.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 2: Knowledge Extractor', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', extractKnowledgeRoutes);
  });

  it('extracts knowledge from conversation chunks', async () => {
    // Tagged messages with signals
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', server_id: 's1', channel_id: 'c1', display_name: 'Alice', content: 'We decided to use Redis for caching', created_at: '2026-03-29T10:00:00Z', tags: { topics: ['redis', 'caching'], isDecision: true, isActionItem: false, isReference: false, confidence: 0.9 } },
        { id: 'msg-2', server_id: 's1', channel_id: 'c1', display_name: 'Bob', content: 'Agreed, Redis it is', created_at: '2026-03-29T10:05:00Z', tags: { topics: ['redis'], isDecision: true, isActionItem: false, isReference: false, confidence: 0.8 } },
      ],
      rowCount: 2,
    } as any);

    // Existing entries for linking
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'ke-existing', title: 'Caching strategy discussion', type: 'topic' }],
      rowCount: 1,
    } as any);

    // LLM extraction response
    const mockProvider = mockGetProvider('gemini-2.5-pro');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify([
      {
        type: 'decision',
        title: 'Redis chosen for caching',
        content: 'The team decided to use Redis for the caching layer.',
        confidence: 0.9,
        linkedEntryIds: ['ke-existing'],
        linkRelationship: 'led_to',
      },
    ]));

    // Insert knowledge entry
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ id: 'ke-new' }],
      rowCount: 1,
    } as any);

    // Insert link
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await app.request('/api/cron/extract-knowledge', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entriesCreated).toBeGreaterThanOrEqual(1);
  });

  it('skips chunks without knowledge signals', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { id: 'msg-1', server_id: 's1', channel_id: 'c1', display_name: 'Alice', content: 'lol', created_at: '2026-03-29T10:00:00Z', tags: { topics: [], isDecision: false, isActionItem: false, isReference: false, confidence: 0.1 } },
      ],
      rowCount: 1,
    } as any);

    const res = await app.request('/api/cron/extract-knowledge', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entriesCreated).toBe(0);
  });
});
