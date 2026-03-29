import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock('../../llm/providerRegistry.js', () => ({
  getProvider: vi.fn(),
}));

import { query } from '../../db/index.js';
import { getProvider } from '../../llm/providerRegistry.js';
import { execute } from '../../commands/settings.js';

const mockQuery = vi.mocked(query);
const mockGetProvider = vi.mocked(getProvider);

describe('settings command', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'key', OPENAI_API_KEY: 'key', ANTHROPIC_API_KEY: 'key' };
    mockGetProvider.mockReturnValue(createMockAIProvider());
  });

  afterEach(() => {
    process.env = originalEnv;
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

  describe('model subcommand', () => {
    it('updates active_model in database', async () => {
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('model'),
          getString: vi.fn().mockReturnValue('gpt-4o'),
        },
      });
      await execute(interaction);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO server_settings'),
        expect.arrayContaining(['guild-456', 'gpt-4o'])
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('gpt-4o'), ephemeral: true })
      );
    });

    it('rejects when provider API key is missing', async () => {
      mockGetProvider.mockImplementation(() => { throw new Error('OPENAI_API_KEY is required'); });
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
  });

  describe('cache subcommand', () => {
    it('refresh creates cache and stores ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ server_lore: 'Test lore', active_model: 'gemini-2.5-flash' }], rowCount: 1,
      } as any);
      const mockAI = createMockAIProvider();
      mockAI.createServerContextCache = vi.fn().mockResolvedValue('cached-123');
      mockGetProvider.mockReturnValue(mockAI);

      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(mockAI.createServerContextCache).toHaveBeenCalledWith('Test lore', 60);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('context_cache_id'),
        expect.arrayContaining(['cached-123'])
      );
    });

    it('refresh rejects when no lore exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('No server lore'), ephemeral: true })
      );
    });

    it('refresh rejects for non-Gemini models', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ server_lore: 'Lore', active_model: 'gpt-4o' }], rowCount: 1,
      } as any);
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('refresh'),
        },
      });
      await execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('only available with Gemini'), ephemeral: true })
      );
    });

    it('clear nulls cache fields', async () => {
      const interaction = createMockInteraction({
        memberPermissions: { has: vi.fn().mockReturnValue(true) },
        options: {
          getSubcommand: vi.fn().mockReturnValue('cache'),
          getString: vi.fn().mockReturnValue('clear'),
        },
      });
      await execute(interaction);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('context_cache_id = NULL'),
        expect.arrayContaining(['guild-456'])
      );
    });
  });
});
