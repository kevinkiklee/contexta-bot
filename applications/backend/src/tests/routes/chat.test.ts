import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn().mockResolvedValue('AI response'),
    summarizeText: vi.fn().mockResolvedValue('Summary text'),
  }),
}));

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn().mockResolvedValue({
    rows: [{ active_model: 'gemini-2.5-flash', context_cache_id: null, cache_expires_at: null }],
    rowCount: 1,
  }),
}));

import { chatRoutes } from '../../routes/chat.js';

describe('chat routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', chatRoutes);
  });

  it('POST /api/chat returns AI response', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: 'guild-1',
        systemPrompt: 'You are helpful',
        chatHistory: [{ role: 'user', parts: [{ text: 'hello' }] }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe('AI response');
  });

  it('POST /api/summarize returns summary', async () => {
    const res = await app.request('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: 'guild-1', text: 'some conversation' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBe('Summary text');
  });

  it('POST /api/chat returns 400 on missing body', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
