import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPoolQuery } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  return { mockPoolQuery };
});

vi.mock('pg', () => ({
  default: {
    Pool: class MockPool {
      query = mockPoolQuery;
    },
  },
}));

import { searchSimilarMemory } from '../../db/index.js';

describe('searchSimilarMemory', () => {
  beforeEach(() => {
    mockPoolQuery.mockClear();
    mockPoolQuery.mockResolvedValue({ rows: [{ id: '1', summary_text: 'test' }], rowCount: 1 });
  });

  it('throws when serverId is missing', async () => {
    await expect(searchSimilarMemory('', 'channel-1', [0.1], 5))
      .rejects.toThrow('requires non-empty serverId and channelId');
  });

  it('throws when channelId is missing', async () => {
    await expect(searchSimilarMemory('server-1', '', [0.1], 5))
      .rejects.toThrow('requires non-empty serverId and channelId');
  });

  it('passes correct params to query', async () => {
    const embedding = [0.1, 0.2, 0.3];
    await searchSimilarMemory('server-1', 'channel-1', embedding, 3);

    expect(mockPoolQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('WHERE server_id = $1 AND channel_id = $2');
    expect(params).toEqual(['server-1', 'channel-1', '[0.1,0.2,0.3]', 3]);
  });

  it('defaults limit to 5 when omitted', async () => {
    await searchSimilarMemory('server-1', 'channel-1', [0.1]);

    const [, params] = mockPoolQuery.mock.calls[0];
    expect(params![3]).toBe(5);
  });

  it('returns rows from query result', async () => {
    const rows = [{ id: '1', summary_text: 'hello', similarity: 0.95 }];
    mockPoolQuery.mockResolvedValue({ rows, rowCount: 1 });

    const result = await searchSimilarMemory('server-1', 'channel-1', [0.1]);
    expect(result).toEqual(rows);
  });
});
