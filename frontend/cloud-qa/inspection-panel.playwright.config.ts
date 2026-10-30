import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { assertCloudEnvironment } from './safety';

assertCloudEnvironment();
export default defineConfig({
  testDir: './e2e', testMatch: ['inspection-panel.spec.ts'], fullyParallel: false, forbidOnly: true, retries: 0, workers: 1,
  timeout: 120000, outputDir: path.join(process.env.QA_ARTIFACTS!, 'inspection-panel-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'inspection-panel-e2e.json') }]],
  use: { baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 850 } } },
    { name: 'web-responsive', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 800 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 393, height: 844 } } },
  ],
});
