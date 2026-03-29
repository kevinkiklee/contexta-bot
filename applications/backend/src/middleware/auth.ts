import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

/** Extract bot_id from X-Bot-Id header, falling back to BOT_CLIENT_ID env var. */
export function getBotId(c: Context): string {
  return c.req.header('X-Bot-Id') || process.env.BOT_CLIENT_ID || 'unknown';
}

export function botAuth() {
  return createMiddleware(async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const expectedKey = process.env.BOT_API_KEY;

    if (!authHeader || !expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    await next();
  });
}

export function cronAuth() {
  return createMiddleware(async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    await next();
  });
}
