import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';

export const knowledgeRoutes = new Hono();

// List knowledge entries (paginated, filtered)
knowledgeRoutes.get('/knowledge/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const cursor = c.req.query('cursor');
  const type = c.req.query('type');
  const includeArchived = c.req.query('includeArchived') === 'true';

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (!includeArchived) {
    conditions.push('is_archived = false');
  }

  if (type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  const status = c.req.query('status');
  if (status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (cursor) {
    conditions.push(`created_at < $${paramIdx}`);
    params.push(cursor);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT id, server_id, type, title, content, confidence, status, source_channel_id, source_message_ids, metadata, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ entries: result.rows });
});

// Get single entry with graph neighborhood
knowledgeRoutes.get('/knowledge/:serverId/:id', async (c) => {
  const serverId = c.req.param('serverId');
  const id = c.req.param('id');

  const entryResult = await rawQuery(
    `SELECT id, server_id, type, title, content, confidence, source_channel_id, source_message_ids, metadata, is_archived, is_pinned, created_at, updated_at
     FROM knowledge_entries
     WHERE id = $1 AND server_id = $2`,
    [id, serverId]
  );

  if (entryResult.rowCount === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  const linksResult = await rawQuery(
    `SELECT kel.id, kel.source_id, kel.target_id, kel.relationship,
            ke.title AS target_title, ke.type AS target_type
     FROM knowledge_entry_links kel
     JOIN knowledge_entries ke ON ke.id = CASE WHEN kel.source_id = $1 THEN kel.target_id ELSE kel.source_id END
     WHERE kel.source_id = $1 OR kel.target_id = $1`,
    [id]
  );

  return c.json({ entry: entryResult.rows[0], links: linksResult.rows });
});

// List channel summaries
knowledgeRoutes.get('/summaries/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const channelId = c.req.query('channelId');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (channelId) {
    conditions.push(`channel_id = $${paramIdx}`);
    params.push(channelId);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT id, server_id, channel_id, period_start, period_end, summary, topics, decisions, open_questions, action_items, message_count, created_at
     FROM channel_summaries
     WHERE ${conditions.join(' AND ')}
     ORDER BY period_end DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ summaries: result.rows });
});

// List user expertise
knowledgeRoutes.get('/expertise/:serverId', async (c) => {
  const serverId = c.req.param('serverId');
  const topic = c.req.query('topic');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') || '10', 10);

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (topic) {
    conditions.push(`topic ILIKE $${paramIdx}`);
    params.push(`%${topic}%`);
    paramIdx++;
  }

  if (userId) {
    conditions.push(`user_id = $${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }

  params.push(limit);

  const result = await rawQuery(
    `SELECT user_id, topic, score, message_count, last_seen_at
     FROM user_expertise
     WHERE ${conditions.join(' AND ')}
     ORDER BY score DESC
     LIMIT $${paramIdx}`,
    params
  );

  return c.json({ expertise: result.rows });
});
