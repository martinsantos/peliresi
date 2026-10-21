import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { assertCloudEnvironment } from './safety';

assertCloudEnvironment();
export default defineConfig({
  testDir: './e2e', testMatch: ['manifest-certificates.spec.ts'],
  fullyParallel: false, forbidOnly: true, retries: 0, workers: 1, maxFailures: 1, timeout: 150000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'certificates-e2e-' + (process.env.QA_BROWSER_ATTEMPT || 'initial')),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'certificates-e2e-' + (process.env.QA_BROWSER_ATTEMPT || 'initial') + '.json') }]],
  use: { baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'web-responsive', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
