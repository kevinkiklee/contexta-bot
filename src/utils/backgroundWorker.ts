import { redisClient } from './redis.js';
import { pool } from '../db/index.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';

const aiProvider = new GeminiProvider();

export async function runSemanticEmbeddingWorker() {
  console.log('[Worker] Starting background semantic embedding sweep...');

  try {
    const keys = await redisClient.keys('channel:*:history');

    for (const key of keys) {
      const channelId = key.split(':')[1];

      // Fix #4: resolve serverId from Redis mapping stored by messageCreate
      const serverId = await redisClient.get(`channel:${channelId}:server`);
      if (!serverId) {
        console.warn(`[Worker] No serverId mapping found for channel ${channelId}, skipping.`);
        continue;
      }

      const messages = await redisClient.lRange(key, 0, -1);
      if (messages.length < 10) continue;

      const rawText = messages.join('\n');

      const summary = await aiProvider.summarizeText(rawText);
      console.log(`[Worker] Generated summary for channel ${channelId}`);

      const embedding = await aiProvider.generateEmbedding(summary);
      console.log(`[Worker] Generated embedding [${embedding.length} dims]`);

      const insertQuery = `
        INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
        VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())
      `;

      await pool.query(insertQuery, [serverId, channelId, summary, `[${embedding.join(',')}]`]);
      console.log(`[Worker] Inserted memory chunk for channel ${channelId} (server ${serverId})`);
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
  }
}
