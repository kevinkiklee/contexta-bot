import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../lib/backendClient.js', () => ({
  backendGet: vi.fn().mockResolvedValue({ lore: null }),
  backendPut: vi.fn().mockResolvedValue({ success: true }),
}));

import { backendGet, backendPut } from '../../lib/backendClient.js';
import { execute } from '../../commands/lore.js';

const mockBackendGet = vi.mocked(backendGet);
const mockBackendPut = vi.mocked(backendPut);

describe('lore command', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects non-admin users', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(false) },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('permission'), ephemeral: true })
    );
  });

  it('view returns lore when it exists', async () => {
    mockBackendGet.mockResolvedValue({ lore: 'Fantasy server lore' });
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((n: string) => n === 'action' ? 'view' : null),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Fantasy server lore', ephemeral: true })
    );
  });

  it('view reports no lore configured', async () => {
    mockBackendGet.mockResolvedValue({ lore: null });
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((n: string) => n === 'action' ? 'view' : null),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No lore configured'), ephemeral: true })
    );
  });

  it('update calls backend with correct args', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((n: string) => {
          if (n === 'action') return 'update';
          if (n === 'text') return 'New lore';
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(mockBackendPut).toHaveBeenCalledWith('/api/servers/guild-456/lore', { text: 'New lore' });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('updated'), ephemeral: true })
    );
  });

  it('update action rejects when no text is provided', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getString: vi.fn().mockImplementation((n: string) => {
          if (n === 'action') return 'update';
          if (n === 'text') return null;
          return null;
        }),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('provide the lore text'), ephemeral: true })
    );
    expect(mockBackendPut).not.toHaveBeenCalled();
  });
});
