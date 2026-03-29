import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

export function parseDbConfig(
  rawUrl: string,
  disableSslEnv?: string,
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

const config = parseDbConfig(
  process.env.DATABASE_URL || '',
  process.env.DISABLE_DB_SSL,
);

export const pool = new Pool({
  connectionString: config.connectionString,
  ssl: config.ssl,
});

export const db = drizzle(pool, { schema });

export async function rawQuery(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Executed query - Duration: ${duration}ms, Rows: ${res.rowCount}`);
  return res;
}
