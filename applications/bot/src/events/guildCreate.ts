import { Guild, Events } from 'discord.js';
import { rawQuery } from '@contexta/db';

export const name = Events.GuildCreate;
export const once = false;

export async function execute(guild: Guild) {
  const botId = process.env.BOT_CLIENT_ID;
  if (!botId) {
    console.warn('[guildCreate] BOT_CLIENT_ID not set, skipping server_settings sync');
    return;
  }
  console.log(`[guildCreate] Bot ${botId} added to guild: ${guild.name} (${guild.id})`);
  await rawQuery(
    `INSERT INTO server_settings (server_id, bot_id, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (server_id, bot_id) DO UPDATE SET is_active = true`,
    [guild.id, botId]
  );
}
