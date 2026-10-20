import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['registration-documents.spec.ts'], workers: 1, retries: 0, maxFailures: 1, timeout: 240_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'receipt-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'receipt-browser.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
