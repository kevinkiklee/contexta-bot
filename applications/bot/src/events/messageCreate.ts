import { Message, Events, TextChannel } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { BOT_SENTINEL, sanitizeMessageContent, formatUserMessage } from '../utils/messageGuard.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';
import { makeCitation, appendCitationFooter } from '../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';

export interface MessageCreateDeps {
  redis: {
    rPush: (key: string, value: string) => Promise<number>;
    lTrim: (key: string, start: number, stop: number) => Promise<string>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    set: (key: string, value: string) => Promise<string | null>;
    sAdd: (key: string, member: string) => Promise<number>;
  };
  postBackend?: typeof backendPost;
  getBackend?: typeof backendGet;
}

const defaultDeps: MessageCreateDeps = {
  redis: redisClient as unknown as MessageCreateDeps['redis'],
  postBackend: backendPost,
  getBackend: backendGet,
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
  const formattedMessage = formatUserMessage(displayName, message.content);

  const redisKey = `channel:${channelId}:history`;
  await deps.redis.rPush(redisKey, formattedMessage);
  await deps.redis.sAdd('active_channels', channelId);
  await deps.redis.lTrim(redisKey, -50, -1);
  await deps.redis.set(`channel:${channelId}:server`, serverId);
  if (message.channel instanceof TextChannel) {
    await deps.redis.set(`channel:${channelId}:name`, message.channel.name);
  }

  // Persist to Postgres for dashboard history/search
  const post = deps.postBackend || backendPost;
  post('/api/messages', {
    serverId,
    channelId,
    userId: message.author.id,
    displayName,
    content: message.content,
    isBot: false,
  }).catch((err) => console.warn('[messageCreate] Failed to persist message:', err));

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

      const get = deps.getBackend || backendGet;

      let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.';

      try {
        const { lore } = await get<{ lore: string | null }>(`/api/servers/${serverId}/lore`);
        if (lore) {
          systemPrompt += `\n\nServer context and lore:\n${lore}`;
        }
      } catch { /* use default prompt */ }

      // Retrieve relevant knowledge (Phase 2)
      let knowledgeBlock = '';
      let citations: KnowledgeCitation[] = [];
      try {
        const { entries } = await (deps.postBackend || backendPost)<{
          entries: { id: string; type: string; title: string; content: string; confidence: number }[];
          related: unknown[];
        }>(`/api/knowledge/${message.guildId}/search`, { query: message.content, limit: 5, minConfidence: 0.3 });

        if (entries.length > 0) {
          citations = entries.map((e: { id: string; type: string; confidence: number; title: string }) => makeCitation(e));
          const lines = entries.map((e: { id: string; type: string; title: string; content: string; confidence: number }) => {
            const conf = e.confidence >= 0.7 ? 'high confidence' : 'moderate confidence';
            return `- ${e.type} (${conf}): "${e.title}" — ${e.content}`;
          });
          knowledgeBlock = `\n\n[RELEVANT KNOWLEDGE]\n${lines.join('\n')}\n[/RELEVANT KNOWLEDGE]\n\nWhen relevant, actively reference this knowledge. Use phrases like "By the way, this relates to..." or "Based on a previous discussion..."`;
        }
      } catch {
        // Knowledge retrieval is best-effort
      }

      systemPrompt += knowledgeBlock;

      const { response } = await post<{ response: string }>('/api/chat', {
        serverId,
        systemPrompt,
        chatHistory,
      });

      const replyText = appendCitationFooter(response, citations);
      await message.reply(replyText);

      const botFormattedMsg = `${BOT_SENTINEL}[System/Contexta]: ${response}`;
      await deps.redis.rPush(redisKey, botFormattedMsg);
      await deps.redis.lTrim(redisKey, -50, -1);

      // Persist bot reply to Postgres
      post('/api/messages', {
        serverId,
        channelId,
        userId: message.client.user.id,
        displayName: 'Contexta',
        content: response,
        isBot: true,
      }).catch((err) => console.warn('[messageCreate] Failed to persist bot reply:', err));
    } catch (err) {
      console.error('[messageCreate] Error generating response:', err);
      await message.reply('I ran into an issue attempting to process that request.');
    }
  }
}
