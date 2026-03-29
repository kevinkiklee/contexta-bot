import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { query } from '../db/index.js';
import { getProvider } from '../llm/providerRegistry.js';

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
      getProvider(modelName);
    } catch (err) {
      await interaction.reply({
        content: `Cannot switch to ${modelName} — ${(err as Error).message}`,
        ephemeral: true,
      });
      return;
    }

    await query(
      `INSERT INTO server_settings (server_id, active_model)
       VALUES ($1, $2)
       ON CONFLICT (server_id)
       DO UPDATE SET active_model = $2`,
      [serverId, modelName]
    );

    await interaction.reply({
      content: `Active model switched to **${modelName}**.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'cache') {
    const action = interaction.options.getString('action', true);

    if (action === 'clear') {
      await query(
        'UPDATE server_settings SET context_cache_id = NULL, cache_expires_at = NULL WHERE server_id = $1',
        [serverId]
      );
      await interaction.reply({ content: 'Context cache cleared.', ephemeral: true });
      return;
    }

    if (action === 'refresh') {
      const result = await query(
        'SELECT server_lore, active_model FROM server_settings WHERE server_id = $1',
        [serverId]
      );

      if (result.rows.length === 0 || !result.rows[0].server_lore) {
        await interaction.reply({
          content: 'No server lore to cache. Use `/lore update` first.',
          ephemeral: true,
        });
        return;
      }

      const { server_lore, active_model } = result.rows[0];

      if (!active_model.startsWith('gemini-')) {
        await interaction.reply({
          content: 'Context caching is only available with Gemini models.',
          ephemeral: true,
        });
        return;
      }

      const ai = getProvider(active_model);
      const cacheId = await ai.createServerContextCache(server_lore, 60);

      await query(
        `UPDATE server_settings SET context_cache_id = $1, cache_expires_at = NOW() + INTERVAL '60 minutes' WHERE server_id = $2`,
        [cacheId, serverId]
      );

      await interaction.reply({
        content: 'Context cache refreshed (expires in 60 minutes).',
        ephemeral: true,
      });
    }
  }
}
