import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../../events/interactionCreate.js';

describe('interactionCreate handler', () => {
  function createBaseInteraction(overrides?: Record<string, any>) {
    return {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      commandName: 'recall',
      client: {
        commands: new Map(),
      },
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
      ...overrides,
    } as any;
  }

  it('ignores non-command interactions', async () => {
    const interaction = createBaseInteraction({
      isChatInputCommand: vi.fn().mockReturnValue(false),
    });
    await execute(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('logs error for unknown command and does not crash', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const interaction = createBaseInteraction();
    await execute(interaction);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No command matching'));
    consoleSpy.mockRestore();
  });

  it('calls execute on a registered command', async () => {
    const mockExecute = vi.fn();
    const commands = new Map([['recall', { execute: mockExecute }]]);
    const interaction = createBaseInteraction({
      client: { commands },
    });

    await execute(interaction);
    expect(mockExecute).toHaveBeenCalledWith(interaction);
  });

  it('replies with error when command throws before reply', async () => {
    const commands = new Map([['recall', {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    }]]);
    const interaction = createBaseInteraction({
      client: { commands },
      replied: false,
      deferred: false,
    });

    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('exception'), ephemeral: true })
    );
  });

  it('follows up with error when command throws after defer', async () => {
    const commands = new Map([['recall', {
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    }]]);
    const interaction = createBaseInteraction({
      client: { commands },
      replied: false,
      deferred: true,
    });

    await execute(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('exception'), ephemeral: true })
    );
  });
});
