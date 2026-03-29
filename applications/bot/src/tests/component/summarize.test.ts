import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { Collection } from 'discord.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../lib/backendClient.js', () => ({
  backendPost: vi.fn().mockResolvedValue({ summary: 'Here is the summary.' }),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { backendPost } from '../../lib/backendClient.js';
import { execute } from '../../commands/summarize.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockBackendPost = vi.mocked(backendPost);

describe('summarize command', () => {
  let mockChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockBackendPost.mockResolvedValue({ summary: 'Here is the summary.' });
    mockChannel = {
      id: 'channel-789',
      messages: {
        fetch: vi.fn().mockResolvedValue(new Collection([
          ['msg-1', { author: { bot: false, username: 'Alice' }, content: 'Hello everyone', createdTimestamp: Date.now() - 1000 }],
          ['msg-2', { author: { bot: false, username: 'Bob' }, content: 'Hi Alice!', createdTimestamp: Date.now() - 500 }],
        ])),
      },
    };
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
  });

  it('fetches messages and calls backend', async () => {
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(24),
        getChannel: vi.fn().mockReturnValue(null),
      },
    });
    await execute(interaction);
    expect(mockChannel.messages.fetch).toHaveBeenCalled();
    expect(mockBackendPost).toHaveBeenCalledWith('/api/summarize', expect.objectContaining({
      serverId: 'guild-456',
      text: expect.stringContaining('Alice'),
    }));
    expect(interaction.editReply).toHaveBeenCalledWith('Here is the summary.');
  });

  it('reports no messages found in time range', async () => {
    mockChannel.messages.fetch.mockResolvedValue(new Collection());
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(1),
        getChannel: vi.fn().mockReturnValue(null),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('No messages found'));
  });

  it('uses specified channel when provided', async () => {
    const otherChannel = {
      id: 'other-channel',
      messages: {
        fetch: vi.fn().mockResolvedValue(new Collection([
          ['msg-3', { author: { bot: false, username: 'Charlie' }, content: 'Test', createdTimestamp: Date.now() }],
        ])),
      },
    };
    const interaction = createMockInteraction({
      channel: mockChannel,
      options: {
        getInteger: vi.fn().mockReturnValue(24),
        getChannel: vi.fn().mockReturnValue(otherChannel),
      },
    });
    await execute(interaction);
    expect(otherChannel.messages.fetch).toHaveBeenCalled();
    expect(mockChannel.messages.fetch).not.toHaveBeenCalled();
  });
});
