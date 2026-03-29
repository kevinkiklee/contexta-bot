import { vi } from 'vitest';

export function createMockAttachmentProcessor() {
  return {
    processAttachments: vi.fn().mockResolvedValue(''),
  };
}
