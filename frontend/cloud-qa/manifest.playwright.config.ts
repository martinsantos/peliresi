import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { assertCloudEnvironment } from './safety';

assertCloudEnvironment();
export default defineConfig({
  testDir: './e2e', testMatch: ['manifest-transport.spec.ts', 'manifest-lifecycle.spec.ts', 'role-handoff.spec.ts', 'manifest-exceptional.spec.ts'],
  fullyParallel: false, forbidOnly: true, retries: 0, workers: 1, timeout: 90000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'manifest-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'manifest-e2e.json') }]],
  use: { baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'web-responsive', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
