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
    include: [
      'src-v6/__tests__/contexts/AuthContext.test.tsx',
      'src-v6/__tests__/hooks/useConnectivity.test.tsx',
      'src-v6/__tests__/utils/impersonationNavigation.test.ts',
      'src-v6/__tests__/utils/routeAccess.test.ts',
      'src-v6/__tests__/utils/userContext.test.ts',
    ],
    exclude: ['node_modules', 'dist', 'dist-app', '**/._*', '**/.__*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src-v6/contexts/AuthContext.tsx',
        'src-v6/hooks/useConnectivity.ts',
        'src-v6/utils/impersonationNavigation.ts',
        'src-v6/utils/routeAccess.ts',
        'src-v6/utils/userContext.ts',
      ],
      exclude: ['**/._*', '**/.__*'],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 65,
        lines: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src-v6'),
    },
  },
});
