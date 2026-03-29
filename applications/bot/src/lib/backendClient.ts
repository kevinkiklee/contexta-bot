// dotenv is loaded by the entry point (index.ts)

const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:5010').trim().replace(/\/$/, '');
const BOT_API_KEY = (process.env.BOT_API_KEY || 'test_bot_key').trim();

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${BACKEND_URL}${cleanPath}`;
  
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30_000),
    headers: {
      'Authorization': `Bearer ${BOT_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Backend ${path} failed (${res.status}): ${error}`);
  }

  return res.json() as Promise<T>;
}

export const backendPost = <T = any>(path: string, body: Record<string, unknown>) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const backendGet = <T = any>(path: string) =>
  request<T>(path, { method: 'GET' });

export const backendPut = <T = any>(path: string, body: Record<string, unknown>) =>
  request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const backendDelete = <T = any>(path: string) =>
  request<T>(path, { method: 'DELETE' });
