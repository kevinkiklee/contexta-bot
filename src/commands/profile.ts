import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';

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

  const result = await query(
    `SELECT gu.global_name, sm.inferred_context, sm.preferences, sm.interaction_count, gu.last_interaction
     FROM server_members sm
     JOIN global_users gu ON gu.user_id = sm.user_id
     WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, user.id]
  );

  if (result.rows.length === 0) {
    await interaction.reply({
      content: `No profile data for ${user.username} yet. Contexta builds profiles as users interact in the server.`,
      ephemeral: true,
    });
    return;
  }

  const row = result.rows[0];
  const prefs = typeof row.preferences === 'string'
    ? row.preferences
    : JSON.stringify(row.preferences, null, 2);

  const lines = [
    `**Profile: ${row.global_name || user.username}**`,
    '',
    `**Context:** ${row.inferred_context || 'None yet'}`,
    `**Preferences:** \`\`\`json\n${prefs}\n\`\`\``,
    `**Interactions:** ${row.interaction_count}`,
    `**Last active:** ${row.last_interaction ? new Date(row.last_interaction).toUTCString() : 'Unknown'}`,
  ];

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
