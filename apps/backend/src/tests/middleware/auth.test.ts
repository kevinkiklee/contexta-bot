import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { botAuth, cronAuth } from '../../middleware/auth.js';

describe('botAuth middleware', () => {
  const originalEnv = process.env;
  let app: Hono;

  beforeEach(() => {
    process.env = { ...originalEnv, BOT_API_KEY: 'test-bot-key' };
    app = new Hono();
    app.use('/api/*', botAuth());
    app.post('/api/test', (c) => c.json({ ok: true }));
  });

  afterEach(() => { process.env = originalEnv; });

  it('returns 401 when no Authorization header', async () => {
    const res = await app.request('/api/test', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong key', async () => {
    const res = await app.request('/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
  });

  it('passes with correct key', async () => {
    const res = await app.request('/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-bot-key' },
    });
    expect(res.status).toBe(200);
  });
});

describe('cronAuth middleware', () => {
  const originalEnv = process.env;
  let app: Hono;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
    app = new Hono();
    app.use('/api/cron/*', cronAuth());
    app.post('/api/cron/test', (c) => c.json({ ok: true }));
  });

  afterEach(() => { process.env = originalEnv; });

  it('returns 401 without correct secret', async () => {
    const res = await app.request('/api/cron/test', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('passes with correct secret', async () => {
    const res = await app.request('/api/cron/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    expect(res.status).toBe(200);
  });
});
