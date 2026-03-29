import { createClient, type RedisClientType } from 'redis';

export const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
}) as RedisClientType;

redisClient.on('error', (err: any) => console.error('[Redis] Client Error', err));
redisClient.on('connect', () => console.log('[Redis] Connected to Redis'));

export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
