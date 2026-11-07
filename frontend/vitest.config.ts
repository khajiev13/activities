import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/api/__tests__/**/*.test.ts'],
    restoreMocks: true,
  },
});
