import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getBotId } from '../middleware/auth.js';
import { getProvider } from '../services/llm/providerRegistry.js';

export const messageRoutes = new Hono();

// POST /messages — store a message
messageRoutes.post('/messages', async (c) => {
  const { serverId, channelId, userId, displayName, content, isBot } = await c.req.json();
  if (!serverId || !channelId || !userId || !displayName || !content) {
    return c.json({ success: false, error: 'serverId, channelId, userId, displayName, and content are required' }, 400);
  }

  await rawQuery(
    `INSERT INTO messages (server_id, channel_id, user_id, display_name, content, is_bot)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [serverId, channelId, userId, displayName, content, isBot ?? false]
  );

  return c.json({ success: true });
});

// GET /messages — search, filter, paginate
messageRoutes.get('/messages', async (c) => {
  const serverId = c.req.query('serverId');
  if (!serverId) return c.json({ success: false, error: 'serverId is required' }, 400);

  const channelId = c.req.query('channelId');
  const q = c.req.query('q');
  const searchMode = c.req.query('searchMode') || 'text';
  const userId = c.req.query('userId');
  const botOnly = c.req.query('botOnly');
  const before = c.req.query('before');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const conditions: string[] = ['server_id = $1'];
  const params: unknown[] = [serverId];
  let paramIdx = 2;

  if (channelId) {
    conditions.push(`channel_id = $${paramIdx++}`);
    params.push(channelId);
  }
  if (userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    params.push(userId);
  }
  if (botOnly === 'true') {
    conditions.push('is_bot = true');
  }
  if (before) {
    conditions.push(`created_at < $${paramIdx++}`);
    params.push(before);
  }

  const where = conditions.join(' AND ');

  // Semantic search
  if (q && searchMode === 'semantic') {
    try {
      const botId = getBotId(c);
      let activeModel = 'gemini-2.5-flash';
      try {
        const settingsResult = await rawQuery(
          'SELECT active_model FROM server_settings WHERE server_id = $1 AND bot_id = $2',
          [serverId, botId]
        );
        if (settingsResult.rows.length > 0) activeModel = settingsResult.rows[0].active_model || activeModel;
      } catch { /* use default */ }

      const ai = getProvider(activeModel);
      const queryEmbedding = await ai.generateEmbedding(q);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      params.push(embeddingStr);
      params.push(limit);
      const result = await rawQuery(
        `SELECT id, server_id, channel_id, user_id, display_name, content, is_bot, created_at,
                embedding <=> $${paramIdx}::vector AS distance
         FROM messages
         WHERE ${where} AND embedding IS NOT NULL
         ORDER BY embedding <=> $${paramIdx++}::vector ASC
         LIMIT $${paramIdx}`,
        params
      );

      return c.json({
        messages: result.rows,
        nextCursor: null, // Semantic search doesn't use cursor pagination
      });
    } catch (err) {
      return c.json({ success: false, error: `Semantic search failed: ${(err as Error).message}` }, 500);
    }
  }

  // Full-text search
  if (q && searchMode === 'text') {
    params.push(q);
    params.push(limit);
    const result = await rawQuery(
      `SELECT id, server_id, channel_id, user_id, display_name, content, is_bot, created_at,
              ts_rank(search_vec, plainto_tsquery('english', $${paramIdx})) AS rank
       FROM messages
       WHERE ${where} AND search_vec @@ plainto_tsquery('english', $${paramIdx++})
       ORDER BY rank DESC, created_at DESC
       LIMIT $${paramIdx}`,
      params
    );

    return c.json({
      messages: result.rows,
      nextCursor: null,
    });
  }

  // Default: chronological browse
  params.push(limit + 1); // fetch one extra to detect if there's a next page
  const result = await rawQuery(
    `SELECT id, server_id, channel_id, user_id, display_name, content, is_bot, created_at
     FROM messages
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx}`,
    params
  );

  const rows = result.rows;
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return c.json({
    messages: rows,
    nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].created_at : null,
  });
});

// GET /messages/users — distinct users for a server (for filter dropdown)
messageRoutes.get('/messages/users', async (c) => {
  const serverId = c.req.query('serverId');
  if (!serverId) return c.json({ success: false, error: 'serverId is required' }, 400);

  const result = await rawQuery(
    `SELECT DISTINCT user_id, display_name, is_bot
     FROM messages
     WHERE server_id = $1
     ORDER BY display_name`,
    [serverId]
  );

  return c.json({ users: result.rows });
});
