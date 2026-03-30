import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { backendPost, backendPut, backendGet } from '../lib/backendClient.js';
import { resolveShortId, confidenceDots } from '../lib/citations.js';

export const data = new SlashCommandBuilder()
  .setName('knowledge')
  .setDescription('Manage the knowledge base')
  .addSubcommand((sub) =>
    sub.setName('search').setDescription('Search the knowledge base')
      .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('delete').setDescription('Archive a knowledge entry (admin only)')
      .addStringOption((opt) => opt.setName('id').setDescription('Entry ID (e.g. KE-3f8a)').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName('correct').setDescription('Correct a knowledge entry (admin only)')
      .addStringOption((opt) => opt.setName('id').setDescription('Entry ID (e.g. KE-3f8a)').setRequired(true))
      .addStringOption((opt) => opt.setName('content').setDescription('New content for the entry').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const serverId = interaction.guildId;
  if (!serverId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'search') {
    await handleSearch(interaction, serverId);
  } else if (subcommand === 'delete') {
    await handleDelete(interaction, serverId);
  } else if (subcommand === 'correct') {
    await handleCorrect(interaction, serverId);
  }
}

async function handleSearch(interaction: ChatInputCommandInteraction, serverId: string) {
  const query = interaction.options.getString('query', true);
  await interaction.deferReply();

  try {
    const { entries } = await backendPost<{
      entries: { id: string; type: string; title: string; content: string; confidence: number }[];
    }>(`/api/knowledge/${serverId}/search`, { query, limit: 3, minConfidence: 0.3 });

    if (entries.length === 0) {
      await interaction.editReply(`🔍 No knowledge entries found for "${query}".`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3B82F6)
      .setTitle(`🔍 Knowledge Search: "${query.length > 200 ? query.slice(0, 197) + '...' : query}"`)
      .setFooter({ text: `${entries.length} result${entries.length === 1 ? '' : 's'} found` });

    for (const e of entries) {
      const shortId = `KE-${e.id.slice(0, 4)}`;
      const snippet = e.content.length > 120 ? e.content.slice(0, 117) + '...' : e.content;
      embed.addFields({
        name: `${shortId} — ${e.title}`,
        value: `${e.type} · ${confidenceDots(e.confidence)}\n${snippet}`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[knowledge search] Error:', err);
    await interaction.editReply('Knowledge search is temporarily unavailable. Try again shortly.');
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction, serverId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the **Manage Server** permission to delete knowledge entries.', ephemeral: true });
    return;
  }

  const rawId = interaction.options.getString('id', true);
  const shortHex = resolveShortId(rawId);
  await interaction.deferReply({ ephemeral: true });

  try {
    const { entries } = await backendGet<{
      entries: { id: string; title: string }[];
    }>(`/api/knowledge/${serverId}?limit=100`);

    const matches = entries.filter((e) => e.id.toLowerCase().startsWith(shortHex));

    if (matches.length === 0) {
      await interaction.editReply(`No entry found matching \`KE-${shortHex}\`.`);
      return;
    }
    if (matches.length > 1) {
      await interaction.editReply(`Multiple entries match \`KE-${shortHex}\`. Please use more characters or the full ID from the dashboard.`);
      return;
    }

    const entry = matches[0];
    await backendPut(`/api/knowledge/${serverId}/${entry.id}/archive`, {});
    await interaction.editReply(`Archived \`KE-${shortHex}\` — **${entry.title}**. Restore from dashboard if needed.`);
  } catch (err) {
    console.error('[knowledge delete] Error:', err);
    await interaction.editReply('Couldn\'t archive that entry right now. Try again shortly.');
  }
}

async function handleCorrect(interaction: ChatInputCommandInteraction, serverId: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the **Manage Server** permission to correct knowledge entries.', ephemeral: true });
    return;
  }

  const rawId = interaction.options.getString('id', true);
  const newContent = interaction.options.getString('content', true);
  const shortHex = resolveShortId(rawId);
  await interaction.deferReply({ ephemeral: true });

  try {
    const { entries } = await backendGet<{
      entries: { id: string; title: string }[];
    }>(`/api/knowledge/${serverId}?limit=100`);

    const matches = entries.filter((e) => e.id.toLowerCase().startsWith(shortHex));

    if (matches.length === 0) {
      await interaction.editReply(`No entry found matching \`KE-${shortHex}\`.`);
      return;
    }
    if (matches.length > 1) {
      await interaction.editReply(`Multiple entries match \`KE-${shortHex}\`. Please use more characters or the full ID from the dashboard.`);
      return;
    }

    const entry = matches[0];
    await backendPut(`/api/knowledge/${serverId}/${entry.id}`, { content: newContent });
    await interaction.editReply(`Updated \`KE-${shortHex}\` — **${entry.title}**. New content saved.`);
  } catch (err) {
    console.error('[knowledge correct] Error:', err);
    await interaction.editReply('Couldn\'t update that entry right now. Try again shortly.');
  }
}
