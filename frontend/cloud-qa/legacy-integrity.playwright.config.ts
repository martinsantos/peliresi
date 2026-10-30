import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { assertCloudEnvironment } from './safety';

assertCloudEnvironment();
const baseline = process.env.SITREP_QA_RUN === 'legacy-integrity-baseline-20261030';
export default defineConfig({
  testDir: './e2e', testMatch: [baseline ? 'legacy-integrity-baseline.spec.ts' : 'legacy-integrity.spec.ts'],
  fullyParallel: false, forbidOnly: true, retries: 0, workers: 1, maxFailures: 4, timeout: 150000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-e2e.json') }]],
  use: { baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 850 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 393, height: 844 } } },
  ],
});
