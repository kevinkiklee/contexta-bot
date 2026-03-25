import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const ssl = process.env.DISABLE_DB_SSL === 'true' || isLocal ? false : { rejectUnauthorized: false };

export const pool = new pg.Pool({
  connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
