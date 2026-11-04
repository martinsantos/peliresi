import { defineConfig } from 'vitest/config';
// Lightweight isolated backend checks using the already installed frontend
// test runner. Run from backend/; no DB, browser or dependency installation.
export default defineConfig({
  test: {
    include: ['src/__tests__/manifestProposal.test.ts'],
    environment: 'node', globals: true, maxWorkers: 1, fileParallelism: false,
  },
});
