import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './utils/redis.js';
import { startHealthServer } from './utils/httpServer.js';
import { rawQuery } from '@contexta/db';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

(client as any).commands = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const commandFiles = fs.readdirSync(commandsPath).filter(
    file => file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(`file://${filePath}`);

    if (command.data && command.execute) {
      (client as any).commands.set(command.data.name, command);
    } else {
      console.warn(`[Loader] Command file ${file} is missing 'data' or 'execute' export.`);
    }
  }

  console.log(`[Loader] Loaded ${(client as any).commands.size} commands.`);
}

async function registerCommands() {
  const commands = (client as any).commands.map((cmd: any) => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  const devGuildId = process.env.DEV_GUILD_ID;

  if (devGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, devGuildId),
      { body: commands }
    );
    console.log(`[Loader] Registered ${commands.length} commands to dev guild ${devGuildId}.`);
  } else {
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    console.log(`[Loader] Registered ${commands.length} commands globally.`);
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter(
    file => file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(`file://${filePath}`);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

async function initServices() {
  await initRedis();
}

async function start() {
  await initServices();
  await loadCommands();
  await loadEvents();

  client.once('clientReady', async () => {
    try {
      await registerCommands();
    } catch (err) {
      console.error('[Loader] Failed to register commands:', err);
    }

    // Sync guild membership to server_settings so the dashboard
    // only shows servers where the bot is actually installed.
    const botId = process.env.BOT_CLIENT_ID;
    if (!botId) {
      console.warn('[Sync] BOT_CLIENT_ID not set, skipping guild sync to server_settings.');
    } else {
      try {
        const guildIds = [...client.guilds.cache.keys()];
        if (guildIds.length > 0) {
          // $1 = botId, then $2..$N = guildIds
          const values = guildIds.map((_, i) => `($${i + 2}, $1, true)`).join(', ');
          await rawQuery(
            `INSERT INTO server_settings (server_id, bot_id, is_active) VALUES ${values}
             ON CONFLICT (server_id, bot_id) DO UPDATE SET is_active = true`,
            [botId, ...guildIds]
          );
        }
        // Deactivate servers this bot is no longer in
        const deactivateParams: unknown[] = [botId];
        let deactivateWhere = `WHERE bot_id = $1 AND is_active = true`;
        if (guildIds.length > 0) {
          const placeholders = guildIds.map((_, i) => `$${i + 2}`).join(', ');
          deactivateWhere += ` AND server_id NOT IN (${placeholders})`;
          deactivateParams.push(...guildIds);
        }
        await rawQuery(`UPDATE server_settings SET is_active = false ${deactivateWhere}`, deactivateParams);
        console.log(`[Sync] Synced ${guildIds.length} guild(s) for bot ${botId}.`);
      } catch (err) {
        console.error('[Sync] Failed to sync guilds:', err);
      }
    }
    const healthPort = process.env.PORT || '3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5000';
    const guilds = client.guilds.cache.size;
    const commands = (client as any).commands.size;

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║           Contexta Bot — System Online           ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Discord    : ${client.user!.tag.padEnd(35)}║`);
    console.log(`║  Guilds     : ${String(guilds).padEnd(35)}║`);
    console.log(`║  Commands   : ${String(commands).padEnd(35)}║`);
    console.log(`║  Health     : http://localhost:${healthPort}/health${' '.repeat(Math.max(0, 35 - 22 - healthPort.length))}║`);
    console.log(`║  Backend    : ${backendUrl.padEnd(35)}║`);
    console.log(`║  Dashboard  : ${dashboardUrl.padEnd(35)}║`);
    console.log(`║  Redis      : ${(process.env.REDIS_URL || 'redis://localhost:6379').padEnd(35)}║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Contexta Bot] FATAL ERROR: DISCORD_TOKEN is missing. Please set it in your .env file.');
    process.exit(1);
  }

  await client.login(token);

  try {
    startHealthServer();
  } catch (err) {
    console.warn('[Contexta Bot] Health server failed to start:', err);
  }
}

start();
