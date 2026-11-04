import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

export default defineConfig({ ...base, testMatch: ['psip-deadlines.spec.ts'], workers: 1, retries: 0, maxFailures: 1,
  timeout: 240_000, outputDir: path.join(process.env.QA_ARTIFACTS!, 'psip-deadlines-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'psip-deadlines-browser.json') }]],
  use: { ...base.use, trace: 'retain-on-failure', serviceWorkers: 'block', timezoneId: 'UTC' },
});
