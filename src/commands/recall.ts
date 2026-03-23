// src/commands/recall.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { searchSimilarMemory } from '../db/index.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export interface RecallDeps {
  ai: IAIProvider;
  searchMemory: typeof searchSimilarMemory;
}

const defaultDeps: RecallDeps = {
  ai: new GeminiProvider(),
  searchMemory: searchSimilarMemory,
};

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Triggers a semantic search of the pgvector database.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The past event or topic you want to remember')
      .setRequired(true));

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: RecallDeps = defaultDeps
) {
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
    const embedding = await deps.ai.generateEmbedding(topic);
    const results = await deps.searchMemory(interaction.guildId, interaction.channelId, embedding, 3);

    if (results.length === 0) {
      await interaction.editReply("I couldn't find any relevant memories regarding that topic.");
      return;
    }

    await interaction.editReply(`I found ${results.length} related memory chunks. Contexta is analyzing them...`);
  } catch (err) {
    console.error('[recall] Error querying semantic memory:', err);
    await interaction.editReply('There was an error querying my semantic memory.');
  }
}
