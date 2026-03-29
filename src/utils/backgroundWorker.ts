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

export interface WorkerStats {
  status: string;
  reason?: string;
  channelsProcessed: number;
  embeddingsCreated: number;
  errors: string[];
}

export async function runSemanticEmbeddingWorker(
  redis: Pick<typeof redisClient, 'sMembers' | 'get' | 'lRange' | 'setEx' | 'del'> = redisClient,
  ai: IAIProvider = new GeminiProvider(),
  db: { query: (text: string, params?: any[]) => Promise<any> } = pool
): Promise<WorkerStats> {
  const LOCK_KEY = 'worker:embedding:running';
  const LOCK_TTL = 300;

  const isRunning = await redis.get(LOCK_KEY);
  if (isRunning) {
    console.log('[Worker] Skipping — another run is already in progress.');
    return { status: 'skipped', reason: 'already_running', channelsProcessed: 0, embeddingsCreated: 0, errors: [] };
  }

  await redis.setEx(LOCK_KEY, LOCK_TTL, '1');
  console.log('[Worker] Starting background semantic embedding sweep...');

  const stats: WorkerStats = { status: 'completed', channelsProcessed: 0, embeddingsCreated: 0, errors: [] };

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

        stats.channelsProcessed++;
        stats.embeddingsCreated++;
      } catch (err) {
        console.error(`[Worker] Error processing channel ${channelId}:`, err);
        stats.errors.push(`channel ${channelId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
    stats.status = 'error';
    stats.errors.push(`fatal: ${(err as Error).message}`);
  } finally {
    await redis.del(LOCK_KEY);
  }

  return stats;
}
