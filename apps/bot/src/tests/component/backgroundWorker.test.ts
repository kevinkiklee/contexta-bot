import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { createMockDb } from '../helpers/mockDb.js';
import { runSemanticEmbeddingWorker } from '../../utils/backgroundWorker.js';

describe('runSemanticEmbeddingWorker orchestrator', () => {
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    ai = createMockAIProvider();
    redis = createMockRedis();
    db = createMockDb();
  });

  it('makes no AI or DB calls when no channels are eligible', async () => {
    redis.sMembers.mockResolvedValue([]);
    await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(ai.summarizeText).not.toHaveBeenCalled();
    expect(ai.generateEmbedding).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('processes a single eligible channel through all stages', async () => {
    const messages = new Array(15).fill('test message');
    redis.sMembers.mockResolvedValue(['c1']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    await runSemanticEmbeddingWorker(redis as any, ai, db);

    expect(ai.summarizeText).toHaveBeenCalledOnce();
    expect(ai.generateEmbedding).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledOnce();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO channel_memory_vectors'),
      expect.arrayContaining(['server-1', 'c1'])
    );
  });

  it('processes multiple channels sequentially', async () => {
    const messages = new Array(15).fill('msg');
    redis.sMembers.mockResolvedValue(['c1', 'c2']);
    redis.get.mockImplementation(async (key: string) => {
      if (key.includes('c1')) return 'server-1';
      if (key.includes('c2')) return 'server-2';
      return null;
    });
    redis.lRange.mockResolvedValue(messages);

    await runSemanticEmbeddingWorker(redis as any, ai, db);
    expect(ai.summarizeText).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('continues processing after error in one channel', async () => {
    const messages = new Array(15).fill('msg');
    redis.sMembers.mockResolvedValue(['c1', 'c2']);
    redis.get.mockResolvedValue('server-1');
    redis.lRange.mockResolvedValue(messages);

    ai.summarizeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce('Summary for c2');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runSemanticEmbeddingWorker(redis as any, ai, db);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error processing channel'),
      expect.any(Error)
    );
    expect(db.query).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});
