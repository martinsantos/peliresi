import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
      thresholds: {
        statements: 2,
        branches: 3,
        functions: 2,
        lines: 2,
      },
    },
    // Faster startup: don't type-check tests
    typecheck: { enabled: false },
  },
});
