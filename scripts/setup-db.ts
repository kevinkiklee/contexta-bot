import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setup() {
  try {
    console.log('[DB] Applying PostgreSQL schemas...');
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('[DB] Schema execution complete.');
  } catch (err) {
    console.error('[DB] Schema execution error:', err);
  } finally {
    await pool.end();
  }
}

setup();
