import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('summarize')
  .setDescription('Catch up on a fast-moving channel.')
  .addIntegerOption(option => 
    option.setName('hours')
      .setDescription('Hours of history to catch up on')
      .setRequired(true))
  .addChannelOption(option => 
    option.setName('channel')
      .setDescription('Channel to summarize (defaults to current)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const hours = interaction.options.getInteger('hours', true);
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  
  await interaction.deferReply();
  await interaction.editReply(`Summarizing the last ${hours} hours in ${targetChannel}...`);
}
