import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('catchup')
  .setDescription('Get a personalized digest of what you missed.')
  .addStringOption(option =>
    option.setName('timerange')
      .setDescription('How far back to look (e.g. "12h", "3d", "1w"). Default: 24h')
      .setRequired(false)
  );

function parseTimeRange(input: string): number {
  const match = input.match(/^(\d+)(h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const timerangeInput = interaction.options.getString('timerange') || '24h';
  const timerangeMs = parseTimeRange(timerangeInput);
  const since = new Date(Date.now() - timerangeMs).toISOString();

  await interaction.deferReply();

  try {
    // Fetch channel summaries for this server
    const { summaries } = await backendGet<{
      summaries: { channel_id: string; summary: string; topics: string[]; decisions: string[]; open_questions: string[]; action_items: string[]; period_start: string; period_end: string; message_count: number }[];
    }>(`/api/summaries/${interaction.guildId}?limit=20`);

    // Filter summaries within time range
    const recentSummaries = summaries.filter(s => new Date(s.period_end) >= new Date(since));

    if (recentSummaries.length === 0) {
      await interaction.editReply(`No activity summaries found for the last ${timerangeInput}. Either there wasn't much going on, or summaries haven't been generated yet.`);
      return;
    }

    // Fetch user's expertise to personalize the digest
    let userTopics: string[] = [];
    try {
      const { expertise } = await backendGet<{
        expertise: { topic: string; score: number }[];
      }>(`/api/expertise/${interaction.guildId}?userId=${interaction.user.id}&limit=10`);
      userTopics = expertise.map(e => e.topic);
    } catch {
      // Expertise is optional for personalization
    }

    // Build context for LLM
    const summaryParts = recentSummaries.map(s => {
      const parts = [`Channel: ${s.channel_id} (${s.message_count} messages)`];
      parts.push(`Summary: ${s.summary}`);
      if (s.decisions.length > 0) parts.push(`Decisions: ${s.decisions.join('; ')}`);
      if (s.action_items.length > 0) parts.push(`Action items: ${s.action_items.join('; ')}`);
      if (s.open_questions.length > 0) parts.push(`Open questions: ${s.open_questions.join('; ')}`);
      return parts.join('\n');
    }).join('\n\n');

    const personalizeHint = userTopics.length > 0
      ? `\n\nThis user is interested in: ${userTopics.join(', ')}. Prioritize topics relevant to their interests.`
      : '';

    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId: interaction.guildId,
      systemPrompt: `You are Contexta, generating a personalized catch-up digest for a Discord server member. Summarize what happened in the last ${timerangeInput}. Highlight decisions made, action items, and trending topics. Be concise but informative. Use bullet points and sections.${personalizeHint}`,
      chatHistory: [{ role: 'user', parts: [{ text: `Here are the channel summaries:\n\n${summaryParts}\n\nGenerate a catch-up digest for me.` }] }],
    });

    const truncated = response.length > 2000 ? response.slice(0, 1997) + '...' : response;
    await interaction.editReply(truncated);
  } catch (err) {
    console.error('[catchup] Error:', err);
    await interaction.editReply('There was an error generating your catch-up digest.');
  }
}
