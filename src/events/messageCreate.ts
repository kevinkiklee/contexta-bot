import { Message, Events } from 'discord.js';
import { redisClient } from '../utils/redis.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';

const aiProvider = new GeminiProvider();

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  // Ignore messages from bots (including ourselves)
  if (message.author.bot) return;

  const channelId = message.channelId;
  const serverId = message.guildId;
  
  if (!serverId) return; // Only operate in servers for now

  // Multi-User Disambiguation
  const displayName = message.member?.displayName || message.author.username;
  const formattedMessage = `[User: ${displayName}]: ${message.content}`;

  // 1. Update the rolling short-term cache in Redis for this channel
  const redisKey = `channel:${channelId}:history`;
  // Add to the right of the list
  await redisClient.rPush(redisKey, formattedMessage);
  // Keep only the last 50 messages to prevent excessive token usage
  await redisClient.lTrim(redisKey, -50, -1);

  // Determine if the bot should respond contextually (e.g. if mentioned directly)
  if (message.mentions.has(message.client.user.id)) {
    // 2. Retrieve history from cache
    const history = await redisClient.lRange(redisKey, 0, -1);
    
    // Construct chat history format for the LLM Interface
    const chatHistory = history.map(msg => ({
      role: msg.startsWith('[System/Contexta]') ? 'model' as const : 'user' as const,
      parts: [{ text: msg }]
    }));

    // 3. Call the Gemini Provider
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      const systemPrompt = `You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses. Do not prefix your own messages with [System/Contexta] as Discord formats it natively.`;
      
      const response = await aiProvider.generateChatResponse(
        systemPrompt, 
        chatHistory,
        { ttlMinutes: 60 } // E.g., caching the system rules via Context Caching API
      );

      // 4. Send the response back and log it in Redis as the model
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
