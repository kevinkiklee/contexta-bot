import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  }),
}));

import { rawQuery } from '@contexta/db';
import { knowledgeSearchRoutes } from '../../routes/knowledgeSearch.js';

const mockRawQuery = vi.mocked(rawQuery);

describe('knowledge search routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', knowledgeSearchRoutes);
  });

  describe('POST /api/knowledge/:serverId/search', () => {
    it('returns semantically similar knowledge entries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ke-1', type: 'decision', title: 'Use Redis for caching', content: 'Team decided on Redis', confidence: 0.9, similarity: 0.85, source_channel_id: 'c1', created_at: '2026-03-29T00:00:00Z' },
          { id: 'ke-2', type: 'topic', title: 'Caching strategies', content: 'Discussion about caching options', confidence: 0.7, similarity: 0.72, source_channel_id: 'c1', created_at: '2026-03-28T00:00:00Z' },
        ],
        rowCount: 2,
      } as any);

      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'ke-3', type: 'entity', title: 'Redis', content: 'Redis is used for caching', relationship: 'relates_to' }],
        rowCount: 1,
      } as any);

      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What caching solution are we using?' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(2);
      expect(data.entries[0].title).toBe('Use Redis for caching');
      expect(data.related).toBeDefined();
    });

    it('returns 400 when query is missing', async () => {
      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns empty results when no matches found', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await app.request('/api/knowledge/s1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'something obscure' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(0);
      expect(data.related).toHaveLength(0);
    });
  });
});
