import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask Contexta a direct question.')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Your core question')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('private')
      .setDescription('Whether the response should be hidden from others (ephemeral)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const userQuery = interaction.options.getString('query', true);
  const isPrivate = interaction.options.getBoolean('private') || false;

  await interaction.deferReply({ ephemeral: isPrivate });

  try {
    const serverId = interaction.guildId;
    let activeModel = 'gemini-2.5-flash';
    let serverLore: string | null = null;

    if (serverId) {
      const result = await query(
        'SELECT active_model, server_lore FROM server_settings WHERE server_id = $1',
        [serverId]
      );
      if (result.rows.length > 0) {
        activeModel = result.rows[0].active_model || activeModel;
        serverLore = result.rows[0].server_lore;
      }
    }

    const ai = getProvider(activeModel);

    let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses.';
    if (serverLore) {
      systemPrompt += `\n\nServer context and lore:\n${serverLore}`;
    }

    const chatHistory = [
      { role: 'user' as const, parts: [{ text: userQuery }] },
    ];

    const response = await ai.generateChatResponse(systemPrompt, chatHistory, { ttlMinutes: 60 });

    if (response.length > 2000) {
      await interaction.editReply(response.substring(0, 2000));
    } else {
      await interaction.editReply(response);
    }
  } catch (err) {
    console.error('[ask] Error generating response:', err);
    await interaction.editReply('I ran into an issue attempting to process that request.');
  }
}
