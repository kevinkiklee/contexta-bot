import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/integration/**/*.integration.test.ts'],
    globalSetup: ['src/tests/integration/globalSetup.ts'],
  },
});
