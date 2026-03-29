import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildProfilePrompt } from '../../services/llm/prompts.js';

export const inferProfilesRoutes = new Hono();

inferProfilesRoutes.post('/infer-profiles', async (c) => {
  const ai = getProvider('gemini-2.5-flash');
  let profilesUpdated = 0;
  const errors: string[] = [];

  const usersResult = await rawQuery(
    `SELECT DISTINCT m.user_id, m.server_id, m.display_name
     FROM messages m
     WHERE m.created_at > now() - interval '7 days'
       AND m.is_bot = false
     ORDER BY m.server_id, m.user_id`,
    []
  );

  for (const user of usersResult.rows) {
    try {
      const messagesResult = await rawQuery(
        `SELECT content, tags
         FROM messages
         WHERE user_id = $1 AND server_id = $2 AND is_bot = false
         ORDER BY created_at DESC
         LIMIT 100`,
        [user.user_id, user.server_id]
      );

      if (messagesResult.rows.length < 5) continue;

      const prompt = buildProfilePrompt(
        user.display_name,
        messagesResult.rows as { content: string; tags: { topics: string[] } | null }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const profile = JSON.parse(response) as {
        expertiseTopics: { topic: string; score: number }[];
        communicationStyle: string;
        verbosity: string;
        technicalLevel: string;
        summary: string;
      };

      const existingResult = await rawQuery(
        `SELECT topic, score, message_count FROM user_expertise WHERE user_id = $1 AND server_id = $2`,
        [user.user_id, user.server_id]
      );
      const existingMap = new Map(
        (existingResult.rows as { topic: string; score: number; message_count: number }[]).map(r => [r.topic, r])
      );

      for (const expertise of profile.expertiseTopics) {
        const existing = existingMap.get(expertise.topic);
        const mergedScore = existing
          ? 0.7 * existing.score + 0.3 * expertise.score
          : expertise.score;
        const messageCount = existing ? existing.message_count + 1 : 1;

        await rawQuery(
          `INSERT INTO user_expertise (user_id, server_id, topic, score, message_count, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (user_id, server_id, topic)
           DO UPDATE SET score = $4, message_count = $5, last_seen_at = now()`,
          [user.user_id, user.server_id, expertise.topic, mergedScore, messageCount]
        );
      }

      await rawQuery(
        `UPDATE server_members
         SET inferred_context = $3,
             preferences = $4::jsonb
         WHERE user_id = $1 AND server_id = $2`,
        [
          user.user_id,
          user.server_id,
          profile.summary,
          JSON.stringify({
            communication_style: profile.communicationStyle,
            verbosity: profile.verbosity,
            technical_level: profile.technicalLevel,
          }),
        ]
      );

      profilesUpdated++;
    } catch (err) {
      errors.push(`${user.user_id}@${user.server_id}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', profilesUpdated, errors });
});
