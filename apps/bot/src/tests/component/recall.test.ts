import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/recall.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('recall command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it('rejects in DM context (no guildId)', async () => {
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
    const ai = createMockAIProvider();
    const searchMemory = vi.fn().mockResolvedValue([]);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining("couldn't find")
    );
  });

  it('reports found results count', async () => {
    const ai = createMockAIProvider();
    const results = [{ id: '1' }, { id: '2' }];
    const searchMemory = vi.fn().mockResolvedValue(results);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test topic'),
      },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('2')
    );
  });

  it('handles embedding generation error', async () => {
    const ai = createMockAIProvider({
      generateEmbedding: vi.fn().mockRejectedValue(new Error('API down')),
    });
    const searchMemory = vi.fn();
    const interaction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test') },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });

  it('handles searchSimilarMemory error', async () => {
    const ai = createMockAIProvider();
    const searchMemory = vi.fn().mockRejectedValue(new Error('DB down'));
    const interaction = createMockInteraction({
      options: { getString: vi.fn().mockReturnValue('test') },
    });

    await execute(interaction, { ai, searchMemory });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });
});
