import { describe, it, expect, vi } from 'vitest';
import { execute } from '../../commands/lore.js';
import { PermissionFlagsBits } from 'discord.js';

function createInteraction(hasAdminPerm: boolean | null) {
  return {
    options: {
      getString: vi.fn().mockReturnValue('view'),
    },
    memberPermissions: hasAdminPerm === null
      ? null
      : { has: vi.fn().mockReturnValue(hasAdminPerm) },
    reply: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('lore execute — permission enforcement', () => {
  it('rejects with ephemeral error when memberPermissions is null', async () => {
    const interaction = createInteraction(null);
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('permission') })
    );
  });

  it('rejects with ephemeral error when user lacks Administrator', async () => {
    const interaction = createInteraction(false);
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('permission') })
    );
  });

  it('proceeds when user has Administrator', async () => {
    const interaction = createInteraction(true);
    await execute(interaction);
    const replyArg = interaction.reply.mock.calls[0][0];
    const content = typeof replyArg === 'string' ? replyArg : replyArg.content;
    expect(content).not.toContain('permission');
  });
});
