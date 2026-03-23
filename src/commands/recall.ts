import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import { searchSimilarMemory } from '../db/index.js';

const aiProvider = new GeminiProvider();

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Triggers a semantic search of the pgvector database.')
  .addStringOption(option => 
    option.setName('topic')
      .setDescription('The past event or topic you want to remember')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const topic = interaction.options.getString('topic', true);
  await interaction.deferReply();
  
  try {
    // Generate an embedding for the user's recall query
    const embedding = await aiProvider.generateEmbedding(topic);
    
    // Search the pgvector database for similar channel memories
    const results = await searchSimilarMemory(interaction.guildId || '', interaction.channelId, embedding, 3);
    
    if (results.length === 0) {
      await interaction.editReply("I couldn't find any relevant memories regarding that topic.");
      return;
    }
    
    // In production, we'd pass these retrieved RAG memories to Gemini 
    // again to formulate an organic answer integrating the context.
    await interaction.editReply(`I found ${results.length} related memory chunks. Contexta is analyzing them...`);
  } catch (err) {
    console.error('[recall] Error querying semantic memory:', err);
    await interaction.editReply('There was an error querying my semantic memory.');
  }
}
