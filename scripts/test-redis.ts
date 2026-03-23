import { initRedis, redisClient } from '../src/utils/redis.js';

async function testRedis() {
  try {
    console.log('[Redis Test] Attempting to connect to Railway Redis...');
    
    // initRedis() calls redisClient.connect()
    await initRedis();
    
    // Test 1: Ping the server
    const pingResponse = await redisClient.ping();
    console.log(`[Redis Test] Ping response: ${pingResponse}`);
    
    // Test 2: Write and read operations
    await redisClient.set('contexta_test_key', 'Connection successful!');
    const val = await redisClient.get('contexta_test_key');
    console.log(`[Redis Test] Retrieved value: ${val}`);
    
    // Cleanup
    await redisClient.del('contexta_test_key');
    await redisClient.disconnect();
    
    console.log('[Redis Test] Success! The caching layer is fully operational.');
  } catch (err) {
    console.error('[Redis Test] Connection failed:', err);
    process.exit(1);
  }
}

testRedis();
