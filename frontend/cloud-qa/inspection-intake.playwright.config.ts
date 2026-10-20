import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['inspection-intake.spec.ts'], workers: 1, retries: 0, maxFailures: 1, timeout: 180_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'intake-' + (process.env.QA_BROWSER_ATTEMPT || 'browser')),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'intake-' + (process.env.QA_BROWSER_ATTEMPT || 'browser') + '.json') }]],
  use: { ...base.use, trace: 'retain-on-failure', serviceWorkers: 'block' },
});
