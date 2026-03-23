import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.split('?')[0]; // Strip sslmode to allow our strict override
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: (isLocal || rawUrl.includes('sslmode=disable') || process.env.DISABLE_DB_SSL === 'true') ? false : { rejectUnauthorized: false }
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Executed query - Duration: ${duration}ms, Rows: ${res.rowCount}`);
  return res;
}

export async function searchSimilarMemory(serverId: string, channelId: string, embedding: number[], limit = 5) {
  // Assuming a 768-dimensional vector from Gemini
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
