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
        statements: 2,
        branches: 0.8,
        functions: 1,
        lines: 2,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src-v6'),
    },
  },
});
