import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Triggers a semantic search of the pgvector database.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The past event or topic you want to remember')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const topic = interaction.options.getString('topic', true);
  await interaction.deferReply();

  try {
    const { embedding } = await backendPost<{ embedding: number[] }>('/api/embeddings/generate', { text: topic });
    const { results } = await backendPost<{ results: any[] }>('/api/embeddings/search', {
      serverId: interaction.guildId,
      channelId: interaction.channelId,
      embedding,
      limit: 3,
    });

    if (results.length === 0) {
      await interaction.editReply("I couldn't find any relevant memories regarding that topic.");
      return;
    }

    await interaction.editReply(`I found ${results.length} related memory chunks. Contexta is analyzing them...`);
  } catch (err) {
    console.error('[recall] Error:', err);
    await interaction.editReply('There was an error querying my semantic memory.');
  }
}
