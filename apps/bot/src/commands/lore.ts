import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';

export const data = new SlashCommandBuilder()
  .setName('lore')
  .setDescription('Update the overarching rules and community themes.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Action to perform on server lore')
      .setRequired(true)
      .addChoices(
        { name: 'view', value: 'view' },
        { name: 'update', value: 'update' }
      ))
  .addStringOption(option =>
    option.setName('text')
      .setDescription('The lore text (if updating)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const action = interaction.options.getString('action', true);
  const serverId = interaction.guildId!;

  if (action === 'view') {
    const result = await query(
      'SELECT server_lore FROM server_settings WHERE server_id = $1',
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].server_lore) {
      await interaction.reply({ content: 'No lore configured for this server.', ephemeral: true });
    } else {
      await interaction.reply({ content: result.rows[0].server_lore, ephemeral: true });
    }
    return;
  }

  if (action === 'update') {
    const text = interaction.options.getString('text');
    if (!text) {
      await interaction.reply({ content: 'Please provide the lore text using the `text` option.', ephemeral: true });
      return;
    }

    await query(
      `INSERT INTO server_settings (server_id, server_lore, context_cache_id, cache_expires_at)
       VALUES ($1, $2, NULL, NULL)
       ON CONFLICT (server_id)
       DO UPDATE SET server_lore = $2, context_cache_id = NULL, cache_expires_at = NULL`,
      [serverId, text]
    );

    await interaction.reply({ content: 'Server lore updated successfully.', ephemeral: true });
  }
}
