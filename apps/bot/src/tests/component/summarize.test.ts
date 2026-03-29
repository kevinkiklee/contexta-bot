import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/summarize.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('summarize command', () => {
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

  it('defers and replies with hours and channel in normal flow', async () => {
    const mockChannel = { id: 'channel-789', toString: () => '<#channel-789>' };
    const interaction = createMockInteraction({
      options: {
        getInteger: vi.fn().mockReturnValue(48),
        getChannel: vi.fn().mockReturnValue(mockChannel),
      },
      channel: mockChannel,
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('48')
    );
  });
});
