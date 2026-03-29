import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const cacheRoutes = new Hono();

cacheRoutes.post('/cache/refresh', async (c) => {
  const { serverId } = await c.req.json();
  if (!serverId) return c.json({ success: false, error: 'serverId is required' }, 400);

  const result = await rawQuery('SELECT server_lore, active_model FROM server_settings WHERE server_id = $1', [serverId]);
  if (result.rows.length === 0 || !result.rows[0].server_lore) {
    return c.json({ success: false, error: 'No server lore to cache' }, 400);
  }

  const { server_lore, active_model } = result.rows[0];
  if (!active_model.startsWith('gemini-')) {
    return c.json({ success: false, error: 'Context caching is only available with Gemini models' }, 400);
  }

  const ai = getProvider(active_model);
  const cacheId = await ai.createServerContextCache(server_lore, 60);
  await rawQuery(
    `UPDATE server_settings SET context_cache_id = $1, cache_expires_at = NOW() + INTERVAL '60 minutes' WHERE server_id = $2`,
    [cacheId, serverId]
  );

  return c.json({ cacheId });
});

cacheRoutes.delete('/cache/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  await rawQuery('UPDATE server_settings SET context_cache_id = NULL, cache_expires_at = NULL WHERE server_id = $1', [serverId]);
  return c.json({ success: true });
});
