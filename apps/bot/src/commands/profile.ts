import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View the inferred JSONB context built for a specific user.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to view')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  await interaction.reply({ content: `Fetching Contexta's cached profile for ${user.username}`, ephemeral: true });
}
