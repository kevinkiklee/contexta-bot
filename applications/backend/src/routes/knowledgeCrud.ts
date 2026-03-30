import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';

export const knowledgeCrudRoutes = new Hono();

// GET /knowledge/:serverId/stats
knowledgeCrudRoutes.get('/knowledge/:serverId/stats', async (c) => {
  const serverId = c.req.param('serverId');

  const result = await rawQuery(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'published')      AS published,
       COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_review,
       COUNT(*) FILTER (WHERE status = 'rejected')       AS rejected,
       COUNT(*) FILTER (WHERE status = 'archived')       AS archived,
       AVG(confidence)                                    AS avg_confidence,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS created_this_week
     FROM knowledge_entries
     WHERE server_id = $1`,
    [serverId]
  );

  return c.json(result.rows[0]);
});

// PUT /knowledge/:serverId/:id — update entry fields
knowledgeCrudRoutes.put('/knowledge/:serverId/:id', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const allowed = ['title', 'content', 'type', 'confidence'] as const;
  type AllowedField = (typeof allowed)[number];

  const updates: { field: AllowedField; value: unknown }[] = [];
  for (const field of allowed) {
    if (field in body) {
      updates.push({ field, value: body[field] });
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No valid fields provided' }, 400);
  }

  const setClauses = updates.map((u, i) => `${u.field} = $${i + 3}`).join(', ');
  const values = updates.map((u) => u.value);

  const result = await rawQuery(
    `UPDATE knowledge_entries
     SET ${setClauses}, updated_at = NOW()
     WHERE server_id = $1 AND id = $2
     RETURNING *`,
    [serverId, id, ...values]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json(result.rows[0]);
});

// PUT /knowledge/:serverId/:id/approve
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/approve', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries
     SET status = 'published', updated_at = NOW()
     WHERE server_id = $1 AND id = $2
     RETURNING *`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json(result.rows[0]);
});

// PUT /knowledge/:serverId/:id/reject
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/reject', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries
     SET status = 'rejected', updated_at = NOW()
     WHERE server_id = $1 AND id = $2
     RETURNING *`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json(result.rows[0]);
});

// PUT /knowledge/:serverId/:id/pin — toggle is_pinned
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/pin', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries
     SET is_pinned = NOT is_pinned, updated_at = NOW()
     WHERE server_id = $1 AND id = $2
     RETURNING is_pinned`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ is_pinned: result.rows[0].is_pinned });
});

// PUT /knowledge/:serverId/:id/archive — toggle is_archived
knowledgeCrudRoutes.put('/knowledge/:serverId/:id/archive', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const result = await rawQuery(
    `UPDATE knowledge_entries
     SET is_archived = NOT is_archived, updated_at = NOW()
     WHERE server_id = $1 AND id = $2
     RETURNING is_archived`,
    [serverId, id]
  );

  if (result.rows.length === 0) {
    return c.json({ error: 'Entry not found' }, 404);
  }

  return c.json({ is_archived: result.rows[0].is_archived });
});
