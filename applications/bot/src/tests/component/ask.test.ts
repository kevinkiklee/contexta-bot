import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/backendClient.js', () => ({
  backendPost: vi.fn().mockResolvedValue({ response: 'AI response' }),
  backendGet: vi.fn().mockResolvedValue({ lore: null }),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { backendPost, backendGet } from '../../lib/backendClient.js';
import { execute } from '../../commands/ask.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockBackendPost = vi.mocked(backendPost);
const mockBackendGet = vi.mocked(backendGet);

describe('ask command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockBackendPost.mockResolvedValue({ response: 'AI response' });
    mockBackendGet.mockResolvedValue({ lore: null });
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

  it('calls backend and replies with response', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('What is TypeScript?'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    expect(mockBackendPost).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      serverId: 'guild-456',
      chatHistory: expect.any(Array),
    }));
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ description: 'AI response' }) })]),
    }));
  });

  it('includes lore in system prompt when available', async () => {
    mockBackendGet.mockResolvedValue({ lore: 'Pirates only!' });
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('hello'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(mockBackendPost).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      systemPrompt: expect.stringContaining('Pirates only!'),
    }));
  });

  it('defers with ephemeral when private', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('secret'),
        getBoolean: vi.fn().mockReturnValue(true),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('handles backend error gracefully', async () => {
    mockBackendPost.mockRejectedValue(new Error('Backend down'));
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("couldn't process"));
  });
});
