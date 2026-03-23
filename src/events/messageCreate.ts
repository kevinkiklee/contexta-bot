// src/events/messageCreate.ts
import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export interface MessageCreateDeps {
  ai: IAIProvider;
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
  };
}

const defaultDeps: MessageCreateDeps = {
  ai: new GeminiProvider(),
  redis: redisClient as unknown as MessageCreateDeps['redis'],
};

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message, deps: MessageCreateDeps = defaultDeps) {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;

  if (!serverId) return;

  const displayName = message.member?.displayName || message.author.username;
  const formattedMessage = formatUserMessage(displayName, message.content);

  const redisKey = `channel:${channelId}:history`;
  await deps.redis.rPush(redisKey, formattedMessage);
  await deps.redis.lTrim(redisKey, -50, -1);
  await deps.redis.set(`channel:${channelId}:server`, serverId);

  if (message.mentions.has(message.client.user.id)) {
    if (isRateLimited(message.author.id)) {
      await message.react('⏳').catch(() => {});
      return;
    }

    const history = await deps.redis.lRange(redisKey, 0, -1);

    const chatHistory = history.map(msg => ({
      role: msg.startsWith('[System/Contexta]') ? 'model' as const : 'user' as const,
      parts: [{ text: msg }]
    }));

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const systemPrompt = `You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.`;

      const response = await deps.ai.generateChatResponse(
        systemPrompt,
        chatHistory,
        { ttlMinutes: 60 }
      );

      await message.reply(response);

      const botFormattedMsg = `[System/Contexta]: ${response}`;
      await deps.redis.rPush(redisKey, botFormattedMsg);
      await deps.redis.lTrim(redisKey, -50, -1);

    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
