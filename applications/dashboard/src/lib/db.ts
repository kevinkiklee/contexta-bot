import pg from 'pg';

const rawUrl = process.env.DATABASE_URL || '';

if (!rawUrl) {
  console.warn('[DB] DATABASE_URL is not set — database queries will fail.');
}

// Parse sslmode from query string before stripping it
const sslmodeMatch = rawUrl.match(/[?&]sslmode=([^&]+)/);
const sslmode = sslmodeMatch?.[1];
const connectionString = rawUrl.split('?')[0];

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const disableSSL = isLocal || sslmode === 'disable' || process.env.DISABLE_DB_SSL === 'true';

export const pool = new pg.Pool({
  connectionString,
  ssl: disableSSL ? false : { rejectUnauthorized: false },
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
