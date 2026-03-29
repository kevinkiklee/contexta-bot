import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';
import { runSemanticEmbeddingWorker } from '../services/embeddingWorker.js';

export const embeddingRoutes = new Hono();

embeddingRoutes.post('/embeddings/generate', async (c) => {
  const { text } = await c.req.json();
  if (!text) return c.json({ success: false, error: 'text is required' }, 400);

  const ai = getProvider('gemini-2.5-flash');
  const embedding = await ai.generateEmbedding(text);
  return c.json({ embedding });
});

embeddingRoutes.post('/embeddings/search', async (c) => {
  const { serverId, channelId, embedding, limit = 5 } = await c.req.json();
  if (!serverId || !channelId || !embedding) {
    return c.json({ success: false, error: 'serverId, channelId, and embedding are required' }, 400);
  }

  const result = await rawQuery(
    `SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
     FROM channel_memory_vectors
     WHERE server_id = $1 AND channel_id = $2
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, channelId, `[${embedding.join(',')}]`, limit]
  );

  return c.json({ results: result.rows });
});

embeddingRoutes.post('/cron/embeddings', async (c) => {
  const stats = await runSemanticEmbeddingWorker();
  return c.json(stats);
});

// Backfill message embeddings for semantic search
embeddingRoutes.post('/cron/message-embeddings', async (c) => {
  const BATCH_SIZE = 50;
  const ai = getProvider('gemini-2.5-flash');
  let processed = 0;
  const errors: string[] = [];

  try {
    const result = await rawQuery(
      `SELECT id, content FROM messages WHERE embedding IS NULL ORDER BY created_at DESC LIMIT $1`,
      [BATCH_SIZE]
    );

    for (const row of result.rows) {
      try {
        const embedding = await ai.generateEmbedding(row.content);
        await rawQuery(
          `UPDATE messages SET embedding = $1::vector WHERE id = $2`,
          [`[${embedding.join(',')}]`, row.id]
        );
        processed++;
      } catch (err) {
        errors.push(`${row.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    return c.json({ status: 'error', error: (err as Error).message }, 500);
  }

  return c.json({ status: 'completed', processed, errors });
});
