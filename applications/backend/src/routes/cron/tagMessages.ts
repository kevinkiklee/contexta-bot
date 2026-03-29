import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildTaggingPrompt } from '../../services/llm/prompts.js';

export const tagMessagesRoutes = new Hono();

const BATCH_SIZE = 100;

tagMessagesRoutes.post('/tag-messages', async (c) => {
  const ai = getProvider('gemini-2.5-flash');
  let processed = 0;
  const errors: string[] = [];

  const result = await rawQuery(
    `SELECT id, content, display_name FROM messages WHERE tags IS NULL ORDER BY created_at ASC LIMIT $1`,
    [BATCH_SIZE]
  );

  if (result.rows.length === 0) {
    return c.json({ status: 'completed', processed: 0, errors: [] });
  }

  try {
    const prompt = buildTaggingPrompt(
      result.rows.map((r: { id: string; content: string; display_name: string }) => ({
        id: r.id,
        content: r.content,
        displayName: r.display_name,
      }))
    );

    const response = await ai.generateChatResponse(prompt, []);
    const tags = JSON.parse(response) as {
      index: number;
      topics: string[];
      isDecision: boolean;
      isActionItem: boolean;
      isReference: boolean;
      confidence: number;
    }[];

    for (const tag of tags) {
      const row = result.rows[tag.index];
      if (!row) continue;

      try {
        await rawQuery(
          `UPDATE messages SET tags = $1::jsonb WHERE id = $2`,
          [JSON.stringify({
            topics: tag.topics,
            isDecision: tag.isDecision,
            isActionItem: tag.isActionItem,
            isReference: tag.isReference,
            confidence: tag.confidence,
          }), row.id]
        );
        processed++;
      } catch (err) {
        errors.push(`${row.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`batch: ${(err as Error).message}`);
  }

  return c.json({ status: 'completed', processed, errors });
});
