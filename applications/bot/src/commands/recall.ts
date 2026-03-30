import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('recall')
  .setDescription('Search the server knowledge base for past discussions, decisions, and topics.')
  .addStringOption(option =>
    option.setName('topic')
      .setDescription('The topic, decision, or event you want to recall')
      .setRequired(true)
  );

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
    // Search knowledge base
    const { entries, related } = await backendPost<{
      entries: { type: string; title: string; content: string; confidence: number; source_channel_id: string; created_at: string; similarity: number }[];
      related: { type: string; title: string; content: string; relationship: string }[];
    }>(`/api/knowledge/${interaction.guildId}/search`, { query: topic, limit: 5 });

    // Also search channel memory vectors (legacy)
    let legacyResults: { summary_text: string; time_start: string; time_end: string }[] = [];
    try {
      const { embedding } = await backendPost<{ embedding: number[] }>('/api/embeddings/generate', { text: topic });
      const { results } = await backendPost<{ results: { summary_text: string; time_start: string; time_end: string }[] }>('/api/embeddings/search', {
        serverId: interaction.guildId,
        channelId: interaction.channelId,
        embedding,
        limit: 3,
      });
      legacyResults = results;
    } catch {
      // Legacy search is best-effort
    }

    if (entries.length === 0 && legacyResults.length === 0) {
      await interaction.editReply("I couldn't find any relevant knowledge about that topic.");
      return;
    }

    // Build context for LLM synthesis
    const knowledgeParts: string[] = [];
    for (const entry of entries) {
      knowledgeParts.push(`[${entry.type}] ${entry.title}: ${entry.content} (confidence: ${entry.confidence.toFixed(1)})`);
    }
    for (const rel of related) {
      knowledgeParts.push(`[related ${rel.type}] ${rel.title}: ${rel.content}`);
    }
    for (const legacy of legacyResults) {
      knowledgeParts.push(`[conversation] ${legacy.summary_text} (${new Date(legacy.time_start).toLocaleDateString()} - ${new Date(legacy.time_end).toLocaleDateString()})`);
    }

    // Synthesize with LLM
    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId: interaction.guildId,
      systemPrompt: `You are Contexta, recalling knowledge for a Discord server member. Summarize the following knowledge entries about "${topic}" into a clear, concise response. Group by type (decisions, topics, discussions). Cite sources where available. Be direct and factual.`,
      chatHistory: [{ role: 'user', parts: [{ text: `Here is what I found:\n\n${knowledgeParts.join('\n')}\n\nSummarize this knowledge about: ${topic}` }] }],
    });

    const truncated = response.length > 2000 ? response.slice(0, 1997) + '...' : response;
    await interaction.editReply(truncated);
  } catch (err) {
    console.error('[recall] Error:', err);
    await interaction.editReply('There was an error searching the knowledge base.');
  }
}
