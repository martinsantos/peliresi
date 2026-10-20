import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

export default defineConfig({ ...base, testMatch: ['inspection-exchange.spec.ts', 'psip.spec.ts', 'manual.spec.ts'], workers: 1,
  retries: 0, maxFailures: 1, timeout: 240_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_PSIP_RUN || 'psip-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, (process.env.QA_PSIP_RUN || 'psip-browser') + '.json') }]],
  use: { ...base.use, trace: 'retain-on-failure', serviceWorkers: 'block' },
});
