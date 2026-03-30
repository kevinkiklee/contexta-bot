import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../services/llm/providerRegistry.js';

export const knowledgeSearchRoutes = new Hono();

knowledgeSearchRoutes.post('/knowledge/:serverId/search', async (c) => {
  const serverId = c.req.param('serverId');
  const { query, limit = 5, minConfidence = 0.3 } = await c.req.json();

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  const ai = getProvider('gemini-2.5-flash');
  const embedding = await ai.generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  const searchResult = await rawQuery(
    `SELECT id, type, title, content, confidence, source_channel_id, created_at,
            1 - (embedding <=> $3::vector) AS similarity
     FROM knowledge_entries
     WHERE server_id = $1
       AND is_archived = false
       AND confidence >= $2
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, minConfidence, vectorStr, limit]
  );

  if (searchResult.rows.length === 0) {
    return c.json({ entries: [], related: [] });
  }

  const entryIds = searchResult.rows.map((r: { id: string }) => r.id);
  const relatedResult = await rawQuery(
    `SELECT DISTINCT ke.id, ke.type, ke.title, ke.content, kel.relationship
     FROM knowledge_entry_links kel
     JOIN knowledge_entries ke ON ke.id = CASE
       WHEN kel.source_id = ANY($1::uuid[]) THEN kel.target_id
       ELSE kel.source_id
     END
     WHERE (kel.source_id = ANY($1::uuid[]) OR kel.target_id = ANY($1::uuid[]))
       AND ke.id != ALL($1::uuid[])
       AND ke.is_archived = false
     LIMIT $2`,
    [entryIds, limit * 3]
  );

  return c.json({
    entries: searchResult.rows,
    related: relatedResult.rows,
  });
});
