import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@contexta/db', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('../../../services/llm/providerRegistry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    generateChatResponse: vi.fn(),
  }),
}));

import { rawQuery } from '@contexta/db';
import { getProvider } from '../../../services/llm/providerRegistry.js';
import { inferProfilesRoutes } from '../../../routes/cron/inferProfiles.js';

const mockRawQuery = vi.mocked(rawQuery);
const mockGetProvider = vi.mocked(getProvider);

describe('Pipeline 4: Profile Inferencer', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/cron', inferProfilesRoutes);
  });

  it('infers profiles for active users', async () => {
    // Active users query
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', server_id: 's1', display_name: 'Alice' }],
      rowCount: 1,
    } as any);

    // User's recent messages
    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { content: 'The Docker build is failing on CI', tags: { topics: ['docker', 'ci'] } },
        { content: 'I fixed the Dockerfile, was a missing COPY step', tags: { topics: ['docker'] } },
        { content: 'Also updated the CI pipeline config', tags: { topics: ['ci'] } },
        { content: 'Should be green now', tags: null },
        { content: 'Yeah the tests pass', tags: null },
      ],
      rowCount: 5,
    } as any);

    // LLM profile response
    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      expertiseTopics: [
        { topic: 'docker', score: 0.85 },
        { topic: 'ci/cd', score: 0.6 },
      ],
      communicationStyle: 'technical',
      verbosity: 'concise',
      technicalLevel: 'high',
      summary: 'Alice is a DevOps-focused developer with strong Docker and CI expertise.',
    }));

    // Existing expertise (empty for new user)
    mockRawQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    // Upsert expertise entries + update server_members
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    const res = await app.request('/api/cron/infer-profiles', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profilesUpdated).toBe(1);
  });

  it('merges scores incrementally with existing expertise', async () => {
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', server_id: 's1', display_name: 'Alice' }],
      rowCount: 1,
    } as any);

    mockRawQuery.mockResolvedValueOnce({
      rows: [
        { content: 'Docker is great', tags: { topics: ['docker'] } },
        { content: 'Love Docker', tags: { topics: ['docker'] } },
        { content: 'Docker all day', tags: { topics: ['docker'] } },
        { content: 'More Docker', tags: { topics: ['docker'] } },
        { content: 'Still Docker', tags: { topics: ['docker'] } },
      ],
      rowCount: 5,
    } as any);

    const mockProvider = mockGetProvider('gemini-2.5-flash');
    vi.mocked(mockProvider.generateChatResponse).mockResolvedValueOnce(JSON.stringify({
      expertiseTopics: [{ topic: 'docker', score: 0.9 }],
      communicationStyle: 'technical',
      verbosity: 'concise',
      technicalLevel: 'high',
      summary: 'Docker expert.',
    }));

    // Existing expertise — old score was 0.6
    mockRawQuery.mockResolvedValueOnce({
      rows: [{ topic: 'docker', score: 0.6, message_count: 50 }],
      rowCount: 1,
    } as any);

    // Upsert calls
    mockRawQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    const res = await app.request('/api/cron/infer-profiles', { method: 'POST' });
    expect(res.status).toBe(200);

    // Verify upsert was called with ON CONFLICT pattern
    expect(mockRawQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.arrayContaining(['u1', 's1', 'docker'])
    );
  });
});
