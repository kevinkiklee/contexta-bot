import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../helpers/mockDiscord.js';
import { createMockAIProvider } from '../helpers/mockAIProvider.js';

vi.mock('../../utils/rateLimiter.js', () => ({
  isRateLimited: vi.fn().mockReturnValue(false),
}));

vi.mock('../../db/index.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

vi.mock('../../llm/providerRegistry.js', () => ({
  getProvider: vi.fn(),
}));

import { isRateLimited } from '../../utils/rateLimiter.js';
import { query } from '../../db/index.js';
import { getProvider } from '../../llm/providerRegistry.js';
import { execute } from '../../commands/ask.js';

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockQuery = vi.mocked(query);
const mockGetProvider = vi.mocked(getProvider);

describe('ask command', () => {
  let mockAI: ReturnType<typeof createMockAIProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockAI = createMockAIProvider();
    mockGetProvider.mockReturnValue(mockAI);
    mockQuery.mockResolvedValue({ rows: [{ active_model: 'gemini-2.5-flash', server_lore: null }], rowCount: 1 } as any);
  });

  it('rejects when rate limited without deferring', async () => {
    mockIsRateLimited.mockReturnValue(true);
    const interaction = createMockInteraction();
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('too quickly'), ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('calls AI provider and replies with response', async () => {
    mockAI.generateChatResponse = vi.fn().mockResolvedValue('The answer is 42.');
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('What is the meaning of life?'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    expect(mockAI.generateChatResponse).toHaveBeenCalledWith(
      expect.stringContaining('Contexta'),
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', parts: [{ text: 'What is the meaning of life?' }] }),
      ]),
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith('The answer is 42.');
  });

  it('includes server lore in system prompt when available', async () => {
    mockQuery.mockResolvedValue({ rows: [{ active_model: 'gemini-2.5-flash', server_lore: 'This is a pirate server.' }], rowCount: 1 } as any);
    mockAI.generateChatResponse = vi.fn().mockResolvedValue('Arr!');
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('hello'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    const systemPrompt = vi.mocked(mockAI.generateChatResponse).mock.calls[0][0];
    expect(systemPrompt).toContain('pirate server');
  });

  it('defers with ephemeral true when private option is set', async () => {
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('secret question'),
        getBoolean: vi.fn().mockReturnValue(true),
      },
    });
    await execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('handles AI error gracefully', async () => {
    mockAI.generateChatResponse = vi.fn().mockRejectedValue(new Error('API down'));
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('issue')
    );
  });

  it('uses default model when no server settings exist', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    const interaction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue('test'),
        getBoolean: vi.fn().mockReturnValue(false),
      },
    });
    await execute(interaction);
    expect(mockGetProvider).toHaveBeenCalledWith('gemini-2.5-flash');
  });
});
