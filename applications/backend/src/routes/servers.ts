import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const serverRoutes = new Hono();

serverRoutes.get('/servers/:id/settings', async (c) => {
  const serverId = c.req.param('id');
  const result = await rawQuery(
    'SELECT server_id, active_model, server_lore, context_cache_id, cache_expires_at, is_active FROM server_settings WHERE server_id = $1',
    [serverId]
  );
  if (result.rows.length === 0) return c.json({ settings: null });
  return c.json({ settings: result.rows[0] });
});

serverRoutes.put('/servers/:id/settings/model', async (c) => {
  const serverId = c.req.param('id');
  const { model } = await c.req.json();
  if (!model) return c.json({ success: false, error: 'model is required' }, 400);

  try { getProvider(model); } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 400);
  }

  await rawQuery(
    `INSERT INTO server_settings (server_id, active_model) VALUES ($1, $2) ON CONFLICT (server_id) DO UPDATE SET active_model = $2`,
    [serverId, model]
  );
  return c.json({ success: true });
});

serverRoutes.get('/servers/:id/lore', async (c) => {
  const serverId = c.req.param('id');
  const result = await rawQuery('SELECT server_lore FROM server_settings WHERE server_id = $1', [serverId]);
  return c.json({ lore: result.rows[0]?.server_lore || null });
});

serverRoutes.put('/servers/:id/lore', async (c) => {
  const serverId = c.req.param('id');
  const { text } = await c.req.json();
  if (!text) return c.json({ success: false, error: 'text is required' }, 400);

  await rawQuery(
    `INSERT INTO server_settings (server_id, server_lore, context_cache_id, cache_expires_at) VALUES ($1, $2, NULL, NULL) ON CONFLICT (server_id) DO UPDATE SET server_lore = $2, context_cache_id = NULL, cache_expires_at = NULL`,
    [serverId, text]
  );
  return c.json({ success: true });
});

serverRoutes.get('/servers/:id/profile/:userId', async (c) => {
  const serverId = c.req.param('id');
  const userId = c.req.param('userId');
  const result = await rawQuery(
    `SELECT gu.global_name, sm.inferred_context, sm.preferences, sm.interaction_count, gu.last_interaction FROM server_members sm JOIN global_users gu ON gu.user_id = sm.user_id WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, userId]
  );
  if (result.rows.length === 0) return c.json({ profile: null });
  return c.json({ profile: result.rows[0] });
});
