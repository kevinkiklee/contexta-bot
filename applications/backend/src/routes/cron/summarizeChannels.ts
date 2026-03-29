import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildSummaryPrompt } from '../../services/llm/prompts.js';

export const summarizeChannelsRoutes = new Hono();

const MIN_MESSAGES = 10;

summarizeChannelsRoutes.post('/summarize-channels', async (c) => {
  const ai = getProvider('gemini-2.5-pro');
  let summarized = 0;
  const errors: string[] = [];

  const channelsResult = await rawQuery(
    `SELECT m.server_id, m.channel_id,
            COUNT(*)::int AS msg_count,
            MIN(m.created_at) AS earliest,
            MAX(m.created_at) AS latest
     FROM messages m
     LEFT JOIN channel_summaries cs
       ON cs.server_id = m.server_id
       AND cs.channel_id = m.channel_id
       AND cs.period_end > now() - interval '1 day'
     WHERE cs.id IS NULL
       AND m.created_at > now() - interval '1 day'
     GROUP BY m.server_id, m.channel_id`,
    []
  );

  for (const channel of channelsResult.rows) {
    if (channel.msg_count < MIN_MESSAGES) continue;

    try {
      const messagesResult = await rawQuery(
        `SELECT display_name, content, created_at
         FROM messages
         WHERE server_id = $1 AND channel_id = $2
           AND created_at BETWEEN $3 AND $4
         ORDER BY created_at ASC`,
        [channel.server_id, channel.channel_id, channel.earliest, channel.latest]
      );

      const prompt = buildSummaryPrompt(
        channel.channel_id,
        messagesResult.rows as { displayName: string; content: string; createdAt: string }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const summary = JSON.parse(response) as {
        summary: string;
        topics: string[];
        decisions: string[];
        openQuestions: string[];
        actionItems: string[];
      };

      const embedding = await ai.generateEmbedding(summary.summary);

      await rawQuery(
        `INSERT INTO channel_summaries (server_id, channel_id, period_start, period_end, summary, topics, decisions, open_questions, action_items, embedding, message_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11)`,
        [
          channel.server_id,
          channel.channel_id,
          channel.earliest,
          channel.latest,
          summary.summary,
          summary.topics,
          summary.decisions,
          summary.openQuestions,
          summary.actionItems,
          `[${embedding.join(',')}]`,
          channel.msg_count,
        ]
      );

      summarized++;
    } catch (err) {
      errors.push(`${channel.channel_id}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', summarized, errors });
});
