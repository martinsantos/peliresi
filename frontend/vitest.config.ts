/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src-v6/__tests__/setup.ts'],
    include: ['src-v6/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src-v6/**/*.{ts,tsx}'],
      exclude: ['src-v6/**/*.test.{ts,tsx}', 'src-v6/__tests__/**'],
      thresholds: {
        // Ratchet from the measured night suite, not a claim of full coverage.
        statements: 22,
        branches: 20,
        functions: 17,
        lines: 22,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src-v6'),
    },
  },
});
