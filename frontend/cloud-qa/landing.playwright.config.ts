import { defineConfig } from '@playwright/test';

if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Run this review in cloud CI only');
const published = process.env.QA_LANDING_PUBLISHED === 'true';

export default defineConfig({
  testDir: './e2e', testMatch: ['landing-identity.spec.ts', 'attention.spec.ts'],
  workers: 1, retries: 0, timeout: 45000,
  outputDir: '/tmp/sitrep-landing-qa/failures',
  reporter: [['list'], ['json', { outputFile: '/tmp/sitrep-landing-qa/results.json' }]],
  use: { baseURL: published ? 'https://sitrep.ultimamilla.com.ar' : 'http://127.0.0.1:4187', reducedMotion: 'reduce', serviceWorkers: 'block',
    screenshot: 'only-on-failure', trace: 'off' },
  webServer: published ? undefined : [
    { command: 'npx --no-install vite preview --host 127.0.0.1 --port 4187 --strictPort',
      cwd: '..', url: 'http://127.0.0.1:4187', reuseExistingServer: false },
    { command: 'npx --no-install vite preview --config vite.config.app.ts --host 127.0.0.1 --port 4188 --strictPort',
      cwd: '..', url: 'http://127.0.0.1:4188/app/', reuseExistingServer: false },
  ],
});
