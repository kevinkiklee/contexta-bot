import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMessage } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../events/messageCreate.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('messageCreate handler', () => {
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    ai = createMockAIProvider();
    redis = createMockRedis();
  });

  it('ignores bot messages', async () => {
    const message = createMockMessage({ author: { bot: true, id: 'bot-1', username: 'Bot' } });
    await execute(message, { ai, redis });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('ignores DM messages (no guildId)', async () => {
    const message = createMockMessage({ guildId: null });
    await execute(message, { ai, redis });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('stores message in Redis and sets server mapping', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis });

    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[User: TestUser]')
    );
    expect(redis.lTrim).toHaveBeenCalledWith('channel:channel-789:history', -50, -1);
    expect(redis.set).toHaveBeenCalledWith('channel:channel-789:server', 'guild-456');
  });

  it('does not call AI when not mentioned', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis });
    expect(ai.generateChatResponse).not.toHaveBeenCalled();
  });

  it('calls AI and replies when mentioned', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello', '[System/Contexta]: hi']);

    await execute(message, { ai, redis });

    expect(ai.generateChatResponse).toHaveBeenCalledWith(
      expect.stringContaining('Contexta'),
      expect.arrayContaining([
        expect.objectContaining({ role: 'user' }),
        expect.objectContaining({ role: 'model' }),
      ]),
      expect.objectContaining({ ttlMinutes: 60 })
    );
    expect(message.reply).toHaveBeenCalledWith('Mock AI response');
  });

  it('stores bot response in Redis after AI reply', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { ai, redis });

    const rPushCalls = redis.rPush.mock.calls;
    const botMessageCall = rPushCalls.find(
      ([, val]) => typeof val === 'string' && val.startsWith('[System/Contexta]')
    );
    expect(botMessageCall).toBeDefined();
  });

  it('reacts with hourglass and skips AI when rate limited on mention', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });

    await execute(message, { ai, redis });
    expect(message.react).toHaveBeenCalledWith('⏳');
    expect(ai.generateChatResponse).not.toHaveBeenCalled();
  });

  it('replies with error and does not store on AI failure', async () => {
    const failingAI = createMockAIProvider({
      generateChatResponse: vi.fn().mockRejectedValue(new Error('API error')),
    });
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([]);

    await execute(message, { ai: failingAI, redis });
    expect(message.reply).toHaveBeenCalledWith(expect.stringContaining('issue'));
    const botStoreCalls = redis.rPush.mock.calls.filter(
      ([, val]) => typeof val === 'string' && val.startsWith('[System/Contexta]')
    );
    expect(botStoreCalls).toHaveLength(0);
  });

  it('maps [System/Contexta] prefix to model role and others to user', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue([
      '[User: Alice]: hello',
      '[System/Contexta]: hi there',
    ]);

    await execute(message, { ai, redis });

    const chatHistory = vi.mocked(ai.generateChatResponse).mock.calls[0][1];
    expect(chatHistory[0].role).toBe('user');
    expect(chatHistory[1].role).toBe('model');
  });
});
