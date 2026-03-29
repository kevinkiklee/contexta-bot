import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { BOT_SENTINEL, sanitizeMessageContent, formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';
import { processAttachments } from '../services/attachmentProcessor.js';
import type { AttachmentInfo } from '../services/attachmentProcessor.js';
import { getProvider as registryGetProvider } from '../llm/providerRegistry.js';
import { query as dbQuery } from '../db/index.js';

export interface MessageCreateDeps {
  ai: IAIProvider;
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
    sAdd: (key: string, member: string) => Promise<number>;
  };
  processAttachments: (ai: IAIProvider, attachments: AttachmentInfo[]) => Promise<string>;
  getProvider?: (modelName: string) => IAIProvider;
  queryDb?: (text: string, params?: any[]) => Promise<any>;
}

const defaultDeps: MessageCreateDeps = {
  ai: new GeminiProvider(),
  redis: redisClient as unknown as MessageCreateDeps['redis'],
  processAttachments,
  getProvider: registryGetProvider,
  queryDb: dbQuery,
};

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message, deps: MessageCreateDeps = defaultDeps) {
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;

  if (!serverId) return;

  if (isRateLimited(message.author.id)) {
    if (message.mentions.has(message.client.user.id)) {
      await message.react('⏳').catch(() => {});
    }
    return;
  }

  const displayName = message.member?.displayName || message.author.username;
  let formattedMessage = formatUserMessage(displayName, message.content);

  if (message.attachments.size > 0) {
    const attachmentInfos: AttachmentInfo[] = [...message.attachments.values()].map(att => ({
      url: att.url,
      name: att.name ?? 'unknown',
      contentType: att.contentType,
      size: att.size,
    }));
    const descriptions = await deps.processAttachments(deps.ai, attachmentInfos);
    if (descriptions) {
      formattedMessage += ' ' + sanitizeMessageContent(descriptions);
    }
  }

  const redisKey = `channel:${channelId}:history`;
  await deps.redis.rPush(redisKey, formattedMessage);
  await deps.redis.sAdd('active_channels', channelId);
  await deps.redis.lTrim(redisKey, -50, -1);
  await deps.redis.set(`channel:${channelId}:server`, serverId);

  if (message.mentions.has(message.client.user.id)) {
    const history = await deps.redis.lRange(redisKey, 0, -1);

    const chatHistory = history.map(msg => ({
      role: msg.startsWith(BOT_SENTINEL) ? 'model' as const : 'user' as const,
      parts: [{ text: msg }],
    }));

    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Fetch server settings for provider, lore, and cache
      let activeModel = 'gemini-2.5-flash';
      let serverLore: string | null = null;
      let cacheId: string | null = null;
      let cacheExpiresAt: string | null = null;

      if (deps.queryDb) {
        try {
          const settingsResult = await deps.queryDb(
            'SELECT active_model, server_lore, context_cache_id, cache_expires_at FROM server_settings WHERE server_id = $1',
            [serverId]
          );
          if (settingsResult.rows.length > 0) {
            const row = settingsResult.rows[0];
            activeModel = row.active_model || activeModel;
            serverLore = row.server_lore;
            cacheId = row.context_cache_id;
            cacheExpiresAt = row.cache_expires_at;
          }
        } catch (err) {
          console.warn('[messageCreate] Failed to fetch server settings, using defaults:', err);
        }
      }

      // Use provider from registry if available
      let ai: IAIProvider;
      if (deps.getProvider) {
        try {
          ai = deps.getProvider(activeModel);
        } catch {
          ai = deps.ai; // fallback to default
        }
      } else {
        ai = deps.ai;
      }

      let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.';
      if (serverLore) {
        systemPrompt += `\n\nServer context and lore:\n${serverLore}`;
      }

      // Determine cache options
      const cacheOptions: { cacheId?: string; ttlMinutes?: number } = { ttlMinutes: 60 };
      if (cacheId && cacheExpiresAt && new Date(cacheExpiresAt) > new Date()) {
        cacheOptions.cacheId = cacheId;
      }

      const response = await ai.generateChatResponse(systemPrompt, chatHistory, cacheOptions);

      await message.reply(response);

      const botFormattedMsg = `${BOT_SENTINEL}[System/Contexta]: ${response}`;
      await deps.redis.rPush(redisKey, botFormattedMsg);
      await deps.redis.lTrim(redisKey, -50, -1);
    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
