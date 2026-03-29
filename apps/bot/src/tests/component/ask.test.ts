import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../commands/ask.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('ask command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  it('rejects when rate limited without deferring', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('defers and replies in normal flow', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('What is TypeScript?'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('What is TypeScript?')
    );
  });

  it('defers with ephemeral true when private option is set', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('secret question'),
        getBoolean: vi.fn().mockReturnValue(true),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });
});
