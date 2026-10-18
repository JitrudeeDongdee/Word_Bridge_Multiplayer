import { defineConfig } from 'vitest/config';

// Database rules tests: run against the Firebase emulator via `npm run test:rules`
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
