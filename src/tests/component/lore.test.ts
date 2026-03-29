import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

import { query } from '../../db/index.js';
import { execute } from '../../commands/lore.js';

const mockQuery = vi.mocked(query);

describe('lore command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin users', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(false) },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('permission'), ephemeral: true })
    );
  });

  it('view action returns lore when it exists', async () => {
    mockQuery.mockResolvedValue({ rows: [{ server_lore: 'This is a fantasy server.' }], rowCount: 1 } as any);
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'view';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('fantasy server'), ephemeral: true })
    );
  });

  it('view action reports when no lore is configured', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'view';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No lore configured'), ephemeral: true })
    );
  });

  it('update action upserts lore and clears cache', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'update';
          if (name === 'text') return 'New lore content';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO server_settings'),
      expect.arrayContaining(['guild-456', 'New lore content'])
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('updated'), ephemeral: true })
    );
  });

  it('update action rejects when no text is provided', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((name: string) => {
          if (name === 'action') return 'update';
          if (name === 'text') return null;
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('provide the lore text'), ephemeral: true })
    );
  });
});
