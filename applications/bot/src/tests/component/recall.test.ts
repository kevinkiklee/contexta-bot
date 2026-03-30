import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/backendClient.js', () => ({
  backendPost: vi.fn(),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { backendPost } from '../../lib/backendClient.js';
import { execute } from '../../commands/recall.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockBackendPost = vi.mocked(backendPost);

describe('recall command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    // Default: knowledge search returns empty, legacy search also returns empty
    mockBackendPost
      .mockResolvedValueOnce({ entries: [], related: [] })   // /api/knowledge/.../search
      .mockResolvedValueOnce({ embedding: [0.1, 0.2] })      // /api/embeddings/generate
      .mockResolvedValueOnce({ results: [] });               // /api/embeddings/search
  });

  it('rejects in DM context', async () => {
    const interaction = createMockInteraction({ guildId: null });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('only be used in a server'), ephemeral: true })
    );
  });

  it('rejects when rate limited', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('reports no results', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("couldn't find"));
  });

  it('reports found results count', async () => {
    mockBackendPost.mockReset();
    mockBackendPost
      .mockResolvedValueOnce({
        entries: [
          { type: 'decision', title: 'Decision A', content: 'We chose X', confidence: 0.9, source_channel_id: '123', created_at: '2026-01-01', similarity: 0.95 },
          { type: 'topic', title: 'Topic B', content: 'Discussion about Y', confidence: 0.8, source_channel_id: '123', created_at: '2026-01-02', similarity: 0.85 },
        ],
        related: [],
      })
      .mockResolvedValueOnce({ embedding: [0.1] })
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ response: 'Here is a summary of the 2 results found.' });
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('2'));
  });

  it('handles backend error gracefully', async () => {
    mockBackendPost.mockReset();
    mockBackendPost.mockRejectedValue(new Error('Backend down'));
    const interaction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test') },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('error'));
  });
});
