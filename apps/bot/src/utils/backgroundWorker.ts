import { redisClient } from './redis.js';
import { pool } from '../db/index.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';
import type { IAIProvider } from '../llm/IAIProvider.js';

export async function fetchEligibleChannels(
  redis: Pick<typeof redisClient, 'sMembers' | 'get' | 'lRange'>
): Promise<{ channelId: string; serverId: string; messages: string[] }[]> {
  const channelIds = await redis.sMembers('active_channels');
  const eligible: { channelId: string; serverId: string; messages: string[] }[] = [];

  for (const channelId of channelIds) {
    const key = `channel:${channelId}:history`;
    const serverId = await redis.get(`channel:${channelId}:server`);
    if (!serverId) {
      console.warn(`[Worker] No serverId mapping found for channel ${channelId}, skipping.`);
      continue;
    }

    const messages = await redis.lRange(key, 0, -1);
    if (messages.length < 10) continue;

    eligible.push({ channelId, serverId, messages });
  }

  return eligible;
}

export async function summarizeBatch(ai: IAIProvider, messages: string[]): Promise<string> {
  return ai.summarizeText(messages.join('\n'));
}

export async function embedSummary(ai: IAIProvider, summary: string): Promise<number[]> {
  return ai.generateEmbedding(summary);
}

export async function storeMemoryVector(
  db: { query: (text: string, params?: any[]) => Promise<any> },
  serverId: string,
  channelId: string,
  summary: string,
  embedding: number[]
): Promise<void> {
  const insertQuery = `
    INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
    VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())
  `;
  await db.query(insertQuery, [serverId, channelId, summary, `[${embedding.join(',')}]`]);
}

export async function runSemanticEmbeddingWorker(
  redis: Pick<typeof redisClient, 'sMembers' | 'get' | 'lRange'> = redisClient,
  ai: IAIProvider = new GeminiProvider(),
  db: { query: (text: string, params?: any[]) => Promise<any> } = pool
): Promise<void> {
  console.log('[Worker] Starting background semantic embedding sweep...');

  try {
    const channels = await fetchEligibleChannels(redis);

    for (const { channelId, serverId, messages } of channels) {
      try {
        const summary = await summarizeBatch(ai, messages);
        console.log(`[Worker] Generated summary for channel ${channelId}`);

        const embedding = await embedSummary(ai, summary);
        console.log(`[Worker] Generated embedding [${embedding.length} dims]`);

        await storeMemoryVector(db, serverId, channelId, summary, embedding);
        console.log(`[Worker] Inserted memory chunk for channel ${channelId} (server ${serverId})`);
      } catch (err) {
        console.error(`[Worker] Error processing channel ${channelId}:`, err);
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
  }
}
