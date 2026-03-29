import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

import { rawQuery } from '@contexta/db';
import { knowledgeRoutes } from '../../routes/knowledge.js';

const mockRawQuery = vi.mocked(rawQuery);

describe('knowledge routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', knowledgeRoutes);
  });

  describe('GET /api/knowledge/:serverId', () => {
    it('returns paginated knowledge entries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ke-1', server_id: 's1', type: 'topic', title: 'Docker', content: 'Docker usage', confidence: 0.8, is_archived: false, is_pinned: false, created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z', source_channel_id: 'c1', source_message_ids: [], metadata: {} },
        ],
        rowCount: 1,
      } as any);

      const res = await app.request('/api/knowledge/s1?limit=20');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].title).toBe('Docker');
    });

    it('filters by type', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await app.request('/api/knowledge/s1?type=decision');
      expect(res.status).toBe(200);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("type = $"),
        expect.arrayContaining(['s1', 'decision'])
      );
    });

    it('excludes archived by default', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await app.request('/api/knowledge/s1');
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_archived = false'),
        expect.any(Array)
      );
    });
  });

  describe('GET /api/knowledge/:serverId/:id', () => {
    it('returns entry with linked entries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'ke-1', server_id: 's1', type: 'topic', title: 'Docker', content: 'Docker usage', confidence: 0.8, is_archived: false, is_pinned: false, created_at: '2026-03-29T00:00:00Z', updated_at: '2026-03-29T00:00:00Z', source_channel_id: 'c1', source_message_ids: [], metadata: {} }],
        rowCount: 1,
      } as any);
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'link-1', source_id: 'ke-1', target_id: 'ke-2', relationship: 'relates_to', target_title: 'Kubernetes', target_type: 'topic' }],
        rowCount: 1,
      } as any);

      const res = await app.request('/api/knowledge/s1/ke-1');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entry.title).toBe('Docker');
      expect(data.links).toHaveLength(1);
      expect(data.links[0].target_title).toBe('Kubernetes');
    });

    it('returns 404 for missing entry', async () => {
      mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const res = await app.request('/api/knowledge/s1/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/summaries/:serverId', () => {
    it('returns channel summaries', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [{ id: 'cs-1', server_id: 's1', channel_id: 'c1', summary: 'Discussed Docker', topics: ['docker'], message_count: 25, period_start: '2026-03-28T00:00:00Z', period_end: '2026-03-29T00:00:00Z' }],
        rowCount: 1,
      } as any);

      const res = await app.request('/api/summaries/s1');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summaries).toHaveLength(1);
    });
  });

  describe('GET /api/expertise/:serverId', () => {
    it('returns user expertise for a topic', async () => {
      mockRawQuery.mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', topic: 'docker', score: 0.92, message_count: 142, last_seen_at: '2026-03-29T00:00:00Z' },
          { user_id: 'u2', topic: 'docker', score: 0.71, message_count: 89, last_seen_at: '2026-03-28T00:00:00Z' },
        ],
        rowCount: 2,
      } as any);

      const res = await app.request('/api/expertise/s1?topic=docker');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expertise).toHaveLength(2);
      expect(data.expertise[0].score).toBe(0.92);
    });
  });
});
