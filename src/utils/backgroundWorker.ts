import { redisClient } from './redis.js';
import { pool } from '../db/index.js';
import { GeminiProvider } from '../llm/GeminiProvider.js';

const aiProvider = new GeminiProvider();

/**
 * Periodically processes the Redis channel histories,
 * summarizes them, generates embeddings, and stores them in pgvector.
 */
export async function runSemanticEmbeddingWorker() {
  console.log('[Worker] Starting background semantic embedding sweep...');
  
  try {
    // 1. Find all active channel histories in Redis
    const keys = await redisClient.keys('channel:*:history');
    
    for (const key of keys) {
      // Extract channelId from 'channel:123:history'
      const channelId = key.split(':')[1];
      
      const messages = await redisClient.lRange(key, 0, -1);
      
      // Realistically we want to wait for chunks of >= 10 messages before summarizing
      if (messages.length < 10) continue; 
      
      const rawText = messages.join('\n');
      
      // 2. Generate Summary
      const summary = await aiProvider.summarizeText(rawText);
      console.log(`[Worker] Generated summary for channel ${channelId}`);
      
      // 3. Generate Vector Embedding
      const embedding = await aiProvider.generateEmbedding(summary);
      console.log(`[Worker] Generated embedding [${embedding.length} dims]`);
      
      // 4. Store in pgvector
      // (Assuming we somehow resolve the serverId from mapping, defaulting here)
      const serverId = process.env.DEFAULT_SERVER_ID || 'server-placeholder'; 
      
      const insertQuery = `
        INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
        VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())
      `;
      
      await pool.query(insertQuery, [serverId, channelId, `[${embedding.join(',')}]`]);
      console.log(`[Worker] Success! Inserted memory chunk into DB for channel ${channelId}`);
      
      // Optional: Clear Redis cache for this chunk to cluster cleanly
      // await redisClient.del(key);
    }
  } catch (err) {
    console.error('[Worker] Fatal error running semantic embedding:', err);
  }
}
