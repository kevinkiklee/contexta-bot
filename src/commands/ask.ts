import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask Contexta a direct question.')
  .addStringOption(option => 
    option.setName('query')
      .setDescription('Your core question')
      .setRequired(true))
  .addBooleanOption(option => 
    option.setName('private')
      .setDescription('Whether the response should be hidden from others (ephemeral)')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  const isPrivate = interaction.options.getBoolean('private') || false;

  await interaction.deferReply({ ephemeral: isPrivate });
  
  // Real implementation: Call the Gemini Provider
  await interaction.editReply(`You asked: "${query}". Contexta is processing this...`);
}
