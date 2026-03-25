import { describe, it, expect } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { createMockDb } from '../helpers/mockDb.js';
import {
  fetchEligibleChannels,
  summarizeBatch,
  embedSummary,
  storeMemoryVector,
} from '../../utils/backgroundWorker.js';

describe('fetchEligibleChannels', () => {
  it('skips channels with fewer than 10 messages', async () => {
    const redis = createMockRedis();
    redis.sMembers.mockResolvedValue(['c1']);
    redis.lRange.mockResolvedValue(['msg1', 'msg2']);
    redis.get.mockResolvedValue('server-1');

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([]);
  });

  it('skips channels without a server mapping', async () => {
    const redis = createMockRedis();
    redis.sMembers.mockResolvedValue(['c1']);
    redis.get.mockResolvedValue(null);
    redis.lRange.mockResolvedValue(new Array(15).fill('msg'));

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([]);
  });

  it('returns eligible channels with correct shape', async () => {
    const redis = createMockRedis();
    const messages = new Array(15).fill('msg');
    redis.sMembers.mockResolvedValue(['c1']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    const result = await fetchEligibleChannels(redis as any);
    expect(result).toEqual([{ channelId: 'c1', serverId: 'server-1', messages }]);
  });

  it('does not call redis.keys', async () => {
    const redis = createMockRedis();
    redis.sMembers.mockResolvedValue([]);

    await fetchEligibleChannels(redis as any);

    expect(redis.keys).not.toHaveBeenCalled();
  });
});

describe('summarizeBatch', () => {
  it('passes joined messages to ai.summarizeText', async () => {
    const ai = createMockAIProvider();
    const messages = ['msg1', 'msg2', 'msg3'];
    const result = await summarizeBatch(ai, messages);

    expect(ai.summarizeText).toHaveBeenCalledWith('msg1\nmsg2\nmsg3');
    expect(result).toBe('Mock summary');
  });
});

describe('embedSummary', () => {
  it('passes summary to ai.generateEmbedding', async () => {
    const ai = createMockAIProvider();
    const result = await embedSummary(ai, 'test summary');

    expect(ai.generateEmbedding).toHaveBeenCalledWith('test summary');
    expect(result).toEqual(new Array(768).fill(0.1));
  });
});

describe('storeMemoryVector', () => {
  it('calls db.query with correct INSERT and formatted embedding', async () => {
    const db = createMockDb();
    const embedding = [0.1, 0.2, 0.3];

    await storeMemoryVector(db, 'server-1', 'channel-1', 'summary text', embedding);

    expect(db.query).toHaveBeenCalledOnce();
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO channel_memory_vectors');
    expect(params).toEqual(['server-1', 'channel-1', 'summary text', '[0.1,0.2,0.3]']);
  });
});
