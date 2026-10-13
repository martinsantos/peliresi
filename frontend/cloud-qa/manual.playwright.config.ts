import { defineConfig, devices } from '@playwright/test';
const published = process.env.QA_MANUAL_PUBLISHED === 'true';
export default defineConfig({
  testDir: './e2e', testMatch: /manual(?:-training)?\.spec\.ts/,
  workers: 1, retries: 0, timeout: 60000,
  outputDir: '/tmp/sitrep-manual-qa/screenshots',
  reporter: [['list'], ['json', { outputFile: '/tmp/sitrep-manual-qa/results.json' }]],
  use: { baseURL: published ? 'https://sitrep.ultimamilla.com.ar' : 'http://127.0.0.1:4186', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'off' },
  webServer: published ? undefined : { command: 'node --experimental-strip-types cloud-qa/manual-server.ts', url: 'http://127.0.0.1:4186/manual/', reuseExistingServer: false, timeout: 15000 },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } }
  ]
});
