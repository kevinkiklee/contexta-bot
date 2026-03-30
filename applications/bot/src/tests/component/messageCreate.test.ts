import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMessage } from '../helpers/mockDiscord.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { BOT_SENTINEL } from '../../utils/messageGuard.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../events/messageCreate.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('messageCreate handler', () => {
  let redis: ReturnType<typeof createMockRedis>;
  let mockPostBackend: ReturnType<typeof vi.fn>;
  let mockGetBackend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    redis = createMockRedis();
    mockPostBackend = vi.fn().mockResolvedValue({ response: 'Mock AI response' });
    mockGetBackend = vi.fn().mockResolvedValue({ lore: null });
  });

  it('ignores bot messages', async () => {
    const message = createMockMessage({ author: { bot: true, id: 'bot-1', username: 'Bot' } });
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('ignores DM messages (no guildId)', async () => {
    const message = createMockMessage({ guildId: null });
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('stores message in Redis and sets server mapping', async () => {
    const message = createMockMessage();
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[User: TestUser]')
    );
    expect(redis.lTrim).toHaveBeenCalledWith('channel:channel-789:history', -50, -1);
    expect(redis.set).toHaveBeenCalledWith('channel:channel-789:server', 'guild-456');
  });

  it('persists message to Postgres but does not call chat when not mentioned', async () => {
    const message = createMockMessage();
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(mockPostBackend).toHaveBeenCalledWith('/api/messages', expect.objectContaining({
      serverId: 'guild-456',
      channelId: 'channel-789',
      isBot: false,
    }));
    expect(mockPostBackend).not.toHaveBeenCalledWith('/api/chat', expect.anything());
  });

  it('calls backend and replies when mentioned', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

    expect(mockPostBackend).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      serverId: 'guild-456',
      chatHistory: expect.any(Array),
    }));
    expect(message.reply).toHaveBeenCalledWith('Mock AI response');
  });

  it('stores bot response in Redis after reply', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

    const rPushCalls = redis.rPush.mock.calls;
    const botCall = rPushCalls.find(([, val]) => typeof val === 'string' && val.startsWith(BOT_SENTINEL));
    expect(botCall).toBeDefined();
    expect(botCall![1]).toBe(`${BOT_SENTINEL}[System/Contexta]: Mock AI response`);
  });

  it('reacts with hourglass when rate limited on mention', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(message.react).toHaveBeenCalledWith('⏳');
    expect(mockPostBackend).not.toHaveBeenCalled();
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('skips Redis write when rate limited on non-mention', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const message = createMockMessage();
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(redis.rPush).not.toHaveBeenCalled();
    expect(message.react).not.toHaveBeenCalled();
  });

  it('replies with error on backend failure', async () => {
    mockPostBackend.mockRejectedValue(new Error('Backend down'));
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('issue'));
  });

  it('includes lore in system prompt when available', async () => {
    mockGetBackend.mockResolvedValue({ lore: 'Pirates only!' });
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

    expect(mockPostBackend).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      systemPrompt: expect.stringContaining('Pirates only!'),
    }));
  });

  it('maps BOT_SENTINEL entries to model role and others to user', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([
      '[User: Alice]: hello',
      `${BOT_SENTINEL}[System/Contexta]: hi there`,
    ]);

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

    const chatCall = mockPostBackend.mock.calls.find((c: any) => c[0] === '/api/chat');
    const chatHistory = chatCall![1].chatHistory;
    expect(chatHistory[0].role).toBe('user');
    expect(chatHistory[1].role).toBe('model');
  });

  it('injects knowledge context when mentioned', async () => {
    const message = createMockMessage({
      content: 'What caching solution are we using?',
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello']);

    mockPostBackend.mockImplementation(async (path: string) => {
      if (path.includes('/knowledge/') && path.includes('/search')) {
        return {
          entries: [{ id: 'abcd1234-0000-0000-0000-000000000000', type: 'decision', title: 'Use Redis', content: 'Team chose Redis', confidence: 0.9 }],
          related: [],
        };
      }
      if (path === '/api/messages') return {};
      return { response: 'Based on a previous discussion, the team chose Redis for caching.' };
    });
    mockGetBackend.mockResolvedValue({ lore: null });

    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });

    // Verify chat was called with knowledge in the prompt
    const chatCall = mockPostBackend.mock.calls.find((c: unknown[]) => c[0] === '/api/chat');
    expect(chatCall).toBeDefined();
    expect(chatCall![1].systemPrompt).toContain('RELEVANT KNOWLEDGE');
  });

  it('registers channelId in active_channels Set on each message', async () => {
    const message = createMockMessage();
    await execute(message, { redis, postBackend: mockPostBackend, getBackend: mockGetBackend });
    expect(redis.sAdd).toHaveBeenCalledWith('active_channels', 'channel-789');
  });
});
