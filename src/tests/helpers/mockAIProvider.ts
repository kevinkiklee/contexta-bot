import { vi } from 'vitest';
import type { IAIProvider } from '../../llm/IAIProvider.js';

export function createMockAIProvider(overrides?: Partial<IAIProvider>): IAIProvider {
  return {
    generateChatResponse: vi.fn().mockResolvedValue('Mock AI response'),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    summarizeText: vi.fn().mockResolvedValue('Mock summary'),
    createServerContextCache: vi.fn().mockResolvedValue('mock-cache-id'),
    ...overrides,
  };
}
