import { Hono } from 'hono';
import { rawQuery } from '@contexta/db';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { buildExtractionPrompt } from '../../services/llm/prompts.js';

export const extractKnowledgeRoutes = new Hono();

const CONVERSATION_GAP_MS = 30 * 60 * 1000; // 30 minutes

interface TaggedMessage {
  id: string;
  server_id: string;
  channel_id: string;
  display_name: string;
  content: string;
  created_at: string;
  tags: { topics: string[]; isDecision: boolean; isActionItem: boolean; isReference: boolean; confidence: number };
}

function groupIntoChunks(messages: TaggedMessage[]): TaggedMessage[][] {
  if (messages.length === 0) return [];

  const chunks: TaggedMessage[][] = [];
  let currentChunk: TaggedMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].created_at).getTime();
    const curr = new Date(messages[i].created_at).getTime();
    const sameChannel = messages[i].channel_id === messages[i - 1].channel_id;

    if (sameChannel && curr - prev < CONVERSATION_GAP_MS) {
      currentChunk.push(messages[i]);
    } else {
      chunks.push(currentChunk);
      currentChunk = [messages[i]];
    }
  }
  chunks.push(currentChunk);
  return chunks;
}

function hasKnowledgeSignals(chunk: TaggedMessage[]): boolean {
  const hasDecision = chunk.some(m => m.tags?.isDecision);
  const hasActionItem = chunk.some(m => m.tags?.isActionItem);
  const topicCount = new Set(chunk.flatMap(m => m.tags?.topics || [])).size;
  return hasDecision || hasActionItem || topicCount >= 3;
}

extractKnowledgeRoutes.post('/extract-knowledge', async (c) => {
  const ai = getProvider('gemini-2.5-pro');
  let entriesCreated = 0;
  let linksCreated = 0;
  const errors: string[] = [];

  const result = await rawQuery(
    `SELECT id, server_id, channel_id, display_name, content, created_at, tags
     FROM messages
     WHERE tags IS NOT NULL
       AND tags->>'confidence' != '0'
       AND created_at > now() - interval '2 hours'
     ORDER BY server_id, channel_id, created_at ASC
     LIMIT 500`,
    []
  );

  if (result.rows.length === 0) {
    return c.json({ status: 'completed', entriesCreated: 0, linksCreated: 0, errors: [] });
  }

  const chunks = groupIntoChunks(result.rows as TaggedMessage[]);

  for (const chunk of chunks) {
    if (!hasKnowledgeSignals(chunk)) continue;

    const serverId = chunk[0].server_id;
    const channelId = chunk[0].channel_id;

    try {
      const existingResult = await rawQuery(
        `SELECT id, title, type FROM knowledge_entries
         WHERE server_id = $1 AND is_archived = false
         ORDER BY created_at DESC LIMIT 10`,
        [serverId]
      );

      const prompt = buildExtractionPrompt(
        chunk.map(m => ({ displayName: m.display_name, content: m.content, createdAt: m.created_at })),
        existingResult.rows as { id: string; title: string; type: string }[]
      );

      const response = await ai.generateChatResponse(prompt, []);
      const extracted = JSON.parse(response) as {
        type: string;
        title: string;
        content: string;
        confidence: number;
        linkedEntryIds: string[];
        linkRelationship: string;
      }[];

      for (const entry of extracted) {
        const embedding = await ai.generateEmbedding(`${entry.title}: ${entry.content}`);
        const messageIds = chunk.map(m => m.id);

        const insertResult = await rawQuery(
          `INSERT INTO knowledge_entries (server_id, type, title, content, confidence, source_channel_id, source_message_ids, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
           RETURNING id`,
          [serverId, entry.type, entry.title, entry.content, entry.confidence, channelId, messageIds, `[${embedding.join(',')}]`]
        );

        const newId = insertResult.rows[0]?.id;
        if (!newId) continue;
        entriesCreated++;

        for (const linkedId of entry.linkedEntryIds) {
          try {
            await rawQuery(
              `INSERT INTO knowledge_entry_links (source_id, target_id, relationship, created_by)
               VALUES ($1, $2, $3, 'pipeline')
               ON CONFLICT (source_id, target_id, relationship) DO NOTHING`,
              [newId, linkedId, entry.linkRelationship || 'relates_to']
            );
            linksCreated++;
          } catch (linkErr) {
            // Link to nonexistent entry — skip silently
          }
        }
      }
    } catch (err) {
      errors.push(`chunk in ${channelId}: ${(err as Error).message}`);
    }
  }

  return c.json({ status: 'completed', entriesCreated, linksCreated, errors });
});
