import { Interaction, Events } from 'discord.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as any).commands.get(interaction.commandName);

  if (!command) {
    console.error(`[interactionCreate] No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('[interactionCreate] Command execution error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an exception while executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an exception while executing this command.', ephemeral: true });
    }
  }
}
