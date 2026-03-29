import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../lib/backendClient.js', () => ({
  backendGet: vi.fn().mockResolvedValue({ profile: null }),
}));

import { backendGet } from '../../lib/backendClient.js';
import { execute } from '../../commands/profile.js';

const mockBackendGet = vi.mocked(backendGet);

describe('profile command', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows profile data when user exists', async () => {
    mockBackendGet.mockResolvedValue({
      profile: {
        global_name: 'Alice',
        inferred_context: 'Enjoys coding and gaming',
        preferences: { theme: 'dark' },
        interaction_count: 42,
        last_interaction: '2026-03-15T12:00:00Z',
      },
    });
    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-456', username: 'Alice' }),
      },
    });
    await execute(interaction);
    const content = (interaction.reply as any).mock.calls[0][0].content;
    expect(content).toContain('Alice');
    expect(content).toContain('42');
    expect(content).toContain('coding');
  });

  it('reports no profile data', async () => {
    mockBackendGet.mockResolvedValue({ profile: null });
    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-999', username: 'Nobody' }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No profile data'), ephemeral: true })
    );
  });
});
