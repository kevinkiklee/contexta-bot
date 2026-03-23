// src/db/index.ts
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Derives PostgreSQL `Pool` connection string and SSL options from a DATABASE_URL-style value.
 *
 * Parses `sslmode` from the query string **before** stripping it, so an explicit
 * `sslmode=disable` is still honoured rather than silently lost.
 *
 * The query string is removed from the connection string because `pg` would otherwise
 * interpret `sslmode` and conflict with our explicit `ssl` option — our `ssl` config is
 * the sole authority.
 *
 * For non-local URLs without `sslmode=disable`, TLS is enabled with
 * `rejectUnauthorized: true` (verify the server certificate in production). Use
 * localhost/127.0.0.1, `sslmode=disable`, or `DISABLE_DB_SSL=true` for local dev.
 */
export function parseDbConfig(
  rawUrl: string,
  disableSslEnv?: string
): {
  connectionString: string;
  ssl: false | { rejectUnauthorized: true };
} {
  const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
  const sslmode = sslmodeMatch?.[1];
  const connectionString = rawUrl.split('?')[0];
  const isLocal =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const disableSSL =
    isLocal || sslmode === 'disable' || disableSslEnv === 'true';
  return {
    connectionString,
    ssl: disableSSL ? false : { rejectUnauthorized: true },
  };
}

const config = parseDbConfig(process.env.DATABASE_URL || '', process.env.DISABLE_DB_SSL);

export const pool = new Pool({
  connectionString: config.connectionString,
  // Fix #5: rejectUnauthorized: true — enforced via parseDbConfig for production URLs.
  ssl: config.ssl,
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
