import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './utils/redis.js';
import { runSemanticEmbeddingWorker } from './utils/backgroundWorker.js';

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

// Extend client with a commands collection
(client as any).commands = new Collection();

async function initServices() {
  await initRedis();
  
  // Example: Run the semantic worker once every hour
  // setInterval(runSemanticEmbeddingWorker, 1000 * 60 * 60);
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;
  
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    // Dynamic import for ES modules
    const event = await import(`file://${filePath}`);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

async function start() {
  await initServices();
  await loadEvents();
  
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Contexta Bot] FATAL ERROR: DISCORD_TOKEN is missing. Please set it in your .env file.');
    process.exit(1);
  }
  
  await client.login(token);
  console.log(`[Contexta Bot] Boot sequence complete. System online.`);
}

start();
