import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = parseInt(process.env.PORT || '4000', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[Backend] Server listening on port ${port}`);
});
