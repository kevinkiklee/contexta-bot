import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

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
    const serverId = interaction.guildId || '';

    const { lore } = await backendGet<{ lore: string | null }>(`/api/servers/${serverId}/lore`);

    let systemPrompt = 'You are Contexta, an intelligent AI co-host for this Discord server. Provide helpful and concise responses.';
    if (lore) {
      systemPrompt += `\n\nServer context and lore:\n${lore}`;
    }

    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId,
      systemPrompt,
      chatHistory: [{ role: 'user', parts: [{ text: userQuery }] }],
    });

    if (response.length > 2000) {
      await interaction.editReply(response.substring(0, 2000));
    } else {
      await interaction.editReply(response);
    }
  } catch (err) {
    console.error('[ask] Error:', err);
    await interaction.editReply('I ran into an issue attempting to process that request.');
  }
}
