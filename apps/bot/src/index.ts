import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './utils/redis.js';
import { startHealthServer } from './utils/httpServer.js';

dotenv.config();

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

  client.once('ready', async () => {
    try {
      await registerCommands();
    } catch (err) {
      console.error('[Loader] Failed to register commands:', err);
    }
    console.log(`[Contexta Bot] Boot sequence complete. System online.`);
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Contexta Bot] FATAL ERROR: DISCORD_TOKEN is missing. Please set it in your .env file.');
    process.exit(1);
  }

  await client.login(token);

  startHealthServer();
}

start();
