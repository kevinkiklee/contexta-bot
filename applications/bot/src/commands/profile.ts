import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendGet } from '../lib/backendClient.js';

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
  const serverId = interaction.guildId!;

  const { profile } = await backendGet<{ profile: any }>(`/api/servers/${serverId}/profile/${user.id}`);

  if (!profile) {
    await interaction.reply({
      content: `No profile data for ${user.username} yet. Contexta builds profiles as users interact in the server.`,
      ephemeral: true,
    });
    return;
  }

  const prefs = typeof profile.preferences === 'string'
    ? profile.preferences
    : JSON.stringify(profile.preferences, null, 2);

  const lines = [
    `**Profile: ${profile.global_name || user.username}**`,
    '',
    `**Context:** ${profile.inferred_context || 'None yet'}`,
    `**Preferences:** \`\`\`json\n${prefs}\n\`\`\``,
    `**Interactions:** ${profile.interaction_count}`,
    `**Last active:** ${profile.last_interaction ? new Date(profile.last_interaction).toUTCString() : 'Unknown'}`,
  ];

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
