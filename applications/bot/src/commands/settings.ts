import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { backendPut, backendPost, backendDelete } from '../lib/backendClient.js';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Admin commands to configure the bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('cache')
      .setDescription('Manage the context cache for server lore')
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
            { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
            { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
            { name: 'GPT-4o', value: 'gpt-4o' },
            { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            { name: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
            { name: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
          )));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const serverId = interaction.guildId!;

  if (subcommand === 'model') {
    const modelName = interaction.options.getString('provider', true);

    try {
      await backendPut(`/api/servers/${serverId}/settings/model`, { model: modelName });
      await interaction.reply({ content: `Active model switched to **${modelName}**.`, ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `Cannot switch to ${modelName} — ${(err as Error).message}`, ephemeral: true });
    }
    return;
  }

  if (subcommand === 'cache') {
    const action = interaction.options.getString('action', true);

    if (action === 'clear') {
      await backendDelete(`/api/cache/${serverId}`);
      await interaction.reply({ content: 'Context cache cleared.', ephemeral: true });
      return;
    }

    if (action === 'refresh') {
      try {
        await backendPost('/api/cache/refresh', { serverId });
        await interaction.reply({ content: 'Context cache refreshed (expires in 60 minutes).', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: (err as Error).message, ephemeral: true });
      }
    }
  }
}
