import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

import { query } from '../../db/index.js';
import { execute } from '../../commands/profile.js';

const mockQuery = vi.mocked(query);

describe('profile command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows profile data when user exists', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        global_name: 'Alice',
        inferred_context: 'Enjoys coding and gaming',
        preferences: { theme: 'dark' },
        interaction_count: 42,
        last_interaction: '2026-03-15T12:00:00Z',
      }],
      rowCount: 1,
    } as any);

    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-456', username: 'Alice' }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Alice'),
        ephemeral: true,
      })
    );
    const content = (interaction.reply as any).mock.calls[0][0].content;
    expect(content).toContain('42');
    expect(content).toContain('coding');
  });

  it('reports when no profile data exists', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-999', username: 'Nobody' }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No profile data'),
        ephemeral: true,
      })
    );
  });
});
