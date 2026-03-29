import { vi } from 'vitest';

export function createMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}
