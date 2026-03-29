import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BOT_API_KEY = process.env.BOT_API_KEY || '';

export async function backendPost<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${BOT_API_KEY}` },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendPut<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function backendDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${BOT_API_KEY}` },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }
  return res.json() as Promise<T>;
}
