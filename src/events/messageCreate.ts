// src/events/messageCreate.ts
import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';

const aiProvider = new GeminiProvider();

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;

  if (!serverId) return;

  const displayName = message.member?.displayName || message.author.username;

  // Fix #1: sanitize display name and content before storing in Redis
  const formattedMessage = formatUserMessage(displayName, message.content);

  const redisKey = `channel:${channelId}:history`;
  await redisClient.rPush(redisKey, formattedMessage);
  await redisClient.lTrim(redisKey, -50, -1);

  // Fix #4 (prerequisite): store server→channel mapping so the background worker
  // can resolve serverId without falling back to an env var
  await redisClient.set(`channel:${channelId}:server`, serverId);

  if (message.mentions.has(message.client.user.id)) {
    // Fix #3: rate-limit LLM calls per user
    if (isRateLimited(message.author.id)) {
      await message.react('⏳').catch(() => {});
      return;
    }

    const history = await redisClient.lRange(redisKey, 0, -1);

    const chatHistory = history.map(msg => ({
      // Safe because formatUserMessage() always wraps user turns in '[User: ...]', making
      // '[System/Contexta]' an exclusive prefix for bot-written turns only.
      role: msg.startsWith('[System/Contexta]') ? 'model' as const : 'user' as const,
      parts: [{ text: msg }]
    }));

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const systemPrompt = `You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.`;

      const response = await aiProvider.generateChatResponse(
        systemPrompt,
        chatHistory,
        { ttlMinutes: 60 }
      );

      await message.reply(response);

      const botFormattedMsg = `[System/Contexta]: ${response}`;
      await redisClient.rPush(redisKey, botFormattedMsg);
      await redisClient.lTrim(redisKey, -50, -1);

    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
