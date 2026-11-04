import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

export default defineConfig({ ...base, testMatch: ['psip-notices.spec.ts'], workers: 1, retries: 0, maxFailures: 1,
  timeout: 240_000, outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_PSIP_RUN || 'psip-notices-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, (process.env.QA_PSIP_RUN || 'psip-notices-browser') + '.json') }]],
  use: { ...base.use, trace: 'retain-on-failure', serviceWorkers: 'block' },
});
