import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['actor-onboarding-manual.spec.ts'], workers: 1, retries: 0, maxFailures: 1,
  outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_MANUAL_ATTEMPT || 'onboarding-manual-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, (process.env.QA_MANUAL_ATTEMPT || 'onboarding-manual-browser') + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
