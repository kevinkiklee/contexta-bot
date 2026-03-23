import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

let pool: InstanceType<typeof Pool>;

const TEST_PREFIX = 'test-server';

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

  const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
});

afterEach(async () => {
  await pool.query(`DELETE FROM channel_memory_vectors WHERE server_id LIKE $1`, [`${TEST_PREFIX}%`]);
});

afterAll(async () => {
  await pool.end();
});

async function insertTestVector(
  serverId: string,
  channelId: string,
  summary: string,
  embedding: number[]
) {
  await pool.query(
    `INSERT INTO channel_memory_vectors (server_id, channel_id, summary_text, embedding, time_start, time_end)
     VALUES ($1, $2, $3, $4::vector, NOW() - INTERVAL '1 hour', NOW())`,
    [serverId, channelId, summary, `[${embedding.join(',')}]`]
  );
}

function makeEmbedding(seed: number): number[] {
  const emb = new Array(768).fill(0);
  emb[0] = seed;
  return emb;
}

async function searchSimilarMemory(
  serverId: string,
  channelId: string,
  embedding: number[],
  limit = 5
) {
  if (!serverId || !channelId) {
    throw new Error('searchSimilarMemory requires non-empty serverId and channelId');
  }
  const { rows } = await pool.query(
    `SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
     FROM channel_memory_vectors
     WHERE server_id = $1 AND channel_id = $2
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [serverId, channelId, `[${embedding.join(',')}]`, limit]
  );
  return rows;
}

describe('database integration', () => {
  it('inserts and queries vectors via searchSimilarMemory with cosine similarity ordering', async () => {
    const serverId = `${TEST_PREFIX}-ordering`;
    const channelId = 'channel-1';

    await insertTestVector(serverId, channelId, 'close match', makeEmbedding(0.9));
    await insertTestVector(serverId, channelId, 'far match', makeEmbedding(0.1));

    const rows = await searchSimilarMemory(serverId, channelId, makeEmbedding(0.9), 5);

    expect(rows.length).toBe(2);
    expect(rows[0].summary_text).toBe('close match');
  });

  it('enforces server isolation via searchSimilarMemory', async () => {
    const channelId = 'channel-shared';
    await insertTestVector(`${TEST_PREFIX}-A`, channelId, 'server A data', makeEmbedding(0.5));
    await insertTestVector(`${TEST_PREFIX}-B`, channelId, 'server B data', makeEmbedding(0.5));

    const rows = await searchSimilarMemory(`${TEST_PREFIX}-A`, channelId, makeEmbedding(0.5), 10);

    expect(rows).toHaveLength(1);
    expect(rows[0].summary_text).toBe('server A data');
  });

  it('enforces channel isolation via searchSimilarMemory', async () => {
    const serverId = `${TEST_PREFIX}-chaniso`;
    await insertTestVector(serverId, 'channel-X', 'channel X data', makeEmbedding(0.5));
    await insertTestVector(serverId, 'channel-Y', 'channel Y data', makeEmbedding(0.5));

    const rows = await searchSimilarMemory(serverId, 'channel-X', makeEmbedding(0.5), 10);

    expect(rows).toHaveLength(1);
    expect(rows[0].summary_text).toBe('channel X data');
  });
});
