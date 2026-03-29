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
    mockBackendPost
      .mockResolvedValueOnce({ embedding: [0.1, 0.2] })
      .mockResolvedValueOnce({ results: [] });
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
      .mockResolvedValueOnce({ embedding: [0.1] })
      .mockResolvedValueOnce({ results: [{ id: '1' }, { id: '2' }] });
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
