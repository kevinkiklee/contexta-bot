import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';
import { getBotId } from '../middleware/auth.js';
import { DEFAULT_PERSONALITY, personalityToPrompt } from '@contexta/shared';
import type { Personality } from '@contexta/shared';

export const chatRoutes = new Hono();

chatRoutes.post('/chat', async (c) => {
  const body = await c.req.json();
  const { serverId, systemPrompt, chatHistory } = body;

  if (!serverId || !chatHistory) {
    return c.json({ success: false, error: 'serverId and chatHistory are required' }, 400);
  }

  const botId = getBotId(c);
  let activeModel = 'gemini-2.5-flash';
  let cacheId: string | null = null;

  let personality: Personality = DEFAULT_PERSONALITY;

  try {
    const result = await rawQuery(
      'SELECT active_model, context_cache_id, cache_expires_at, personality FROM server_settings WHERE server_id = $1 AND bot_id = $2',
      [serverId, botId]
    );
    if (result.rows.length > 0) {
      activeModel = result.rows[0].active_model || activeModel;
      if (result.rows[0].context_cache_id && result.rows[0].cache_expires_at) {
        const expiresAt = new Date(result.rows[0].cache_expires_at);
        if (expiresAt > new Date()) {
          cacheId = result.rows[0].context_cache_id;
        }
      }
      if (result.rows[0].personality && typeof result.rows[0].personality === 'object') {
        personality = { ...DEFAULT_PERSONALITY, ...result.rows[0].personality };
      }
    }
  } catch (err) {
    console.warn('[chat] Failed to fetch server settings:', err);
  }

  const ai = getProvider(activeModel);
  const baseLine = 'You are Contexta, an intelligent AI co-host for this Discord server.';
  const personalityLine = personalityToPrompt(personality);
  const loreLine = systemPrompt && systemPrompt !== baseLine ? systemPrompt.replace(baseLine, '').trim() : '';
  const prompt = [baseLine, personalityLine, loreLine].filter(Boolean).join('\n\n');
  const response = await ai.generateChatResponse(prompt, chatHistory, {
    cacheId: cacheId || undefined,
    ttlMinutes: 60,
  });

  return c.json({ response });
});

chatRoutes.post('/summarize', async (c) => {
  const body = await c.req.json();
  const { serverId, text } = body;

  if (!serverId || !text) {
    return c.json({ success: false, error: 'serverId and text are required' }, 400);
  }

  const botId = getBotId(c);
  let activeModel = 'gemini-2.5-flash';
  try {
    const result = await rawQuery(
      'SELECT active_model FROM server_settings WHERE server_id = $1 AND bot_id = $2',
      [serverId, botId]
    );
    if (result.rows.length > 0) {
      activeModel = result.rows[0].active_model || activeModel;
    }
  } catch { /* use default */ }

  const ai = getProvider(activeModel);
  const summary = await ai.summarizeText(text);
  return c.json({ summary });
});
