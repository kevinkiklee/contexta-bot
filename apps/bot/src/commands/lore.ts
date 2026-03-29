import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendGet, backendPut } from '../lib/backendClient.js';

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
    const { lore } = await backendGet<{ lore: string | null }>(`/api/servers/${serverId}/lore`);
    if (!lore) {
      await interaction.reply({ content: 'No lore configured for this server.', ephemeral: true });
    } else {
      await interaction.reply({ content: lore, ephemeral: true });
    }
    return;
  }

  if (action === 'update') {
    const text = interaction.options.getString('text');
    if (!text) {
      await interaction.reply({ content: 'Please provide the lore text using the `text` option.', ephemeral: true });
      return;
    }

    await backendPut(`/api/servers/${serverId}/lore`, { text });
    await interaction.reply({ content: 'Server lore updated successfully.', ephemeral: true });
  }
}
