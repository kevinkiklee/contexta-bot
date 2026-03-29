import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';

vi.mock('../../lib/backendClient.js', () => ({
  backendPut: vi.fn().mockResolvedValue({ success: true }),
  backendPost: vi.fn().mockResolvedValue({ cacheId: 'cached-123' }),
  backendDelete: vi.fn().mockResolvedValue({ success: true }),
}));

import { backendPut, backendPost, backendDelete } from '../../lib/backendClient.js';
import { execute } from '../../commands/settings.js';

const mockBackendPut = vi.mocked(backendPut);
const mockBackendPost = vi.mocked(backendPost);
const mockBackendDelete = vi.mocked(backendDelete);

describe('settings command', () => {
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

  it('model subcommand calls backend and confirms', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getSubcommand: vi.fn().mockReturnValue('model'),
        getString: vi.fn().mockReturnValue('gpt-4o'),
      },
    });
    await execute(interaction);
    expect(mockBackendPut).toHaveBeenCalledWith('/api/servers/guild-456/settings/model', { model: 'gpt-4o' });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('gpt-4o'), ephemeral: true })
    );
  });

  it('model subcommand handles backend error', async () => {
    mockBackendPut.mockRejectedValue(new Error('Service unavailable'));
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getSubcommand: vi.fn().mockReturnValue('model'),
        getString: vi.fn().mockReturnValue('gpt-4o'),
      },
    });
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Cannot switch'), ephemeral: true })
    );
  });

  it('cache clear calls backend delete', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getSubcommand: vi.fn().mockReturnValue('cache'),
        getString: vi.fn().mockReturnValue('clear'),
      },
    });
    await execute(interaction);
    expect(mockBackendDelete).toHaveBeenCalledWith('/api/cache/guild-456');
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('cleared'), ephemeral: true })
    );
  });

  it('cache refresh calls backend post', async () => {
    const interaction = createMockInteraction({
      memberPermissions: { has: vi.fn().mockReturnValue(true) },
      options: {
        getSubcommand: vi.fn().mockReturnValue('cache'),
        getString: vi.fn().mockReturnValue('refresh'),
      },
    });
    await execute(interaction);
    expect(mockBackendPost).toHaveBeenCalledWith('/api/cache/refresh', { serverId: 'guild-456' });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('refreshed'), ephemeral: true })
    );
  });
});
