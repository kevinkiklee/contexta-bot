import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMessage } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';
import { createMockRedis } from '../helpers/mockRedis.js';
import { createMockAttachmentProcessor } from '../helpers/mockAttachmentProcessor.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { execute } from '../../events/messageCreate.js';

const mockIsRateLimited = vi.mocked(isRateLimited);

describe('messageCreate handler', () => {
  let ai: ReturnType<typeof createMockAIProvider>;
  let redis: ReturnType<typeof createMockRedis>;
  let attachmentProcessor: ReturnType<typeof createMockAttachmentProcessor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    ai = createMockAIProvider();
    redis = createMockRedis();
    attachmentProcessor = createMockAttachmentProcessor();
  });

  it('ignores bot messages', async () => {
    const message = createMockMessage({ author: { bot: true, id: 'bot-1', username: 'Bot' } });
    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('ignores DM messages (no guildId)', async () => {
    const message = createMockMessage({ guildId: null });
    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });
    expect(redis.rPush).not.toHaveBeenCalled();
  });

  it('stores message in Redis and sets server mapping', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[User: TestUser]')
    );
    expect(redis.lTrim).toHaveBeenCalledWith('channel:channel-789:history', -50, -1);
    expect(redis.set).toHaveBeenCalledWith('channel:channel-789:server', 'guild-456');
  });

  it('does not call AI when not mentioned', async () => {
    const message = createMockMessage();
    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });
    expect(ai.generateChatResponse).not.toHaveBeenCalled();
  });

  it('calls AI and replies when mentioned', async () => {
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    redis.lRange.mockResolvedValue(['[User: Alice]: hello', '[System/Contexta]: hi']);

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

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

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

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

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });
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

    await execute(message, {
      ai: failingAI,
      redis,
      processAttachments: attachmentProcessor.processAttachments,
    });
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

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const chatHistory = vi.mocked(ai.generateChatResponse).mock.calls[0][1];
    expect(chatHistory[0].role).toBe('user');
    expect(chatHistory[1].role).toBe('model');
  });

  it('calls processAttachments and appends result to Redis for message with attachment', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('[Attachment: photo.png — A blue square]');
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/photo.png', name: 'photo.png', contentType: 'image/png', size: 1024 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    expect(attachmentProcessor.processAttachments).toHaveBeenCalledWith(
      ai,
      [expect.objectContaining({ name: 'photo.png', contentType: 'image/png' })]
    );
    expect(redis.rPush).toHaveBeenCalledWith(
      'channel:channel-789:history',
      expect.stringContaining('[Attachment: photo.png — A blue square]')
    );
  });

  it('stores message text only when attachment processing returns empty string', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('');
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/bad.zip', name: 'bad.zip', contentType: 'application/zip', size: 500 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const storedMsg = redis.rPush.mock.calls[0][1] as string;
    expect(storedMsg).toContain('[User: TestUser]');
    expect(storedMsg).not.toContain('[Attachment:');
  });

  it('processes multiple attachments and appends all descriptions', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue(
      '[Attachment: a.png — First image] [Attachment: b.pdf — A document]'
    );
    const message = createMockMessage({
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/a.png', name: 'a.png', contentType: 'image/png', size: 1024 }],
        ['att-2', { url: 'https://cdn.example.com/b.pdf', name: 'b.pdf', contentType: 'application/pdf', size: 2048 }],
      ]),
    });

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const storedMsg = redis.rPush.mock.calls[0][1] as string;
    expect(storedMsg).toContain('[Attachment: a.png');
    expect(storedMsg).toContain('[Attachment: b.pdf');
  });

  it('does not call processAttachments when message has no attachments', async () => {
    const message = createMockMessage();

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    expect(attachmentProcessor.processAttachments).not.toHaveBeenCalled();
  });

  it('includes attachment descriptions in LLM history when mentioned', async () => {
    attachmentProcessor.processAttachments.mockResolvedValue('[Attachment: error.png — A stack trace]');
    const message = createMockMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
      attachments: new Map([
        ['att-1', { url: 'https://cdn.example.com/error.png', name: 'error.png', contentType: 'image/png', size: 512 }],
      ]),
    });
    redis.lRange.mockResolvedValue([
      '[User: TestUser]: help me [Attachment: error.png — A stack trace]',
    ]);

    await execute(message, { ai, redis, processAttachments: attachmentProcessor.processAttachments });

    const chatHistory = vi.mocked(ai.generateChatResponse).mock.calls[0][1];
    expect(chatHistory[0].parts[0].text).toContain('[Attachment: error.png');
  });
});
