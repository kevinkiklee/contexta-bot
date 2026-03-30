import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn().mockResolvedValue('AI response'),
    summarizeText: vi.fn().mockResolvedValue('Summary text'),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }),
}));

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn().mockResolvedValue({
    rows: [{ active_model: 'gemini-2.5-flash', context_cache_id: null, cache_expires_at: null, personality: null }],
    rowCount: 1,
  }),
}));

import { chatRoutes } from '../../routes/chat.js';
import { getProvider } from '../../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';

describe('chat routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api', chatRoutes);

    // Default: server settings query returns a row, knowledge query returns empty
    (rawQuery as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        rows: [{ active_model: 'gemini-2.5-flash', context_cache_id: null, cache_expires_at: null, personality: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
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
    // summarize only calls rawQuery once (server settings), reset mock for this test
    vi.clearAllMocks();
    (rawQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ active_model: 'gemini-2.5-flash' }],
      rowCount: 1,
    });

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

  it('POST /api/chat injects knowledge context into system prompt when knowledge entries exist', async () => {
    // Set up provider mock with generateEmbedding
    const mockProvider = {
      generateChatResponse: vi.fn().mockResolvedValue('AI response with knowledge'),
      summarizeText: vi.fn().mockResolvedValue('Summary text'),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);

    // Override rawQuery: first call = server settings, second call = knowledge entries
    // (beforeEach already set up two mockResolvedValueOnce calls, but we need to
    // override the second one to return actual knowledge rows — reset and re-chain)
    (rawQuery as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce({
        rows: [{ active_model: 'gemini-2.5-flash', context_cache_id: null, cache_expires_at: null, personality: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'fact',
            title: 'Server Rules',
            content: 'No spam allowed.',
            confidence: 0.85,
            source_channel_id: 'ch-1',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        rowCount: 1,
      });

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: 'guild-1',
        systemPrompt: 'You are helpful',
        chatHistory: [{ role: 'user', parts: [{ text: 'what are the rules?' }] }],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe('AI response with knowledge');

    // generateEmbedding should have been called with the user's message
    expect(mockProvider.generateEmbedding).toHaveBeenCalledWith('what are the rules?');

    // generateChatResponse prompt should contain the RELEVANT KNOWLEDGE block
    const promptArg = mockProvider.generateChatResponse.mock.calls[0][0] as string;
    expect(promptArg).toContain('[RELEVANT KNOWLEDGE]');
    expect(promptArg).toContain('Server Rules');
    expect(promptArg).toContain('high confidence');
    expect(promptArg).toContain('[/RELEVANT KNOWLEDGE]');
  });
});
