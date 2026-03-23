// src/commands/summarize.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { isRateLimited } from '../utils/rateLimiter.js';

export const data = new SlashCommandBuilder()
  .setName('summarize')
  .setDescription('Catch up on a fast-moving channel.')
  .addIntegerOption(option =>
    option.setName('hours')
      .setDescription('Hours of history to catch up on (max 168 = 1 week)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(168)) // Fix #3: bound the parameter to prevent runaway API calls
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to summarize (defaults to current)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  // Fix #3: rate limit per user
  if (isRateLimited(interaction.user.id)) {
    await interaction.reply({ content: 'You are sending commands too quickly. Please wait a moment.', ephemeral: true });
    return;
  }

  const hours = interaction.options.getInteger('hours', true);
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  await interaction.deferReply();
  await interaction.editReply(`Summarizing the last ${hours} hours in ${targetChannel}...`);
}
