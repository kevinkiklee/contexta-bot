import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { botAuth, cronAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { chatRoutes } from './routes/chat.js';
import { embeddingRoutes } from './routes/embeddings.js';
import { serverRoutes } from './routes/servers.js';
import { attachmentRoutes } from './routes/attachments.js';
import { cacheRoutes } from './routes/cache.js';
import { messageRoutes } from './routes/messages.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { knowledgeSearchRoutes } from './routes/knowledgeSearch.js';
import { tagMessagesRoutes } from './routes/cron/tagMessages.js';
import { extractKnowledgeRoutes } from './routes/cron/extractKnowledge.js';
import { summarizeChannelsRoutes } from './routes/cron/summarizeChannels.js';
import { inferProfilesRoutes } from './routes/cron/inferProfiles.js';
import { initRedis } from './lib/redis.js';

dotenv.config();

const app = new Hono();

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Cron sub-app (cronAuth only — isolated from botAuth)
const cronApp = new Hono();
cronApp.use('/*', cronAuth());
cronApp.route('/', embeddingRoutes);
cronApp.route('/', tagMessagesRoutes);
cronApp.route('/', extractKnowledgeRoutes);
cronApp.route('/', summarizeChannelsRoutes);
cronApp.route('/', inferProfilesRoutes);
app.route('/api/cron', cronApp);

// Bot-facing API routes (bot API key auth)
const apiApp = new Hono();
apiApp.use('/*', botAuth());
apiApp.route('/', chatRoutes);
apiApp.route('/', embeddingRoutes);
apiApp.route('/', serverRoutes);
apiApp.route('/', attachmentRoutes);
apiApp.route('/', cacheRoutes);
apiApp.route('/', messageRoutes);
apiApp.route('/', knowledgeRoutes);
apiApp.route('/', knowledgeSearchRoutes);
app.route('/api', apiApp);

// Error handler
app.onError(errorHandler);

const port = parseInt(process.env.PORT || '5010', 10);

async function start() {
  await initRedis();

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[Backend] Server listening on port ${port}`);
  });
}

start();
