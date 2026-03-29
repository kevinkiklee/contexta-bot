import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

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
  await interaction.reply({ content: `Lore action received: ${action}`, ephemeral: true });
}
