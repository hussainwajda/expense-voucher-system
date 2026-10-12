import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Starts a throwaway PostgreSQL (or uses TEST_DATABASE_URL) and applies migrations once.
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    // Test files share one database, so run them one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
