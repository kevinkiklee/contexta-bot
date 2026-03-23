// src/db/index.ts
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL || '';

// Parse sslmode from query string BEFORE stripping it, so an explicit
// sslmode=disable is still honoured rather than silently lost.
const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
const sslmode = sslmodeMatch?.[1];

// pg parses sslmode from the connection string query params and uses it to configure SSL,
// which would conflict with our explicit `ssl` object. Strip the query string so our
// ssl config is the sole authority.
const connectionString = rawUrl.split('?')[0];

const isLocal =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const disableSSL =
  isLocal ||
  sslmode === 'disable' ||
  process.env.DISABLE_DB_SSL === 'true';

export const pool = new Pool({
  connectionString,
  // Fix #5: rejectUnauthorized: true — verify the server's certificate in production.
  // Set DATABASE_URL with sslmode=disable or DISABLE_DB_SSL=true for local dev.
  ssl: disableSSL ? false : { rejectUnauthorized: true },
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // NOTE: never log `text` or `params` here — they may contain PII.
  console.log(`[DB] Executed query - Duration: ${duration}ms, Rows: ${res.rowCount}`);
  return res;
}

export async function searchSimilarMemory(
  serverId: string,
  channelId: string,
  embedding: number[],
  limit = 5
) {
  if (!serverId || !channelId) {
    throw new Error('[DB] searchSimilarMemory requires non-empty serverId and channelId');
  }

  const textQuery = `
    SELECT id, summary_text, time_start, time_end, 1 - (embedding <=> $3::vector) AS similarity
    FROM channel_memory_vectors
    WHERE server_id = $1 AND channel_id = $2
    ORDER BY embedding <=> $3::vector
    LIMIT $4;
  `;
  const values = [serverId, channelId, `[${embedding.join(',')}]`, limit];
  const { rows } = await query(textQuery, values);
  return rows;
}
