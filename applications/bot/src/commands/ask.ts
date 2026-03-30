import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { backendPost, backendGet } from '../lib/backendClient.js';
import { makeCitation, confidenceDots } from '../lib/citations.js';
import type { KnowledgeCitation } from '@contexta/shared';

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

    // Retrieve relevant knowledge
    let knowledgeBlock = '';
    let citations: KnowledgeCitation[] = [];
    try {
      const { entries } = await backendPost<{
        entries: { id: string; type: string; title: string; content: string; confidence: number }[];
        related: unknown[];
      }>(`/api/knowledge/${interaction.guildId}/search`, { query: userQuery, limit: 5, minConfidence: 0.3 });

      if (entries.length > 0) {
        citations = entries.map((e: { id: string; type: string; confidence: number; title: string }) => makeCitation(e));
        const lines = entries.map((e: { id: string; type: string; title: string; content: string; confidence: number }) => {
          const conf = e.confidence >= 0.7 ? 'high confidence' : 'moderate confidence';
          return `- ${e.type} (${conf}): "${e.title}" — ${e.content}`;
        });
        knowledgeBlock = `\n\n[RELEVANT KNOWLEDGE]\n${lines.join('\n')}\n[/RELEVANT KNOWLEDGE]`;
      }
    } catch {
      // Knowledge retrieval is best-effort
    }

    systemPrompt += knowledgeBlock;

    const { response } = await backendPost<{ response: string }>('/api/chat', {
      serverId,
      systemPrompt,
      chatHistory: [{ role: 'user', parts: [{ text: userQuery }] }],
    });

    const embed = new EmbedBuilder()
      .setColor(0x3B82F6)
      .setDescription(response.length > 4096 ? response.slice(0, 4093) + '...' : response);

    if (citations.length > 0) {
      const footerParts = citations.map(
        (c) => `${c.shortId} (${c.type}, ${confidenceDots(c.confidence)})`
      );
      embed.setFooter({ text: `📚 ${footerParts.join(' · ')}` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[ask] Error:', err);
    await interaction.editReply('I couldn\'t process that right now. Try again in a moment.');
  }
}
