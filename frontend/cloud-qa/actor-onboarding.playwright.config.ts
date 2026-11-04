import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['actor-onboarding.spec.ts', 'actor-administration.spec.ts'], workers: 1, retries: 0, maxFailures: 1, timeout: 300_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_BROWSER_ATTEMPT || 'onboarding-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, (process.env.QA_BROWSER_ATTEMPT || 'onboarding-browser') + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
