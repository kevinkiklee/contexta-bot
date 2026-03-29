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
import { initRedis } from './lib/redis.js';

dotenv.config();

const app = new Hono();

// Health check (no auth)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Cron sub-app (cronAuth only — isolated from botAuth)
const cronApp = new Hono();
cronApp.use('/*', cronAuth());
cronApp.route('/', embeddingRoutes);
app.route('/api/cron', cronApp);

// Bot-facing API routes (bot API key auth)
const apiApp = new Hono();
apiApp.use('/*', botAuth());
apiApp.route('/', chatRoutes);
apiApp.route('/', embeddingRoutes);
apiApp.route('/', serverRoutes);
apiApp.route('/', attachmentRoutes);
apiApp.route('/', cacheRoutes);
app.route('/api', apiApp);

// Error handler
app.onError(errorHandler);

const port = parseInt(process.env.PORT || '6000', 10);

async function start() {
  await initRedis();

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[Backend] Server listening on port ${port}`);
  });
}

start();
