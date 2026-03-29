import { Guild, Events } from 'discord.js';
import { rawQuery } from '@contexta/db';

export const name = Events.GuildDelete;
export const once = false;

export async function execute(guild: Guild) {
  const botId = process.env.BOT_CLIENT_ID;
  if (!botId) {
    console.warn('[guildDelete] BOT_CLIENT_ID not set, skipping server_settings sync');
    return;
  }
  console.log(`[guildDelete] Bot ${botId} removed from guild: ${guild.name} (${guild.id})`);
  await rawQuery(
    `UPDATE server_settings SET is_active = false WHERE server_id = $1 AND bot_id = $2`,
    [guild.id, botId]
  );
}
