import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Admin commands to configure the bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Admin only
  .addSubcommand(subcommand =>
    subcommand
      .setName('cache')
      .setDescription('Manage the Gemini context cache for server lore')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'refresh', value: 'refresh' },
            { name: 'clear', value: 'clear' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('model')
      .setDescription('Dynamically swap the active LLM interface')
      .addStringOption(option =>
        option.setName('provider')
          .setDescription('The AI model to use')
          .setRequired(true)
          .addChoices(
            { name: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
            { name: 'gemini-2.0-pro', value: 'gemini-2.0-pro' }
          )));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }
  const subcommand = interaction.options.getSubcommand();
  await interaction.reply({ content: `Processing settings update for: ${subcommand}...`, ephemeral: true });
}
