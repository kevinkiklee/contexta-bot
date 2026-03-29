import { vi } from 'vitest';
import type { ChatInputCommandInteraction, Message } from 'discord.js';

export function createMockInteraction(overrides?: Record<string, any>): ChatInputCommandInteraction {
  return {
    user: { id: 'user-123' },
    guildId: 'guild-456',
    channelId: 'channel-789',
    options: {
      getString: vi.fn().mockReturnValue('test input'),
      getInteger: vi.fn().mockReturnValue(24),
      getBoolean: vi.fn().mockReturnValue(false),
      getChannel: vi.fn().mockReturnValue(null),
      getUser: vi.fn().mockReturnValue({ username: 'TestUser' }),
      getSubcommand: vi.fn().mockReturnValue('cache'),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
    isChatInputCommand: vi.fn().mockReturnValue(true),
    commandName: 'test',
    client: { commands: new Map() },
    ...overrides,
  } as unknown as ChatInputCommandInteraction;
}

export function createMockMessage(overrides?: Record<string, any>): Message {
  return {
    author: { bot: false, id: 'user-123', username: 'TestUser' },
    member: { displayName: 'TestUser' },
    guildId: 'guild-456',
    channelId: 'channel-789',
    content: 'Hello Contexta',
    mentions: { has: vi.fn().mockReturnValue(false) },
    channel: { sendTyping: vi.fn().mockResolvedValue(undefined) },
    client: { user: { id: 'bot-999' } },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    attachments: new Map(),
    ...overrides,
  } as unknown as Message;
}
