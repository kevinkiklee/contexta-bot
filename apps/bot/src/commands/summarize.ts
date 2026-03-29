import { SlashCommandBuilder, ChatInputCommandInteraction, SnowflakeUtil, TextChannel } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

export const data = new SlashCommandBuilder()
  .setName('summarize')
  .setDescription('Catch up on a fast-moving channel.')
  .addIntegerOption(option =>
    option.setName('hours')
      .setDescription('Hours of history to catch up on (max 168 = 1 week)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(168))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to summarize (defaults to current)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const hours = interaction.options.getInteger('hours', true);
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  await interaction.deferReply();

  try {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const afterSnowflake = SnowflakeUtil.generate({ timestamp: cutoffTime });

    const channel = targetChannel as TextChannel;
    const fetched = await channel.messages.fetch({ after: afterSnowflake.toString(), limit: 100 });

    if (fetched.size === 0) {
      await interaction.editReply('No messages found in that time range.');
      return;
    }

    const formatted = [...fetched.values()]
      .filter(msg => !msg.author.bot)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(msg => `[${msg.author.username}]: ${msg.content}`)
      .join('\n');

    if (!formatted) {
      await interaction.editReply('No user messages found in that time range.');
      return;
    }

    const settingsResult = await query(
      'SELECT active_model FROM server_settings WHERE server_id = $1',
      [interaction.guildId]
    );
    const activeModel = settingsResult.rows[0]?.active_model || 'gemini-2.5-flash';
    const ai = getProvider(activeModel);

    const summary = await ai.summarizeText(formatted);

    if (summary.length > 2000) {
      await interaction.editReply(summary.substring(0, 2000));
    } else {
      await interaction.editReply(summary);
    }
  } catch (err) {
    console.error('[summarize] Error:', err);
    await interaction.editReply('There was an error generating the summary.');
  }
}
