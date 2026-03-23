import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err: any) => console.error('[Redis] Client Error', err));
redisClient.on('connect', () => console.log('[Redis] Connected to Redis caching layer'));

export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
